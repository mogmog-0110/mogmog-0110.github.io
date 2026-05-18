"""Generate a 1200x630 OGP image for Shiggy's portfolio.

Uses Pillow with system fonts. Outputs to images/ogp.webp.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images" / "ogp.webp"

W, H = 1200, 630
BG = (5, 5, 8)
ACCENT = (139, 32, 32)
TEXT = (232, 232, 232)
DIM = (160, 160, 170)


def find_font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont:
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Subtle dotted/cosmic effect — radial gradient ring
    for r in range(420, 350, -1):
        alpha = max(0, 30 - (420 - r) * 1)
        d.ellipse(
            [W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r],
            outline=(ACCENT[0], ACCENT[1], ACCENT[2]) if r == 360 else None,
        )

    # Accent line top-left
    d.rectangle([0, 0, 240, 6], fill=ACCENT)

    # Title
    title_font = find_font(
        ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"], 96
    )
    d.text((80, 140), "Shiggy", font=title_font, fill=TEXT)

    # Subtitle
    sub_font = find_font(
        ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"], 36
    )
    d.text((80, 260), "Portfolio / 川村優弥", font=sub_font, fill=DIM)

    # Tagline lines
    line_font = find_font(
        ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/yugothic.ttc",
         "C:/Windows/Fonts/msgothic.ttc", "C:/Windows/Fonts/arial.ttf"],
        28,
    )
    lines = [
        "Game developer / Engine author / Researcher",
        "Live2D Inc. — Cubism SDK for Native",
        "BDA 2025 (Springer LNCS, First Author)",
    ]
    y = 380
    for ln in lines:
        d.text((80, y), ln, font=line_font, fill=TEXT)
        y += 50

    # Footer URL
    url_font = find_font(
        ["C:/Windows/Fonts/consola.ttf", "C:/Windows/Fonts/arial.ttf"], 24
    )
    d.text((80, H - 80), "mogmog-0110.github.io", font=url_font, fill=DIM)

    img.save(OUT, "WEBP", quality=92, method=6)
    print(f"wrote {OUT}  {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
