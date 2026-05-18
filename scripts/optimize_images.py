"""Resize and convert referenced PNG images to WebP.

Reads HTML files to find images/<file>.png references, then for each:
- Loads the PNG with Pillow.
- Resizes so the longest side is at most MAX_DIM (Lanczos), preserving aspect.
- Saves alongside as <file>.webp at QUALITY.

Originals are kept on disk. HTML rewriting is done separately.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "images"

MAX_DIM = 1600
QUALITY = 88
DIAGRAM_QUALITY = 92


def find_referenced_pngs() -> list[Path]:
    """Scan HTML files for images/<name>.png references."""
    pattern = re.compile(r"images/([A-Za-z0-9_. -]+\.png)")
    found: set[str] = set()
    for html in ROOT.glob("*.html"):
        text = html.read_text(encoding="utf-8")
        for match in pattern.finditer(text):
            found.add(match.group(1))
    return [IMG_DIR / name for name in sorted(found) if (IMG_DIR / name).exists()]


def is_diagram(stem: str) -> bool:
    return stem.startswith("research") or stem in {"res_1"}


def convert(path: Path) -> tuple[int, int, int]:
    """Returns (orig_bytes, new_bytes, saved_pct)."""
    img = Image.open(path)
    w, h = img.size
    scale = min(1.0, MAX_DIM / max(w, h))
    if scale < 1.0:
        new_size = (int(round(w * scale)), int(round(h * scale)))
        img = img.resize(new_size, Image.LANCZOS)
    q = DIAGRAM_QUALITY if is_diagram(path.stem) else QUALITY
    webp_path = path.with_suffix(".webp")
    save_kwargs = {"quality": q, "method": 6}
    if img.mode in {"RGBA", "LA"}:
        save_kwargs["lossless"] = False
    img.save(webp_path, "WEBP", **save_kwargs)
    orig = path.stat().st_size
    new = webp_path.stat().st_size
    saved_pct = int((1 - new / orig) * 100) if orig else 0
    return orig, new, saved_pct


def main() -> int:
    pngs = find_referenced_pngs()
    if not pngs:
        print("No referenced PNGs found.")
        return 1

    print(f"Processing {len(pngs)} images...\n")
    total_orig = 0
    total_new = 0
    for path in pngs:
        try:
            orig, new, pct = convert(path)
        except Exception as exc:
            print(f"  FAIL  {path.name}: {exc}")
            continue
        total_orig += orig
        total_new += new
        print(f"  {path.name:40s}  {orig / 1024:8.0f} KB -> {new / 1024:7.0f} KB  ({pct:+d}%)")

    print()
    print(f"Total:  {total_orig / 1024 / 1024:.1f} MB -> {total_new / 1024 / 1024:.2f} MB")
    print(f"Saved:  {(total_orig - total_new) / 1024 / 1024:.1f} MB "
          f"({int((1 - total_new / total_orig) * 100)}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
