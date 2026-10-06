window.AgentPassportManifest = {
  "schemaVersion": "1.0",
  "agents": [
    {
      "id": "orchestrator",
      "name": "Оркестратор",
      "title": "Оркестратор",
      "cat": "Оркестрация",
      "model": "ALEPHY",
      "domain": "Управление выполнением и распределение подзадач",
      "status": "active",
      "capabilities": {
        "execution": false,
        "readRepository": false,
        "writesFiles": false,
        "streaming": true
      }
    },
    {
      "id": "frontend-developer",
      "name": "Фронтенд-разработчик",
      "title": "Фронтенд-разработчик",
      "cat": "Разработка",
      "model": "Локальный аудит",
      "domain": "Фронтенд лаборатории: соответствие дизайн-канону",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "researcher",
      "name": "Исследователь",
      "title": "Исследователь",
      "cat": "Исследование",
      "model": "Локальный агент",
      "domain": "Извлечение термина, корня и локальных источников",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "semitologist",
      "name": "Семитолог",
      "title": "Семитолог",
      "cat": "Исследование",
      "model": "Локальный агент",
      "domain": "Семитские параллели без подмены источников",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "exposer",
      "name": "Разоблачитель",
      "title": "Разоблачитель",
      "cat": "Исследование",
      "model": "Локальный агент",
      "domain": "Карта сдвигов и пропусков перевода",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "editor",
      "name": "Редактор",
      "title": "Редактор",
      "cat": "Документация",
      "model": "Локальный агент",
      "domain": "Приведение материала к стилю проекта",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "collector",
      "name": "Сборщик",
      "title": "Сборщик",
      "cat": "Оркестрация",
      "model": "Локальный агент",
      "domain": "Единый результат линейных и циклических цепочек",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "comparator",
      "name": "Компаратор",
      "title": "Компаратор",
      "cat": "Исследование",
      "model": "Локальный агент",
      "domain": "Сравнение текстовых свидетелей",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "critic",
      "name": "Критик",
      "title": "Критик",
      "cat": "Контроль качества",
      "model": "Локальный агент",
      "domain": "Проверка хода работы по эмет и шекер",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "verifier",
      "name": "Проверяющий",
      "title": "Проверяющий",
      "cat": "Контроль качества",
      "model": "Локальный агент",
      "domain": "Валидация обязательных полей результата",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "paleo-translator",
      "name": "Переводчик палео-иврита",
      "title": "Переводчик палео-иврита",
      "cat": "Исследование",
      "model": "Локальный агент",
      "domain": "Палео-образ и физический смысл букв",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "flow-architect",
      "name": "Архитектор потока",
      "title": "Архитектор потока",
      "cat": "Оркестрация",
      "model": "Локальный агент",
      "domain": "Порядок этапов исследования",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "liaison",
      "name": "Связной",
      "title": "Связной",
      "cat": "Оркестрация",
      "model": "Локальный агент",
      "domain": "Передача контекста и расширение горизонта",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "technical-writer",
      "name": "Технический писатель",
      "title": "Технический писатель",
      "cat": "Документация",
      "model": "Локальный агент",
      "domain": "Оформление исследования в Markdown",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "code-reviewer",
      "name": "Ревьюер кода",
      "title": "Ревьюер кода",
      "cat": "Контроль качества",
      "model": "Локальный агент",
      "domain": "Минимальный технический контроль пайплайна",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "ai-engineer",
      "name": "AI-инженер",
      "title": "AI-инженер",
      "cat": "Разработка",
      "model": "Локальный агент",
      "domain": "Подготовка задач для подключённой LLM",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "arch-scanner",
      "name": "Архитектурный сканер",
      "title": "Архитектурный сканер",
      "cat": "Архитектура",
      "model": "Локальный агент",
      "domain": "Снимок фактов о репозитории",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "arch-critic",
      "name": "Архитектурный критик",
      "title": "Архитектурный критик",
      "cat": "Архитектура",
      "model": "Локальный агент",
      "domain": "Сверка паспорта с фактами репозитория",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "arch-planner",
      "name": "Архитектурный планировщик",
      "title": "Архитектурный планировщик",
      "cat": "Архитектура",
      "model": "Локальный агент",
      "domain": "Классификация находок по корзинам решения",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    },
    {
      "id": "arch-writer",
      "name": "Архитектурный писатель",
      "title": "Архитектурный писатель",
      "cat": "Архитектура",
      "model": "Локальный агент",
      "domain": "Перерисовка генерируемых блоков паспорта",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": true,
        "streaming": false
      }
    },
    {
      "id": "arch-convergence",
      "name": "Архитектурный сход",
      "title": "Архитектурный сход",
      "cat": "Архитектура",
      "model": "Локальный агент",
      "domain": "Остановка цикла при совпадении снимка и документа",
      "status": "ready",
      "capabilities": {
        "execution": true,
        "readRepository": true,
        "writesFiles": false,
        "streaming": false
      }
    }
  ]
};
