"""
Local-only wiki crawler for ehwiki.org tag pages.

Phase 1: walk Category:{Tag,Character_Tag,Creator_Tag,Language_Tag} pagination,
collect all tag page URLs.
Phase 2: download each tag page HTML to local cache.

Output:
  /tmp/eh-wiki-cache/urls.txt              one URL per line, with category prefix
  /tmp/eh-wiki-cache/<category>/<slug>.html
"""
from __future__ import annotations
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BASE = 'https://ehwiki.org'
CACHE = Path.home() / 'eh-wiki-cache'
USER_AGENT = 'eh-quick-tag-wiki-crawler/0.1 (https://github.com/Tsuyumi25/EhQuickTag)'

CATEGORIES = [
    ('tag', 'Category:Tag'),
    ('character', 'Category:Character_Tag'),
    ('creator', 'Category:Creator_Tag'),
    ('language', 'Category:Language_Tag'),
    ('series', 'Category:Series_Tag'),
]

# Sequential 0.3s delay = ~37 min for 7500 pages. Use 5 threads = ~7 min,
# still polite by mediawiki standards.
CONCURRENCY = 5
DELAY_SEC = 0.1


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8')


def collect_category_urls(category_path: str) -> list[str]:
    """Walk pagination, return list of /wiki/<slug> URLs."""
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
    # Filesystem-safe: replace / with __, leave most chars alone
    return name.replace('/', '__')


def phase1_collect() -> dict[str, list[str]]:
    CACHE.mkdir(parents=True, exist_ok=True)
    catalog: dict[str, list[str]] = {}
    for cat_key, cat_path in CATEGORIES:
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
            return wiki_path, True  # skipped
        try:
            html = fetch(BASE + wiki_path)
            out_path.write_text(html)
            time.sleep(DELAY_SEC)
            return wiki_path, False
        except Exception as e:
            print(f'  ERR {wiki_path}: {e}', file=sys.stderr)
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
    """Re-load urls.txt without re-walking pagination."""
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


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if cmd in ('collect', 'all'):
        catalog = phase1_collect()
    else:
        catalog = load_catalog()
        if not catalog:
            print('no urls.txt; run `collect` first', file=sys.stderr)
            sys.exit(1)
    if cmd in ('download', 'all'):
        phase2_download(catalog)


if __name__ == '__main__':
    main()
