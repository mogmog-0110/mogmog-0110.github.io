"""Inject favicon, OGP, and Twitter card meta into all HTML pages.

Idempotent — if the marker is already present, skips the page.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "<!-- meta:social -->"
SITE = "https://mogmog-0110.github.io"

# Per-page metadata
PAGES = {
    "index.html": ("Shiggy's Portfolio", "川村優弥のポートフォリオ。ゲーム開発、自作エンジン MitiruEngine、剛体物理シミュレーション研究（BDA 2025 / Springer LNCS）、株式会社 Live2D での Cubism SDK 実務。", "/"),
    "portfolio.html": ("Portfolio | Shiggy", "川村優弥のゲーム作品とツール。MitiruEngine、かえるクレープ、ハトを育てよう（リメイク）など。", "/portfolio.html"),
    "engine.html": ("MitiruEngine | Shiggy", "C++20 で書いている自作 header-only ゲームエンジン。47 モジュール / 700+ ヘッダ / 730+ commits。", "/engine.html"),
    "kaerucrape.html": ("かえるクレープへようこそ | Shiggy", "クレープを作りながらヒロインたちと親睦を深める美少女ゲーム × クッキングゲーム。Godot 版を経て MitiruEngine で書き直し中。", "/kaerucrape.html"),
    "hato.html": ("ハトを育てよう（MitiruEngine リメイク）| Shiggy", "TyranoScript で書いた原作を、自作 MitiruEngine 上で完全移植 + 追加要素を入れたリメイク版。", "/hato.html"),
    "research.html": ("Research | Shiggy", "剛体物理シミュレーションを用いた環状化合物の選択性解析。BDA 2025（Springer LNCS）に第一著者として発表。", "/research.html"),
    "creation.html": ("Creation | Shiggy", "川村優弥の創作活動。イラスト、Live2D、短編小説。", "/creation.html"),
    "skills.html": ("Skills | Shiggy", "川村優弥のスキル。各技術に実際の作品・リポジトリへのリンクを付けています。", "/skills.html"),
}


def build_block(title: str, desc: str, path: str) -> str:
    url = SITE + path
    return f"""    {MARKER}
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Shiggy's Portfolio">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{desc}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{SITE}/images/ogp.webp">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{desc}">
    <meta name="twitter:image" content="{SITE}/images/ogp.webp">
"""


def main() -> int:
    for name, (title, desc, path) in PAGES.items():
        f = ROOT / name
        if not f.exists():
            print(f"missing: {name}")
            continue
        text = f.read_text(encoding="utf-8")
        if MARKER in text:
            # Replace existing block
            text = re.sub(
                re.escape(MARKER) + r".*?(?=    <!-- Fonts -->|    <link rel=\"preconnect\")",
                build_block(title, desc, path).rstrip() + "\n\n",
                text,
                count=1,
                flags=re.DOTALL,
            )
        else:
            # Insert before <!-- Fonts --> or <link rel="preconnect"
            insert = build_block(title, desc, path)
            text = re.sub(
                r"(    <!-- Fonts -->\n|    <link rel=\"preconnect\")",
                insert + r"\1",
                text,
                count=1,
            )
        f.write_text(text, encoding="utf-8")
        print(f"updated: {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
