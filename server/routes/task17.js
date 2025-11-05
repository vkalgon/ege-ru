// server/routes/task17.js
import { Router } from 'express';
import db from '../db.js';

const task17 = Router();

// Порог IoU для совпадения спанов (из .env или по умолчанию)
const SPANS_IOU_THRESHOLD = parseFloat(process.env.SPANS_IOU_THRESHOLD || '0.9');

/* ----------------------
   УТИЛИТЫ ДЛЯ ПРОВЕРКИ
----------------------- */

// Вычисление IoU (Intersection over Union) для двух интервалов
function calculateIoU(start1, end1, start2, end2) {
  const intersectionStart = Math.max(start1, start2);
  const intersectionEnd = Math.min(end1, end2);
  
  if (intersectionStart >= intersectionEnd) {
    return 0;
  }
  
  const intersection = intersectionEnd - intersectionStart;
  const union = (end1 - start1) + (end2 - start2) - intersection;
  
  return intersection / union;
}

// Жадный матчинг спанов (best-first matching)
function matchSpans(targetSpans, userSpans) {
  const matched = new Set();
  const results = [];
  
  for (const target of targetSpans) {
    let bestMatch = null;
    let bestIoU = 0;
    
    for (let i = 0; i < userSpans.length; i++) {
      if (matched.has(i)) continue;
      
      const user = userSpans[i];
      if (target.type !== user.type) continue;
      
      const iou = calculateIoU(
        target.startOffset, target.endOffset,
        user.startOffset, user.endOffset
      );
      
      if (iou >= SPANS_IOU_THRESHOLD && iou > bestIoU) {
        bestIoU = iou;
        bestMatch = i;
      }
    }
    
    if (bestMatch !== null) {
      matched.add(bestMatch);
      const user = userSpans[bestMatch];
      results.push({
        type: target.type,
        target: [target.startOffset, target.endOffset],
        user: [user.startOffset, user.endOffset],
        iou: bestIoU,
        ok: true
      });
    } else {
      results.push({
        type: target.type,
        target: [target.startOffset, target.endOffset],
        user: null,
        iou: 0,
        ok: false
      });
    }
  }
  
  // Отмечаем лишние пользовательские спаны
  for (let i = 0; i < userSpans.length; i++) {
    if (!matched.has(i)) {
      const user = userSpans[i];
      results.push({
        type: user.type,
        target: null,
        user: [user.startOffset, user.endOffset],
        iou: 0,
        ok: false
      });
    }
  }
  
  return results;
}

// Валидация индексов для строки
function validateOffsets(text, offsets) {
  const maxOffset = text.length;
  for (const offset of offsets) {
    if (typeof offset !== 'number' || offset < 0 || offset > maxOffset) {
      return false;
    }
  }
  return true;
}

/* ----------------------
   АДМИНКА
----------------------- */

