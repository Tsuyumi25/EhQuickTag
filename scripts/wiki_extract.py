"""
Shared HTML parsing logic for ehwiki tag pages. Used by both extract-wiki-tags.py
(full corpus extract) and fetch-wiki-tags.py (incremental fetch+extract).

Hybrid lxml + regex approach — DOM for structural navigation, regex for
localized text cleanup:

  DOM (lxml):
    - find mw-parser-output container (CSS selector, no attr order fragility)
    - strip noise attributes (class / data-* / typeof / dir / lang / decoding)
    - rewrite relative /wiki/ /images/ URLs to absolute (make_links_absolute
      handles href AND src in one call, replaces 3 old regex)
    - split by <hr/> → variants
    - split by <ul> → prelude + blocks (each ul + trailing siblings until
      next ul; last ul splits trailing off as its own block)
    - recursively unwrap guidance <dl> (dl without <dt>, just <dd>) → flat
      <p> sequence, no fixed-point iteration upper bound

  regex (on serialized block HTML):
    - rewrite <ul><li><b>K</b>: V</li></ul> → <dl><dt>K</dt><dd>V</dd></dl>
      (KV pattern; bounded to single top-level ul per block, no nesting)
    - collapse whitespace between tags for compact output
    - strip trailing empty <p><br/></p>

Payload version 3 — schema:
  entries[<cat>/<slug>] = [
    { "prelude": str, "blocks": list[str] },  # one variant
    ...                                       # disambig pages have more
  ]
"""
from __future__ import annotations
import gzip
import json
import os
import re
import time
from pathlib import Path

import lxml.html
from lxml import etree

CATEGORIES = ['tag', 'character', 'creator', 'language', 'series']

# Wiki category page names, for any caller that needs to walk indices
CATEGORY_PATHS = {
    'tag': 'Category:Tag',
    'character': 'Category:Character_Tag',
    'creator': 'Category:Creator_Tag',
    'language': 'Category:Language_Tag',
    'series': 'Category:Series_Tag',
}

EHWIKI_BASE = 'https://ehwiki.org/'


class ExtractFetchError(Exception):
    """HTML missing mw-parser-output div — likely fetch error / redirect / login wall,
    NOT a real wiki content page. Caller should keep existing entry instead of removing."""


# ── DOM cleanup phase ──

NOISE_ATTRS = {'class', 'typeof', 'dir', 'lang', 'decoding'}


def strip_noise_attrs(root: etree._Element) -> None:
    """Remove class / typeof / dir / lang / decoding + all data-* attributes from every
    element. ehwiki 的 mw-* class name 跟 EH 站 CSS 或 plugin 自己的 selector
    容易亂撞，data-* 只有 MediaWiki 內部標記用途對我們沒意義"""
    for el in root.iter():
        for attr in list(el.attrib.keys()):
            if attr in NOISE_ATTRS or attr.startswith('data-'):
                del el.attrib[attr]


def strip_comments(root: etree._Element) -> None:
    """MediaWiki parser 塞了大量 <!-- NewPP limit report --> / cache time 等 comment，
    對我們無意義。etree.strip_elements 遞迴移除、保留 tail text"""
    etree.strip_elements(root, etree.Comment, with_tail=False)


# ── Split logic ──

def split_children_by_hr(container: etree._Element) -> list[list[etree._Element]]:
    """Group container 的 direct children by <hr/> boundaries."""
    groups: list[list[etree._Element]] = [[]]
    for child in container:
        if child.tag == 'hr':
            groups.append([])
        else:
            groups[-1].append(child)
    return [g for g in groups if g]


