"""
Analyze the local ehwiki cache to find key distribution + edge cases.

Per category, report:
  - Total pages
  - Unique <b>KEY</b> labels found + occurrence count + %
  - Pages that have NO content extractor match (likely structure deviation)
  - Sample values for each key
"""
from __future__ import annotations
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

CACHE = Path.home() / 'eh-wiki-cache'
CATEGORIES = ['tag', 'character', 'creator', 'language']

# Body content: between <div class="mw-content-ltr mw-parser-output"> and end of that div
BODY_RE = re.compile(
    r'<div class="mw-content-ltr mw-parser-output"[^>]*>(.*?)<div class="printfooter"',
    re.DOTALL,
)
# <li><b>KEY</b>: VALUE (VALUE goes until </li>)
# Also handle <li><a ...><b>KEY</b></a> form
LI_KEY_RE = re.compile(
    r'<li>(?:<a[^>]*>)?<b>([^<]+)</b>:?\s*(.*?)</li>',
    re.DOTALL,
)
# Strip tags for VALUE preview
TAG_STRIP = re.compile(r'<[^>]+>')


def extract_body(html: str) -> str | None:
    m = BODY_RE.search(html)
    return m.group(1) if m else None


def extract_keys(body: str) -> list[tuple[str, str]]:
    """Return [(KEY, raw_value_html), ...]"""
    return LI_KEY_RE.findall(body)


def value_preview(raw: str, max_len: int = 100) -> str:
    text = TAG_STRIP.sub('', raw).strip()
    text = re.sub(r'\s+', ' ', text)
    return text[:max_len] + ('…' if len(text) > max_len else '')


def analyze_category(cat: str) -> dict:
    files = sorted((CACHE / cat).glob('*.html'))
    stats = {
        'total': len(files),
        'no_body': [],
        'no_keys': [],
        'key_counts': Counter(),
        'key_samples': defaultdict(list),
        'unrecognized_structure': [],
    }
    for f in files:
        html = f.read_text(errors='replace')
        body = extract_body(html)
        if body is None:
            stats['no_body'].append(f.name)
            continue
        keys = extract_keys(body)
        if not keys:
            stats['no_keys'].append(f.name)
            continue
        seen_in_this_page = set()
        for key, raw_val in keys:
            key_norm = key.strip()
            stats['key_counts'][key_norm] += 1
            if key_norm not in seen_in_this_page:
                seen_in_this_page.add(key_norm)
                # Keep up to 3 sample values per key, with filename
                if len(stats['key_samples'][key_norm]) < 3:
                    stats['key_samples'][key_norm].append(
                        (f.name, value_preview(raw_val))
                    )
    return stats


def print_report(cat: str, stats: dict) -> None:
    total = stats['total']
    print(f'\n{"=" * 60}')
    print(f'Category: {cat}  (total: {total} files)')
    print('=' * 60)
    print(f'no_body:           {len(stats["no_body"])}')
    print(f'no_keys (body OK): {len(stats["no_keys"])}')
    if stats['no_body']:
        print(f'  no_body samples: {stats["no_body"][:5]}')
    if stats['no_keys']:
        print(f'  no_keys samples: {stats["no_keys"][:5]}')
    print(f'\nKey distribution (count / pct):')
    for key, cnt in sorted(stats['key_counts'].items(), key=lambda x: -x[1]):
        pct = cnt / total * 100
        print(f'  {key:30s} {cnt:>5d}  {pct:>5.1f}%')
        for fname, val in stats['key_samples'][key][:2]:
            print(f'      └─ {fname}: {val}')


def main() -> None:
    if not CACHE.exists():
        print(f'cache dir not found: {CACHE}', file=sys.stderr)
        sys.exit(1)
    for cat in CATEGORIES:
        if not (CACHE / cat).exists():
            print(f'skipping {cat} (no dir)', file=sys.stderr)
            continue
        stats = analyze_category(cat)
        print_report(cat, stats)


if __name__ == '__main__':
    main()