// POST /api/task17 - создать задание
task17.post('/', (req, res) => {
  try {
    const {
      source_text,
      base_text,
      commaless_text,
      digits,
      comma_positions,
      spans,
      answer_text,
      explanation_md,
      source,
      reveal_policy
    } = req.body;
    
    if (!source_text || !base_text || !commaless_text) {
      return res.status(400).json({ error: 'source_text, base_text, commaless_text обязательны' });
    }
    
    if (!digits || !Array.isArray(digits)) {
      return res.status(400).json({ error: 'digits должен быть массивом чисел' });
    }
    
    // comma_positions может быть пустым массивом (для упрощенной формы админки)
    const finalCommaPositions = comma_positions && Array.isArray(comma_positions) ? comma_positions : [];
    
    // Валидация индексов только если есть позиции
    if (finalCommaPositions.length > 0 && !validateOffsets(commaless_text, finalCommaPositions)) {
      return res.status(400).json({ error: 'Некорректные индексы в comma_positions' });
    }
    
    // spans может быть пустым массивом (обороты в объяснении не требуются для сохранения задания)
    const finalSpans = spans && Array.isArray(spans) ? spans : [];
    
    // Валидация спанов только если они есть
    for (const span of finalSpans) {
      if (span.startOffset < 0 || span.endOffset > commaless_text.length || span.startOffset >= span.endOffset) {
        return res.status(400).json({ error: `Некорректные offsets в span: ${JSON.stringify(span)}` });
      }
      if (span.type !== 'participle' && span.type !== 'gerund') {
        return res.status(400).json({ error: `Некорректный тип span: ${span.type}` });
      }
    }
    
    // Вставляем задание
    const taskResult = db.prepare(`
      INSERT INTO task17 (source_text, base_text, commaless_text, answer_text, explanation_md, source, reveal_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      source_text,
      base_text,
      commaless_text,
      answer_text || null,
      explanation_md || null,
      source || null,
      reveal_policy || 'after_correct'
    );
    
    const taskId = taskResult.lastInsertRowid;
    
    // Вставляем ответы
    db.prepare(`
      INSERT INTO task17_answer (task_id, digits_json, comma_positions_json, spans_json)
      VALUES (?, ?, ?, ?)
    `).run(
      taskId,
      JSON.stringify(digits),
      JSON.stringify(finalCommaPositions),
      JSON.stringify(finalSpans)
    );
    
    res.json({ id: taskId, message: 'Задание создано' });
  } catch (error) {
    console.error('Ошибка создания задания:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка создания задания',
      details: error.message 
    });
  }
});

// GET /api/task17 - список заданий
task17.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const rows = db.prepare(`
      SELECT 
        id, source_text, base_text, commaless_text, 
        answer_text, explanation_md, source, reveal_policy, created_at
      FROM task17
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения заданий:', error);
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});

// GET /api/task17/:id - одно задание
task17.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const task = db.prepare(`
      SELECT 
        id, source_text, base_text, commaless_text,
        answer_text, explanation_md, source, reveal_policy, created_at
      FROM task17
      WHERE id = ?
    `).get(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    const answer = db.prepare(`
      SELECT digits_json, comma_positions_json, spans_json
      FROM task17_answer
      WHERE task_id = ?
    `).get(id);
    
    if (answer) {
      task.digits = JSON.parse(answer.digits_json);
      task.comma_positions = JSON.parse(answer.comma_positions_json);
      task.spans = JSON.parse(answer.spans_json);
    }
    
    res.json(task);
  } catch (error) {
    console.error('Ошибка получения задания:', error);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
});

// PUT /api/task17/:id - обновить задание
task17.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      source_text,
      base_text,
      commaless_text,
      digits,
      comma_positions,
      spans,
      answer_text,
      explanation_md,
      source,
      reveal_policy
    } = req.body;
    
    // Обновляем задание
    const taskResult = db.prepare(`
      UPDATE task17
      SET source_text = COALESCE(?, source_text),
          base_text = COALESCE(?, base_text),
          commaless_text = COALESCE(?, commaless_text),
          answer_text = COALESCE(?, answer_text),
          explanation_md = COALESCE(?, explanation_md),
          source = COALESCE(?, source),
          reveal_policy = COALESCE(?, reveal_policy)
      WHERE id = ?
    `).run(
      source_text || null,
      base_text || null,
      commaless_text || null,
      answer_text !== undefined ? answer_text : null,
      explanation_md !== undefined ? explanation_md : null,
      source !== undefined ? source : null,
      reveal_policy || null,
      id
    );
    
    if (taskResult.changes === 0) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    // Обрабатываем ответы - разрешаем пустые массивы
    const finalCommaPositions = comma_positions && Array.isArray(comma_positions) ? comma_positions : [];
    const finalSpans = spans && Array.isArray(spans) ? spans : [];
    
    // Валидация индексов только если есть позиции
    if (commaless_text && finalCommaPositions.length > 0 && !validateOffsets(commaless_text, finalCommaPositions)) {
      return res.status(400).json({ error: 'Некорректные индексы в comma_positions' });
    }
    
    // Валидация спанов только если они есть
    if (commaless_text) {
      for (const span of finalSpans) {
        if (span.startOffset < 0 || span.endOffset > commaless_text.length || span.startOffset >= span.endOffset) {
          return res.status(400).json({ error: `Некорректные offsets в span: ${JSON.stringify(span)}` });
        }
        if (span.type !== 'participle' && span.type !== 'gerund') {
          return res.status(400).json({ error: `Некорректный тип span: ${span.type}` });
        }
      }
    }
    
    // Обновляем ответы, если переданы
    if (digits !== undefined || comma_positions !== undefined || spans !== undefined) {
      const existing = db.prepare('SELECT task_id FROM task17_answer WHERE task_id = ?').get(id);
      
      if (existing) {
        const current = db.prepare('SELECT digits_json, comma_positions_json, spans_json FROM task17_answer WHERE task_id = ?').get(id);
        const currentDigits = JSON.parse(current.digits_json);
        const currentCommas = JSON.parse(current.comma_positions_json);
        const currentSpans = JSON.parse(current.spans_json);
        
        db.prepare(`
          UPDATE task17_answer
          SET digits_json = ?,
              comma_positions_json = ?,
              spans_json = ?
          WHERE task_id = ?
        `).run(
          JSON.stringify(digits !== undefined ? digits : currentDigits),
          JSON.stringify(comma_positions !== undefined ? finalCommaPositions : currentCommas),
          JSON.stringify(spans !== undefined ? finalSpans : currentSpans),
          id
        );
      } else {
        // Если ответов нет, но переданы данные - создаем
        if (digits !== undefined || comma_positions !== undefined || spans !== undefined) {
          db.prepare(`
            INSERT INTO task17_answer (task_id, digits_json, comma_positions_json, spans_json)
            VALUES (?, ?, ?, ?)
          `).run(
            id,
            JSON.stringify(digits !== undefined ? digits : []),
            JSON.stringify(finalCommaPositions),
            JSON.stringify(finalSpans)
          );
        }
      }
    }
    
    res.json({ message: 'Задание обновлено' });
  } catch (error) {
    console.error('Ошибка обновления задания:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка обновления задания',
      details: error.message 
    });
  }
});