def split_variant_by_ul(elements: list[etree._Element]) -> dict:
    """Split a variant's top-level elements into { prelude, blocks[] }.

    prelude = elements before first <ul>
    blocks  = each <ul> + trailing non-<ul> siblings until next <ul>
              (so ul→dl→ul yields ['ul+dl', 'ul'])
              EXCEPT trailing after the LAST <ul> — splits off as its own
              block (footer-style notes like <p><i>See character page</i></p>
              shouldn't be glued to preceding metadata ul)

    Edge case: no <ul> at all → prelude=all, blocks=[].
    """
    ul_indices = [i for i, e in enumerate(elements) if e.tag == 'ul']
    if not ul_indices:
        return {'prelude': serialize_elements(elements), 'blocks': []}

    prelude_elements = elements[:ul_indices[0]]
    raw_blocks: list[list[etree._Element]] = []
    for i, idx in enumerate(ul_indices):
        if i + 1 < len(ul_indices):
            # non-last ul: attach trailing siblings until next ul
            raw_blocks.append(elements[idx:ul_indices[i + 1]])
        else:
            # last ul: keep just <ul>, trailing splits off
            raw_blocks.append([elements[idx]])
            trailing = elements[idx + 1:]
            if trailing:
                raw_blocks.append(trailing)

    prelude_html = serialize_elements(prelude_elements)
    blocks = []
    for block_elements in raw_blocks:
        block_html = serialize_elements(block_elements)
        block_html = rewrite_ul_to_dl(block_html)
        block_html = collapse_whitespace(block_html)
        if block_html:
            blocks.append(block_html)
    prelude_html = collapse_whitespace(prelude_html)
    return {'prelude': prelude_html, 'blocks': blocks}


# ── DOM: unwrap guidance <dl> ──

def unwrap_guidance_dl(root: etree._Element) -> None:
    """Recursively replace <dl>-without-<dt> (guidance style, ehwiki 用 `:::`
    wikitext 產生的純視覺縮排) with a flat <p> sequence from its <dd>s.

    Bottom-up traversal (innermost dl first) so nested guidance flattens
    correctly without needing fixed-point iteration."""
    # depth-first order via iter(), then reverse to get innermost-first
    dls = list(root.iter('dl'))
    dls.reverse()

    for dl in dls:
        parent = dl.getparent()
        if parent is None:
            continue  # already removed by outer pass
        # KV dl (has <dt>) — preserve as-is
        if any(child.tag == 'dt' for child in dl):
            continue

        # Convert each <dd> to <p>
        ps: list[etree._Element] = []
        for dd in dl:
            if dd.tag != 'dd':
                continue
            p = etree.Element('p')
            p.text = dd.text
            for c in list(dd):
                p.append(c)  # detach from dd, attach to p
            # 若 dd 已被前一輪 unwrap 過裡面只有一個 <p> 且沒 text → 用內層 p 取代
            # 避免 <p><p>...</p></p> 巢套（雖然 browser 會 auto-close，但視覺會多一段空 p）。
            # `not (p[0].tail or '').strip()` 匹配 None / '' / 只有 whitespace 三種
            # falsy 情況——前輪 tail 處理可能塞 empty string 或深巢狀 dl 內的 whitespace
            if (
                p.text is None
                and len(p) == 1
                and p[0].tag == 'p'
                and not (p[0].tail or '').strip()
            ):
                ps.append(p[0])
            elif p.text or len(p) > 0:
                ps.append(p)

        # Replace dl in parent with the p sequence
        idx = list(parent).index(dl)
        for i, p in enumerate(ps):
            parent.insert(idx + i, p)
        # 處理 tail：dl.tail 該接到最後一個 p 的 tail 之後，或若沒 p 就接前一個 sibling
        if ps:
            last = ps[-1]
            last.tail = (last.tail or '') + (dl.tail or '')
        elif idx > 0:
            prev = parent[idx - 1]
            prev.tail = (prev.tail or '') + (dl.tail or '')
        else:
            parent.text = (parent.text or '') + (dl.tail or '')
        parent.remove(dl)


# ── Serialize helpers ──

def serialize_elements(elements: list[etree._Element]) -> str:
    """Concat serialized HTML of each element (含 tail text)."""
    parts = []
    for e in elements:
        parts.append(etree.tostring(e, encoding='unicode', method='html', with_tail=True))
    return ''.join(parts).strip()


# ── Regex cleanup phase ──

# <ul><li><b>Key</b>: Val</li>...</ul> → <dl><dt>Key</dt><dd>Val</dd>...</dl>：
# 讓 v-html 渲染時可以像 trans db 側那樣走 dt 標題 + dd 內容的樣式。<b> 內可能含
# <a>（例：Power Requirement 的 Power 有 wiki link 包住），所以 key 用 .*? non-greedy
UL_KV_RE = re.compile(r'<ul>(.*?)</ul>', re.DOTALL)
LI_KV_RE = re.compile(
    r'<li>\s*(?:<a[^>]*>)?<b>(.*?)</b>(?:</a>)?\s*:?\s*(.*?)\s*</li>',
    re.DOTALL,
)
WS_BETWEEN_TAGS_RE = re.compile(r'>\s+<')
TRAILING_EMPTY_P_RE = re.compile(r'(?:<p>\s*(?:<br\s*/?>\s*)?</p>\s*)+$')


