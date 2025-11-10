// public/js/task17/CommaSlots.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';

interface CommaSlotsProps {
  text: string; // commaless_text
  onCommaPositionsChange: (positions: number[]) => void;
  selectedPositions?: number[];
  correctPositions?: number[]; // Правильные позиции для подсветки зеленым
  extraPositions?: number[]; // Лишние позиции для подсветки красным
}

/**
 * Компонент для отображения текста с интерактивными слотами для запятых
 * Позиции - межсимвольные индексы [0..text.length]
 */
export const CommaSlots: React.FC<CommaSlotsProps> = ({
  text,
  onCommaPositionsChange,
  selectedPositions = [],
  correctPositions = [],
  extraPositions = []
}) => {
  const [positions, setPositions] = useState<Set<number>>(new Set(selectedPositions));
  const containerRef = useRef<HTMLDivElement>(null);

  // Синхронизируем внутреннее состояние с пропсами
  useEffect(() => {
    setPositions(new Set(selectedPositions));
  }, [selectedPositions]);

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
    
    // Проверяем, есть ли результат проверки (если есть correctPositions, значит проверка была)
    const hasCheckResult = correctPositions.length > 0 || extraPositions.length > 0;
    
    console.log('[CommaSlots] correctPositions:', correctPositions);
    console.log('[CommaSlots] extraPositions:', extraPositions);
    console.log('[CommaSlots] hasCheckResult:', hasCheckResult);
    console.log('[CommaSlots] text length:', text.length);

    for (let i = 0; i <= text.length; i++) {
      if (i < text.length) {
        result.push(
          <span key={`char-${i}`}>{text[i]}</span>
        );
      }

      // Добавляем слот для запятой после каждого символа (кроме последнего)
      const isSlotPosition = sortedPositions.includes(i);
      const isCorrect = correctPositions.some(p => Number(p) === i);
      const isExtra = extraPositions.some(p => Number(p) === i);
      
      // Логируем первые несколько позиций для отладки
      if (i < 10 || isCorrect || isSlotPosition) {
        console.log(`[CommaSlots] Позиция ${i}: isSlotPosition=${isSlotPosition}, isCorrect=${isCorrect}, isExtra=${isExtra}, hasCheckResult=${hasCheckResult}`);
      }
      
      // Определяем, нужно ли показывать запятую
      // Показываем запятую если:
      // 1. Пользователь выбрал эту позицию (isSlotPosition), ИЛИ
      // 2. Это правильная позиция и есть результат проверки (чтобы показать правильные запятые)
      const shouldShowComma = isSlotPosition || (isCorrect && hasCheckResult);
      
      // Определяем цвет подсветки: зеленый для правильных, красный для лишних
      let commaColor = 'var(--neon-cyan, #00f0ff)';
      let slotBgColor = 'transparent';
      
      if (isExtra && isSlotPosition) {
        // Лишняя позиция выбрана - красный (высший приоритет)
        commaColor = '#ef4444';
        slotBgColor = 'rgba(239, 68, 68, 0.2)';
      } else if (isCorrect && isSlotPosition) {
        // Правильная позиция выбрана - зеленый
        commaColor = '#22c55e';
        slotBgColor = 'rgba(34, 197, 94, 0.2)';
      } else if (isCorrect && hasCheckResult) {
        // Правильная позиция не выбрана, но есть результат проверки - светло-зеленый
        commaColor = '#22c55e';
        slotBgColor = 'rgba(34, 197, 94, 0.1)';
      } else if (isSlotPosition) {
        // Выбрана, но нет результата проверки - обычный cyan
        slotBgColor = 'rgba(0, 240, 255, 0.1)';
      }
      
      result.push(
        <span
          key={`slot-${i}`}
          className={`comma-slot ${isSlotPosition ? 'has-comma' : ''} ${isCorrect ? 'correct' : ''} ${isExtra ? 'extra' : ''}`}
          onClick={() => handleSlotClick(i)}
          style={{
            display: 'inline-block',
            width: '8px',
            height: '16px',
            margin: '0 2px',
            cursor: 'pointer',
            position: 'relative',
            verticalAlign: 'text-bottom',
            backgroundColor: slotBgColor,
            borderRadius: '2px',
            transition: 'all 0.2s'
          }}
          title={`Позиция ${i}`}
        >
          {shouldShowComma && (
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '18px',
                color: commaColor,
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


