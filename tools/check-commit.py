#!/usr/bin/env python3
"""Гейт перед коммитом: сообщение по конвенции + чистота добавленных строк.

Заимствовано из ECC (affaan-m/ECC) идея pre-commit хука: одна команда вместо
пункта «проверки соответствующего уровня» в голове агента. Конвенция сообщения —
`.clinerules` §6, список проверок — `docs/09-GUIDES/SECURITY-CHECKLIST.md`.

Проверки (только по индексу, `git diff --cached`):
  message   [error]  формат `<type>(<scope>): <описание>`, известные type и scope;
  debug     [warn]   console.log / debugger / TODO / FIXME в добавленных строках;
  secrets   [error]  присвоение ключа/токена/пароля в добавленных строках;
  build     [error]  build/apps/researchlab разошёлся с исходниками;
  data      [error]  data/methodology (index + documents/) разошёлся с docs/06-METHODOLOGY;
  docs      [error]  tools/check-docs.py check не проходит.

Использование:
  python tools/check-commit.py                     # проверка индекса
  python tools/check-commit.py -m "feat(lab): x"   # с проверкой сообщения
  git config core.hooksPath .githooks              # включить автозапуск
"""
from __future__ import annotations

import argparse
import importlib.util
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# .clinerules §6: формат коммита.
TYPES = {"feat", "fix", "refactor", "docs", "style", "test", "chore"}
SCOPES = {"router", "lab", "club", "smoke", "docs", "design", "data", "agents"}
MESSAGE_RE = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[a-z0-9-]+)\))?: (?P<desc>\S.*)$")

# Отладочный мусор: предупреждение, а не блокировка — в тестах console.error законен.
DEBUG_RE = re.compile(r"\b(console\.(log|debug|trace)|debugger\b|TODO|FIXME|XXX)\b")

# Секреты: блокируются. Требование значения отсекает ложные срабатывания
# на упоминаниях вида «ключ не попадает в исходники».
SECRET_RE = re.compile(
    r"(?i)\b(api[_-]?key|secret|token|password|passwd|private[_-]?key)\b"
    r"\s*[:=]\s*['\"]?([A-Za-z0-9/+_-]{12,})"
)
SECRET_PEM_RE = re.compile(r"BEGIN (?:[A-Z ]+ )?PRIVATE KEY")




def git(*args: str) -> tuple[int, str]:
    """Запускает git и возвращает (код возврата, stdout+stderr)."""
    proc = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def staged_paths() -> list[str]:
    code, out = git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
    return out.split() if code == 0 else []


def added_lines() -> list[tuple[str, str]]:
    """Добавленные строки индекса как список (путь, текст)."""
    code, out = git("diff", "--cached", "--unified=0", "--no-color", "--diff-filter=ACMR")
    if code != 0:
        print(f"::error::git diff --cached не отработал:\n{out.strip()}")
        raise SystemExit(1)
    result: list[tuple[str, str]] = []
    path = ""
    for line in out.splitlines():
        if line.startswith("+++ "):
            path = line[4:].strip()
            if path.startswith("b/"):
                path = path[2:]
        elif line.startswith("+") and not line.startswith("+++"):
            result.append((path, line[1:]))
    return result


def check_message(message: str) -> list[str]:
    first = message.strip().splitlines()[0] if message.strip() else ""
    match = MESSAGE_RE.match(first)
    if not match:
        return [f"сообщение не по конвенции .clinerules §6: «{first or "(пусто)"}»"]
    errors: list[str] = []
    if match["type"] not in TYPES:
        errors.append(f"неизвестный type «{match['type']}»: {'/'.join(sorted(TYPES))}")
    if match["scope"] and match["scope"] not in SCOPES:
        errors.append(f"неизвестный scope «{match['scope']}»: {'/'.join(sorted(SCOPES))}")
    return errors