// DELETE /api/task17/:id - удалить задание
task17.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare('DELETE FROM task17 WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    res.json({ message: 'Задание удалено' });
  } catch (error) {
    console.error('Ошибка удаления задания:', error);
    res.status(500).json({ error: 'Ошибка удаления задания' });
  }
});

/* ----------------------
   УЧЕБНЫЙ РЕЖИМ
----------------------- */

// GET /api/task17/:id/play - получить задание для решения
task17.get('/:id/play', (req, res) => {
  try {
    const { id } = req.params;
    const mode = req.query.mode || 'digits'; // 'digits' или 'commas'
    
    if (mode !== 'digits' && mode !== 'commas') {
      return res.status(400).json({ error: 'mode должен быть "digits" или "commas"' });
    }
    
    const task = db.prepare(`
      SELECT source_text, commaless_text
      FROM task17
      WHERE id = ?
    `).get(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    res.json({
      mode,
      text: mode === 'digits' ? task.source_text : task.commaless_text,
      allowSpanSelection: true
    });
  } catch (error) {
    console.error('Ошибка получения задания для решения:', error);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
});

// POST /api/task17/:id/check - проверить ответ
task17.post('/:id/check', (req, res) => {
  try {
    const { id } = req.params;
    const { mode, digits, comma_positions, spans } = req.body;
    
    if (!mode || (mode !== 'digits' && mode !== 'commas')) {
      return res.status(400).json({ error: 'mode должен быть "digits" или "commas"' });
    }
    
    // Получаем задание и эталонные ответы
    const task = db.prepare(`
      SELECT source_text, commaless_text, answer_text, explanation_md, reveal_policy
      FROM task17
      WHERE id = ?
    `).get(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    const answer = db.prepare(`
      SELECT digits_json, comma_positions_json, spans_json
      FROM task17_answer
      WHERE task_id = ?
    `).get(id);
    
    if (!answer) {
      return res.status(500).json({ error: 'Эталонные ответы не найдены' });
    }
    
    const expectedDigits = JSON.parse(answer.digits_json);
    const expectedCommas = JSON.parse(answer.comma_positions_json);
    const expectedSpans = JSON.parse(answer.spans_json);
    
    // Валидация пользовательских данных
    if (mode === 'digits') {
      if (!digits || !Array.isArray(digits)) {
        return res.status(400).json({ error: 'digits обязателен для mode=digits' });
      }
      // В режиме digits не валидируем comma_positions
    } else {
      if (!comma_positions || !Array.isArray(comma_positions)) {
        return res.status(400).json({ error: 'comma_positions обязателен для mode=commas' });
      }
      if (!validateOffsets(task.commaless_text, comma_positions)) {
        return res.status(400).json({ error: 'Некорректные индексы в comma_positions' });
      }
    }
    
    if (spans) {
      if (!Array.isArray(spans)) {
        return res.status(400).json({ error: 'spans должен быть массивом' });
      }
      for (const span of spans) {
        if (span.startOffset < 0 || span.endOffset > task.commaless_text.length || span.startOffset >= span.endOffset) {
          return res.status(400).json({ error: `Некорректные offsets в span: ${JSON.stringify(span)}` });
        }
      }
    }
    
    // Проверка цифр
    let digitsResult = null;
    if (mode === 'digits') {
      // Преобразуем все значения в числа для корректного сравнения
      const expectedNums = expectedDigits.map(d => Number(d)).sort((a, b) => a - b);
      const userNums = digits.map(d => Number(d)).sort((a, b) => a - b);
      
      console.log('[TASK17 CHECK] Mode: digits');
      console.log('[TASK17 CHECK] Expected digits:', expectedNums);
      console.log('[TASK17 CHECK] User digits:', userNums);
      
      const expectedSet = new Set(expectedNums);
      const userSet = new Set(userNums);
      
      const missing = expectedNums.filter(d => !userSet.has(d));
      const extra = userNums.filter(d => !expectedSet.has(d));
      const isCorrect = missing.length === 0 && extra.length === 0;
      
      console.log('[TASK17 CHECK] Missing:', missing);
      console.log('[TASK17 CHECK] Extra:', extra);
      console.log('[TASK17 CHECK] Is correct:', isCorrect);
      
      digitsResult = { isCorrect, missing, extra };
    }
    
    // Проверка запятых
    let commasResult = null;
    if (mode === 'commas') {
      const expectedSet = new Set(expectedCommas);
      const userSet = new Set(comma_positions);
      
      const missing = expectedCommas.filter(p => !userSet.has(p));
      const extra = comma_positions.filter(p => !expectedSet.has(p));
      const isCorrect = missing.length === 0 && extra.length === 0;
      
      commasResult = { isCorrect, missing, extra };
    }
    
    // Проверка спанов
    const userSpans = spans || [];
    const spansReport = matchSpans(expectedSpans, userSpans);
    const spansCorrect = spansReport.filter(r => r.ok && r.target !== null).length;
    const spansTotal = expectedSpans.length;
    const spansOk = spansCorrect === spansTotal && userSpans.length === spansTotal;
    
    // Подсчет баллов
    const digitsOrCommasOk = mode === 'digits' ? digitsResult.isCorrect : commasResult.isCorrect;
    const score = {
      digitsOrCommas: digitsOrCommasOk ? 1 : 0,
      spans: spansOk ? 2 : 0,
      total: (digitsOrCommasOk ? 1 : 0) + (spansOk ? 2 : 0),
      max: 3
    };
    
    // Определяем, показывать ли объяснение
    let explanation = null;
    const shouldShow = 
      task.reveal_policy === 'always' ||
      (task.reveal_policy === 'after_check') ||
      (task.reveal_policy === 'after_correct' && digitsOrCommasOk && spansOk);
    
    if (shouldShow) {
      explanation = {
        answer_text: task.answer_text,
        explanation_md: task.explanation_md,
        shown: true
      };
    } else {
      explanation = { shown: false };
    }
    
    // Логируем попытку
    try {
      db.prepare(`
        INSERT INTO task17_attempt (
          task_id, mode, user_digits_json, user_comma_positions_json, user_spans_json,
          is_correct_digits, is_correct_commas, spans_report_json, explanation_shown
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        mode,
        mode === 'digits' ? JSON.stringify(digits) : null,
        mode === 'commas' ? JSON.stringify(comma_positions) : null,
        JSON.stringify(userSpans),
        mode === 'digits' ? (digitsResult.isCorrect ? 1 : 0) : null,
        mode === 'commas' ? (commasResult.isCorrect ? 1 : 0) : null,
        JSON.stringify(spansReport),
        explanation.shown ? 1 : 0
      );
    } catch (logError) {
      console.error('Ошибка логирования попытки:', logError);
    }
    
    // Формируем ответ
    const response = {
      digits: digitsResult,
      commas: commasResult,
      spans: spansReport,
      score,
      explanation
    };
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка проверки ответа:', error);
    res.status(500).json({ error: 'Ошибка проверки ответа' });
  }
});

export default task17;
