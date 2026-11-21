# check-build-sync.py — build/ это зеркало исходников, а не источник истины.
# Проверка паритета: любой файл apps/researchlab обязан совпадать с копией в
# build/apps/researchlab (побайтно). Расхождение = забытый products/website/tools/build.sh.
# Дополнительно сверяются остальные деревья, которые build.sh копирует целиком
# (js, locales, pages, content, assets) и корневые файлы сайта: раньше гейт
# смотрел только на лабу, и устаревшие build/locales жили месяцами.
# И проверяются относительные ссылки разметки index.html сборки: путь на
# непубликуемый файл (например, ../../src/js/i18n.js) даёт 404 на сайте.
import hashlib
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "products" / "website"
SRC = WEB / "apps" / "researchlab"
ARTIFACT = WEB / "build"
BUILD = ARTIFACT / "apps" / "researchlab"

# Исходник → путь в артефакте: build.sh копирует эти деревья целиком.
MIRROR_PAIRS = (
    (WEB / "src" / "js", "js"),
    (WEB / "src" / "locales", "locales"),
    (WEB / "src" / "pages", "pages"),
    (WEB / "src" / "content", "content"),
    (WEB / "assets", "assets"),
)
# Корневые файлы сайта, которые build.sh копирует как есть. style.css и
# package*.json генерируются сборкой и в зеркало не входят.
MIRROR_FILES = ("index.html", "app.js", "favicon.svg", "robots.txt", "site.css", "files.json", "sitemap.xml")

# Служебное и генерируемое: не зеркалится и не должно проверяться.
SKIP_DIRS = {"node_modules", "test-results", "playwright-report", ".git"}
SKIP_SUFFIXES = {".bak", ".log", ".tmp"}
# Скриншоты тестов — артефакты прогона, а не исходники: они появляются в build/
# при локальном запуске Playwright, но в apps/ их нет. Сверять их нельзя.
SKIP_SUBPATHS = {os.path.join("tests", "screenshots")}


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 16), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


REF_RE = re.compile(r'(?:src|href)="([^"]+)"')
EXTERNAL_PREFIXES = ("#", "/", "http://", "https://", "mailto:", "tel:", "data:", "javascript:")


def asset_ref_problems() -> list[str]:
    """Ссылки разметки index.html, которые в артефакте не разрешаются.

    Ловит класс ошибки «ссылка на ../../src/js/i18n.js»: такой файл build.sh
    не публикует, браузер получает 404, а smoke его игнорирует как
    «Failed to load resource». Проверяем только сборку: относительные пути
    разметки разрешаются именно от неё.
    """
    index = BUILD / "index.html"
    if not index.is_file():
        return []
    # BUILD — каталог лабы в артефакте; публикуемый корень на два уровня выше
    # (build/apps/researchlab → build). Ссылки вроде ../../js/… разрешаются от него.
    artifact_root = BUILD.parents[1].resolve()
    problems: list[str] = []
    for match in REF_RE.finditer(index.read_text(encoding="utf-8")):
        ref = match.group(1).strip()
        if not ref or ref.startswith(EXTERNAL_PREFIXES):
            continue
        ref = ref.split("?")[0].split("#")[0]
        if not ref:
            continue
        target = (index.parent / ref).resolve()
        if target.is_dir():
            continue  # ссылка на каталог (например, «../../» — на главную сайта)
        inside = target == artifact_root or artifact_root in target.parents
        if not inside:
            problems.append(f"ссылка ведёт за пределы артефакта: {ref}")
        elif not target.is_file():
            problems.append(f"битая ссылка в артефакте: {ref}")
    return problems


def collect(root: Path) -> dict[str, Path]:
    found: dict[str, Path] = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative_parts = path.relative_to(root).parts
        parts = set(relative_parts)
        if parts & SKIP_DIRS or path.suffix in SKIP_SUFFIXES:
            continue
        # parts[:-1] пуст для файлов в корне — os.path.join без аргументов падает.
        parent = os.path.join(*relative_parts[:-1]) if len(relative_parts) > 1 else ""
        if parent in SKIP_SUBPATHS:
            continue
        found[str(path.relative_to(root))] = path
    return found


def mirror_problems() -> list[str]:
    """Паритет деревьев и корневых файлов, которые build.sh копирует целиком."""
    problems: list[str] = []
    for source_root, build_rel in MIRROR_PAIRS:
        if not source_root.is_dir():
            continue
        build_root = ARTIFACT / build_rel
        source_files = collect(source_root)
        build_files = collect(build_root) if build_root.is_dir() else {}
        for relative, source_path in sorted(source_files.items()):
            target = build_root / relative
            if not target.is_file():
                problems.append(f"нет в build/{build_rel}: {relative}")
            elif digest(source_path) != digest(target):
                problems.append(f"расходится с build/{build_rel}: {relative}")
        for relative in sorted(set(build_files) - set(source_files)):
            problems.append(f"лишний файл в build/{build_rel}: {relative}")
    for name in MIRROR_FILES:
        source = WEB / name
        target = ARTIFACT / name
        if not source.is_file():
            continue
        if not target.is_file():
            problems.append(f"нет в build: {name}")
        elif digest(source) != digest(target):
            problems.append(f"расходится с build: {name}")
    return problems


def main() -> int:
    if not SRC.is_dir() or not BUILD.is_dir():
        print("::error::нет каталогов apps/researchlab или build/apps/researchlab")
        return 1

    source_files = collect(SRC)
    build_files = collect(BUILD)
    problems: list[str] = []

    for relative, source_path in sorted(source_files.items()):
        build_path = BUILD / relative
        if not build_path.is_file():
            problems.append(f"отсутствует в build: {relative}")
        elif digest(source_path) != digest(build_path):
            problems.append(f"расходится с build: {relative}")

    # Файлы, которых больше нет в исходниках, но которые остались в build.
    for relative in sorted(set(build_files) - set(source_files)):
        problems.append(f"лишний файл в build: {relative}")

    # Класс ошибки, который не ловит ни один гейт: ссылка разметки на файл,
    # которого в артефакте нет (исторически — ../../src/js/i18n.js).
    problems.extend(asset_ref_problems())
    # Остальные зеркальные деревья и корневые файлы: раньше гейт видел только
    # apps/researchlab, поэтому build/locales могли месяцами жить устаревшими.
    problems.extend(mirror_problems())

    if problems:
        print("::error::build/ разошёлся с products/website/apps/researchlab")
        for problem in problems[:40]:
            print(f"  - {problem}")
        if len(problems) > 40:
            print(f"  … и ещё {len(problems) - 40}")
        print("::error::запусти bash products/website/tools/build.sh и закоммить результат")
        return 1

    print(f"[ok] build синхронен: {len(source_files)} файлов")
    return 0


if __name__ == "__main__":
    sys.exit(main())
