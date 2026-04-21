import { Router } from 'express';
import db from '../db.js';

const router = Router();

// ── helpers ─────────────────────────────────────────────────────────────────

function buildPhrase(beforeText, form, afterText) {
  const parts = [beforeText.trim(), form.trim(), afterText.trim()].filter(Boolean);
  return parts.join(' ');
}

function getTaskWithItems(taskId) {
  const task = db.prepare('SELECT * FROM task7_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  task.items = db.prepare(
    'SELECT * FROM task7_items WHERE task_id = ? ORDER BY item_index'
  ).all(taskId);
  return task;
}

// ── Банк слов ────────────────────────────────────────────────────────────────

// GET /api/task7/words?category=...
router.get('/words', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM task7_words WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY category, id';
  const words = db.prepare(sql).all(...params);
  const contexts = db.prepare('SELECT * FROM task7_contexts').all();
  const contextMap = {};
  for (const c of contexts) {
    contextMap[c.word_id] ??= [];
    contextMap[c.word_id].push(c);
  }
  for (const w of words) w.contexts = contextMap[w.id] || [];
  res.json(words);
});

// GET /api/task7/categories
router.get('/categories', (_req, res) => {
  const rows = db.prepare(
    'SELECT DISTINCT category FROM task7_words WHERE category IS NOT NULL ORDER BY category'
  ).all();
  res.json(rows.map(r => r.category));
});

// POST /api/task7/words
router.post('/words', (req, res) => {
  const { correct_form, error_form, before_text = '', after_text = '', category = null } = req.body;
  if (!correct_form?.trim() || !error_form?.trim())
    return res.status(400).json({ error: 'correct_form и error_form обязательны' });

  const { lastInsertRowid: wordId } = db.prepare(
    'INSERT INTO task7_words (correct_form, error_form, category) VALUES (?, ?, ?)'
  ).run(correct_form.trim(), error_form.trim(), category?.trim() || null);

  db.prepare(
    'INSERT INTO task7_contexts (word_id, before_text, after_text) VALUES (?, ?, ?)'
  ).run(wordId, before_text.trim(), after_text.trim());

  res.json({ id: wordId });
});

// PUT /api/task7/words/:id
router.put('/words/:id', (req, res) => {
  const { correct_form, error_form, category = null } = req.body;
  if (!correct_form?.trim() || !error_form?.trim())
    return res.status(400).json({ error: 'correct_form и error_form обязательны' });

  const r = db.prepare(
    'UPDATE task7_words SET correct_form = ?, error_form = ?, category = ? WHERE id = ?'
  ).run(correct_form.trim(), error_form.trim(), category?.trim() || null, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// DELETE /api/task7/words/:id
router.delete('/words/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task7_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// ── Контексты ────────────────────────────────────────────────────────────────

// POST /api/task7/words/:wordId/contexts
router.post('/words/:wordId/contexts', (req, res) => {
  const { before_text = '', after_text = '' } = req.body;
  const word = db.prepare('SELECT id FROM task7_words WHERE id = ?').get(req.params.wordId);
  if (!word) return res.status(404).json({ error: 'Слово не найдено' });

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO task7_contexts (word_id, before_text, after_text) VALUES (?, ?, ?)'
  ).run(req.params.wordId, before_text.trim(), after_text.trim());
  res.json({ id: lastInsertRowid });
});

// PUT /api/task7/contexts/:id
router.put('/contexts/:id', (req, res) => {
  const { before_text = '', after_text = '' } = req.body;
  const r = db.prepare(
    'UPDATE task7_contexts SET before_text = ?, after_text = ? WHERE id = ?'
  ).run(before_text.trim(), after_text.trim(), req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Контекст не найден' });
  res.json({ ok: true });
});

// DELETE /api/task7/contexts/:id
router.delete('/contexts/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task7_contexts WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Контекст не найден' });
  res.json({ ok: true });
});

// ── Задания ──────────────────────────────────────────────────────────────────

// GET /api/task7/tasks
router.get('/tasks', (_req, res) => {
  const tasks = db.prepare(`
    SELECT t.*,
      (SELECT i.display_phrase FROM task7_items i WHERE i.task_id = t.id AND i.is_error = 1 LIMIT 1) AS error_phrase,
      (SELECT i.correct_form   FROM task7_items i WHERE i.task_id = t.id AND i.is_error = 1 LIMIT 1) AS correct_form
    FROM task7_tasks t ORDER BY t.id DESC
  `).all();
  res.json(tasks);
});

// DELETE /api/task7/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task7_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

// GET /api/task7/tasks/:id/play — без is_error и correct_form
router.get('/tasks/:id/play', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({
    id: task.id,
    items: task.items.map(it => ({
      item_index: it.item_index,
      display_phrase: it.display_phrase,
    })),
  });
});

// POST /api/task7/tasks/:id/check
router.post('/tasks/:id/check', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const userAnswer = (req.body.answer || '').trim().toLowerCase();
  const errorItem = task.items.find(it => it.is_error);
  if (!errorItem) return res.status(500).json({ error: 'В задании нет ошибочного слова' });

  const correctAnswer = errorItem.correct_form.trim().toLowerCase();
  const is_correct = userAnswer === correctAnswer;

  res.json({
    is_correct,
    correct_answer: errorItem.correct_form,
    error_item_index: errorItem.item_index,
    items: task.items.map(it => ({
      item_index: it.item_index,
      display_phrase: it.display_phrase,
      is_error: it.is_error,
      correct_form: it.correct_form,
    })),
  });
});

// ── Генерация ─────────────────────────────────────────────────────────────────

// POST /api/task7/generate
router.post('/generate', (req, res) => {
  const count = Math.min(20, Math.max(1, parseInt(req.body.count) || 1));

  // Загружаем все слова с контекстами
  const allWords = db.prepare('SELECT * FROM task7_words').all();
  const allContexts = db.prepare('SELECT * FROM task7_contexts').all();

  // Индексируем контексты по word_id
  const contextsByWord = {};
  for (const c of allContexts) {
    contextsByWord[c.word_id] ??= [];
    contextsByWord[c.word_id].push(c);
  }

  // Только слова с хотя бы одним контекстом
  const validWords = allWords.filter(w => (contextsByWord[w.id] || []).length > 0);

  if (validWords.length < 5)
    return res.status(400).json({ error: 'Нужно минимум 5 слов с контекстами в банке' });

  function pickRandomContext(wordId) {
    const pool = contextsByWord[wordId] || [];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  const insertTask = db.prepare('INSERT INTO task7_tasks (is_generated) VALUES (1)');
  const insertItem = db.prepare(`
    INSERT INTO task7_items (task_id, item_index, word_id, is_error, display_phrase, correct_form)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const createdIds = [];

  const generate = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const shuffled = shuffle(validWords);
      const errorWord   = shuffled[0];
      const correctWords = shuffled.slice(1, 5);

      const five = shuffle([
        { word: errorWord, isError: true },
        ...correctWords.map(w => ({ word: w, isError: false })),
      ]);

      const { lastInsertRowid: taskId } = insertTask.run();

      five.forEach(({ word, isError }, idx) => {
        const ctx = pickRandomContext(word.id);
        const form = isError ? word.error_form : word.correct_form;
        const phrase = buildPhrase(ctx.before_text, form, ctx.after_text);
        insertItem.run(taskId, idx + 1, word.id, isError ? 1 : 0, phrase, word.correct_form);
      });

      createdIds.push(taskId);
    }
  });

  generate();
  res.json({ ids: createdIds, count: createdIds.length });
});

export default router;
