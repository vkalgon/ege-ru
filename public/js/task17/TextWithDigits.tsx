// public/js/task17/TextWithDigits.tsx
import React, { useState, useCallback } from 'react';

interface TextWithDigitsProps {
  text: string; // source_text с метками (1)...(N)
  onDigitsChange: (digits: number[]) => void;
  selectedDigits?: number[];
}

/**
 * Компонент для отображения текста с кликабельными цифрами (1)...(N)
 */
export const TextWithDigits: React.FC<TextWithDigitsProps> = ({
  text,
  onDigitsChange,
  selectedDigits = []
}) => {
  const [digits, setDigits] = useState<Set<number>>(new Set(selectedDigits));

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

  return (
    <div className="text-with-digits">
      {parts.map((part, idx) => {
        if (part.digit !== null) {
          const isSelected = digits.has(part.digit);
          return (
            <span
              key={idx}
              className={`digit-marker ${isSelected ? 'selected' : ''}`}
              onClick={() => handleDigitClick(part.digit!)}
              style={{
                cursor: 'pointer',
                padding: '2px 4px',
                margin: '0 2px',
                borderRadius: '4px',
                backgroundColor: isSelected ? 'var(--neon-cyan, #00f0ff)' : 'transparent',
                color: isSelected ? 'var(--bg-primary, #0a0e27)' : 'var(--text-primary, #fff)',
                transition: 'all 0.2s',
                display: 'inline-block'
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

