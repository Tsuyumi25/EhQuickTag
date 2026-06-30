"""
Analyze the local ehwiki cache to find key distribution + edge cases.

Per category, report:
  - Total pages
  - Unique <b>KEY</b> labels found + occurrence count + %
  - Pages that have NO content extractor match (likely structure deviation)
  - Sample values for each key

Uses the same body extraction + comment/reminder stripping as wiki_extract,
so analysis output reflects what production extractor actually sees.
"""
from __future__ import annotations
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from wiki_extract import (  # noqa: E402
    CATEGORIES, BODY_RE, COMMENT_RE, REMINDER_RE, LI_RE, KV_RE, TAG_STRIP,
)

CACHE = Path.home() / 'eh-wiki-cache'


def extract_raw_kvs(html: str) -> list[tuple[str, str]] | None:
    """Return raw [(KEY, raw_value_html), ...] without normalization, preserving
    duplicates within page (so analyser can spot keys appearing twice — e.g.
    ai_generated's dual Description). Returns None if no wiki body found."""
    body_m = BODY_RE.search(html)
    if body_m is None:
        return None
    body = COMMENT_RE.sub('', body_m.group(1))
    body = REMINDER_RE.sub('', body)
    out: list[tuple[str, str]] = []
    for li in LI_RE.findall(body):
        m = KV_RE.match(li.strip())
        if m:
            out.append((m.group(1).strip(), m.group(2)))
    return out


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
    }
    for f in files:
        html = f.read_text(errors='replace')
        kvs = extract_raw_kvs(html)
        if kvs is None:
            stats['no_body'].append(f.name)
            continue
        if not kvs:
            stats['no_keys'].append(f.name)
            continue
        seen_in_this_page = set()
        for key, raw_val in kvs:
            stats['key_counts'][key] += 1
            if key not in seen_in_this_page:
                seen_in_this_page.add(key)
                if len(stats['key_samples'][key]) < 3:
                    stats['key_samples'][key].append(
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
