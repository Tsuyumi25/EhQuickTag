"""
Full-corpus extract from local ehwiki HTML cache → single JSON.
Walks every HTML file under ~/eh-wiki-cache/<category>/ and writes
~/eh-wiki-extract.json{,.gz}. Run after fetch-wiki-tags.py all.

Incremental updates go via fetch-wiki-tags.py incremental instead.
"""
from __future__ import annotations
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from wiki_extract import (  # noqa: E402
    CATEGORIES, extract_one, build_payload, write_json_gz, ExtractFetchError,
)

CACHE = Path.home() / 'eh-wiki-cache'
OUT_JSON_GZ = Path.home() / 'eh-wiki-extract.json.gz'


def main() -> None:
    out: dict[str, dict] = {}
    skipped: dict[str, int] = {}
    by_cat: dict[str, int] = {}

    t0 = time.time()
    for cat in CATEGORIES:
        cat_dir = CACHE / cat
        if not cat_dir.exists():
            continue
        for f in sorted(cat_dir.glob('*.html')):
            try:
                data = extract_one(f.read_text(errors='replace'))
            except ExtractFetchError:
                # no wiki body — corrupted cache file, treat as skip
                skipped[cat] = skipped.get(cat, 0) + 1
                continue
            if data is None:
                skipped[cat] = skipped.get(cat, 0) + 1
                continue
            # entry is list[dict] — {prelude, blocks[]} per variant
            out[f'{cat}/{f.stem}'] = data
            by_cat[cat] = by_cat.get(cat, 0) + 1

    elapsed = time.time() - t0
    print(f'extracted: {len(out)} entries in {elapsed:.1f}s', file=sys.stderr)
    print(f'  by category: {by_cat}', file=sys.stderr)
    print(f'  skipped: {sum(skipped.values())} ({skipped})', file=sys.stderr)

    raw_size = write_json_gz(build_payload(out), OUT_JSON_GZ)
    print(
        f'wrote {OUT_JSON_GZ} ({OUT_JSON_GZ.stat().st_size:,} bytes gzipped, '
        f'{raw_size:,} bytes raw)',
        file=sys.stderr,
    )


if __name__ == '__main__':
    main()
