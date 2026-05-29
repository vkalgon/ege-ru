// server/routes/task8.js
import { Router } from 'express';
import db from '../db.js';

const router = Router();

// ── Типы ошибок ────────────────────────────────────────────────

router.get('/error-types', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM task8_error_types ORDER BY order_index, id'
  ).all();
  res.json(rows);
});

router.post('/error-types', (req, res) => {
  const { title, description, order_index, subtype } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  const result = db.prepare(
    'INSERT INTO task8_error_types (title, description, order_index, subtype) VALUES (?, ?, ?, ?)'
  ).run(title.trim(), description?.trim() || null, order_index ?? 0, subtype?.trim() || null);
  res.json({ id: result.lastInsertRowid });
});

router.put('/error-types/:id', (req, res) => {
  const { title, description, order_index, subtype } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  db.prepare(
    'UPDATE task8_error_types SET title=?, description=?, order_index=?, subtype=? WHERE id=?'
  ).run(title.trim(), description?.trim() || null, order_index ?? 0, subtype?.trim() || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/error-types/:id', (req, res) => {
  db.prepare('DELETE FROM task8_error_types WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Задания ────────────────────────────────────────────────────

router.get('/tasks', (req, res) => {
  const tasks = db.prepare(
    'SELECT * FROM task8_tasks ORDER BY id DESC'
  ).all();
  res.json(tasks);
});

router.get('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM task8_tasks WHERE id=?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const errors = db.prepare(
    `SELECT te.slot, te.error_type_id, et.title AS error_title
     FROM task8_task_errors te
     JOIN task8_error_types et ON et.id = te.error_type_id
     WHERE te.task_id = ? ORDER BY te.slot`
  ).all(req.params.id);

  const sentences = db.prepare(
    `SELECT s.position, s.text, s.correct_text, s.error_type_id, et.title AS error_title
     FROM task8_sentences s
     LEFT JOIN task8_error_types et ON et.id = s.error_type_id
     WHERE s.task_id = ? ORDER BY s.position`
  ).all(req.params.id);

  res.json({ ...task, errors, sentences });
});

// Создать задание целиком
// Body: { source?, errors: [{slot, error_type_id}], sentences: [{position, text, error_type_id?}] }
router.post('/tasks', (req, res) => {
  const { source, errors, sentences } = req.body;
  if (!Array.isArray(errors) || errors.length !== 5)
    return res.status(400).json({ error: 'need exactly 5 errors (slots А–Д)' });
  if (!Array.isArray(sentences) || sentences.length !== 9)
    return res.status(400).json({ error: 'need exactly 9 sentences' });

  const insertTask = db.prepare(
    'INSERT INTO task8_tasks (source) VALUES (?)'
  );
  const insertError = db.prepare(
    'INSERT INTO task8_task_errors (task_id, slot, error_type_id) VALUES (?,?,?)'
  );
  const insertSent = db.prepare(
    'INSERT INTO task8_sentences (task_id, position, text, correct_text, error_type_id) VALUES (?,?,?,?,?)'
  );

  const taskId = db.transaction(() => {
    const { lastInsertRowid } = insertTask.run(source?.trim() || null);
    for (const e of errors) insertError.run(lastInsertRowid, e.slot, e.error_type_id);
    for (const s of sentences) insertSent.run(
      lastInsertRowid, s.position, s.text, s.correct_text?.trim() || null, s.error_type_id ?? null
    );
    return lastInsertRowid;
  })();

  res.json({ id: taskId });
});

router.put('/tasks/:id', (req, res) => {
  const { source, errors, sentences } = req.body;
  if (!Array.isArray(errors) || errors.length !== 5)
    return res.status(400).json({ error: 'need exactly 5 errors (slots А–Д)' });
  if (!Array.isArray(sentences) || sentences.length !== 9)
    return res.status(400).json({ error: 'need exactly 9 sentences' });

  const id = req.params.id;
  const task = db.prepare('SELECT id FROM task8_tasks WHERE id=?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });

  db.transaction(() => {
    db.prepare('UPDATE task8_tasks SET source=? WHERE id=?').run(source?.trim() || null, id);
    db.prepare('DELETE FROM task8_task_errors WHERE task_id=?').run(id);
    db.prepare('DELETE FROM task8_sentences WHERE task_id=?').run(id);

    const insErr  = db.prepare('INSERT INTO task8_task_errors (task_id, slot, error_type_id) VALUES (?,?,?)');
    const insSent = db.prepare('INSERT INTO task8_sentences (task_id, position, text, correct_text, error_type_id) VALUES (?,?,?,?,?)');

    for (const e of errors) insErr.run(id, e.slot, e.error_type_id);
    for (const s of sentences) insSent.run(id, s.position, s.text, s.correct_text?.trim() || null, s.error_type_id ?? null);
  })();

  res.json({ id: Number(id) });
});

router.delete('/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM task8_tasks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Режим игры (без ответов) ───────────────────────────────────

router.get('/tasks/:id/play', (req, res) => {
  const task = db.prepare('SELECT id, source FROM task8_tasks WHERE id=?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const errors = db.prepare(
    `SELECT te.slot, et.title AS error_title
     FROM task8_task_errors te
     JOIN task8_error_types et ON et.id = te.error_type_id
     WHERE te.task_id = ? ORDER BY te.slot`
  ).all(req.params.id);

  const sentences = db.prepare(
    'SELECT position, text FROM task8_sentences WHERE task_id=? ORDER BY position'
  ).all(req.params.id);

  res.json({ id: task.id, source: task.source, errors, sentences });
});

// ── Решение ────────────────────────────────────────────────────
router.get('/tasks/:id/solution', (req, res) => {
  const task = db.prepare('SELECT id FROM task8_tasks WHERE id=?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const slots = db.prepare(
    `SELECT te.slot, et.title AS error_title, et.subtype,
            s.position AS correct_position, s.text AS error_text, s.correct_text
     FROM task8_task_errors te
     JOIN task8_error_types et ON et.id = te.error_type_id
     JOIN task8_sentences s ON s.task_id = te.task_id AND s.error_type_id = te.error_type_id
     WHERE te.task_id = ? ORDER BY te.slot`
  ).all(req.params.id);

  const answers = {};
  for (const s of slots) answers[s.slot] = s.correct_position;

  res.json({ answers, slots });
});

// ── Проверка ответа ────────────────────────────────────────────
// Body: { answers: { А: 3, Б: 7, ... } }
router.post('/tasks/:id/check', (req, res) => {
  const { answers } = req.body;
  if (!answers || typeof answers !== 'object')
    return res.status(400).json({ error: 'answers object required' });

  const slots = db.prepare(
    `SELECT te.slot, s.position AS correct_position
     FROM task8_task_errors te
     JOIN task8_sentences s ON s.task_id = te.task_id AND s.error_type_id = te.error_type_id
     WHERE te.task_id = ? ORDER BY te.slot`
  ).all(req.params.id);

  const result = {};
  let correct = 0;
  for (const { slot, correct_position } of slots) {
    const userPos = Number(answers[slot]);
    const ok = userPos === correct_position;
    result[slot] = { correct_position, user_position: userPos, ok };
    if (ok) correct++;
  }

  res.json({ correct, total: slots.length, details: result });
});

export default router;
