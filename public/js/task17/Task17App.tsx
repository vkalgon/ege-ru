// public/js/task17/Task17App.tsx
import React, { useState, useEffect } from 'react';
import { TextWithDigits } from './TextWithDigits';
import { CommaSlots } from './CommaSlots';
import { SpanEditor, Span } from './SpanEditor';

interface Task17Data {
  mode: 'digits' | 'commas';
  text: string;
  allowSpanSelection: boolean;
}

interface CheckResult {
  digits?: { isCorrect: boolean; missing: number[]; extra: number[] };
  commas?: { isCorrect: boolean; missing: number[]; extra: number[] };
  spans: Array<{
    type: string;
    target: number[] | null;
    user: number[] | null;
    iou: number;
    ok: boolean;
  }>;
  score: {
    digitsOrCommas: number;
    spans: number;
    total: number;
    max: number;
  };
  explanation: {
    answer_text?: string;
    explanation_md?: string;
    shown: boolean;
  };
  correctAnswer?: number[]; // Правильные цифры/позиции для режима digits/commas
}

interface Task17AppProps {
  taskId: number;
}

/**
 * Главный компонент для задания №17
 */
export const Task17App: React.FC<Task17AppProps> = ({ taskId }) => {
  const [mode, setMode] = useState<'digits' | 'commas'>('digits');
  const [taskData, setTaskData] = useState<Task17Data | null>(null);
  const [digits, setDigits] = useState<number[]>([]);
  const [commaPositions, setCommaPositions] = useState<number[]>([]);
  const [spans, setSpans] = useState<Span[]>([]);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузка задания
  useEffect(() => {
    const loadTask = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/task17/${taskId}/play?mode=${mode}`);
        if (!response.ok) throw new Error('Не удалось загрузить задание');
        const data = await response.json();
        setTaskData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      loadTask();
    }
  }, [taskId, mode]);

  // Сброс при смене режима
  useEffect(() => {
    setDigits([]);
    setCommaPositions([]);
    setSpans([]);
    setCheckResult(null);
  }, [mode]);

  const handleCheck = async () => {
    if (!taskData) return;

    try {
      setLoading(true);
      const payload: any = {
        mode,
        spans: spans.map(s => ({
          type: s.type,
          startOffset: s.startOffset,
          endOffset: s.endOffset
        }))
      };

      if (mode === 'digits') {
        payload.digits = digits;
      } else {
        payload.comma_positions = commaPositions;
      }

      const response = await fetch(`/api/task17/${taskId}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Ошибка проверки');
      const result = await response.json();
      console.log('[Task17App] Результат проверки:', result);
      console.log('[Task17App] correctAnswer:', result.correctAnswer);
      console.log('[Task17App] commas result:', result.commas);
      setCheckResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка проверки');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !taskData) {
    return <div>Загрузка...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Ошибка: {error}</div>;
  }

  if (!taskData) {
    return <div>Задание не найдено</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px' }}>Задание №17: Пунктуация</h1>

      {/* Переключатель режимов */}
      <div style={{ marginBottom: '24px' }}>
        <label>
          <input
            type="radio"
            checked={mode === 'digits'}
            onChange={() => setMode('digits')}
            style={{ marginRight: '8px' }}
          />
          Режим «Цифры»
        </label>
        <label style={{ marginLeft: '16px' }}>
          <input
            type="radio"
            checked={mode === 'commas'}
            onChange={() => setMode('commas')}
            style={{ marginRight: '8px' }}
          />
          Режим «Запятые»
        </label>
      </div>

      {/* Текст задания */}
      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
        {mode === 'digits' ? (
          <TextWithDigits
            text={taskData.text}
            onDigitsChange={setDigits}
            selectedDigits={digits}
            correctDigits={checkResult && checkResult.digits ? (checkResult.correctAnswer || []) : []}
            extraDigits={checkResult?.digits?.extra || []}
          />
        ) : (
          <CommaSlots
            text={taskData.text}
            onCommaPositionsChange={setCommaPositions}
            selectedPositions={commaPositions}
            correctPositions={(() => {
              const correct = checkResult?.commas ? checkResult.correctAnswer || [] : [];
              console.log('[Task17App] Передаем correctPositions в CommaSlots:', correct);
              console.log('[Task17App] checkResult?.commas:', checkResult?.commas);
              return correct;
            })()}
            extraPositions={checkResult?.commas?.extra || []}
          />
        )}
      </div>

      {/* Выделение оборотов */}
      {taskData.allowSpanSelection && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '12px' }}>Выделите обороты:</h3>
          <SpanEditor
            text={mode === 'digits' ? taskData.text.replace(/\(\d+\)/g, '') : taskData.text}
            onSpansChange={setSpans}
            existingSpans={spans}
          />
        </div>
      )}

      {/* Кнопка проверки */}
      <button
        onClick={handleCheck}
        disabled={loading}
        style={{
          padding: '12px 24px',
          background: 'var(--neon-cyan)',
          color: 'var(--bg-primary)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? 'Проверка...' : 'Проверить'}
      </button>

      {/* Результаты проверки */}
      {checkResult && (
        <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
          <h3>Результат проверки</h3>
          
          {/* Цифры/Запятые */}
          {checkResult.digits && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', color: checkResult.digits.isCorrect ? 'green' : 'red' }}>
                Цифры: {checkResult.digits.isCorrect ? '✓ Верно' : '✗ Неверно'}
              </div>
              {checkResult.digits.missing.length > 0 && (
                <div>Отсутствуют: {checkResult.digits.missing.join(', ')}</div>
              )}
              {checkResult.digits.extra.length > 0 && (
                <div>Лишние: {checkResult.digits.extra.join(', ')}</div>
              )}
            </div>
          )}

          {checkResult.commas && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', color: checkResult.commas.isCorrect ? 'green' : 'red' }}>
                Запятые: {checkResult.commas.isCorrect ? '✓ Верно' : '✗ Неверно'}
              </div>
              {checkResult.commas.missing.length > 0 && (
                <div>Отсутствуют позиции: {checkResult.commas.missing.join(', ')}</div>
              )}
              {checkResult.commas.extra.length > 0 && (
                <div>Лишние позиции: {checkResult.commas.extra.join(', ')}</div>
              )}
            </div>
          )}

          {/* Спаны */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold' }}>
              Обороты: {checkResult.spans.filter(s => s.ok).length} / {checkResult.spans.filter(s => s.target !== null).length}
            </div>
            {checkResult.spans.map((span, idx) => (
              <div key={idx} style={{ marginLeft: '16px', fontSize: '14px' }}>
                {span.ok ? '✓' : '✗'} {span.type} 
                {span.target && ` [${span.target[0]}-${span.target[1]}]`}
                {span.user && ` → [${span.user[0]}-${span.user[1]}]`}
                {span.iou > 0 && ` (IoU: ${span.iou.toFixed(2)})`}
              </div>
            ))}
          </div>

          {/* Баллы */}
          <div style={{ marginBottom: '16px', fontWeight: 'bold' }}>
            Баллы: {checkResult.score.total} / {checkResult.score.max}
          </div>

          {/* Объяснение */}
          {checkResult.explanation.shown && (
            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <h4>Объяснение:</h4>
              {checkResult.explanation.answer_text && (
                <div style={{ marginBottom: '12px' }}>{checkResult.explanation.answer_text}</div>
              )}
              {checkResult.explanation.explanation_md && (
                <div dangerouslySetInnerHTML={{ __html: checkResult.explanation.explanation_md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


