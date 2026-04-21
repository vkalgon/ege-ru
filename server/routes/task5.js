import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, updateWordProgress, getWeakWordIds, pickWeighted, resolveWeakUserFromReq } from './progress.js';

const router = Router();

// ── helpers ─────────────────────────────────────────────────────────────────

function getTaskWithItems(taskId) {
  const task = db.prepare('SELECT * FROM task5_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const items = db.prepare(`
    SELECT ti.id, ti.item_index,
           s.id AS sentence_id, s.sentence, s.highlighted_word, s.correct_word, s.is_error,
           g.id AS group_id, g.title AS group_title
    FROM task5_items ti
    JOIN task5_sentences s ON s.id = ti.sentence_id
    JOIN task5_groups g    ON g.id = s.group_id
    WHERE ti.task_id = ?
    ORDER BY ti.item_index
  `).all(taskId);
  task.items = items;
  return task;
}

// ── Паронимные группы ────────────────────────────────────────────────────────

router.get('/groups', (req, res) => {
  const groups = db.prepare(
    'SELECT g.*, COUNT(s.id) AS sentence_count FROM task5_groups g LEFT JOIN task5_sentences s ON s.group_id = g.id GROUP BY g.id ORDER BY g.title'
  ).all();
  res.json(groups);
});

router.post('/groups', (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  const result = db.prepare('INSERT INTO task5_groups (title) VALUES (?)').run(title.trim());
  res.json({ id: result.lastInsertRowid, title: title.trim() });
});

router.put('/groups/:id', (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  db.prepare('UPDATE task5_groups SET title = ? WHERE id = ?').run(title.trim(), req.params.id);
  res.json({ ok: true });
});

router.delete('/groups/:id', (req, res) => {
  db.prepare('DELETE FROM task5_groups WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Предложения ──────────────────────────────────────────────────────────────

router.get('/sentences', (req, res) => {
  const { group_id } = req.query;
  let rows;
  if (group_id) {
    rows = db.prepare(`
      SELECT s.*, g.title AS group_title
      FROM task5_sentences s JOIN task5_groups g ON g.id = s.group_id
      WHERE s.group_id = ? ORDER BY s.is_error, s.id
    `).all(group_id);
  } else {
    rows = db.prepare(`
      SELECT s.*, g.title AS group_title
      FROM task5_sentences s JOIN task5_groups g ON g.id = s.group_id
      ORDER BY g.title, s.is_error, s.id
    `).all();
  }
  res.json(rows);
});

router.post('/sentences', (req, res) => {
  const { group_id, sentence, highlighted_word, correct_word, is_error } = req.body;
  if (!group_id || !sentence?.trim() || !highlighted_word?.trim() || !correct_word?.trim()) {
    return res.status(400).json({ error: 'group_id, sentence, highlighted_word, correct_word required' });
  }
  const result = db.prepare(
    'INSERT INTO task5_sentences (group_id, sentence, highlighted_word, correct_word, is_error) VALUES (?,?,?,?,?)'
  ).run(group_id, sentence.trim(), highlighted_word.trim(), correct_word.trim(), is_error ? 1 : 0);
  res.json({ id: result.lastInsertRowid });
});

router.put('/sentences/:id', (req, res) => {
  const { group_id, sentence, highlighted_word, correct_word, is_error } = req.body;
  if (!group_id || !sentence?.trim() || !highlighted_word?.trim() || !correct_word?.trim()) {
    return res.status(400).json({ error: 'group_id, sentence, highlighted_word, correct_word required' });
  }
  db.prepare(
    'UPDATE task5_sentences SET group_id=?, sentence=?, highlighted_word=?, correct_word=?, is_error=? WHERE id=?'
  ).run(group_id, sentence.trim(), highlighted_word.trim(), correct_word.trim(), is_error ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/sentences/:id', (req, res) => {
  db.prepare('DELETE FROM task5_sentences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Задания ──────────────────────────────────────────────────────────────────

router.get('/tasks', (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*,
      (SELECT s.highlighted_word FROM task5_items i JOIN task5_sentences s ON s.id=i.sentence_id
       WHERE i.task_id=t.id AND s.is_error=1 LIMIT 1) AS error_word,
      (SELECT s.correct_word FROM task5_items i JOIN task5_sentences s ON s.id=i.sentence_id
       WHERE i.task_id=t.id AND s.is_error=1 LIMIT 1) AS correct_word
    FROM task5_tasks t ORDER BY t.id DESC
  `).all();
  res.json(tasks);
});

