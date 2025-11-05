// public/js/task17/SpanEditor.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';

export type SpanType = 'participle' | 'gerund';

export interface Span {
  type: SpanType;
  startOffset: number;
  endOffset: number;
}

interface SpanEditorProps {
  text: string; // commaless_text
  onSpansChange: (spans: Span[]) => void;
  existingSpans?: Span[];
}

/**
 * Компонент для выделения причастных/деепричастных оборотов
 * Поддерживает multi-range выделение с Alt
 */
export const SpanEditor: React.FC<SpanEditorProps> = ({
  text,
  onSpansChange,
  existingSpans = []
}) => {
  const [spans, setSpans] = useState<Span[]>(existingSpans);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [showTypeMenu, setShowTypeMenu] = useState<{ x: number; y: number; start: number; end: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSpansChange(spans);
  }, [spans, onSpansChange]);

  // Преобразуем UTF-16 индексы в позиции в DOM
  const getTextSelection = useCallback((selection: Selection): { start: number; end: number } | null => {
    if (!containerRef.current || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const container = containerRef.current.querySelector('.span-editor-text');
    if (!container) return null;

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;

    return { start, end };
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) return;

    const textRange = getTextSelection(selection);
    if (!textRange || textRange.start === textRange.end) return;

    // Проверяем, нажат ли Alt для multi-range
    if (e.altKey) {
      // Добавляем новый диапазон к существующим
      setSelectionStart(textRange.start);
      setSelectionEnd(textRange.end);
      setShowTypeMenu({
        x: e.clientX,
        y: e.clientY,
        start: textRange.start,
        end: textRange.end
      });
    } else {
      // Новое выделение
      setSelectionStart(textRange.start);
      setSelectionEnd(textRange.end);
      setShowTypeMenu({
        x: e.clientX,
        y: e.clientY,
        start: textRange.start,
        end: textRange.end
      });
    }
  }, [getTextSelection]);

  const handleSpanTypeSelect = useCallback((type: SpanType) => {
    if (selectionStart === null || selectionEnd === null) return;

    const newSpan: Span = {
      type,
      startOffset: Math.min(selectionStart, selectionEnd),
      endOffset: Math.max(selectionStart, selectionEnd)
    };

    // Проверяем пересечения и удаляем перекрывающиеся спаны
    const filteredSpans = spans.filter(s => {
      return !(
        (newSpan.startOffset < s.endOffset && newSpan.endOffset > s.startOffset)
      );
    });

    setSpans([...filteredSpans, newSpan]);
    setShowTypeMenu(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionStart, selectionEnd, spans]);

  const handleRemoveSpan = useCallback((index: number) => {
    setSpans(spans.filter((_, i) => i !== index));
  }, [spans]);

  // Применяем спаны к тексту
  const renderTextWithSpans = () => {
    if (spans.length === 0) {
      return <span className="span-editor-text">{text}</span>;
    }

    // Сортируем спаны по startOffset
    const sortedSpans = [...spans].sort((a, b) => a.startOffset - b.startOffset);
    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedSpans.forEach((span, idx) => {
      // Добавляем текст до спана
      if (span.startOffset > lastIndex) {
        result.push(
          <span key={`text-${lastIndex}-${span.startOffset}`}>
            {text.substring(lastIndex, span.startOffset)}
          </span>
        );
      }

      // Добавляем спан
      result.push(
        <span
          key={`span-${idx}`}
          className={`span-participle span-${span.type}`}
          data-start={span.startOffset}
          data-end={span.endOffset}
          style={{ position: 'relative' }}
        >
          {text.substring(span.startOffset, span.endOffset)}
          <button
            onClick={() => handleRemoveSpan(spans.indexOf(span))}
            style={{
              position: 'absolute',
              top: '-20px',
              right: '0',
              background: 'rgba(255, 0, 0, 0.7)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '12px'
            }}
          >
            ×
          </button>
        </span>
      );

      lastIndex = span.endOffset;
    });

    // Добавляем остаток текста
    if (lastIndex < text.length) {
      result.push(
        <span key={`text-${lastIndex}-end`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return <span className="span-editor-text" onMouseUp={handleMouseUp}>{result}</span>;
  };

  return (
    <div ref={containerRef} className="span-editor" style={{ position: 'relative' }}>
      <div style={{ marginBottom: '16px' }}>
        {renderTextWithSpans()}
      </div>

      {showTypeMenu && (
        <div
          style={{
            position: 'fixed',
            left: `${showTypeMenu.x}px`,
            top: `${showTypeMenu.y}px`,
            background: 'var(--bg-tertiary, #1a1f3d)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '8px',
            zIndex: 1000,
            boxShadow: 'var(--shadow-glass)'
          }}
        >
          <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Выберите тип оборота:
          </div>
          <button
            onClick={() => handleSpanTypeSelect('participle')}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              marginBottom: '4px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Причастный
          </button>
          <button
            onClick={() => handleSpanTypeSelect('gerund')}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Деепричастный
          </button>
          <button
            onClick={() => {
              setShowTypeMenu(null);
              setSelectionStart(null);
              setSelectionEnd(null);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '4px',
              marginTop: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Отмена
          </button>
        </div>
      )}

      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div>Выделите текст (Alt + выделение для множественного выбора)</div>
        <div style={{ marginTop: '8px' }}>
          <span className="span-participle" style={{ textDecoration: 'underline wavy' }}>
            Причастный — волнистая линия
          </span>
          {' | '}
          <span className="span-gerund" style={{ position: 'relative', textDecoration: 'none' }}>
            Деепричастный — точка-тире
          </span>
        </div>
      </div>
    </div>
  );
};

