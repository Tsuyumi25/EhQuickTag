"""
Extract structured data from local ehwiki HTML cache → single JSON.

Per page output:
  {
    "category": "tag|character|creator|language|series",
    "variants": [ { "<Key>": "<value text>", ... }, ... ],  # >1 if disambig
    "shared": { "<Key>": "<value text>", ... }  # fields appearing after last <hr>
  }

Skips DNP-style pages with no <li><b>KEY</b>: VALUE entries at all.
"""
from __future__ import annotations
import gzip
import json
import re
import sys
import time
from pathlib import Path

CACHE = Path.home() / 'eh-wiki-cache'
OUT_JSON = Path.home() / 'eh-wiki-extract.json'
OUT_JSON_GZ = Path.home() / 'eh-wiki-extract.json.gz'
CATEGORIES = ['tag', 'character', 'creator', 'language', 'series']

# Content area: between <div class="mw-content-ltr mw-parser-output"> and printfooter
BODY_RE = re.compile(
    r'<div class="mw-content-ltr mw-parser-output"[^>]*>(.*?)<div class="printfooter"',
    re.DOTALL,
)
# Drop wiki internal comments (NewPP report, parser cache info)
COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)
# Drop the "Reminder: Tags require..." paragraph (only on Category:Tag pages)
REMINDER_RE = re.compile(
    r'<p><b>Reminder:</b>.*?</p>', re.DOTALL,
)
# Split on <hr ...> (disambig groups). MediaWiki emits <hr /> or <hr/>
HR_SPLIT = re.compile(r'<hr\s*/?>')
# Within a chunk, find <ul>...</ul> blocks (chunks may have multiple <ul>)
UL_RE = re.compile(r'<ul>(.*?)</ul>', re.DOTALL)
# Within a <ul>, find <li>...</li> entries
LI_RE = re.compile(r'<li>(.*?)</li>', re.DOTALL)
# Within a <li>, find <b>KEY</b>: VALUE (KEY may be wrapped in <a>...<b>)
KV_RE = re.compile(r'(?:<a[^>]*>)?<b>([^<]+)</b>(?:</a>)?:?\s*(.*)', re.DOTALL)
# Strip tags + normalize whitespace
TAG_STRIP = re.compile(r'<[^>]+>')
WS_RE = re.compile(r'\s+')
# Decode common HTML entities
ENTITY_MAP = {
    '&amp;': '&',
    '&nbsp;': ' ',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#160;': ' ',
    '&#39;': "'",
}

# Key name normalization (collapse trailing-colon variants and known aliases)
KEY_NORMALIZE = {
    'Note:': 'Note',
    'Notes': 'Note',
    'Related characters:': 'Related characters',
    'Related characters': 'Related characters',
    'Slave tags:': 'Slave Tags',
    'Human form:': 'Human form',
}


def clean_text(raw: str) -> str:
    """Strip HTML tags, decode entities, normalize whitespace."""
    text = TAG_STRIP.sub('', raw)
    for ent, ch in ENTITY_MAP.items():
        text = text.replace(ent, ch)
    text = WS_RE.sub(' ', text).strip()
    return text


def normalize_key(key: str) -> str:
    key = key.strip()
    return KEY_NORMALIZE.get(key, key)


def parse_ul_chunk(chunk_html: str) -> dict[str, str]:
    """Parse one chunk's <ul><li><b>KEY</b>: VALUE</li></ul> entries."""
    fields: dict[str, str] = {}
    for ul_match in UL_RE.findall(chunk_html):
        for li in LI_RE.findall(ul_match):
            m = KV_RE.match(li.strip())
            if not m:
                continue
            key = normalize_key(m.group(1))
            value = clean_text(m.group(2))
            # First wins on duplicate keys within same chunk
            if key not in fields:
                fields[key] = value
    return fields


def extract_one(html: str) -> dict | None:
    body_m = BODY_RE.search(html)
    if not body_m:
        return None
    body = body_m.group(1)
    body = COMMENT_RE.sub('', body)
    body = REMINDER_RE.sub('', body)

    # Split by <hr/> → each chunk is one variant (or shared footer)
    chunks = HR_SPLIT.split(body)
    parsed_chunks = [parse_ul_chunk(c) for c in chunks]
    # Drop empty-string values, then drop chunks left with no fields
    parsed_chunks = [
        {k: v for k, v in c.items() if v}
        for c in parsed_chunks
    ]
    parsed_chunks = [c for c in parsed_chunks if c]

    if not parsed_chunks:
        return None  # DNP / structurally empty

    if len(parsed_chunks) == 1:
        return {'variants': [parsed_chunks[0]], 'shared': {}}

    # Multiple chunks: last one is "shared footer" if it contains Slave Tags-only
    # OR small (≤2 fields) suggesting it's not a real variant.
    # Heuristic: if last chunk has ONLY shared-style keys (Slave Tags), treat as shared.
    SHARED_HINTS = {'Slave Tags'}
    last = parsed_chunks[-1]
    if set(last.keys()).issubset(SHARED_HINTS):
        return {'variants': parsed_chunks[:-1], 'shared': last}
    return {'variants': parsed_chunks, 'shared': {}}


def main() -> None:
    out: dict[str, dict] = {}
    skipped = 0
    failed = 0
    by_cat: dict[str, int] = {}
    by_cat_skipped: dict[str, int] = {}

    t0 = time.time()
    for cat in CATEGORIES:
        cat_dir = CACHE / cat
        if not cat_dir.exists():
            continue
        for f in sorted(cat_dir.glob('*.html')):
            html = f.read_text(errors='replace')
            data = extract_one(html)
            if data is None:
                skipped += 1
                by_cat_skipped[cat] = by_cat_skipped.get(cat, 0) + 1
                continue
            slug = f.stem
            key = f'{cat}/{slug}'
            data['category'] = cat
            out[key] = data
            by_cat[cat] = by_cat.get(cat, 0) + 1

    elapsed = time.time() - t0
    print(f'extracted: {len(out)} entries in {elapsed:.1f}s', file=sys.stderr)
    print(f'  by category: {by_cat}', file=sys.stderr)
    print(f'  skipped: {skipped} ({by_cat_skipped})', file=sys.stderr)

    payload = {
        'version': 1,
        'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'entries': out,
    }
    json_text = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    OUT_JSON.write_text(json_text)
    with gzip.open(OUT_JSON_GZ, 'wb', compresslevel=9) as f:
        f.write(json_text.encode('utf-8'))
    print(
        f'wrote {OUT_JSON} ({len(json_text):,} bytes) + {OUT_JSON_GZ} ({OUT_JSON_GZ.stat().st_size:,} bytes)',
        file=sys.stderr,
    )


if __name__ == '__main__':
    main()
