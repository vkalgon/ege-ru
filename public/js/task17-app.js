// ─── Константы ───────────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  { text: 'rgba(59, 130, 246, 1)' },
  { text: 'rgba(34, 197, 94, 1)' },
  { text: 'rgba(236, 72, 153, 1)' },
  { text: 'rgba(251, 191, 36, 1)' },
  { text: 'rgba(168, 85, 247, 1)' },
  { text: 'rgba(239, 68, 68, 1)' },
  { text: 'rgba(14, 165, 233, 1)' },
  { text: 'rgba(245, 158, 11, 1)' },
];

// ─── Утилиты цвета ────────────────────────────────────────────────────────────

function rgbaToSvgHex(rgba) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '%23A4BEE2';
  const r = parseInt(m[1]).toString(16).padStart(2, '0');
  const g = parseInt(m[2]).toString(16).padStart(2, '0');
  const b = parseInt(m[3]).toString(16).padStart(2, '0');
  return '%23' + r + g + b;
}

function gerundBgImage(colorText) {
  const c = rgbaToSvgHex(colorText);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='4' viewBox='0 0 36 4' preserveAspectRatio='none'%3E%3Cline x1='0' y1='2' x2='8' y2='2' stroke='${c}' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='2' r='1.5' fill='${c}'/%3E%3Cline x1='22' y1='2' x2='36' y2='2' stroke='${c}' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`;
}

function applyMainWordColor(el, color) {
  el.style.color = color.text;
  el.style.setProperty('--mw-color', color.text);
  el.style.backgroundColor = '';
  el.style.border = '';
  el.style.borderWidth = '';
  el.style.borderStyle = '';
  el.style.borderColor = '';
}

function applyLinkedTurnColor(el, color) {
  el.style.backgroundColor = '';
  if (el.classList.contains('span-gerund')) {
    el.style.backgroundImage = gerundBgImage(color.text);
  } else {
    el.style.textDecorationColor = color.text;
  }
}

function clearSpanColor(el) {
  el.style.color = '';
  el.style.removeProperty('--mw-color');
  el.style.backgroundColor = '';
  el.style.border = '';
  el.style.borderWidth = '';
  el.style.borderStyle = '';
  el.style.borderColor = '';
  el.style.textDecorationColor = '';
  if (el.classList.contains('span-gerund')) {
    el.style.backgroundImage = '';
  }
}

// ─── Парсинг текста ───────────────────────────────────────────────────────────

function parseTextWithDigits(text) {
  const parts = [];
  const regex = /\((\d+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), digit: null });
    }
    parts.push({ text: match[0], digit: parseInt(match[1], 10) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), digit: null });
  }
  return parts;
}

function parseTextWithSpaces(text, correctCommaPositions = null) {
  const parts = [];
  if (!text || text.length === 0) return parts;

  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const correctCommasSet = correctCommaPositions
    ? new Set(correctCommaPositions.map(p => Number(p)))
    : null;

  let currentOffset = 0;
  let spaceIndex = 0;

  if (normalizedText.length > 0 && normalizedText[0] === ' ') {
    parts.push({ text: ' ', isClickable: true, spaceIndex, showCorrectComma: correctCommasSet && correctCommasSet.has(spaceIndex) });
    currentOffset = 1;
    spaceIndex++;
  }

  for (let i = currentOffset; i < normalizedText.length; i++) {
    if (normalizedText[i] === ' ') {
      if (i > currentOffset) {
        const textPart = normalizedText.substring(currentOffset, i);
        if (textPart.length > 0) parts.push({ text: textPart, isClickable: false, spaceIndex: null });
      }
      parts.push({
        text: ' ',
        isClickable: true,
        spaceIndex,
        showCorrectComma: correctCommasSet && correctCommasSet.has(spaceIndex)
      });
      currentOffset = i + 1;
      spaceIndex++;
    }
  }

  if (currentOffset < normalizedText.length) {
    const textPart = normalizedText.substring(currentOffset);
    if (textPart.length > 0) parts.push({ text: textPart, isClickable: false, spaceIndex: null });
  }

  const reconstructed = parts.map(p => p.text || '').join('');
  if (reconstructed !== normalizedText) {
    const simpleParts = [];
    let si = 0;
    for (let i = 0; i < normalizedText.length; i++) {
      if (normalizedText[i] === ' ') {
        simpleParts.push({ text: ' ', isClickable: true, spaceIndex: si, showCorrectComma: correctCommasSet && correctCommasSet.has(si) });
        si++;
      } else {
        let wordStart = i;
        while (i < normalizedText.length && normalizedText[i] !== ' ') i++;
        i--;
        const word = normalizedText.substring(wordStart, i + 1);
        if (word.length > 0) simpleParts.push({ text: word, isClickable: false, spaceIndex: null });
      }
    }
    return simpleParts;
  }

  return parts;
}

// ─── Стек отмены ─────────────────────────────────────────────────────────────

const _undoStack = [];
function _saveUndo(editor) {
  _undoStack.push({ editor, html: editor.innerHTML });
  if (_undoStack.length > 50) _undoStack.shift();
}
function _undo() {
  if (_undoStack.length === 0) return;
  const { editor, html } = _undoStack.pop();
  editor.innerHTML = html;
  if (typeof setupClickOnMarks === 'function') setupClickOnMarks();
}
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    const focused = document.activeElement;
    const inEditor = focused && focused.closest('.task17-text-editable');
    if (inEditor && _undoStack.length > 0) {
      e.preventDefault();
      _undo();
    }
  }
});
window._undoStack = _undoStack;
window._saveUndo = _saveUndo;
window._undo = _undo;

// ─── applySpanClass ──────────────────────────────────────────────────────────

function applySpanClass(className) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const parent = range.commonAncestorContainer.nodeType === 3
    ? range.commonAncestorContainer.parentElement
    : range.commonAncestorContainer;

  let editor = parent;
  while (editor && !editor.classList.contains('task17-text-editable')) {
    editor = editor.parentElement;
  }
  if (!editor) { alert('Поместите курсор в текст задания'); return; }

  const selectedText = selection.toString().trim();
  if (!selectedText) { alert('Выделите текст для отметки'); return; }

  _saveUndo(editor);

  try {
    function expandRangeToSpaces(range) {
      const expandedRange = range.cloneRange();

      let startContainer = expandedRange.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const text = startContainer.textContent;
        let newOffset = expandedRange.startOffset;
        while (newOffset > 0 && text[newOffset - 1] !== ' ') newOffset--;
        expandedRange.setStart(startContainer, newOffset);
      } else {
        const walker = document.createTreeWalker(startContainer, NodeFilter.SHOW_TEXT, null);
        const firstTextNode = walker.nextNode();
        if (firstTextNode) {
          const text = firstTextNode.textContent;
          const spacePos = text.lastIndexOf(' ');
          expandedRange.setStart(firstTextNode, spacePos >= 0 ? spacePos + 1 : 0);
        }
      }

      let endContainer = expandedRange.endContainer;
      if (endContainer.nodeType === Node.TEXT_NODE) {
        const text = endContainer.textContent;
        let newOffset = expandedRange.endOffset;
        while (newOffset < text.length && text[newOffset] !== ' ') newOffset++;
        expandedRange.setEnd(endContainer, newOffset);
      } else {
        const walker = document.createTreeWalker(endContainer, NodeFilter.SHOW_TEXT, null);
        let lastTextNode = null;
        let node;
        while ((node = walker.nextNode())) lastTextNode = node;
        if (lastTextNode) {
          const text = lastTextNode.textContent;
          const spacePos = text.indexOf(' ');
          expandedRange.setEnd(lastTextNode, spacePos >= 0 ? spacePos : text.length);
        }
      }

      while (true) {
        const sc = expandedRange.startContainer;
        const so = expandedRange.startOffset;
        if (sc.nodeType === Node.TEXT_NODE && so === 0) {
          const prevNode = sc.previousSibling;
          if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
            const text = prevNode.textContent;
            const sp = text.lastIndexOf(' ');
            expandedRange.setStart(prevNode, sp >= 0 ? sp + 1 : 0);
            continue;
          }
        }
        break;
      }

      while (true) {
        const ec = expandedRange.endContainer;
        const eo = expandedRange.endOffset;
        if (ec.nodeType === Node.TEXT_NODE && eo >= ec.textContent.length) {
          const nextNode = ec.nextSibling;
          if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
            const text = nextNode.textContent;
            const sp = text.indexOf(' ');
            expandedRange.setEnd(nextNode, sp >= 0 ? sp : text.length);
            continue;
          }
        }
        break;
      }

      return expandedRange;
    }

    let expandedRange;
    try {
      expandedRange = expandRangeToSpaces(range);
    } catch (e) {
      expandedRange = range.cloneRange();
    }

    const expandedText = expandedRange.toString();
    if (!expandedText || expandedText.trim() === '') {
      if (!range.toString().trim()) { alert('Не удалось расширить выделение'); return; }
      expandedRange = range.cloneRange();
    }

    const underlineClasses = ['span-participle', 'span-gerund', 'span-subject', 'span-predicate'];
    const isUnderlineClass = underlineClasses.includes(className);

    if (isUnderlineClass) {
      const startParent = expandedRange.startContainer.nodeType === 1
        ? expandedRange.startContainer
        : expandedRange.startContainer.parentElement;
      let parentUnderlineSpan = null;
      let cur = startParent;
      while (cur && cur !== editor) {
        if (cur.classList) {
          for (const cls of underlineClasses) {
            if (cur.classList.contains(cls)) { parentUnderlineSpan = cur; break; }
          }
          if (parentUnderlineSpan) break;
        }
        cur = cur.parentElement;
      }

      if (parentUnderlineSpan) {
        const parentText = parentUnderlineSpan.textContent.trim();
        const rangeText = expandedRange.toString().trim();
        const spanRange = document.createRange();
        spanRange.selectNodeContents(parentUnderlineSpan);
        const isExactMatch =
          expandedRange.compareBoundaryPoints(Range.START_TO_START, spanRange) === 0 &&
          expandedRange.compareBoundaryPoints(Range.END_TO_END, spanRange) === 0;
        const isAlmostMatch =
          rangeText === parentText ||
          (rangeText.length >= parentText.length * 0.95 && rangeText.length <= parentText.length * 1.05);

        if (isExactMatch || isAlmostMatch) {
          const gp = parentUnderlineSpan.parentNode;
          if (gp) {
            while (parentUnderlineSpan.firstChild) gp.insertBefore(parentUnderlineSpan.firstChild, parentUnderlineSpan);
            gp.removeChild(parentUnderlineSpan);
          }
        } else {
          const parentClass = underlineClasses.find(c => parentUnderlineSpan.classList.contains(c));
          const allowed = { 'span-participle': ['span-gerund', 'span-participle'], 'span-gerund': ['span-participle', 'span-gerund'] };
          if (parentClass === 'span-participle' || parentClass === 'span-gerund') {
            if (!allowed[parentClass].includes(className)) {
              alert('Невозможно создать вложенный оборот: разрешены только комбинации причастный/деепричастный');
              selection.removeAllRanges();
              return;
            }
          } else {
            alert('Невозможно создать вложенный оборот внутри подлежащего или сказуемого');
            selection.removeAllRanges();
            return;
          }
        }
      } else {
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(expandedRange.cloneContents());
        if (tempDiv.querySelectorAll('.span-participle, .span-gerund, .span-subject, .span-predicate').length > 0) {
          const allUnderlineSpans = editor.querySelectorAll('.span-participle, .span-gerund, .span-subject, .span-predicate');
          for (const realSpan of allUnderlineSpans) {
            const spanRange = document.createRange();
            spanRange.selectNodeContents(realSpan);
            if (
              expandedRange.compareBoundaryPoints(Range.START_TO_START, spanRange) <= 0 &&
              expandedRange.compareBoundaryPoints(Range.END_TO_END, spanRange) >= 0
            ) {
              const gp = realSpan.parentNode;
              if (gp) {
                while (realSpan.firstChild) gp.insertBefore(realSpan.firstChild, realSpan);
                gp.removeChild(realSpan);
              }
              break;
            }
          }
        }
      }
    }

    const span = document.createElement('span');
    span.className = className;

    if (className === 'span-main-word') {
      const usedColors = new Set();
      const textEditor = editor.closest('.task17-text-editable') || document.querySelector('.task17-text-editable');
      if (textEditor) {
        textEditor.querySelectorAll('.span-main-word[data-color-id]').forEach(el => {
          const id = el.getAttribute('data-color-id');
          if (id !== null && id !== '') usedColors.add(parseInt(id));
        });
      }
      let freeIndex = 0;
      while (usedColors.has(freeIndex) && freeIndex < COLOR_PALETTE.length) freeIndex++;
      const color = COLOR_PALETTE[freeIndex % COLOR_PALETTE.length];
      span.setAttribute('data-color-id', freeIndex);
      applyMainWordColor(span, color);
    }

    try {
      if (expandedRange.collapsed || !expandedRange.toString().trim()) {
        alert('Не удалось создать выделение: пустое выделение');
        selection.removeAllRanges();
        return;
      }
      expandedRange.surroundContents(span);
    } catch (e) {
      try {
        const contents = expandedRange.extractContents();
        if (!contents || contents.childNodes.length === 0) {
          alert('Не удалось создать выделение: пустое содержимое');
          selection.removeAllRanges();
          return;
        }
        span.appendChild(contents);
        expandedRange.insertNode(span);
      } catch (extractError) {
        console.error('Ошибка при создании выделения:', extractError);
        alert('Не удалось создать выделение. Попробуйте выделить текст заново.');
        selection.removeAllRanges();
        return;
      }
    }

    if (className === 'span-main-word') {
      requestAnimationFrame(() => {
        const colorId = span.getAttribute('data-color-id');
        if (colorId !== null && colorId !== '') {
          applyMainWordColor(span, COLOR_PALETTE[parseInt(colorId) % COLOR_PALETTE.length]);
        }
      });
      span.querySelectorAll('.span-participle, .span-gerund, .span-subject, .span-predicate').forEach(s => {
        s.style.position = 'relative';
        s.style.zIndex = '1';
      });
    }

    selection.removeAllRanges();

    if (className === 'span-main-word') {
      const colorId = span.getAttribute('data-color-id');
      requestAnimationFrame(() => {
        const mw = editor.querySelector(`.span-main-word[data-color-id="${colorId}"]`);
        if (mw) applyMainWordColor(mw, COLOR_PALETTE[parseInt(colorId) % COLOR_PALETTE.length]);
      });
    }
  } catch (err) {
    console.error('Ошибка при применении стиля:', err);
  }
}
window.applySpanClass = applySpanClass;

// ─── removeMark ───────────────────────────────────────────────────────────────

function removeMark() {
  const selection = window.getSelection();
  if (!selection.rangeCount) { alert('Выделите текст для удаления отметки'); return; }

  const range = selection.getRangeAt(0);
  const parent = range.commonAncestorContainer.nodeType === 3
    ? range.commonAncestorContainer.parentElement
    : range.commonAncestorContainer;

  if (
    parent && (
      parent.classList.contains('span-participle') ||
      parent.classList.contains('span-gerund') ||
      parent.classList.contains('span-main-word') ||
      parent.classList.contains('span-subject') ||
      parent.classList.contains('span-predicate')
    )
  ) {
    const editor = parent.closest('.task17-text-editable');
    if (editor) _saveUndo(editor);
    const grandParent = parent.parentNode;
    if (grandParent) {
      grandParent.replaceChild(document.createTextNode(parent.textContent), parent);
      selection.removeAllRanges();
    } else {
      alert('Ошибка: не удалось найти родительский элемент');
    }
  } else {
    alert('Выделите текст с отметкой для удаления');
  }
}
window.removeMark = removeMark;

// ─── applyColorsInExplanation ─────────────────────────────────────────────────

function applyColorsInExplanation() {
  function applyColor(element, color) {
    if (element.classList.contains('span-main-word')) {
      applyMainWordColor(element, color);
    } else {
      applyLinkedTurnColor(element, color);
    }
  }

  document.querySelectorAll('.task17-explanation-content').forEach(explanationDiv => {
    explanationDiv.querySelectorAll('.span-main-word[data-color-id]').forEach(mainWord => {
      const colorId = mainWord.getAttribute('data-color-id');
      if (!colorId || colorId === '') return;
      const color = COLOR_PALETTE[parseInt(colorId) % COLOR_PALETTE.length];
      applyColor(mainWord, color);
      explanationDiv.querySelectorAll(`[data-linked-to="${colorId}"]`).forEach(turn => applyColor(turn, color));
    });
  });
}
window.applyColorsInExplanation = applyColorsInExplanation;

// ─── React-компоненты ─────────────────────────────────────────────────────────

const { useState, useEffect, useRef } = React;

function Task17Item({ task, taskId: taskIdProp, index = 0, showDigits = true }) {
  const taskId = task?.id ?? taskIdProp;
  const [currentMode, setCurrentMode] = useState('digits');
  const [taskData, setTaskData] = useState(null);
  const [selectedDigits, setSelectedDigits] = useState(new Set());
  const [commaPositions, setCommaPositions] = useState(new Set());
  const [answerInput, setAnswerInput] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [correctDigits, setCorrectDigits] = useState(new Set());
  const [extraDigits, setExtraDigits] = useState(new Set());
  const [correctCommaPositions, setCorrectCommaPositions] = useState(new Set());
  const [extraCommaPositions, setExtraCommaPositions] = useState(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    setCurrentMode(showDigits ? 'digits' : 'commas');
    setCommaPositions(new Set());
    setSelectedDigits(new Set());
    setCorrectCommaPositions(new Set());
    setExtraCommaPositions(new Set());
    setCorrectDigits(new Set());
    setExtraDigits(new Set());
    setAnswerInput('');
  }, [showDigits]);

  useEffect(() => {
    const loadTask = async () => {
      try {
        setLoading(true);
        setCorrectDigits(new Set());
        setExtraDigits(new Set());
        setCorrectCommaPositions(new Set());
        setExtraCommaPositions(new Set());
        setCheckResult(null);
        const response = await fetch(`/api/task17/${taskId}/play?mode=${currentMode}`);
        if (!response.ok) throw new Error('Не удалось загрузить задание');
        const data = await response.json();
        if (data.text) data.text = data.text.replace(/\s+/g, ' ').trim();
        setTaskData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    loadTask();
  }, [taskId, currentMode]);

  useEffect(() => {
    if (showSolution && taskData?.explanation?.explanation_md) {
      setTimeout(() => {
        const explanationDiv = document.getElementById(`task17-explanation-${taskId}`);
        if (explanationDiv && typeof applyColorsInExplanation === 'function') {
          applyColorsInExplanation();
        }
      }, 300);
    }
  }, [showSolution, taskData, taskId]);

  const handleDigitClick = (digit) => {
    setSelectedDigits(prev => {
      const next = new Set(prev);
      if (next.has(digit)) next.delete(digit); else next.add(digit);
      return next;
    });
  };

  const handleSpaceClick = (offset) => {
    setCommaPositions(prev => {
      const next = new Set(prev);
      if (next.has(offset)) next.delete(offset); else next.add(offset);
      return next;
    });
  };

  useEffect(() => {
    if (currentMode === 'digits') {
      setAnswerInput(Array.from(selectedDigits).sort((a, b) => a - b).join(''));
    } else {
      setAnswerInput(Array.from(commaPositions).sort((a, b) => a - b).join(', '));
    }
  }, [selectedDigits, commaPositions, currentMode]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setAnswerInput(value);
    setSelectedDigits(new Set(value.split('').map(c => parseInt(c, 10)).filter(n => !isNaN(n) && n > 0)));
  };

  const handleCheck = async () => {
    if (!taskData) return;
    let payload = { mode: currentMode, spans: [] };

    if (currentMode === 'digits') {
      const currentDigits = Array.from(selectedDigits).sort((a, b) => a - b);
      if (currentDigits.length === 0) {
        alert('Введите ответ, выбрав цифры в тексте или введя их вручную');
        if (inputRef.current) inputRef.current.focus();
        return;
      }
      payload.digits = currentDigits;
    } else {
      payload.comma_positions = Array.from(commaPositions).sort((a, b) => a - b);
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/task17/${taskId}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Ошибка проверки');
      const result = await response.json();
      setCheckResult(result);

      if (currentMode === 'digits') {
        setCorrectDigits(new Set(result.correctAnswer || []));
        setExtraDigits(new Set(result.digits?.extra || []));
        setCorrectCommaPositions(new Set());
        setExtraCommaPositions(new Set());
      } else {
        if (result.correctAnswer && Array.isArray(result.correctAnswer)) {
          setCorrectCommaPositions(new Set(result.correctAnswer.map(p => Number(p))));
        } else {
          setCorrectCommaPositions(new Set());
        }
        setExtraCommaPositions(new Set((result.commas?.extra || []).map(p => Number(p))));
        setCorrectDigits(new Set());
        setExtraDigits(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка проверки');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !taskData) {
    return (
      <div className="task-card">
        <div className="task-content"><p>Загрузка задания {index + 1}...</p></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="task-card">
        <div className="task-content"><p style={{color: 'red'}}>Ошибка: {error}</p></div>
      </div>
    );
  }
  if (!taskData) return null;

  const isAnswerOk = checkResult && (
    (currentMode === 'digits' && checkResult.digits?.isCorrect) ||
    (currentMode === 'commas' && checkResult.commas?.isCorrect)
  );
  const statusPillClass = 'task-status-pill' +
    (checkResult ? (isAnswerOk ? ' task-status-pill--correct' : ' task-status-pill--incorrect') : '');
  const statusPillText = checkResult ? (isAnswerOk ? 'Верно' : 'Неверно') : 'Не решено';

  return (
    <div className="task-card">
      <div className="task-meta">
        <span className="task-meta__number">№ 17</span>
        <span className="task-meta__source">{taskData.source || `задание #${taskId}`}</span>
        <span className={statusPillClass}>{statusPillText}</span>
      </div>

      <div className="task-content">
        <div className="task-prompt" style={{position: 'relative'}}>
          <div
            className="task17-text-editable"
            id={`task17-text-${taskId}`}
            style={{padding: '0', borderRadius: '8px', background: 'transparent', position: 'relative'}}
            contentEditable={false}
            suppressContentEditableWarning={true}
            onCopy={(e) => {
              e.preventDefault();
              const originalText = (currentMode === 'commas' && taskData.source_text)
                ? taskData.source_text
                : (taskData.text || '');
              if (originalText && e.clipboardData) e.clipboardData.setData('text/plain', originalText);
            }}
          >
            <div style={{paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--glass-border)', fontSize: '16px', lineHeight: '1.6', color: 'var(--text-primary)', fontWeight: '500'}}>
              {currentMode === 'digits'
                ? 'Укажите цифру(-ы), на месте которой(-ых) должна(-ы) стоять запятая(-ые).'
                : 'Нажмите на пробелы в тексте, где должны стоять запятые.'}
            </div>

            {currentMode === 'digits' ? (
              parseTextWithDigits(taskData.text).map((part, idx) => {
                if (part.digit !== null) {
                  const isSelected = selectedDigits.has(part.digit);
                  const isCorrect = correctDigits.has(part.digit);
                  const isExtra = extraDigits.has(part.digit);
                  const hasResult = correctDigits.size > 0 || extraDigits.size > 0;
                  let digitClass = 'task17-digit';
                  if (hasResult) {
                    if (isExtra && isSelected) digitClass += ' extra-selected';
                    else if (isCorrect && isSelected) digitClass += ' correct-selected';
                    else if (isCorrect) digitClass += ' correct';
                    else if (isSelected) digitClass += ' selected';
                  } else if (isSelected) {
                    digitClass += ' selected';
                  }
                  return (
                    <span
                      key={`digit-${taskId}-${part.digit}-${idx}`}
                      className={digitClass}
                      data-digit={part.digit}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDigitClick(part.digit); }}
                      title={`Кликните, чтобы ${isSelected ? 'убрать' : 'добавить'} цифру ${part.digit} в ответ`}
                      style={{userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer', contentEditable: 'false'}}
                      contentEditable={false}
                      suppressContentEditableWarning={true}
                    >
                      {part.digit}
                    </span>
                  );
                }
                if (!part.text) return null;
                return <span key={`text-${taskId}-${idx}`}>{part.text}</span>;
              })
            ) : (
              (() => {
                const correctIndicesArray = checkResult && correctCommaPositions.size > 0
                  ? Array.from(correctCommaPositions)
                  : null;
                return parseTextWithSpaces(taskData.text, correctIndicesArray);
              })().map((part, idx) => {
                if (part.isClickable && part.spaceIndex != null) {
                  const spaceIndex = Number(part.spaceIndex);
                  const hasComma = commaPositions.has(spaceIndex);
                  const isCorrect = correctCommaPositions.has(spaceIndex);
                  const isExtra = extraCommaPositions.has(spaceIndex);
                  let bgColor = 'transparent', textColor = 'inherit', fontWeight = 'normal';
                  let displayComma = hasComma || (checkResult && isCorrect);
                  if (checkResult) {
                    if (hasComma && isExtra) {
                      bgColor = 'rgba(214, 146, 149, 0.3)'; textColor = '#D69295'; fontWeight = 'bold'; displayComma = true;
                    } else if (isCorrect) {
                      bgColor = 'rgba(164, 226, 208, 0.3)'; textColor = '#A4E2D0'; fontWeight = 'bold'; displayComma = true;
                    } else if (hasComma) {
                      bgColor = 'var(--brand-muted)'; textColor = 'var(--brand)'; fontWeight = 'bold'; displayComma = true;
                    }
                  } else if (hasComma) {
                    bgColor = 'var(--brand-muted)'; textColor = 'var(--brand)'; fontWeight = 'bold'; displayComma = true;
                  }
                  return (
                    <span
                      key={`space-${taskId}-${spaceIndex}-${idx}`}
                      className={`task17-space ${hasComma ? 'task17-space-with-comma' : ''} ${isCorrect ? 'task17-space-correct' : ''} ${isExtra ? 'task17-space-extra' : ''}`}
                      data-space-index={spaceIndex}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSpaceClick(spaceIndex); }}
                      title="Кликните, чтобы поставить запятую"
                      style={{backgroundColor: bgColor, color: textColor, fontWeight}}
                    >
                      {displayComma ? ',' : ' '}
                    </span>
                  );
                }
                const textToDisplay = part?.text ?? '';
                return <span key={`text-${taskId}-${idx}`}>{textToDisplay}</span>;
              })
            )}
          </div>
        </div>

        <div className="task-controls">
          {currentMode === 'digits' && (
            <input
              ref={inputRef}
              className={'task-input' + (checkResult ? (isAnswerOk ? ' input-correct' : ' input-incorrect') : '')}
              type="text"
              value={answerInput}
              onChange={handleInputChange}
              placeholder="Введите свой ответ"
              inputMode="numeric"
              onKeyPress={(e) => { if (e.key === 'Enter') handleCheck(); }}
            />
          )}
          <button className="task-send" onClick={handleCheck} disabled={loading}>
            <span>{loading ? 'Проверка...' : 'Отправить'}</span>
          </button>
          <button className="task-solution" onClick={() => setShowSolution(!showSolution)}>
            <span>Решение</span>
            <img src={showSolution ? '/images/eye on.svg' : '/images/eye off.svg'} alt="Глаз" width="16" height="16"/>
          </button>
          <button className="task-like" onClick={() => setIsLiked(!isLiked)}>
            <img src={isLiked ? '/images/heart on.svg' : '/images/heart off.svg'} alt="Лайк" width="16" height="16"/>
          </button>
        </div>

        {showSolution && taskData?.explanation && (
          <div id={`task17-solution-block-${taskId}`} style={{marginTop: '24px'}}>
            {taskData.explanation.answer_text && (
              <div style={{marginBottom: '12px'}} className="solution-answer">
                <strong>Ответ:</strong> {taskData.explanation.answer_text}
              </div>
            )}
            {taskData.explanation.explanation_md && (
              <div>
                <h4 style={{marginTop: 0, marginBottom: '12px'}}>Объяснение:</h4>
                <div
                  id={`task17-explanation-${taskId}`}
                  dangerouslySetInnerHTML={{
                    __html: taskData.explanation.explanation_md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }}
                  className="editor-content task17-explanation-content"
                  style={{position: 'relative', fontSize: '18px', lineHeight: '1.8'}}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Task17List ───────────────────────────────────────────────────────────────

function Task17List() {
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDigits, setShowDigits] = useState(true);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/task17')
      .then(r => r.json())
      .then(tasks => { setAllTasks(tasks); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.querySelectorAll('.task17-text-editable').forEach(editor => {
      editor.querySelectorAll('.task17-digit').forEach(digit => {
        digit.style.display = showDigits ? '' : 'none';
      });
    });
  }, [showDigits]);

  if (loading) return <div style={{padding: '20px'}}><p>Загрузка заданий...</p></div>;
  if (!allTasks.length) return <div style={{padding: '20px'}}><p>Заданий №17 пока нет.</p></div>;

  return (
    <div className="task17-wrapper">
      <div style={{flex: 1, maxWidth: '800px'}}>
        {allTasks.map((task, index) => (
          <Task17Item key={task.id} task={task} index={index} showDigits={showDigits} />
        ))}
      </div>
      <div
        className="task17-control-panel"
        style={{
          width: isSettingsExpanded ? 'auto' : '40px',
          minWidth: isSettingsExpanded ? '240px' : '40px',
          height: isSettingsExpanded ? 'auto' : '40px',
          padding: isSettingsExpanded ? '12px' : '0',
          borderRadius: '8px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--glass-border)',
          transition: 'all 0.3s ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: isSettingsExpanded ? 'row' : 'column',
          alignItems: isSettingsExpanded ? 'center' : 'stretch',
          gap: isSettingsExpanded ? '12px' : '0'
        }}
      >
        <div
          onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
          style={{cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', width: '40px', height: '40px', minWidth: '40px', borderRadius: '4px', transition: 'background-color 0.2s ease', flexShrink: 0}}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          title="Настройки отображения"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{transform: isSettingsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', color: 'var(--text-primary)'}}>
            <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {isSettingsExpanded && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: 0}}>
            <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px', gap: '12px', padding: '4px 0'}}>
              <span style={{flex: 1, minWidth: 0}}>Показывать цифры</span>
              <div
                onClick={e => { e.stopPropagation(); setShowDigits(!showDigits); }}
                style={{width: '48px', height: '24px', background: showDigits ? 'var(--brand)' : 'var(--text-disabled)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease', borderRadius: '12px', flexShrink: 0}}
              >
                <div style={{width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: showDigits ? '26px' : '2px', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'}} />
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Task17Play (одиночное задание с навигацией) ──────────────────────────────

function Task17Play({ taskId: initialTaskId }) {
  const [allTasks, setAllTasks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [showDigits, setShowDigits] = useState(true);

  useEffect(() => {
    fetch('/api/task17')
      .then(r => r.json())
      .then(tasks => {
        setAllTasks(tasks);
        const idx = initialTaskId != null
          ? tasks.findIndex(t => t.id == initialTaskId)
          : 0;
        setCurrentIndex(idx >= 0 ? idx : 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{padding: '20px'}}><p>Загрузка...</p></div>;
  if (!allTasks.length) return <div style={{padding: '20px'}}><p>Заданий №17 пока нет.</p></div>;

  const idx = currentIndex >= 0 && currentIndex < allTasks.length ? currentIndex : 0;
  const task = allTasks[idx];

  const goPrev = () => {
    const next = idx - 1;
    setCurrentIndex(next);
    window.history.pushState({}, '', `/task17/${allTasks[next].id}`);
  };
  const goNext = () => {
    const next = idx + 1;
    setCurrentIndex(next);
    window.history.pushState({}, '', `/task17/${allTasks[next].id}`);
  };

  return (
    <div className="task17-wrapper">
      <div style={{flex: 1, maxWidth: '800px'}}>
        {allTasks.length > 1 && (
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <button
              disabled={idx === 0}
              style={{padding: '8px 16px', background: idx === 0 ? 'var(--text-disabled)' : 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1, fontSize: '14px', transition: 'all 0.3s ease'}}
              onClick={goPrev}
            >← Предыдущее</button>
            <span style={{color: 'var(--text-secondary)', fontSize: '14px'}}>
              Задание {idx + 1} из {allTasks.length}
            </span>
            <button
              disabled={idx === allTasks.length - 1}
              style={{padding: '8px 16px', background: idx === allTasks.length - 1 ? 'var(--text-disabled)' : 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', cursor: idx === allTasks.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === allTasks.length - 1 ? 0.5 : 1, fontSize: '14px', transition: 'all 0.3s ease'}}
              onClick={goNext}
            >Следующее →</button>
          </div>
        )}
        <Task17Item key={task.id} task={task} index={idx} showDigits={showDigits} />
      </div>
      <div className="task17-control-panel">
        <div style={{marginBottom: '16px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px'}}>
          Настройки отображения
        </div>
        <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px'}}>
          <span>Показывать цифры</span>
          <div
            onClick={() => setShowDigits(!showDigits)}
            style={{width: '48px', height: '24px', borderRadius: '12px', background: showDigits ? 'var(--brand)' : 'var(--text-disabled)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease', boxShadow: 'none'}}
          >
            <div style={{width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: showDigits ? '26px' : '2px', transition: 'all 0.3s ease', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'}} />
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── Глобальный экспорт компонента ────────────────────────────────────────────

window.Task17Item = Task17Item;

// ─── Точка входа ──────────────────────────────────────────────────────────────

const _container = document.getElementById('task17Container');
if (_container) {
  const _root = ReactDOM.createRoot(_container);
  if (window.task17InitialId != null) {
    _root.render(<Task17Play taskId={window.task17InitialId} />);
  } else {
    _root.render(<Task17List />);
  }
}

// ─── Режим связывания ─────────────────────────────────────────────────────────

let selectedMainWord = null;
let isLinkingMode = false;

function initMainWordColorSelection() {
  function applyColor(element, color) {
    if (element.classList.contains('span-main-word')) {
      applyMainWordColor(element, color);
    } else {
      applyLinkedTurnColor(element, color);
    }
  }

  function getColorForMainWord(mainWord) {
    const colorId = mainWord.getAttribute('data-color-id');
    if (colorId !== null && colorId !== '') {
      const index = parseInt(colorId);
      return { index, color: COLOR_PALETTE[index % COLOR_PALETTE.length] };
    }
    const usedColors = new Set();
    document.querySelectorAll('.task17-text-editable .span-main-word[data-color-id]').forEach(el => {
      const id = el.getAttribute('data-color-id');
      if (id !== null && id !== '') usedColors.add(parseInt(id));
    });
    let freeIndex = 0;
    while (usedColors.has(freeIndex) && freeIndex < COLOR_PALETTE.length) freeIndex++;
    return { index: freeIndex, color: COLOR_PALETTE[freeIndex % COLOR_PALETTE.length] };
  }

  function assignColorToMainWord(mainWord) {
    const colorData = getColorForMainWord(mainWord);
    mainWord.setAttribute('data-color-id', colorData.index);
    applyColor(mainWord, colorData.color);
  }

  function activateLinkingMode(mainWord) {
    let colorId = mainWord.getAttribute('data-color-id');
    if (!colorId || colorId === '') {
      assignColorToMainWord(mainWord);
      colorId = mainWord.getAttribute('data-color-id');
    } else {
      applyColor(mainWord, COLOR_PALETTE[parseInt(colorId) % COLOR_PALETTE.length]);
    }

    if (isLinkingMode && selectedMainWord && selectedMainWord !== mainWord) {
      if (typeof window.cancelLinkingMode === 'function') window.cancelLinkingMode();
    }

    selectedMainWord = mainWord;
    isLinkingMode = true;
    mainWord.style.outline = '3px solid rgba(236, 72, 153, 0.8)';
    mainWord.style.outlineOffset = '2px';

    setTimeout(() => {
      if (typeof window.setupLinkingModeHover === 'function') window.setupLinkingModeHover();
    }, 100);
  }

  function linkTurnToMainWord(mainWord, turn) {
    const colorId = mainWord.getAttribute('data-color-id');
    if (!colorId || colorId === '') return;
    const color = COLOR_PALETTE[parseInt(colorId) % COLOR_PALETTE.length];
    applyColor(turn, color);
    turn.setAttribute('data-linked-to', colorId);
    turn.style.transform = 'scale(1.05)';
    turn.style.transition = 'transform 0.2s ease';
    setTimeout(() => { turn.style.transform = ''; }, 200);
    requestAnimationFrame(() => {
      if (turn.getAttribute('data-linked-to') === colorId) applyColor(turn, color);
    });
    if (typeof window.cancelLinkingMode === 'function') window.cancelLinkingMode();
  }

  function cancelLinkingMode() {
    if (selectedMainWord) {
      const mainWordRef = selectedMainWord;
      const colorId = mainWordRef.getAttribute('data-color-id');
      mainWordRef.style.outline = '';
      mainWordRef.style.outlineOffset = '';
      if (colorId && colorId !== '') {
        const color = COLOR_PALETTE[parseInt(colorId) % COLOR_PALETTE.length];
        applyColor(mainWordRef, color);
        requestAnimationFrame(() => {
          if (mainWordRef.getAttribute('data-color-id') === colorId) applyColor(mainWordRef, color);
        });
      }
      selectedMainWord = null;
    }
    isLinkingMode = false;
    removeLinkingModeHover();
  }

  let hoverHandlers = new WeakMap();

  function setupLinkingModeHover() {
    if (!isLinkingMode || !selectedMainWord) return;
    const colorId = selectedMainWord.getAttribute('data-color-id');
    if (!colorId) return;
    const color = COLOR_PALETTE[parseInt(colorId) % COLOR_PALETTE.length];

    document.querySelectorAll('.span-participle, .span-gerund').forEach(turn => {
      if (turn.getAttribute('data-linked-to') === colorId) return;
      const existing = hoverHandlers.get(turn);
      if (existing) {
        turn.removeEventListener('mouseenter', existing.enter);
        turn.removeEventListener('mouseleave', existing.leave);
      }
      turn.style.cursor = 'pointer';
      turn.style.transition = 'all 0.2s ease';
      const enterHandler = function() {
        if (isLinkingMode && this.getAttribute('data-linked-to') !== colorId) {
          this.style.backgroundColor = color.bg || 'rgba(59, 130, 246, 0.15)';
          this.style.opacity = '0.8';
        }
      };
      const leaveHandler = function() {
        if (this.getAttribute('data-linked-to') !== colorId) {
          this.style.backgroundColor = '';
          this.style.opacity = '';
        }
      };
      turn.addEventListener('mouseenter', enterHandler);
      turn.addEventListener('mouseleave', leaveHandler);
      hoverHandlers.set(turn, { enter: enterHandler, leave: leaveHandler });
    });
  }

  function removeLinkingModeHover() {
    document.querySelectorAll('.span-participle, .span-gerund').forEach(turn => {
      const handlers = hoverHandlers.get(turn);
      if (handlers) {
        turn.removeEventListener('mouseenter', handlers.enter);
        turn.removeEventListener('mouseleave', handlers.leave);
        hoverHandlers.delete(turn);
      }
      turn.style.cursor = '';
      turn.style.opacity = '';
      const linkedTo = turn.getAttribute('data-linked-to');
      if (!linkedTo || linkedTo === '') {
        turn.style.backgroundColor = '';
      } else {
        applyColor(turn, COLOR_PALETTE[parseInt(linkedTo) % COLOR_PALETTE.length]);
      }
    });
  }

  window.cancelLinkingMode = cancelLinkingMode;
  window.setupLinkingModeHover = setupLinkingModeHover;
  window.removeLinkingModeHover = removeLinkingModeHover;
  window.activateLinkingMode = activateLinkingMode;

  document.addEventListener('click', (e) => {
    if (isLinkingMode && selectedMainWord) {
      const turn = e.target.closest('.span-participle, .span-gerund');
      if (turn) {
        e.preventDefault();
        e.stopPropagation();
        linkTurnToMainWord(selectedMainWord, turn);
        return;
      }
    }
    const mainWord = e.target.closest('.span-main-word');
    if (mainWord) {
      const selection = window.getSelection();
      if (selection.toString().trim().length > 0 && !selection.isCollapsed) return;
      if (isLinkingMode && selectedMainWord && mainWord !== selectedMainWord) {
        e.preventDefault();
        e.stopPropagation();
        activateLinkingMode(mainWord);
        return;
      }
    }
  }, false);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isLinkingMode) {
      if (typeof window.cancelLinkingMode === 'function') window.cancelLinkingMode();
    }
  });
}

// ─── initFloatingToolbar ──────────────────────────────────────────────────────

function initFloatingToolbar() {
  let textSelectionToolbar = null;
  let floatingToolbar = null;

  textSelectionToolbar = new TextSelectionToolbar({
    containerId: 'task17-floating-toolbar',
    editorSelector: '.task17-text-editable',
    ignoreSelectors: ['.task17-digit'],
    defaultButtons: true,
    onButtonClick: (buttonConfig) => {
      if (buttonConfig.class && typeof window.applySpanClass === 'function') {
        window.applySpanClass(buttonConfig.class);
      }
    },
    onRemoveClick: () => {
      if (typeof window.removeMark === 'function') window.removeMark();
    }
  });

  floatingToolbar = document.getElementById('task17-floating-toolbar');
  if (!floatingToolbar) return;

  function setupClickOnMarks() {
    document.querySelectorAll('.span-participle, .span-gerund, .span-subject, .span-predicate, .span-main-word').forEach(mark => {
      if (mark.dataset.clickSetup) return;
      mark.dataset.clickSetup = 'true';

      mark.addEventListener('click', function(e) {
        if (e.target.closest('.task17-digit')) return;
        if (typeof isLinkingMode !== 'undefined' && isLinkingMode &&
            (this.classList.contains('span-participle') || this.classList.contains('span-gerund'))) return;

        const selection = window.getSelection();
        if (selection.toString().trim().length > 0 && !selection.isCollapsed) return;

        const clickedElement = e.target.closest('.span-participle, .span-gerund, .span-subject, .span-predicate, .span-main-word');
        if (clickedElement && clickedElement !== this) return;

        if (this.classList.contains('span-main-word')) {
          if (typeof isLinkingMode !== 'undefined' && isLinkingMode && selectedMainWord === this) {
            e.preventDefault();
            e.stopPropagation();
            const range = document.createRange();
            range.selectNodeContents(this);
            textSelectionToolbar && textSelectionToolbar.show(range, { showRemoveButton: true });
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          floatingToolbar.classList.remove('show');
          if (typeof window.activateLinkingMode === 'function') window.activateLinkingMode(this);
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        const range = document.createRange();
        range.selectNodeContents(this);
        textSelectionToolbar && textSelectionToolbar.show(range, { showRemoveButton: true });
      }, true);
    });
  }

  const markClickObserver = new MutationObserver(() => setupClickOnMarks());
  markClickObserver.observe(document.body, { childList: true, subtree: true });
  setupClickOnMarks();

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.span-participle, .span-gerund, .span-subject, .span-predicate, .span-main-word')) return;
    if (floatingToolbar && !floatingToolbar.contains(e.target)) {
      setTimeout(() => {
        if (floatingToolbar && !floatingToolbar.contains(document.activeElement)) {
          floatingToolbar.classList.remove('show');
        }
      }, 200);
    }
  });

  textSelectionToolbar.setupAutoShow();
  window.showToolbar = (range) => textSelectionToolbar && textSelectionToolbar.show(range, { showRemoveButton: true });
}

// ─── setupMainWordHoverGlow ────────────────────────────────────────────────────

function setupMainWordHoverGlow() {
  const processedElements = new WeakSet();

  function setupGlowForElement(mainWord) {
    if (processedElements.has(mainWord)) return;
    processedElements.add(mainWord);

    let borderColor = null;
    const cssVar = getComputedStyle(mainWord).getPropertyValue('--main-word-border-color').trim();
    if (cssVar && cssVar !== 'transparent') borderColor = cssVar;

    if (!borderColor) {
      const outline = mainWord.style.outline;
      if (outline) { const m = outline.match(/rgba?\([^)]+\)/); if (m) borderColor = m[0]; }
    }
    if (!borderColor) borderColor = mainWord.style.borderColor;

    if (borderColor) {
      let glowColor = borderColor.startsWith('rgb(')
        ? borderColor.replace('rgb(', 'rgba(').replace(')', ', 0.6)')
        : borderColor.replace(/,\s*[\d.]+\)$/, ', 0.6)');
      let glowColorInner = borderColor.startsWith('rgb(')
        ? borderColor.replace('rgb(', 'rgba(').replace(')', ', 0.4)')
        : borderColor.replace(/,\s*[\d.]+\)$/, ', 0.4)');

      mainWord.addEventListener('mouseenter', function() {
        this.style.boxShadow = `0 0 12px ${glowColor}, 0 0 6px ${glowColorInner}`;
      });
      mainWord.addEventListener('mouseleave', function() {
        this.style.boxShadow = '';
      });
    }
  }

  const observer = new MutationObserver(() => {
    document.querySelectorAll('.span-main-word').forEach(setupGlowForElement);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'data-color-id'] });

  setTimeout(() => {
    document.querySelectorAll('.span-main-word').forEach(setupGlowForElement);
  }, 100);
}

// ─── Инициализация ────────────────────────────────────────────────────────────

setTimeout(() => {
  if (typeof TextSelectionToolbar !== 'undefined') {
    initFloatingToolbar();
  }
  initMainWordColorSelection();
  setupMainWordHoverGlow();
}, 500);
