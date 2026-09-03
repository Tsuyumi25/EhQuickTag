#!/usr/bin/env python3
"""從 e-hentai-db 產出「標籤組合」fixture，給 /mytags 面板用。

組合只記錄「哪些標籤同時出現在同一本畫廊上、有幾本」，不含權重——權重是
使用者在頁面上即時改的，由前端自己算分。

每本畫廊在這份詞彙表上的標籤子集是唯一的，所以組合把畫廊切得不重不漏——面板正是
靠這個性質把面積分給每一格。

輸入   eh.db          URenko/e-hentai-db nightly（zstd 解開後）
       mytags HTML    決定要收哪些標籤的組合
輸出   combos.json    {tags: [...], combos: [[count, tagIdx...], ...]}

用法   python3 scripts/build-combos-fixture.py <eh.db> <mytags*.html>... \
           -o out.json
"""
import argparse, collections, json, sqlite3, sys
from html.parser import HTMLParser

# 預設全收。門檻會系統性破壞「含此路徑」那一欄——它要把所有超集合加起來，而超集合
# 大多是深層的稀有組合，一切就少掉一大截（實測某條路徑少 45%）。而且路徑越深偏差
# 越大，畫面上又看不出來。「剛好」那欄不受影響，因為它只讀一筆。
MIN_COUNT = 1


class TagRowParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.previews = {}
        self.weights = {}
        self.hidden = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        i = a.get('id', '')
        if tag == 'div' and i.startswith('tagpreview_'):
            tid = i[len('tagpreview_'):]
            if tid != '0':
                self.previews[tid] = a.get('title', '')
        elif i.startswith('tagweight_'):
            self.weights[i[len('tagweight_'):]] = a.get('value', '').strip()
        elif i.startswith('taghide_') and 'checked' in a:
            self.hidden.add(i[len('taghide_'):])


def read_tag_names(paths):
    """回傳 (全部標籤, 有在擋的標籤)。後者才需要帶分枝標記進來——scope 只會在你
    正在過濾的標籤上展開，其他標籤的標記收進詞彙表只會讓組合數翻倍"""
    names, blocking = set(), set()
    for p in paths:
        parser = TagRowParser()
        parser.feed(open(p, encoding='utf-8', errors='replace').read())
        for tid, full in parser.previews.items():
            if not full:
                continue
            names.add(full)
            raw = parser.weights.get(tid, '')
            # 空白代表沿用 EH 的預設權重 10
            if tid in parser.hidden or (raw and int(raw) < 0):
                blocking.add(full)
    return sorted(names), blocking


def build(db_path, names):
    con = sqlite3.connect(db_path)
    con.execute("PRAGMA cache_size=-2000000")
    tid = dict(con.execute(
        "SELECT name,id FROM tag WHERE name IN (%s)" % ",".join("?" * len(names)), names))
    missing = [n for n in names if n not in tid]
    if missing:
        print(f"警告：{len(missing)} 個標籤在 db 裡找不到", file=sys.stderr)

    idx = {name: i for i, name in enumerate(names)}
    con.execute("CREATE TEMP TABLE mt(tid INTEGER PRIMARY KEY)")
    con.executemany("INSERT INTO mt VALUES (?)", [(v,) for v in tid.values()])
    rev = {v: idx[k] for k, v in tid.items()}

    rows = con.execute("""SELECT gt.gid, gt.tid FROM gid_tid gt JOIN mt ON mt.tid=gt.tid
                          JOIN gallery g ON g.gid=gt.gid
                          WHERE g.expunged=0 AND g.removed=0 AND g.replaced=0
                          ORDER BY gt.gid""")
    combos = collections.Counter()
    cur, buf = None, []
    for gid, t in rows:
        if gid != cur:
            if buf:
                combos[tuple(sorted(buf))] += 1
            cur, buf = gid, []
        buf.append(rev[t])
    if buf:
        combos[tuple(sorted(buf))] += 1
    return combos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('db')
    ap.add_argument('html', nargs='+')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--min-count', type=int, default=MIN_COUNT)
    args = ap.parse_args()

    names, _ = read_tag_names(args.html)
    combos = build(args.db, names)
    kept = [(n, c) for c, n in combos.items() if n >= args.min_count]
    kept.sort(reverse=True)

    total = sum(combos.values())
    covered = sum(n for n, _ in kept)
    print(f"標籤 {len(names)}　組合 {len(combos):,} → 保留 {len(kept):,} "
          f"(≥{args.min_count} 本)　涵蓋畫廊 {covered:,}/{total:,} "
          f"({covered / total * 100:.1f}%)", file=sys.stderr)

    json.dump({'tags': names, 'combos': [[n, *c] for n, c in kept]},
              open(args.out, 'w'), separators=(',', ':'))


if __name__ == '__main__':
    main()