router.post('/tasks', (req, res) => {
  const { sentence_ids } = req.body; // array of 5 ids
  if (!Array.isArray(sentence_ids) || sentence_ids.length !== 5) {
    return res.status(400).json({ error: 'sentence_ids must be array of 5' });
  }
  // Validate: exactly 1 must be error
  const sentences = sentence_ids.map(id =>
    db.prepare('SELECT * FROM task5_sentences WHERE id = ?').get(id)
  );
  if (sentences.some(s => !s)) return res.status(400).json({ error: 'invalid sentence_id' });
  const errorCount = sentences.filter(s => s.is_error).length;
  if (errorCount !== 1) return res.status(400).json({ error: 'exactly 1 error sentence required' });

  const taskResult = db.prepare('INSERT INTO task5_tasks (is_generated) VALUES (0)').run();
  const taskId = taskResult.lastInsertRowid;
  const insertItem = db.prepare('INSERT INTO task5_items (task_id, item_index, sentence_id) VALUES (?,?,?)');
  sentence_ids.forEach((sid, i) => insertItem.run(taskId, i + 1, sid));
  res.json({ id: taskId });
});

router.get('/tasks/:id', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  res.json(task);
});

router.put('/tasks/:id', (req, res) => {
  const { sentence_ids } = req.body;
  if (!Array.isArray(sentence_ids) || sentence_ids.length !== 5) {
    return res.status(400).json({ error: 'sentence_ids must be array of 5' });
  }
  const sentences = sentence_ids.map(id =>
    db.prepare('SELECT * FROM task5_sentences WHERE id = ?').get(id)
  );
  if (sentences.some(s => !s)) return res.status(400).json({ error: 'invalid sentence_id' });
  const errorCount = sentences.filter(s => s.is_error).length;
  if (errorCount !== 1) return res.status(400).json({ error: 'exactly 1 error sentence required' });

  db.prepare('DELETE FROM task5_items WHERE task_id = ?').run(req.params.id);
  const insertItem = db.prepare('INSERT INTO task5_items (task_id, item_index, sentence_id) VALUES (?,?,?)');
  sentence_ids.forEach((sid, i) => insertItem.run(req.params.id, i + 1, sid));
  res.json({ ok: true });
});

router.delete('/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM task5_tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Play (студент) ────────────────────────────────────────────────────────────

router.get('/tasks/:id/play', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  // Скрываем is_error и correct_word
  const items = task.items.map(it => ({
    item_index: it.item_index,
    sentence_id: it.sentence_id,
    sentence: it.sentence,
    highlighted_word: it.highlighted_word,
    group_title: it.group_title,
  }));
  res.json({ id: task.id, items });
});

// ── Check ─────────────────────────────────────────────────────────────────────

router.post('/tasks/:id/check', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const userAnswer = (req.body.answer || '').trim().toLowerCase();
  const errorItem = task.items.find(it => it.is_error);
  if (!errorItem) return res.status(500).json({ error: 'task has no error sentence' });

  const correctAnswer = errorItem.correct_word.trim().toLowerCase();
  const is_correct = userAnswer === correctAnswer;

  // Прогресс (пароним как «слово»)
  const userInfo = getUserIdFromReq(req);
  if (userInfo) {
    updateWordProgress(userInfo.id, 'task5_sentences', errorItem.sentence_id, is_correct);
  }

  res.json({
    is_correct,
    correct_answer: errorItem.correct_word,
    error_item_index: errorItem.item_index,
    items: task.items.map(it => ({
      item_index: it.item_index,
      sentence: it.sentence,
      highlighted_word: it.highlighted_word,
      correct_word: it.correct_word,
      is_error: it.is_error,
      group_title: it.group_title,
    })),
  });
});

