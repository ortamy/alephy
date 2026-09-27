# check-build-sync.py — build/ это зеркало исходников, а не источник истины.
# Проверка паритета: любой файл apps/researchlab обязан совпадать с копией в
# build/apps/researchlab (побайтно). Расхождение = забытый products/website/tools/build.sh.
import hashlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "products" / "website"
SRC = WEB / "apps" / "researchlab"
BUILD = WEB / "build" / "apps" / "researchlab"

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
