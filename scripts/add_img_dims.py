# -*- coding: utf-8 -*-
"""HTML 内の <img> に width/height 属性を付与する（CLS 対策）。

ローカル画像のみ対象。既に width 属性があるものはスキップ。
使い方: python scripts/add_img_dims.py
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = sorted(ROOT.glob("*.html"))

_dim_cache = {}


def probe(path: Path):
    if path in _dim_cache:
        return _dim_cache[path]
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        w, h = out.split(",")[:2]
        dims = (int(w), int(h))
    except (subprocess.CalledProcessError, ValueError) as e:
        print(f"  ! ffprobe failed for {path.name}: {e}", file=sys.stderr)
        dims = None
    _dim_cache[path] = dims
    return dims


IMG_RE = re.compile(r"<img\b[^>]*>")
SRC_RE = re.compile(r'src="([^"]+)"')


def process(page: Path) -> int:
    html = page.read_text(encoding="utf-8")
    count = 0

    def repl(m: re.Match) -> str:
        nonlocal count
        tag = m.group(0)
        if "width=" in tag:
            return tag
        src = SRC_RE.search(tag)
        if not src or src.group(1).startswith(("http", "data:")):
            return tag
        img_path = ROOT / src.group(1)
        if not img_path.exists():
            print(f"  ! missing: {src.group(1)} ({page.name})", file=sys.stderr)
            return tag
        dims = probe(img_path)
        if not dims:
            return tag
        count += 1
        return tag[:-1] + f' width="{dims[0]}" height="{dims[1]}">'

    updated = IMG_RE.sub(repl, html)
    if updated != html:
        page.write_text(updated, encoding="utf-8")
    return count


def main():
    for page in PAGES:
        n = process(page)
        if n:
            print(f"{page.name}: {n} imgs updated")


if __name__ == "__main__":
    main()
