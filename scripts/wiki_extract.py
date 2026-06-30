"""
Shared HTML parsing logic for ehwiki tag pages. Used by both extract-wiki-tags.py
(full corpus extract) and fetch-wiki-tags.py (incremental fetch+extract).
"""
from __future__ import annotations
import gzip
import json
import os
import re
import time
from pathlib import Path

CATEGORIES = ['tag', 'character', 'creator', 'language', 'series']

# Wiki category page names, for any caller that needs to walk indices
CATEGORY_PATHS = {
    'tag': 'Category:Tag',
    'character': 'Category:Character_Tag',
    'creator': 'Category:Creator_Tag',
    'language': 'Category:Language_Tag',
    'series': 'Category:Series_Tag',
}


class ExtractFetchError(Exception):
    """HTML missing mw-parser-output div — likely fetch error / redirect / login wall,
    NOT a real wiki content page. Caller should keep existing entry instead of removing."""

BODY_RE = re.compile(
    r'<div class="mw-content-ltr mw-parser-output"[^>]*>(.*?)<div class="printfooter"',
    re.DOTALL,
)
COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)
REMINDER_RE = re.compile(r'<p><b>Reminder:</b>.*?</p>', re.DOTALL)
HR_SPLIT = re.compile(r'<hr\s*/?>')
UL_RE = re.compile(r'<ul>(.*?)</ul>', re.DOTALL)
LI_RE = re.compile(r'<li>(.*?)</li>', re.DOTALL)
KV_RE = re.compile(r'(?:<a[^>]*>)?<b>([^<]+)</b>(?:</a>)?:?\s*(.*)', re.DOTALL)
TAG_STRIP = re.compile(r'<[^>]+>')
WS_RE = re.compile(r'\s+')

ENTITY_MAP = {
    '&amp;': '&',
    '&nbsp;': ' ',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#160;': ' ',
    '&#39;': "'",
}

KEY_NORMALIZE = {
    'Note:': 'Note',
    'Notes': 'Note',
    'Related characters:': 'Related characters',
    'Slave tags:': 'Slave Tags',
    'Human form:': 'Human form',
}

SHARED_HINTS = {'Slave Tags'}


def clean_text(raw: str) -> str:
    text = TAG_STRIP.sub('', raw)
    for ent, ch in ENTITY_MAP.items():
        text = text.replace(ent, ch)
    return WS_RE.sub(' ', text).strip()


def normalize_key(key: str) -> str:
    key = key.strip()
    return KEY_NORMALIZE.get(key, key)


def parse_ul_chunk(chunk_html: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for ul_match in UL_RE.findall(chunk_html):
        for li in LI_RE.findall(ul_match):
            m = KV_RE.match(li.strip())
            if not m:
                continue
            key = normalize_key(m.group(1))
            value = clean_text(m.group(2))
            if key not in fields:
                fields[key] = value
    return fields


def extract_one(html: str) -> dict | None:
    """Parse a wiki page HTML.

    Returns:
        dict — parsed fields (variants + shared)
        None — page has wiki body but no parseable KV fields (DNP-like, safe to remove)

    Raises:
        ExtractFetchError — no wiki body div found (caller should NOT treat as remove)
    """
    body_m = BODY_RE.search(html)
    if not body_m:
        raise ExtractFetchError('no mw-parser-output div')
    body = COMMENT_RE.sub('', body_m.group(1))
    body = REMINDER_RE.sub('', body)

    chunks = HR_SPLIT.split(body)
    parsed_chunks = [parse_ul_chunk(c) for c in chunks]
    parsed_chunks = [
        {k: v for k, v in c.items() if v}
        for c in parsed_chunks
    ]
    parsed_chunks = [c for c in parsed_chunks if c]

    if not parsed_chunks:
        return None

    if len(parsed_chunks) == 1:
        return {'variants': [parsed_chunks[0]], 'shared': {}}

    last = parsed_chunks[-1]
    if set(last.keys()).issubset(SHARED_HINTS):
        return {'variants': parsed_chunks[:-1], 'shared': last}
    return {'variants': parsed_chunks, 'shared': {}}


def build_payload(entries: dict[str, dict]) -> dict:
    return {
        'version': 1,
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
