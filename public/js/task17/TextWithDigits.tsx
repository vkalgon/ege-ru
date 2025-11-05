// public/js/task17/TextWithDigits.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';

interface TextWithDigitsProps {
  text: string; // source_text с метками (1)...(N)
  onDigitsChange: (digits: number[]) => void;
  selectedDigits?: number[];
  correctDigits?: number[]; // Правильные цифры для подсветки зеленым
  extraDigits?: number[]; // Лишние цифры для подсветки красным
}

/**
 * Компонент для отображения текста с кликабельными цифрами (1)...(N)
 */
export const TextWithDigits: React.FC<TextWithDigitsProps> = ({
  text,
  onDigitsChange,
  selectedDigits = [],
  correctDigits = [],
  extraDigits = []
}) => {
  const [digits, setDigits] = useState<Set<number>>(new Set(selectedDigits));

  // Синхронизируем внутреннее состояние с пропсами
  useEffect(() => {
    setDigits(new Set(selectedDigits));
  }, [selectedDigits]);

  // Парсим текст и находим все метки (1), (2), ...
  const parseText = useCallback((source: string) => {
    const parts: Array<{ text: string; digit: number | null }> = [];
    const regex = /\((\d+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(source)) !== null) {
      // Добавляем текст до метки
      if (match.index > lastIndex) {
        parts.push({
          text: source.substring(lastIndex, match.index),
          digit: null
        });
      }
      // Добавляем метку
      const digitNum = parseInt(match[1], 10);
      parts.push({
        text: match[0],
        digit: digitNum
      });
      lastIndex = match.index + match[0].length;
    }

    // Добавляем остаток текста
    if (lastIndex < source.length) {
      parts.push({
        text: source.substring(lastIndex),
        digit: null
      });
    }

    return parts;
  }, []);

  const handleDigitClick = useCallback((digit: number) => {
    const newDigits = new Set(digits);
    if (newDigits.has(digit)) {
      newDigits.delete(digit);
    } else {
      newDigits.add(digit);
    }
    setDigits(newDigits);
    onDigitsChange(Array.from(newDigits).sort((a, b) => a - b));
  }, [digits, onDigitsChange]);

  const parts = parseText(text);
  
  // Используем selectedDigits из пропсов для определения выбранных цифр
  const selectedSet = useMemo(() => new Set(selectedDigits), [selectedDigits]);

  return (
    <div className="text-with-digits">
      {parts.map((part, idx) => {
        if (part.digit !== null) {
          const isSelected = selectedSet.has(part.digit);
          // Убеждаемся, что сравнение идет по числам
          const isCorrect = correctDigits.some(d => Number(d) === part.digit);
          const isExtra = extraDigits.some(d => Number(d) === part.digit);
          
          // Определяем цвет подсветки: зеленый для правильных, красный для лишних
          // Приоритет: лишние (красный) > правильные выбранные (зеленый) > правильные не выбранные (светло-зеленый) > обычные выбранные (cyan)
          let backgroundColor = 'transparent';
          let color = 'var(--text-primary, #fff)';
          
          // Проверяем, есть ли результат проверки (если есть correctDigits или extraDigits, значит проверка была)
          const hasCheckResult = correctDigits.length > 0 || extraDigits.length > 0;
          
          // Определяем стили на основе состояния
          if (hasCheckResult) {
            if (isExtra && isSelected) {
              // Лишняя цифра - красный (высший приоритет)
              backgroundColor = '#ef4444';
              color = '#fff';
            } else if (isCorrect && isSelected) {
              // Правильная цифра выбрана - ярко зеленый
              backgroundColor = '#22c55e';
              color = '#fff';
            } else if (isCorrect) {
              // Правильная цифра не выбрана - светло зеленый
              backgroundColor = 'rgba(34, 197, 94, 0.3)';
              color = '#22c55e';
            } else if (isSelected) {
              // Выбрана, но не правильная и не лишняя (не должно быть, но на всякий случай)
              backgroundColor = 'var(--neon-cyan, #00f0ff)';
              color = 'var(--bg-primary, #0a0e27)';
            }
          } else if (isSelected) {
            // Обычная выбранная цифра (до проверки)
            backgroundColor = 'var(--neon-cyan, #00f0ff)';
            color = 'var(--bg-primary, #0a0e27)';
          }
          
          // Не используем класс 'selected' если есть результат проверки, чтобы не перекрывать цвета
          const className = `digit-marker ${!hasCheckResult && isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isExtra ? 'extra' : ''}`;
          
          return (
            <span
              key={idx}
              className={className}
              onClick={() => handleDigitClick(part.digit!)}
              style={{
                cursor: 'pointer',
                padding: '2px 4px',
                margin: '0 2px',
                borderRadius: '4px',
                backgroundColor: !hasCheckResult && backgroundColor !== 'transparent' ? backgroundColor : undefined,
                color: !hasCheckResult && color !== 'var(--text-primary, #fff)' ? color : undefined,
                transition: 'all 0.2s',
                display: 'inline-block',
                fontWeight: isCorrect || isExtra ? 'bold' : 'normal'
              }}
            >
              {part.text}
            </span>
          );
        }
        return <span key={idx}>{part.text}</span>;
      })}
    </div>
  );
};


