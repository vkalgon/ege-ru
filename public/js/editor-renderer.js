// Утилита для рендеринга JSON данных от Editor.js в HTML
class EditorRenderer {
  static render(editorData) {
    // Если это строка (простой текст), обрабатываем как параграф
    if (typeof editorData === 'string') {
      return `<p>${this.renderInlineContent(editorData)}</p>`;
    }
    
    // Если это не Editor.js данные, возвращаем как есть
    if (!editorData || !editorData.blocks) {
      return editorData || '';
    }

    // Проверяем, есть ли пустые блоки
    const hasContent = editorData.blocks.some(block => {
      if (block.type === 'paragraph') {
        return block.data && block.data.text && block.data.text.trim() !== '';
      }
      return true;
    });

    // Если нет контента, возвращаем пустую строку
    if (!hasContent) {
      return '';
    }

    let html = '';
    
    for (const block of editorData.blocks) {
      const rendered = this.renderBlock(block);
      if (rendered && rendered.trim() !== '') {
        html += rendered;
      }
    }
    
    return html;
  }

  static renderBlock(block) {
    switch (block.type) {
      case 'paragraph':
        if (!block.data || !block.data.text || block.data.text.trim() === '') {
          return '';
        }
        return `<p>${this.renderInlineContent(block.data.text)}</p>`;
      
      case 'header':
        const level = block.data.level || 3;
        return `<h${level}>${this.renderInlineContent(block.data.text)}</h${level}>`;
      
      case 'list':
        const listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
        const items = block.data.items.map(item => 
          `<li>${this.renderInlineContent(item)}</li>`
        ).join('');
        return `<${listTag}>${items}</${listTag}>`;
      
      case 'checklist':
        const checklistItems = block.data.items.map(item => 
          `<li class="checklist-item ${item.checked ? 'checked' : ''}">
            <input type="checkbox" ${item.checked ? 'checked' : ''} disabled>
            <span>${this.renderInlineContent(item.text)}</span>
          </li>`
        ).join('');
        return `<ul class="checklist">${checklistItems}</ul>`;
      
      case 'quote':
        return `<blockquote>
          <p>${this.renderInlineContent(block.data.text)}</p>
          ${block.data.caption ? `<cite>${block.data.caption}</cite>` : ''}
        </blockquote>`;
      
      case 'code':
        return `<pre><code>${this.escapeHtml(block.data.code)}</code></pre>`;
      
      case 'table':
        const table = this.renderTable(block.data);
        return table;
      
      case 'warning':
        return `<div class="warning-block">
          <div class="warning-title">${this.renderInlineContent(block.data.title)}</div>
          <div class="warning-message">${this.renderInlineContent(block.data.message)}</div>
        </div>`;
      
      case 'delimiter':
        return '<hr>';
      
      case 'image':
        return `<figure>
          <img src="${block.data.file.url}" alt="${block.data.caption || ''}" 
               style="max-width: 100%; height: auto;">
          ${block.data.caption ? `<figcaption>${block.data.caption}</figcaption>` : ''}
        </figure>`;
      
      default:
        return `<div class="editor-block editor-block-${block.type}">
          <p><em>Неподдерживаемый блок: ${block.type}</em></p>
        </div>`;
    }
  }

  static renderTable(data) {
    if (!data.content || data.content.length === 0) {
      return '<table><tr><td>Пустая таблица</td></tr></table>';
    }

    let tableHtml = '<table class="editor-table">';
    
    data.content.forEach((row, rowIndex) => {
      tableHtml += '<tr>';
      row.forEach((cell, cellIndex) => {
        const tag = (rowIndex === 0 && data.withHeadings) ? 'th' : 'td';
        tableHtml += `<${tag}>${this.renderInlineContent(cell)}</${tag}>`;
      });
      tableHtml += '</tr>';
    });
    
    tableHtml += '</table>';
    return tableHtml;
  }

  static renderInlineContent(text) {
    if (!text || text.trim() === '') return '';
    
    // Editor.js сохраняет форматирование как HTML теги (например, <b>, <i>, <mark>, <code>)
    // Но может быть и markdown синтаксис в старых данных
    // Проверяем, есть ли уже HTML теги форматирования
    const hasHtmlFormatting = /<(b|strong|i|em|u|mark|code|del|s|br)[\s>]/i.test(text);
    
    if (hasHtmlFormatting) {
      // Editor.js уже сохранил форматирование как HTML
      // Просто обрабатываем переносы строк
      return text.replace(/\n/g, '<br>');
    } else {
      // Обрабатываем markdown-подобный синтаксис или простой текст
      // Сначала экранируем HTML для безопасности
      let safeText = this.escapeHtml(text);
      
      // Затем применяем форматирование
      // Сначала обрабатываем жирный (чтобы не путался с курсивом)
      return safeText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // жирный
        .replace(/(?:\*)([^*]+?)(?:\*)(?!\*)/g, '<em>$1</em>') // курсив (после обработки **)
        .replace(/`(.*?)`/g, '<code>$1</code>') // inline код
        .replace(/~~(.*?)~~/g, '<del>$1</del>') // зачеркнутый
        .replace(/==(.*?)==/g, '<mark>$1</mark>') // выделенный
        .replace(/__(.*?)__/g, '<u>$1</u>') // подчеркнутый
        .replace(/\n/g, '<br>'); // переносы строк
    }
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Функция для создания краткого превью контента
  static createPreview(editorData, maxLength = 100) {
    if (!editorData || !editorData.blocks) {
      return '';
    }

    let text = '';
    
    for (const block of editorData.blocks) {
      if (block.type === 'paragraph' && block.data.text) {
        text += block.data.text + ' ';
      } else if (block.type === 'header' && block.data.text) {
        text += block.data.text + ' ';
      } else if (block.type === 'list' && block.data.items) {
        text += block.data.items.join(' ') + ' ';
      }
      
      if (text.length > maxLength) {
        break;
      }
    }
    
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}

// Экспорт для использования в других скриптах
window.EditorRenderer = EditorRenderer;

