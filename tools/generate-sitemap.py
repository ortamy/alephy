#!/usr/bin/env python3
"""generate-sitemap.py — sitemap.xml products/website из фактических маршрутов.

Источники URL (ровно то, что build.sh публикует):
  * корень            -> index.html            (лендинг, loc с '/')
  * apps/researchlab  -> apps/researchlab/index.html
  * src/pages/**      -> pages/...             (build.sh копирует в build/pages)

Сознательно НЕ включается: src/content/html/** (>1200 фрагментов контента
без canonical) и dev-страницы (tools/, config/).

Использование (из корня репозитория):
  python tools/generate-sitemap.py           # перезаписать sitemap.xml + build-зеркало
  python tools/generate-sitemap.py --check   # exit 1, если файлы разошлись (CI-гейт)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "products" / "website"
SOURCE = WEB / "sitemap.xml"
MIRROR = WEB / "build" / "sitemap.xml"
BASE = "https://ortamy.github.io/alephy/"

# (changefreq, priority) для известных маршрутов; новые страницы получают дефолт.
SPECS: dict[str, tuple[str, str]] = {
    "": ("weekly", "1.0"),
    "apps/researchlab/index.html": ("weekly", "0.9"),
    "pages/index.html": ("weekly", "0.9"),
    "pages/research/index.html": ("daily", "0.9"),
    "pages/about/index.html": ("weekly", "0.8"),
    "pages/tanakh/index.html": ("weekly", "0.8"),
    "pages/interlinear/index.html": ("weekly", "0.8"),
}
DEFAULT_SPEC = ("monthly", "0.7")


def page_routes() -> list[str]:
    """Относительные пути публикуемых страниц (posix), отсортированы."""
    pages_dir = WEB / "src" / "pages"
    if not pages_dir.is_dir():
        raise SystemExit("::error::нет products/website/src/pages — источника маршрутов нет")
    return sorted(p.relative_to(pages_dir).as_posix() for p in pages_dir.rglob("*.html"))


def render() -> str:
    routes = [""]
    if not (WEB / "apps" / "researchlab" / "index.html").is_file():
        raise SystemExit("::error::нет apps/researchlab/index.html — лаборатория не публикуется")
    if not (WEB / "index.html").is_file():
        raise SystemExit("::error::нет index.html — лендинг не публикуется")
    routes.append("apps/researchlab/index.html")
    routes.extend("pages/" + rel for rel in page_routes())

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for rel in routes:
        changefreq, priority = SPECS.get(rel, DEFAULT_SPEC)
        loc = BASE if rel == "" else BASE + rel
        lines.append(
            f"  <url><loc>{loc}</loc>"
            f"<changefreq>{changefreq}</changefreq>"
            f"<priority>{priority}</priority></url>"
        )
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    expected = render()
    check = "--check" in argv[1:]

    if check:
        stale = [p for p in (SOURCE, MIRROR) if not p.is_file() or p.read_text(encoding="utf-8") != expected]
        if stale:
            names = ", ".join(str(p.relative_to(ROOT)) for p in stale)
            print(
                f"::error::sitemap разошёлся с маршрутами ({names}) — "
                "запусти `python tools/generate-sitemap.py` и закоммить результат",
                file=sys.stderr,
            )
            return 1
        print(f"[ok] sitemap свежий: {len(expected.splitlines()) - 3} URL")
        return 0

    for target in (SOURCE, MIRROR):
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(expected, encoding="utf-8", newline="\n")
        print(f"[ok] записан {target.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
