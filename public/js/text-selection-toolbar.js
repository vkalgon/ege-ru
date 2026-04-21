/**
 * Переиспользуемый модуль для плавающей панели инструментов выделения текста
 * Используется в задании 17, админке и других местах
 */

class TextSelectionToolbar {
  constructor(options = {}) {
    this.containerId = options.containerId || 'text-selection-toolbar';
    this.editorSelector = options.editorSelector || '.task17-text-editable';
    this.ignoreSelectors = options.ignoreSelectors || ['.task17-digit'];
    this.onButtonClick = options.onButtonClick || null;
    this.onRemoveClick = options.onRemoveClick || null;
    this.customButtons = options.customButtons || [];
    this.defaultButtons = options.defaultButtons !== false;
    
    this.toolbar = null;
    this.init();
  }

  init() {
    // Создаем панель, если её еще нет
    if (!document.getElementById(this.containerId)) {
      this.createToolbar();
    } else {
      this.toolbar = document.getElementById(this.containerId);
    }
  }

  createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.id = this.containerId;
    this.toolbar.className = 'text-selection-toolbar';
    document.body.appendChild(this.toolbar);
  }

  /**
   * Показывает панель для указанного range
   */
  show(range, options = {}) {
    if (!this.toolbar) {
      this.init();
    }

    if (!range || range.collapsed) {
      this.hide();
      return;
    }

    const selectedText = range.toString().trim();
    if (!selectedText) {
      this.hide();
      return;
    }

    // Проверяем, что выделение внутри разрешенного редактора
    const editor = range.commonAncestorContainer.nodeType === 3 
      ? range.commonAncestorContainer.parentElement 
      : range.commonAncestorContainer;

    // Проверяем игнорируемые селекторы
    for (const selector of this.ignoreSelectors) {
      if (editor.closest && editor.closest(selector)) {
        this.hide();
        return;
      }
    }

    // Проверяем, что выделение внутри редактора
    let textEditor = editor;
    while (textEditor && !textEditor.matches(this.editorSelector)) {
      textEditor = textEditor.parentElement;
    }

    if (!textEditor) {
      this.hide();
      return;
    }

    // Устанавливаем selection
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Очищаем панель
    this.toolbar.innerHTML = '';

    // Сохраняем range для обработчиков
    const savedRange = range.cloneRange();

    // Получаем кнопки для отображения
    const buttons = this.getButtons(options);

    // Создаем кнопки
    buttons.forEach(buttonConfig => {
      const button = this.createButton(buttonConfig, savedRange);
      this.toolbar.appendChild(button);
    });

    // Добавляем кнопку удаления, если нужно
    if (options.showRemoveButton !== false) {
      const removeBtn = this.createRemoveButton(savedRange);
      this.toolbar.appendChild(removeBtn);
    }

    // Позиционируем панель
    this.positionToolbar(range);
  }

  /**
   * Скрывает панель
   */
  hide() {
    if (this.toolbar) {
      this.toolbar.classList.remove('show');
    }
  }

  /**
   * Получает список кнопок для отображения
   */
  getButtons(options = {}) {
    const buttons = [];

    // Добавляем стандартные кнопки, если они включены
    if (this.defaultButtons) {
      buttons.push(...this.getDefaultButtons());
    }

    // Добавляем кастомные кнопки
    if (this.customButtons && this.customButtons.length > 0) {
      buttons.push(...this.customButtons);
    }

    // Добавляем кнопки из options
    if (options.buttons && options.buttons.length > 0) {
      buttons.push(...options.buttons);
    }

    return buttons;
  }

  /**
   * Получает стандартные кнопки
   */
  getDefaultButtons() {
    return [
      {
        class: 'span-participle',
        icon: '<svg width="24" height="8" viewBox="0 0 24 8" xmlns="http://www.w3.org/2000/svg"><path d="M 2 6 Q 4 4, 6 6 T 10 6 T 14 6 T 18 6 T 22 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
        title: 'Причастный'
      },
      {
        class: 'span-gerund',
        icon: '<svg width="24" height="8" viewBox="0 0 24 8" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="6" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="6" r="1.5" fill="currentColor"/><line x1="16" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        title: 'Деепричастный'
      },
      {
        class: 'span-subject',
        icon: '<svg width="24" height="8" viewBox="0 0 24 8" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        title: 'Подлежащее'
      },
      {
        class: 'span-predicate',
        icon: '<svg width="24" height="8" viewBox="0 0 24 8" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="7" x2="22" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        title: 'Сказуемое'
      },
      {
        class: 'span-main-word',
        icon: '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        title: 'Главное слово'
      }
    ];
  }

  /**
   * Создает кнопку
   */
  createButton(buttonConfig, savedRange) {
    const button = document.createElement('button');
    button.innerHTML = buttonConfig.icon || buttonConfig.label || '';
    button.title = buttonConfig.title || '';
    if (buttonConfig.className) {
      button.className = buttonConfig.className;
    }
    
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      
      // Восстанавливаем выделение
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        
        if (sel.rangeCount > 0) {
          // Вызываем кастомный обработчик или стандартный
          if (this.onButtonClick) {
            this.onButtonClick(buttonConfig, savedRange, sel);
          } else if (buttonConfig.onClick) {
            buttonConfig.onClick(buttonConfig, savedRange, sel);
          } else if (buttonConfig.class && typeof window.applySpanClass === 'function') {
            window.applySpanClass(buttonConfig.class);
          }
        }
      } catch (err) {
        console.error('Ошибка при восстановлении выделения:', err);
        // Пытаемся восстановить через текст
        this.restoreSelectionByText(savedRange, buttonConfig);
      }
    };
    
    return button;
  }

  /**
   * Создает кнопку удаления
   */
  createRemoveButton(savedRange) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove';
    removeBtn.innerHTML = '🗑';
    removeBtn.title = 'Удалить выделение';
    removeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        
        if (sel.rangeCount > 0) {
          if (this.onRemoveClick) {
            this.onRemoveClick(savedRange, sel);
          } else if (typeof window.removeMark === 'function') {
            window.removeMark();
          }
        }
      } catch (err) {
        console.error('Ошибка при восстановлении выделения:', err);
      }
    };
    
    return removeBtn;
  }

  /**
   * Восстанавливает выделение по тексту
   */
  restoreSelectionByText(savedRange, buttonConfig) {
    const sel = window.getSelection();
    const textEditor = document.querySelector(this.editorSelector);
    if (textEditor && savedRange.toString()) {
      const text = savedRange.toString();
      const walker = document.createTreeWalker(textEditor, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const index = node.textContent.indexOf(text);
        if (index >= 0) {
          const newRange = document.createRange();
          newRange.setStart(node, index);
          newRange.setEnd(node, index + text.length);
          sel.removeAllRanges();
          sel.addRange(newRange);
          if (this.onButtonClick) {
            this.onButtonClick(buttonConfig, newRange, sel);
          } else if (buttonConfig.class && typeof window.applySpanClass === 'function') {
            window.applySpanClass(buttonConfig.class);
          }
          break;
        }
      }
    }
  }

  /**
   * Позиционирует панель относительно range
   */
  positionToolbar(range) {
    const rect = range.getBoundingClientRect();
    
    // Показываем панель, чтобы получить её размеры
    this.toolbar.style.visibility = 'hidden';
    this.toolbar.style.position = 'fixed';
    this.toolbar.classList.add('show');
    
    requestAnimationFrame(() => {
      const toolbarRect = this.toolbar.getBoundingClientRect();
      
      // Позиционируем панель над выделением по центру
      let top = rect.top - toolbarRect.height - 10;
      let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);

      // Проверяем границы экрана
      if (left + toolbarRect.width > window.innerWidth) {
        left = window.innerWidth - toolbarRect.width - 8;
      }
      if (left < 8) {
        left = 8;
      }
      if (top < 8) {
        top = rect.bottom + 10;
      }

      this.toolbar.style.top = top + 'px';
      this.toolbar.style.left = left + 'px';
      this.toolbar.style.visibility = 'visible';
    });
  }

  /**
   * Устанавливает обработчики событий для автоматического показа панели
   */
  setupAutoShow(options = {}) {
    // Обработчик mouseup для выделения текста
    document.addEventListener('mouseup', (e) => {
      if (this.toolbar && this.toolbar.contains(e.target)) {
        return;
      }
      
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
          // Проверяем, не клик ли это на уже выделенный элемент
          const clickedMark = e.target.closest('.span-participle, .span-gerund, .span-subject, .span-predicate, .span-main-word');
          if (clickedMark) {
            const markRange = document.createRange();
            markRange.selectNodeContents(clickedMark);
            const selectedText = range.toString().trim();
            const markText = clickedMark.textContent.trim();
            if (selectedText === markText) {
              return; // Это клик, не новое выделение
            }
          }
          
          this.show(range, options);
        } else {
          this.hide();
        }
      } else {
        this.hide();
      }
    });

    // Обработчик клика вне панели для скрытия
    document.addEventListener('click', (e) => {
      if (this.toolbar && !this.toolbar.contains(e.target)) {
        const selection = window.getSelection();
        if (selection.isCollapsed || selection.rangeCount === 0) {
          if (this.toolbar && !this.toolbar.contains(document.activeElement)) {
            this.hide();
          }
        }
      }
    });
  }
}

// Экспортируем для использования
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextSelectionToolbar;
} else {
  window.TextSelectionToolbar = TextSelectionToolbar;
}

