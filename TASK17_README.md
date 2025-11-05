# Задание №17: Пунктуация

## Описание

Реализован функционал для задания №17 с двумя режимами проверки:
- **Режим "Цифры"**: выбор цифр из меток `(1)`, `(2)`, ...
- **Режим "Запятые"**: расстановка запятых в тексте без запятых

Также поддерживается выделение причастных и деепричастных оборотов с поддержкой перекрытий.

## База данных

Таблицы создаются автоматически при запуске сервера:
- `task17` - задания
- `task17_answer` - эталонные ответы
- `task17_attempt` - логи попыток

## API Endpoints

### Админка

- `POST /api/task17` - создать задание
- `GET /api/task17` - список заданий (с `?limit=` и `?offset=`)
- `GET /api/task17/:id` - получить задание
- `PUT /api/task17/:id` - обновить задание
- `DELETE /api/task17/:id` - удалить задание

### Учебный режим

- `GET /api/task17/:id/play?mode=digits|commas` - получить задание для решения
- `POST /api/task17/:id/check` - проверить ответ

## Запуск seed скрипта

Для создания примера задания:

```bash
npm run seed:task17
```

Или напрямую:

```bash
node server/db/seeds/task17.seed.js
```

## React компоненты

Компоненты созданы в `public/js/task17/`:
- `TextWithDigits.tsx` - отображение текста с кликабельными цифрами
- `CommaSlots.tsx` - интерактивные слоты для запятых
- `SpanEditor.tsx` - выделение оборотов (Alt + выделение)
- `Task17App.tsx` - главный компонент приложения

**Примечание**: Для использования TSX компонентов в браузере их нужно скомпилировать в JS. Можно использовать:
- TypeScript компилятор (`tsc`)
- Babel с TypeScript preset
- Или использовать JSX версии через Babel Standalone (как в `public/task17.html`)

## CSS стили

Стили для спанов добавлены в `public/styles.css`:
- `.span-participle` - волнистая линия (причастный оборот)
- `.span-gerund` - точка-тире (деепричастный оборот)

## Логика проверки

- **Цифры/Запятые**: сравнение множеств (порядок не важен)
- **Спаны**: сравнение по IoU (Intersection over Union) с порогом 0.9
- **Баллы**: 1 балл за цифры/запятые + 2 балла за спаны (макс. 3)

Порог IoU можно настроить через переменную окружения `SPANS_IOU_THRESHOLD`.

## Пример использования API

### Создание задания

```bash
curl -X POST http://localhost:3000/api/task17 \
  -H "Content-Type: application/json" \
  -d '{
    "source_text": "Текст (1) с метками (2)...",
    "base_text": "Текст с пунктуацией, но без меток...",
    "commaless_text": "Текст без запятых и без меток...",
    "digits": [1, 2],
    "comma_positions": [10, 25],
    "spans": [{"type": "gerund", "startOffset": 20, "endOffset": 35}],
    "answer_text": "Краткий ответ",
    "explanation_md": "**Подробное** объяснение",
    "reveal_policy": "after_correct"
  }'
```

### Проверка ответа (режим "Запятые")

```bash
curl -X POST http://localhost:3000/api/task17/1/check \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "commas",
    "comma_positions": [10, 25],
    "spans": [{"type": "gerund", "startOffset": 20, "endOffset": 35}]
  }'
```

## Структура данных

### task17
- `source_text` - текст с метками `(1)`, `(2)`, ...
- `base_text` - текст без меток, с пунктуацией
- `commaless_text` - текст без меток и без запятых
- `answer_text` - краткий ответ
- `explanation_md` - объяснение (Markdown)
- `reveal_policy` - политика показа объяснения (`never`|`after_check`|`after_correct`|`always`)

### task17_answer
- `digits_json` - массив цифр для режима "Цифры"
- `comma_positions_json` - массив позиций запятых (межсимвольные индексы для `commaless_text`)
- `spans_json` - массив объектов `{type: 'participle'|'gerund', startOffset, endOffset}`

Индексы - UTF-16 code unit индексы (как в JavaScript).