def scan_added(lines: list[tuple[str, str]]) -> tuple[list[str], list[str]]:
    """Возвращает (errors, warns) по добавленным строкам."""
    errors: list[str] = []
    warns: list[str] = []
    for path, text in lines:
        # Сам гейт содержит регулярки и списки слов — сканировать его бессмысленно.
        if path.replace("\\", "/").endswith("tools/check-commit.py"):
            continue
        if SECRET_PEM_RE.search(text) or SECRET_RE.search(text):
            errors.append(f"{path}: похоже на секрет в исходниках — ключи сюда не попадают")
        if DEBUG_RE.search(text):
            warns.append(f"{path}: отладочный мусор (console.log/debugger/TODO/FIXME)")
    return errors, warns



def check_build_sync() -> list[str]:
    """Паритет build-зеркала; пропускаем, если лаборатория не затронута."""
    if not any("apps/researchlab" in p.replace("\\", "/") for p in staged_paths()):
        return []
    spec = importlib.util.spec_from_file_location("check_build_sync", ROOT / "tools" / "check-build-sync.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not mod.SRC.is_dir() or not mod.BUILD.is_dir():
        return []
    problems: list[str] = []
    for relative, source_path in sorted(mod.collect(mod.SRC).items()):
        build_path = mod.BUILD / relative
        if not build_path.is_file():
            problems.append(f"отсутствует в build: {relative}")
        elif mod.digest(source_path) != mod.digest(build_path):
            problems.append(f"разошёлся с build: {relative}")
    return problems


def check_docs() -> list[str]:
    """Гейт документации; запускается, только если затронут docs/."""
    if not any(p.startswith("docs/") for p in staged_paths()):
        return []
    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "check-docs.py"), "check"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode == 0:
        return []
    return ["docs/ не проходит check-docs.py — вывод: python tools/check-docs.py check"]


def check_generated_data() -> list[str]:
    """docs/ → data/: методички переносит генератор, значит он же их и сверяет.

    Запускается, когда затронуты исходники методичек, данные лаба или реестр, из
    которого генератор берёт список документов: иначе правка в docs/ оставит
    data/methodology/index.json и тела в documents/ молча устаревшими.
    """
    touched = [p.replace("\\", "/") for p in staged_paths()]
    if not any(
        p.startswith("docs/06-METHODOLOGY/")
        or p.startswith("products/website/apps/researchlab/data/methodology/")
        or p.endswith("apps/researchlab/js/module-registry.js")
        for p in touched
    ):
        return []
    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "generate-methodology-docs.py"), "--check"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode == 0:
        return []
    detail = (proc.stdout or proc.stderr or "").strip().splitlines()
    hint = detail[0] if detail else "запусти: python tools/generate-methodology-docs.py"
    return [f"методички в data/ разошлись с docs/06-METHODOLOGY — {hint}"]


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Гейт перед коммитом проекта «Алефи»")
    parser.add_argument("-m", "--message", default=None, help="проверить сообщение коммита")
    args = parser.parse_args()

    lines = added_lines()
    errors: list[str] = []
    warns: list[str] = []

    if args.message is not None:
        errors.extend(check_message(args.message))
    errors.extend(check_build_sync())
    errors.extend(check_generated_data())
    errors.extend(check_docs())

    scan_errors, scan_warns = scan_added(lines)
    errors.extend(scan_errors)
    warns.extend(scan_warns)

    print("— Гейт перед коммитом —")
    print(f"[error] блокирующих: {len(errors)}")
    for item in errors[:40]:
        print(f"    {item}")
    if len(errors) > 40:
        print(f"    … и ещё {len(errors) - 40}")
    print(f"[warn] предупреждений: {len(warns)}")
    for item in warns[:20]:
        print(f"    {item}")
    if len(warns) > 20:
        print(f"    … и ещё {len(warns) - 20}")

    if errors:
        print("— Итог: коммит заблокирован —")
        return 1
    print(f"— Итог: чисто ({len(lines)} добавленных строк) —")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

