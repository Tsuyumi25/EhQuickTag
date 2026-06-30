"""
ehwiki.org tag page crawler. Two modes:

  all         (= collect + download) full crawl, cache to ~/eh-wiki-cache/.
              For initial bootstrap on a fresh machine. ~3 hours, ~120 MB cache.
  collect     phase 1 only: walk Category indices, write urls.txt
  download    phase 2 only: download HTML for URLs in urls.txt
  incremental walk Category indices + query RecentChanges API → fetch only NEW
              / CHANGED pages, drop REMOVED entries, merge into existing JSON.
              Used by GHA weekly cron. No persistent cache (tempdir).
"""
from __future__ import annotations
import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from wiki_extract import (  # noqa: E402
    CATEGORIES, CATEGORY_PATHS, ExtractFetchError,
    extract_one, build_payload, write_json_gz, read_json_gz,
)

BASE = 'https://ehwiki.org'
CACHE = Path.home() / 'eh-wiki-cache'
USER_AGENT = 'eh-quick-tag-wiki-crawler/0.1 (https://github.com/Tsuyumi25/EhQuickTag)'

CONCURRENCY = 5
DELAY_SEC = 0.1
RETRIES = 2
RETRY_BACKOFF_SEC = 1.0


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8')


def fetch_with_retry(url: str) -> str:
    last_err: Exception | None = None
    for attempt in range(RETRIES + 1):
        try:
            return fetch(url)
        except Exception as e:
            last_err = e
            if attempt < RETRIES:
                time.sleep(RETRY_BACKOFF_SEC * (2 ** attempt))
    assert last_err is not None
    raise last_err


def collect_category_urls(category_path: str) -> list[str]:
    urls: list[str] = []
    url = f'{BASE}/wiki/{category_path}'
    page_n = 0
    while url:
        page_n += 1
        print(f'  fetching index page {page_n}: {url}', file=sys.stderr)
        html = fetch(url)
        m = re.search(r'<div id="mw-pages">(.*?)<div class="printfooter"', html, re.DOTALL)
        if not m:
            break
        body = m.group(1)
        for href in re.findall(r'<li><a href="(/wiki/[^"]+)"', body):
            urls.append(href)
        nxt = re.search(
            r'<a href="(/index\.php\?title=' + re.escape(category_path) + r'&amp;pagefrom=[^"]+)"[^>]*>next page</a>',
            html,
        )
        if nxt:
            url = BASE + nxt.group(1).replace('&amp;', '&')
            time.sleep(DELAY_SEC)
        else:
            url = None
    return urls


def slug_from_url(wiki_path: str) -> str:
    """`/wiki/big_breasts` → `big_breasts` (URL-decoded, filesystem-safe)."""
    name = wiki_path.removeprefix('/wiki/')
    name = urllib.parse.unquote(name)
    return name.replace('/', '__')


# ---------------- full-crawl mode (collect / download / all) ----------------


def phase1_collect() -> dict[str, list[str]]:
    CACHE.mkdir(parents=True, exist_ok=True)
    catalog: dict[str, list[str]] = {}
    for cat_key in CATEGORIES:
        cat_path = CATEGORY_PATHS[cat_key]
        print(f'[phase 1] {cat_key} ({cat_path})', file=sys.stderr)
        urls = collect_category_urls(cat_path)
        catalog[cat_key] = urls
        print(f'  → {len(urls)} URLs', file=sys.stderr)
    urls_file = CACHE / 'urls.txt'
    with urls_file.open('w') as f:
        for cat_key, urls in catalog.items():
            for u in urls:
                f.write(f'{cat_key}\t{u}\n')
    print(f'[phase 1 done] wrote {urls_file}', file=sys.stderr)
    return catalog


def phase2_download(catalog: dict[str, list[str]]) -> None:
    total = sum(len(v) for v in catalog.values())
    print(f'[phase 2] downloading {total} pages with {CONCURRENCY} threads', file=sys.stderr)
    done = 0
    skipped = 0

    def task(cat_key: str, wiki_path: str) -> tuple[str, bool]:
        out_dir = CACHE / cat_key
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f'{slug_from_url(wiki_path)}.html'
        if out_path.exists() and out_path.stat().st_size > 100:
            return wiki_path, True
        try:
            html = fetch(BASE + wiki_path)
            out_path.write_text(html)
        except Exception as e:
            print(f'  ERR {wiki_path}: {e}', file=sys.stderr)
        finally:
            # Always sleep so a failing server doesn't get 5 threads × 0 delay burst
            time.sleep(DELAY_SEC)
        return wiki_path, False

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futures = [ex.submit(task, cat, url) for cat, urls in catalog.items() for url in urls]
        for fut in as_completed(futures):
            _, was_skipped = fut.result()
            done += 1
            if was_skipped:
                skipped += 1
            if done % 100 == 0:
                print(f'  {done}/{total} ({skipped} cached)', file=sys.stderr)
    print(f'[phase 2 done] {done} processed, {skipped} from cache', file=sys.stderr)