LI_ANY_RE = re.compile(r'<li>(.*?)</li>', re.DOTALL)


def rewrite_ul_to_dl(html: str) -> str:
    """把 `<ul><li><b>Key</b>: Val</li>...</ul>` 改寫成 `<dl><dt>Key</dt><dd>Val</dd>...</dl>`。
    只在 ul 內**所有** <li> 都符合 KV pattern 時才改寫；任一 li 不符合就整個 ul 原樣
    保留，避免不匹配的 li 被靜默丟掉。

    這步走 regex 因為每個 block 保證頂層一個 <ul>，沒巢狀，closed set 適合 regex"""
    def repl(m: re.Match) -> str:
        inner = m.group(1)
        total_lis = LI_ANY_RE.findall(inner)
        if not total_lis:
            return m.group(0)
        parts: list[str] = []
        for li_m in LI_KV_RE.finditer(inner):
            key = li_m.group(1).strip()
            val = li_m.group(2).strip()
            parts.append(f'<dt>{key}</dt><dd>{val}</dd>')
        if len(parts) != len(total_lis):
            return m.group(0)  # 部分 li 不匹配 KV，整個 ul 保留
        return '<dl>' + ''.join(parts) + '</dl>'
    return UL_KV_RE.sub(repl, html)


def collapse_whitespace(html: str) -> str:
    """Collapse `>  <` → `><` 縮小 payload；順手剝末尾空 <p>。"""
    html = WS_BETWEEN_TAGS_RE.sub('><', html)
    html = TRAILING_EMPTY_P_RE.sub('', html)
    return html.strip()


# ── Main entry ──

def extract_one(html: str) -> list[dict] | None:
    """Parse a wiki page HTML.

    Returns:
        list[dict] — one { prelude, blocks[] } per variant (split by <hr/>)
        None       — body div exists but is empty after cleanup (DNP-like, safe to remove)

    Raises:
        ExtractFetchError — no wiki body div found (caller should NOT treat as remove)
    """
    try:
        doc = lxml.html.fromstring(html)
    except (etree.ParserError, ValueError):
        raise ExtractFetchError('lxml parse failed')

    # find_class 走內建 class-token 匹配，不用另裝 cssselect
    body_list = [el for el in doc.find_class('mw-parser-output') if el.tag == 'div']
    if not body_list:
        raise ExtractFetchError('no mw-parser-output div')
    body = body_list[0]

    # 1. Global cleanup (DOM level)
    strip_comments(body)
    strip_noise_attrs(body)
    body.make_links_absolute(EHWIKI_BASE)

    # 2. DOM-level guidance dl unwrap (recursive, no fixed-point upper bound)
    unwrap_guidance_dl(body)

    # 3. Split by <hr/> → variants
    variant_groups = split_children_by_hr(body)
    if not variant_groups:
        return None

    # 4. For each variant: split by <ul> + regex rewrite ul→dl + cleanup
    parsed = []
    for group in variant_groups:
        result = split_variant_by_ul(group)
        if result['prelude'] or result['blocks']:
            parsed.append(result)
    return parsed or None


def build_payload(entries: dict[str, list[dict]]) -> dict:
    return {
        'version': 3,
        'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'entries': entries,
    }


def write_json_gz(payload: dict, out_gz: Path) -> int:
    """Atomic write of gzipped JSON. Writes to .tmp then os.replace —
    crash mid-write leaves the previous file intact instead of truncated."""
    text = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    tmp = out_gz.with_suffix(out_gz.suffix + '.tmp')
    out_gz.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(tmp, 'wb', compresslevel=9) as f:
        f.write(text.encode('utf-8'))
    os.replace(tmp, out_gz)
    return len(text)


def read_json_gz(path: Path) -> dict:
    with gzip.open(path, 'rb') as f:
        return json.loads(f.read().decode('utf-8'))
