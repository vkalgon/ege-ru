// server/routes/task18.js — Задание №18: Вводные слова и обращения
import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, updateWordProgress, logTaskCompletion, getWeakWordIds, resolveWeakUserFromReq } from './progress.js';

const router = Router();

/* ─── Категории вводных слов ─────────────────────────────── */

export const CATEGORY_LABELS = {
  certainty:   'Уверенность',
  uncertainty: 'Неуверенность',
  feeling:     'Чувства',
  source:      'Источник сообщения',
  sequence:    'Последовательность / связь мыслей',
  style:       'Способ оформления мыслей',
  attention:   'Привлечение внимания',
  usual:       'Степень обычности',
  measure:     'Оценка меры',
  expressive:  'Экспрессивность',
};

export const INTRO_TYPE_LABELS = {
  always:  'Всегда вводное',
  never:   'Никогда не вводное',
  context: 'Зависит от контекста',
};

/* ─── Утилиты ────────────────────────────────────────────── */

/**
 * Сканирует текст задания и возвращает слова из банка, найденные в тексте.
 * Очищает маркеры (1)(2)... перед поиском.
 */
function detectWordsInText(sourceText) {
  const clean = sourceText
    .replace(/\(\d+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const allWords = db.prepare(
    'SELECT * FROM task18_words ORDER BY LENGTH(phrase) DESC'  // длинные сначала, чтобы "может быть" не перекрывалось "может"
  ).all();

  const found = [];
  const matchedSpans = []; // [start, end] уже занятые фрагменты текста

  for (const word of allWords) {
    const phrase = word.phrase.toLowerCase();
    let idx = clean.indexOf(phrase);
    while (idx !== -1) {
      // Проверяем, что не пересекается с уже найденными
      const end = idx + phrase.length;
      const overlap = matchedSpans.some(([s, e]) => idx < e && end > s);
      if (!overlap) {
        // Проверяем границы слова
        const before = idx > 0 ? clean[idx - 1] : ' ';
        const after  = end < clean.length ? clean[end] : ' ';
        const isBoundary = !/[а-яёa-z]/.test(before) && !/[а-яёa-z]/.test(after);
        if (isBoundary) {
          found.push({ word, textIdx: idx });
          matchedSpans.push([idx, end]);
          break; // одно вхождение слова на задание
        }
      }
      idx = clean.indexOf(phrase, idx + 1);
    }
  }

  return found.map(f => f.word);
}

/**
 * Возвращает полное задание с ответом и связанными словами.
 */
function getFullTask(taskId) {
  const task = db.prepare('SELECT * FROM task18_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const answer = db.prepare('SELECT * FROM task18_answer WHERE task_id = ?').get(taskId);
  const taskWords = db.prepare(`
    SELECT tw.*, w.phrase, w.intro_type, w.category, w.rule_intro, w.rule_not_intro
    FROM task18_task_words tw
    JOIN task18_words w ON w.id = tw.word_id
    WHERE tw.task_id = ?
  `).all(taskId);
  return {
    ...task,
    comma_positions: answer ? JSON.parse(answer.comma_positions_json) : [],
    task_words: taskWords.map(tw => ({
      ...tw,
      position_indices: JSON.parse(tw.position_indices_json || '[]'),
    })),
  };
}

/* ─── БАНК СЛОВ (админ) ──────────────────────────────────── */

// GET /api/task18/words
router.get('/words', (req, res) => {
  const { intro_type, category } = req.query;
  let sql = 'SELECT * FROM task18_words WHERE 1=1';
  const params = [];
  if (intro_type) { sql += ' AND intro_type = ?'; params.push(intro_type); }
  if (category)   { sql += ' AND category = ?';   params.push(category); }
  sql += ' ORDER BY intro_type, category, phrase COLLATE NOCASE';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/task18/words
router.post('/words', (req, res) => {
  const { phrase, intro_type, category, rule_intro, rule_not_intro } = req.body;
  if (!phrase || !intro_type)
    return res.status(400).json({ error: 'phrase и intro_type обязательны' });
  if (!['always', 'never', 'context'].includes(intro_type))
    return res.status(400).json({ error: 'Неверный intro_type' });
  try {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO task18_words (phrase, intro_type, category, rule_intro, rule_not_intro) VALUES (?, ?, ?, ?, ?)'
    ).run(phrase.trim().toLowerCase(), intro_type, category || null, rule_intro || null, rule_not_intro || null);
    res.json({ id: lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Такое слово уже есть в банке' });
    throw e;
  }
});

// PUT /api/task18/words/:id
router.put('/words/:id', (req, res) => {
  const { phrase, intro_type, category, rule_intro, rule_not_intro } = req.body;
  if (!phrase || !intro_type)
    return res.status(400).json({ error: 'phrase и intro_type обязательны' });
  try {
    const r = db.prepare(
      'UPDATE task18_words SET phrase=?, intro_type=?, category=?, rule_intro=?, rule_not_intro=? WHERE id=?'
    ).run(phrase.trim().toLowerCase(), intro_type, category || null, rule_intro || null, rule_not_intro || null, req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Такое слово уже есть в банке' });
    throw e;
  }
});

// DELETE /api/task18/words/:id
router.delete('/words/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task18_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// POST /api/task18/words/detect  — определить слова в тексте
router.post('/words/detect', (req, res) => {
  const { source_text } = req.body;
  if (!source_text) return res.status(400).json({ error: 'source_text обязателен' });
  const found = detectWordsInText(source_text);
  res.json({ words: found });
});

/* ─── ЗАДАНИЯ (админ) ────────────────────────────────────── */

// GET /api/task18/tasks
router.get('/tasks', (_req, res) => {
  const tasks = db.prepare(`
    SELECT t.id, t.source_text, t.source, t.created_at,
           a.comma_positions_json,
           COUNT(tw.id) AS word_count
    FROM task18_tasks t
    LEFT JOIN task18_answer a ON a.task_id = t.id
    LEFT JOIN task18_task_words tw ON tw.task_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
  res.json(tasks.map(t => ({
    ...t,
    comma_positions: t.comma_positions_json ? JSON.parse(t.comma_positions_json) : [],
  })));
});

// GET /api/task18/tasks/:id
router.get('/tasks/:id', (req, res) => {
  const task = getFullTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(task);
});

// POST /api/task18/tasks
router.post('/tasks', (req, res) => {
  const { source_text, base_text, source, explanation_md, comma_positions, task_words } = req.body;
  if (!source_text || !base_text)
    return res.status(400).json({ error: 'source_text и base_text обязательны' });
  if (!Array.isArray(comma_positions) || comma_positions.length === 0)
    return res.status(400).json({ error: 'Нужно указать хотя бы одну позицию запятой' });

  const create = db.transaction(() => {
    const { lastInsertRowid: taskId } = db.prepare(
      'INSERT INTO task18_tasks (source_text, base_text, source, explanation_md) VALUES (?, ?, ?, ?)'
    ).run(source_text.trim(), base_text.trim(), source || null, explanation_md || null);

    db.prepare(
      'INSERT INTO task18_answer (task_id, comma_positions_json) VALUES (?, ?)'
    ).run(taskId, JSON.stringify(comma_positions.map(Number).sort((a, b) => a - b)));

    // Связать со словами
    if (Array.isArray(task_words)) {
      const insertTW = db.prepare(
        'INSERT INTO task18_task_words (task_id, word_id, is_intro_in_task, position_indices_json) VALUES (?, ?, ?, ?)'
      );
      for (const tw of task_words) {
        if (!tw.word_id) continue;
        insertTW.run(taskId, tw.word_id, tw.is_intro ? 1 : 0, JSON.stringify(tw.position_indices || []));
      }
    }

    return taskId;
  });

  res.json({ id: create() });
});

// PUT /api/task18/tasks/:id
router.put('/tasks/:id', (req, res) => {
  const { source_text, base_text, source, explanation_md, comma_positions, task_words } = req.body;
  if (!source_text || !base_text)
    return res.status(400).json({ error: 'source_text и base_text обязательны' });
  if (!Array.isArray(comma_positions) || comma_positions.length === 0)
    return res.status(400).json({ error: 'Нужно указать хотя бы одну позицию запятой' });

  const exists = db.prepare('SELECT 1 FROM task18_tasks WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Задание не найдено' });

  const update = db.transaction(() => {
    db.prepare(
      'UPDATE task18_tasks SET source_text=?, base_text=?, source=?, explanation_md=? WHERE id=?'
    ).run(source_text.trim(), base_text.trim(), source || null, explanation_md || null, req.params.id);

    db.prepare('INSERT OR REPLACE INTO task18_answer (task_id, comma_positions_json) VALUES (?, ?)')
      .run(req.params.id, JSON.stringify(comma_positions.map(Number).sort((a, b) => a - b)));

    db.prepare('DELETE FROM task18_task_words WHERE task_id = ?').run(req.params.id);
    if (Array.isArray(task_words)) {
      const insertTW = db.prepare(
        'INSERT INTO task18_task_words (task_id, word_id, is_intro_in_task, position_indices_json) VALUES (?, ?, ?, ?)'
      );
      for (const tw of task_words) {
        if (!tw.word_id) continue;
        insertTW.run(req.params.id, tw.word_id, tw.is_intro ? 1 : 0, JSON.stringify(tw.position_indices || []));
      }
    }
  });
  update();
  res.json({ ok: true });
});

// DELETE /api/task18/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task18_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── ИГРА (ученик) ──────────────────────────────────────── */

// GET /api/task18/tasks/:id/play  — задание без ответов
router.get('/tasks/:id/play', (req, res) => {
  const task = db.prepare('SELECT id, source_text, source, explanation_md FROM task18_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const markers = (task.source_text.match(/\(\d+\)/g) || []).map(m => parseInt(m.slice(1, -1)));

  res.json({
    id: task.id,
    source_text: task.source_text,
    source: task.source,
    explanation: task.explanation_md || null,
    markers,
  });
});

// POST /api/task18/tasks/:id/check
router.post('/tasks/:id/check', (req, res) => {
  const task = getFullTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const { selected } = req.body; // number[] — номера позиций, выбранных учеником
  if (!Array.isArray(selected))
    return res.status(400).json({ error: 'selected должен быть массивом чисел' });

  const userSet = new Set(selected.map(Number));
  const correctSet = new Set(task.comma_positions);

  // Для каждой позиции определяем: правильно ли она выбрана
  const allMarkers = (task.source_text.match(/\(\d+\)/g) || []).map(m => parseInt(m.slice(1, -1)));

  const positionResults = allMarkers.map(pos => ({
    pos,
    user_selected: userSet.has(pos),
    correct: correctSet.has(pos),
    is_correct: userSet.has(pos) === correctSet.has(pos),
  }));

  // Оцениваем по словам
  const wordResults = task.task_words.map(tw => {
    const positions = tw.position_indices;
    let wordCorrect;
    if (tw.is_intro_in_task) {
      // Слово вводное → все позиции вокруг него должны быть выбраны
      wordCorrect = positions.every(p => userSet.has(p));
    } else {
      // Слово не вводное → ни одна позиция вокруг него не должна быть выбрана
      wordCorrect = positions.every(p => !userSet.has(p));
    }
    return {
      word_id: tw.word_id,
      phrase: tw.phrase,
      intro_type: tw.intro_type,
      category: tw.category,
      is_intro_in_task: !!tw.is_intro_in_task,
      position_indices: positions,
      word_correct: wordCorrect,
      rule_intro: tw.rule_intro,
      rule_not_intro: tw.rule_not_intro,
    };
  });

  // Итог: задание полностью правильно?
  const isCorrect = positionResults.every(p => p.is_correct);

  // Обновляем прогресс
  const userInfo = getUserIdFromReq(req);
  if (userInfo) {
    for (const wr of wordResults) {
      updateWordProgress(userInfo.id, 'task18_words', wr.word_id, wr.word_correct);
    }
    logTaskCompletion(userInfo.id, 'task18_words');
  }

  res.json({
    is_correct: isCorrect,
    comma_positions: task.comma_positions,
    position_results: positionResults,
    word_results: wordResults,
    explanation_md: task.explanation_md,
    base_text: task.base_text,
  });
});

// POST /api/task18/next  — следующее задание для ученика (с приоритетом слабых слов)
router.post('/next', (req, res) => {
  const targetUserId = resolveWeakUserFromReq(req);
  const { category, intro_type, exclude_ids } = req.body;
  const excluded = Array.isArray(exclude_ids) ? exclude_ids.map(Number) : [];

  // Слабые слова ученика
  const weakIds = targetUserId ? getWeakWordIds(targetUserId, 'task18_words') : new Set();

  // Получаем все задания (с фильтрацией по категории/типу если задано)
  let sql = `
    SELECT DISTINCT t.id
    FROM task18_tasks t
    JOIN task18_task_words tw ON tw.task_id = t.id
    JOIN task18_words w ON w.id = tw.word_id
    WHERE 1=1
  `;
  const params = [];
  if (category)   { sql += ' AND w.category = ?';    params.push(category); }
  if (intro_type) { sql += ' AND w.intro_type = ?';  params.push(intro_type); }
  if (excluded.length) {
    sql += ` AND t.id NOT IN (${excluded.map(() => '?').join(',')})`;
    params.push(...excluded);
  }

  const candidateIds = db.prepare(sql).all(...params).map(r => r.id);
  if (candidateIds.length === 0) {
    // Нет заданий с фильтром — берём любое
    const any = db.prepare(
      `SELECT id FROM task18_tasks${excluded.length ? ` WHERE id NOT IN (${excluded.map(() => '?').join(',')})` : ''} ORDER BY RANDOM() LIMIT 1`
    ).get(...excluded);
    if (!any) return res.status(404).json({ error: 'Нет доступных заданий' });
    return res.json({ id: any.id });
  }

  // Приоритизируем задания, содержащие слабые слова
  if (weakIds.size > 0) {
    const withWeak = db.prepare(`
      SELECT DISTINCT t.id
      FROM task18_tasks t
      JOIN task18_task_words tw ON tw.task_id = t.id
      WHERE t.id IN (${candidateIds.map(() => '?').join(',')})
        AND tw.word_id IN (${[...weakIds].map(() => '?').join(',')})
    `).all(...candidateIds, ...[...weakIds]).map(r => r.id);

    if (withWeak.length > 0) {
      const picked = withWeak[Math.floor(Math.random() * withWeak.length)];
      return res.json({ id: picked });
    }
  }

  const picked = candidateIds[Math.floor(Math.random() * candidateIds.length)];
  res.json({ id: picked });
});

export default router;