def load_catalog() -> dict[str, list[str]]:
    urls_file = CACHE / 'urls.txt'
    if not urls_file.exists():
        return {}
    catalog: dict[str, list[str]] = {}
    for line in urls_file.read_text().splitlines():
        if '\t' not in line:
            continue
        cat, url = line.split('\t', 1)
        catalog.setdefault(cat, []).append(url)
    return catalog


# ---------------- incremental mode ----------------


def query_recent_changes(days: int) -> set[str]:
    """RecentChanges API (ns=0, edit+new) for last `days`. Returns lowercase slug set."""
    end_iso = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
    slugs: set[str] = set()
    rccontinue: str | None = None
    while True:
        url = (
            f'{BASE}/api.php?action=query&list=recentchanges'
            f'&rcprop=title&rcnamespace=0&rclimit=500&format=json'
            f'&rcend={end_iso}'
        )
        if rccontinue:
            url += f'&rccontinue={urllib.parse.quote(rccontinue)}'
        resp = json.loads(fetch(url))
        for entry in resp.get('query', {}).get('recentchanges', []):
            title = entry['title']
            slugs.add(title.replace(' ', '_').lower())
        cont = resp.get('continue', {}).get('rccontinue')
        if not cont:
            break
        rccontinue = cont
    return slugs


def cmd_incremental(existing_json: Path, out_path: Path, days: int) -> None:
    """Incremental update: only refresh existing entries whose slug appears in
    RecentChanges. New / removed pages are out of scope — handled by a separate
    full re-build (run `all` + `extract-wiki-tags.py` then push) if needed."""
    try:
        existing = read_json_gz(existing_json)
        entries: dict[str, dict] = existing.get('entries', {})
        print(f'[read] existing entries: {len(entries)}', file=sys.stderr)
    except FileNotFoundError:
        print(f'[read] {existing_json} not found, starting empty', file=sys.stderr)
        entries = {}

    # lower-slug → [(cat, key, original_slug)] — RC titles are case-preserved,
    # we match lowercase. original_slug preserved so re-fetch URL gets right case.
    slug_to_keys: dict[str, list[tuple[str, str, str]]] = {}
    for key in entries:
        cat, slug = key.split('/', 1)
        slug_to_keys.setdefault(slug.lower(), []).append((cat, key, slug))

    print(f'[recentchanges] last {days} days', file=sys.stderr)
    recent_slugs = query_recent_changes(days)
    print(f'  changed slugs: {len(recent_slugs)}', file=sys.stderr)

    hits: list[tuple[str, str, str]] = []  # (key, wiki_path, cat)
    for slug in recent_slugs:
        for cat, key, orig_slug in slug_to_keys.get(slug, []):
            hits.append((key, '/wiki/' + orig_slug, cat))
    print(f'  hits in catalog: {len(hits)}', file=sys.stderr)

    refetched = popped = kept_on_error = 0
    for key, wiki_path, cat in hits:
        try:
            html = fetch_with_retry(BASE + wiki_path)
        except Exception as e:
            print(f'  ERR fetch {key}: {e}, keeping existing', file=sys.stderr)
            kept_on_error += 1
            continue
        try:
            data = extract_one(html)
        except ExtractFetchError as e:
            # No wiki body — likely fetch issue / redirect. Don't trust as "remove".
            print(f'  WARN {key}: {e}, keeping existing', file=sys.stderr)
            kept_on_error += 1
            continue
        if data is None:
            # Body exists but no parseable fields — DNP-like, safe to remove
            entries.pop(key, None)
            popped += 1
        else:
            data['category'] = cat
            entries[key] = data
            refetched += 1
        time.sleep(DELAY_SEC)

    print(
        f'[done] refetched={refetched} popped={popped} kept_on_error={kept_on_error} '
        f'→ {len(entries)} entries',
        file=sys.stderr,
    )
    raw_size = write_json_gz(build_payload(entries), out_path)
    print(
        f'wrote {out_path} ({out_path.stat().st_size:,} gzipped, {raw_size:,} raw)',
        file=sys.stderr,
    )


# ---------------- CLI ----------------


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='cmd', required=True)
    sub.add_parser('collect', help='phase 1 only')
    sub.add_parser('download', help='phase 2 only (needs prior collect)')
    sub.add_parser('all', help='collect + download (full crawl to ~/eh-wiki-cache)')
    inc = sub.add_parser('incremental', help='diff against existing JSON, fetch only changes')
    inc.add_argument('--existing-json', type=Path, required=True, help='input wiki.json.gz')
    inc.add_argument('--out', type=Path, required=True, help='output wiki.json.gz')
    inc.add_argument('--days', type=int, default=7, help='RecentChanges window (default 7)')
    args = p.parse_args()

    if args.cmd == 'collect':
        phase1_collect()
    elif args.cmd == 'download':
        catalog = load_catalog()
        if not catalog:
            print('no urls.txt; run `collect` first', file=sys.stderr)
            sys.exit(1)
        phase2_download(catalog)
    elif args.cmd == 'all':
        catalog = phase1_collect()
        phase2_download(catalog)
    elif args.cmd == 'incremental':
        cmd_incremental(args.existing_json, args.out, args.days)


if __name__ == '__main__':
    main()