// ── Генерация ─────────────────────────────────────────────────────────────────

router.post('/generate', (req, res) => {
  const count = Math.min(20, Math.max(1, parseInt(req.body.count) || 1));

  // Загружаем все предложения
  const allSentences = db.prepare(`
    SELECT s.*, g.title AS group_title
    FROM task5_sentences s JOIN task5_groups g ON g.id = s.group_id
  `).all();

  const errorSentences   = allSentences.filter(s => s.is_error);
  const correctSentences = allSentences.filter(s => !s.is_error);

  if (errorSentences.length < 1) {
    return res.status(400).json({ error: 'Нет предложений с ошибкой в банке' });
  }
  if (correctSentences.length < 4) {
    return res.status(400).json({ error: 'Нужно минимум 4 правильных предложения в банке' });
  }

  // Учитываем прогресс (опционально)
  const targetUserId = resolveWeakUserFromReq(req);
  const weakIds = targetUserId ? getWeakWordIds(targetUserId, 'task5_sentences') : new Set();

  const createdIds = [];
  const insertTask = db.prepare('INSERT INTO task5_tasks (is_generated) VALUES (1)');
  const insertItem = db.prepare('INSERT INTO task5_items (task_id, item_index, sentence_id) VALUES (?,?,?)');

  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    // Выбираем 1 ошибочное предложение
    const errPool = shuffle(errorSentences);
    const errSentence = errPool[0];

    // Выбираем 4 правильных из других групп если возможно
    const otherCorrect = correctSentences.filter(s => s.group_id !== errSentence.group_id);
    const pool4 = otherCorrect.length >= 4 ? otherCorrect : correctSentences;
    const chosen4 = shuffle(pool4).slice(0, 4);

    if (chosen4.length < 4) {
      return res.status(400).json({ error: 'Недостаточно правильных предложений для генерации' });
    }

    const five = shuffle([errSentence, ...chosen4]);
    const taskResult = insertTask.run();
    const taskId = taskResult.lastInsertRowid;
    five.forEach((s, idx) => insertItem.run(taskId, idx + 1, s.id));
    createdIds.push(taskId);
  }

  res.json({ ids: createdIds, count: createdIds.length });
});

// ── Избранные паронимы (слабые места по теории) ─────────────────────────────

/** GET /api/task5/paronym-favorites — список id пар, добавленных пользователем */
router.get('/paronym-favorites', (req, res) => {
  const user = getUserIdFromReq(req);
  if (!user) return res.json({ favorites: [] });
  const rows = db.prepare(
    'SELECT paronym_id FROM user_paronym_favorites WHERE user_id = ? ORDER BY created_at DESC'
  ).all(user.id);
  res.json({ favorites: rows.map(r => r.paronym_id) });
});

/** POST /api/task5/paronym-favorites/:id — toggle (добавить / убрать) */
router.post('/paronym-favorites/:id', (req, res) => {
  const user = getUserIdFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const paronymId = req.params.id;
  const exists = db.prepare(
    'SELECT 1 FROM user_paronym_favorites WHERE user_id = ? AND paronym_id = ?'
  ).get(user.id, paronymId);
  if (exists) {
    db.prepare('DELETE FROM user_paronym_favorites WHERE user_id = ? AND paronym_id = ?')
      .run(user.id, paronymId);
    res.json({ saved: false });
  } else {
    db.prepare('INSERT INTO user_paronym_favorites (user_id, paronym_id) VALUES (?, ?)')
      .run(user.id, paronymId);
    res.json({ saved: true });
  }
});

export default router;
