// public/js/task17/CommaSlots.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';

interface CommaSlotsProps {
  text: string; // commaless_text
  onCommaPositionsChange: (positions: number[]) => void;
  selectedPositions?: number[];
}

/**
 * Компонент для отображения текста с интерактивными слотами для запятых
 * Позиции - межсимвольные индексы [0..text.length]
 */
export const CommaSlots: React.FC<CommaSlotsProps> = ({
  text,
  onCommaPositionsChange,
  selectedPositions = []
}) => {
  const [positions, setPositions] = useState<Set<number>>(new Set(selectedPositions));
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSlotClick = useCallback((position: number) => {
    // Разрешаем кликать только между токенами (после пробелов, знаков препинания)
    // Для упрощения разрешаем кликать везде, но можно улучшить логику
    
    const newPositions = new Set(positions);
    if (newPositions.has(position)) {
      newPositions.delete(position);
    } else {
      newPositions.add(position);
    }
    setPositions(newPositions);
    onCommaPositionsChange(Array.from(newPositions).sort((a, b) => a - b));
  }, [positions, onCommaPositionsChange]);

  // Разбиваем текст на символы с учетом позиций для запятых
  const renderText = () => {
    const result: React.ReactNode[] = [];
    const sortedPositions = Array.from(positions).sort((a, b) => a - b);

    for (let i = 0; i <= text.length; i++) {
      if (i < text.length) {
        result.push(
          <span key={`char-${i}`}>{text[i]}</span>
        );
      }

      // Добавляем слот для запятой после каждого символа (кроме последнего)
      const isSlotPosition = sortedPositions.includes(i);
      result.push(
        <span
          key={`slot-${i}`}
          className={`comma-slot ${isSlotPosition ? 'has-comma' : ''}`}
          onClick={() => handleSlotClick(i)}
          style={{
            display: 'inline-block',
            width: '8px',
            height: '16px',
            margin: '0 2px',
            cursor: 'pointer',
            position: 'relative',
            verticalAlign: 'text-bottom'
          }}
          title={`Позиция ${i}`}
        >
          {isSlotPosition && (
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '18px',
                color: 'var(--neon-cyan, #00f0ff)',
                fontWeight: 'bold'
              }}
            >
              ,
            </span>
          )}
        </span>
      );
    }

    return result;
  };

  return (
    <div ref={containerRef} className="comma-slots">
      <div style={{ lineHeight: '1.8', fontSize: '16px' }}>
        {renderText()}
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        Кликните между символами, чтобы поставить запятую
      </div>
    </div>
  );
};

