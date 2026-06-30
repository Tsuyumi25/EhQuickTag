#!/usr/bin/env python3
"""Generate tag count CSV from URenko/e-hentai-db SQLite snapshot.

每行 `tag_name,len`，count 計算的是 distinct EH gallery（用 root_gid 去重，
fallback 到 gid），排除 expunged / removed。

對齊 EH search 站上顯示的 result count——mokurin000 上游 CSV 是 raw
gid_tid count，把 replaced 的多版本同人志算多次，跟使用者體感不符。

Filtered to count >= 5 砍掉長尾死 tag。
"""
import csv
import gzip
import sqlite3
import sys

MIN_COUNT = 5

QUERY = """
SELECT t.name AS name,
       COUNT(DISTINCT COALESCE(g.root_gid, g.gid)) AS n
FROM gid_tid gt
JOIN gallery g ON g.gid = gt.gid
JOIN tag t ON t.id = gt.tid
WHERE g.expunged = 0 AND g.removed = 0
GROUP BY t.name
HAVING n >= ?
ORDER BY n DESC
"""


def main(db_path: str, out_path: str) -> None:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = con.execute(QUERY, (MIN_COUNT,))

    with gzip.open(out_path, "wt", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["tag_name", "len"])
        w.writerows(rows)

    con.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} <db_path> <out_csv_gz>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
