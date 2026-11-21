#!/usr/bin/env python3
# prepare_data.py — подготовка данных для обучения нейросети из репозитория.
# Легаси-скрипт neuro: пути приведены к текущей раскладке репозитория
# (docs/05-DICTIONARIES, docs/06-METHODOLOGY, docs/08-AUDITS, researches/).
# В файле раньше стояло markdown-ограждение ```python — он не компилировался.

import json
import re
from pathlib import Path
from typing import List, Dict

REPO_ROOT = Path(__file__).resolve().parents[3]
TERMINOLOGY_DIR = REPO_ROOT / "docs" / "05-DICTIONARIES"
RESEARCHES_DIR = REPO_ROOT / "researches"
INSTRUCTIONS_DIR = REPO_ROOT / "docs" / "06-METHODOLOGY"
CHECKERS_DIR = REPO_ROOT / "docs" / "08-AUDITS"
TRAINING_DATA_DIR = REPO_ROOT / "products" / "neuro" / "training-data"

OUTPUT_FILE = TRAINING_DATA_DIR / "prepared.json"


def extract_text_from_md(file_path: Path, max_length: int = 500) -> str:
    """Извлекает текст из md-файла (без метаданных)"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return ""
    
    lines = content.split('\n')
    result_lines = []
    in_metadata = True
    
    for line in lines:
        if in_metadata and line.strip() == "":
            in_metadata = False
            continue
        if not in_metadata and not line.startswith('**Метаданные'):
            if line.startswith('# '):
                continue
            result_lines.append(line)
    
    text = '\n'.join(result_lines)
    return text[:max_length]


def load_prompts_and_responses() -> List[Dict]:
    """Загружает существующие промпты и ответы"""
    prompts_file = TRAINING_DATA_DIR / "prompts.json"
    responses_file = TRAINING_DATA_DIR / "responses.json"
    
    if not prompts_file.exists() or not responses_file.exists():
        return []
    
    with open(prompts_file, 'r', encoding='utf-8') as f:
        prompts_data = json.load(f)
    
    with open(responses_file, 'r', encoding='utf-8') as f:
        responses_data = json.load(f)
    
    prompts = prompts_data.get("prompts", [])
    responses = responses_data.get("responses", [])
    
    prompt_dict = {p["id"]: p for p in prompts}
    response_dict = {r["id"]: r for r in responses}
    
    result = []
    for pid in prompt_dict:
        if pid in response_dict:
            result.append({
                "id": pid,
                "category": prompt_dict[pid]["category"],
                "instruction": prompt_dict[pid]["prompt"],
                "output": response_dict[pid]["expected"]
            })
    
    return result


def generate_terminology_data() -> List[Dict]:
    """Генерирует данные из терминов"""
    data = []
    
    if not TERMINOLOGY_DIR.exists():
        return data
    
    for md_file in TERMINOLOGY_DIR.glob("*.md"):
        content = extract_text_from_md(md_file, 800)
        if not content:
            continue
        
        name = md_file.stem
        data.append({
            "id": f"term_{name}",
            "category": "термин",
            "instruction": f"Что означает слово «{name}»?",
            "output": content
        })
        
        data.append({
            "id": f"term_{name}_context",
            "category": "термин",
            "instruction": f"Объясни понятие {name} и приведи пример из ТаНаХа",
            "output": content
        })
    
    return data


def generate_researches_data() -> List[Dict]:
    """Генерирует данные из исследований"""
    data = []
    
    if not RESEARCHES_DIR.exists():
        return data
    
    for md_file in RESEARCHES_DIR.glob("*.md"):
        content = extract_text_from_md(md_file, 1000)
        if not content:
            continue
        
        name = md_file.stem.replace('-', ' ')
        data.append({
            "id": f"research_{md_file.stem}",
            "category": "исследование",
            "instruction": f"Расскажи об исследовании: {name}",
            "output": content
        })
    
    return data


def generate_principles_data() -> List[Dict]:
    """Генерирует данные из принципов"""
    data = []
    principles_file = INSTRUCTIONS_DIR / "RESEARCH-PRINCIPLES.md"
    
    if principles_file.exists():
        content = extract_text_from_md(principles_file, 1500)
        if content:
            data.append({
                "id": "principles_all",
                "category": "принципы",
                "instruction": "Назови основные принципы исследований",
                "output": content
            })
    
    return data


def generate_forbidden_words_data() -> List[Dict]:
    """Генерирует данные из запрещённых слов"""
    data = []
    forbidden_file = INSTRUCTIONS_DIR / "DAVAR.md"
    
    if forbidden_file.exists():
        content = extract_text_from_md(forbidden_file, 1000)
        if content:
            data.append({
                "id": "forbidden_words",
                "category": "запреты",
                "instruction": "Какие слова запрещено использовать в авторской речи?",
                "output": content
            })
            data.append({
                "id": "forbidden_replace",
                "category": "запреты",
                "instruction": "Чем заменять религионизмы?",
                "output": content
            })
    
    return data


def generate_methods_data() -> List[Dict]:
    """Генерирует данные из методов разоблачения"""
    data = []
    methods_file = INSTRUCTIONS_DIR / "METHODS.md"
    
    if methods_file.exists():
        content = extract_text_from_md(methods_file, 1500)
        if content:
            data.append({
                "id": "methods_23",
                "category": "методы",
                "instruction": "Какие есть методы разоблачения?",
                "output": content
            })
    
    return data


def generate_checkers_data() -> List[Dict]:
    """Генерирует данные из чекеров"""
    data = []
    checkers_dir = CHECKERS_DIR
    
    if checkers_dir.exists():
        for md_file in checkers_dir.glob("*.md"):
            content = extract_text_from_md(md_file, 800)
            if content:
                name = md_file.stem
                data.append({
                    "id": f"checker_{name}",
                    "category": "чекеры",
                    "instruction": f"Как работает чекер {name}?",
                    "output": content
                })
    
    return data


def main():
    print("📚 ПОДГОТОВКА ДАННЫХ ДЛЯ ОБУЧЕНИЯ")
    print("=================================")
    print("")
    
    all_data = []
    
    print("1. Загрузка промптов и ответов...")
    existing = load_prompts_and_responses()
    all_data.extend(existing)
    print(f"   Загружено: {len(existing)}")
    
    print("2. Генерация из терминов...")
    terms = generate_terminology_data()
    all_data.extend(terms)
    print(f"   Сгенерировано: {len(terms)}")
    
    print("3. Генерация из исследований...")
    researches = generate_researches_data()
    all_data.extend(researches)
    print(f"   Сгенерировано: {len(researches)}")
    
    print("4. Генерация из принципов...")
    principles = generate_principles_data()
    all_data.extend(principles)
    print(f"   Сгенерировано: {len(principles)}")
    
    print("5. Генерация из запрещённых слов...")
    forbidden = generate_forbidden_words_data()
    all_data.extend(forbidden)
    print(f"   Сгенерировано: {len(forbidden)}")
    
    print("6. Генерация из методов...")
    methods = generate_methods_data()
    all_data.extend(methods)
    print(f"   Сгенерировано: {len(methods)}")
    
    print("7. Генерация из чекеров...")
    checkers = generate_checkers_data()
    all_data.extend(checkers)
    print(f"   Сгенерировано: {len(checkers)}")
    
    print("")
    print(f"📊 ВСЕГО: {len(all_data)} записей")
    
    TRAINING_DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Сохранено: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
