# Text Selection Toolbar Module

Переиспользуемый модуль для плавающей панели инструментов выделения текста.

## Использование

```javascript
const toolbar = new TextSelectionToolbar({
  containerId: 'my-toolbar',              // ID контейнера панели
  editorSelector: '.text-editor',          // Селектор редактора текста
  ignoreSelectors: ['.ignore-me'],         // Селекторы элементов, которые нужно игнорировать
  defaultButtons: true,                    // Показывать стандартные кнопки (причастный, деепричастный и т.д.)
  customButtons: [],                       // Массив кастомных кнопок
  onButtonClick: (buttonConfig, range, selection) => {
    // Обработчик клика на кнопку
  },
  onRemoveClick: (range, selection) => {
    // Обработчик клика на кнопку удаления
  }
});

// Показать панель для выделения
toolbar.show(range, {
  buttons: [],           // Дополнительные кнопки для этого показа
  showRemoveButton: true // Показывать кнопку удаления
});

// Скрыть панель
toolbar.hide();

// Настроить автоматический показ при выделении текста
toolbar.setupAutoShow();
```

## Примеры

### Базовое использование

```javascript
const toolbar = new TextSelectionToolbar({
  containerId: 'text-selection-toolbar',
  editorSelector: '.task17-text-editable',
  onButtonClick: (buttonConfig, range, selection) => {
    if (buttonConfig.class) {
      applySpanClass(buttonConfig.class);
    }
  }
});

toolbar.setupAutoShow();
```

### С кастомными кнопками

```javascript
const toolbar = new TextSelectionToolbar({
  containerId: 'text-selection-toolbar',
  defaultButtons: false, // Отключить стандартные кнопки
  customButtons: [
    {
      class: 'span-custom',
      icon: '<svg>...</svg>',
      title: 'Кастомная кнопка',
      onClick: (config, range, selection) => {
        // Кастомная логика
      }
    }
  ]
});
```

## API

### Конструктор

`new TextSelectionToolbar(options)`

**Параметры:**
- `containerId` (string) - ID контейнера панели
- `editorSelector` (string) - Селектор редактора текста
- `ignoreSelectors` (array) - Массив селекторов для игнорирования
- `defaultButtons` (boolean) - Показывать стандартные кнопки
- `customButtons` (array) - Массив кастомных кнопок
- `onButtonClick` (function) - Обработчик клика на кнопку
- `onRemoveClick` (function) - Обработчик клика на кнопку удаления

### Методы

- `show(range, options)` - Показать панель для указанного range
- `hide()` - Скрыть панель
- `setupAutoShow()` - Настроить автоматический показ при выделении текста

## Стандартные кнопки

Модуль включает стандартные кнопки:
- Причастный оборот (`.span-participle`)
- Деепричастный оборот (`.span-gerund`)
- Подлежащее (`.span-subject`)
- Сказуемое (`.span-predicate`)
- Главное слово (`.span-main-word`)

## Стили

Модуль использует CSS классы:
- `.text-selection-toolbar` - основной контейнер
- `.text-selection-toolbar.show` - видимое состояние
- `.text-selection-toolbar button` - кнопки
- `.text-selection-toolbar button.remove` - кнопка удаления

Стили определены в `public/styles.css`.

