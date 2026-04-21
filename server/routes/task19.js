// server/routes/task19.js — Задание №19: Знаки в СПП
import { Router } from 'express';
import db from '../db.js';

const router = Router();

export const RULE_TYPE_LABELS = {
  kotory:          'Союзное слово КОТОРЫЙ',
  double_conj:     'Два союза рядом',
  i_junction:      'Союз И на стыке частей',
  homogeneous_sub: 'Однородные придаточные',
};

function parseRuleTypes(json) {
  try { return JSON.parse(json || '[]') || []; } catch { return []; }
}

function getFullTask(taskId) {
  const task = db.prepare('SELECT * FROM task19_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const answer = db.prepare('SELECT * FROM task19_answer WHERE task_id = ?').get(taskId);
  return {
    ...task,
    rule_types: parseRuleTypes(task.rule_types_json),
    comma_positions: answer ? JSON.parse(answer.comma_positions_json) : [],
  };
}

/* ─── CRUD (админ) ───────────────────────────────────────── */

// GET /api/task19/tasks
router.get('/tasks', (_req, res) => {
  const tasks = db.prepare(`
    SELECT t.id, t.source_text, t.source, t.rule_types_json, t.created_at,
           a.comma_positions_json
    FROM task19_tasks t
    LEFT JOIN task19_answer a ON a.task_id = t.id
    ORDER BY t.created_at DESC
  `).all();
  res.json(tasks.map(t => ({
    ...t,
    rule_types:      parseRuleTypes(t.rule_types_json),
    comma_positions: t.comma_positions_json ? JSON.parse(t.comma_positions_json) : [],
  })));
});

// GET /api/task19/tasks/:id
router.get('/tasks/:id', (req, res) => {
  const task = getFullTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(task);
});

// POST /api/task19/tasks
router.post('/tasks', (req, res) => {
  const { source_text, source, rule_types, explanation_md, comma_positions } = req.body;
  if (!source_text)
    return res.status(400).json({ error: 'source_text обязателен' });
  if (!Array.isArray(comma_positions) || comma_positions.length === 0)
    return res.status(400).json({ error: 'Нужно указать хотя бы одну позицию запятой' });

  const ruleTypesJson = JSON.stringify(Array.isArray(rule_types) ? rule_types : []);

  const create = db.transaction(() => {
    const { lastInsertRowid: taskId } = db.prepare(
      'INSERT INTO task19_tasks (source_text, source, rule_types_json, explanation_md) VALUES (?, ?, ?, ?)'
    ).run(source_text.trim(), source || null, ruleTypesJson, explanation_md || null);

    db.prepare(
      'INSERT INTO task19_answer (task_id, comma_positions_json) VALUES (?, ?)'
    ).run(taskId, JSON.stringify(comma_positions.map(Number).sort((a, b) => a - b)));

    return taskId;
  });

  res.json({ id: create() });
});

// PUT /api/task19/tasks/:id
router.put('/tasks/:id', (req, res) => {
  const { source_text, source, rule_types, explanation_md, comma_positions } = req.body;
  if (!source_text)
    return res.status(400).json({ error: 'source_text обязателен' });
  if (!Array.isArray(comma_positions) || comma_positions.length === 0)
    return res.status(400).json({ error: 'Нужно указать хотя бы одну позицию запятой' });

  const exists = db.prepare('SELECT 1 FROM task19_tasks WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Задание не найдено' });

  const ruleTypesJson = JSON.stringify(Array.isArray(rule_types) ? rule_types : []);

  db.transaction(() => {
    db.prepare(
      'UPDATE task19_tasks SET source_text=?, source=?, rule_types_json=?, explanation_md=? WHERE id=?'
    ).run(source_text.trim(), source || null, ruleTypesJson, explanation_md || null, req.params.id);

    db.prepare('INSERT OR REPLACE INTO task19_answer (task_id, comma_positions_json) VALUES (?, ?)')
      .run(req.params.id, JSON.stringify(comma_positions.map(Number).sort((a, b) => a - b)));
  })();

  res.json({ ok: true });
});

// DELETE /api/task19/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task19_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── ИГРА (ученик) ──────────────────────────────────────── */

// GET /api/task19/tasks/:id/play — задание без ответов
router.get('/tasks/:id/play', (req, res) => {
  const task = db.prepare(
    'SELECT id, source_text, source, rule_types_json, explanation_md FROM task19_tasks WHERE id = ?'
  ).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const markers = (task.source_text.match(/\(\d+\)/g) || []).map(m => parseInt(m.slice(1, -1)));
  res.json({
    id:          task.id,
    source_text: task.source_text,
    source:      task.source,
    rule_types:  parseRuleTypes(task.rule_types_json),
    markers,
  });
});

// POST /api/task19/tasks/:id/check
router.post('/tasks/:id/check', (req, res) => {
  const task = getFullTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const { selected } = req.body;
  if (!Array.isArray(selected))
    return res.status(400).json({ error: 'selected должен быть массивом чисел' });

  const userSet    = new Set(selected.map(Number));
  const correctSet = new Set(task.comma_positions);
  const allMarkers = (task.source_text.match(/\(\d+\)/g) || []).map(m => parseInt(m.slice(1, -1)));

  const positionResults = allMarkers.map(pos => ({
    pos,
    user_selected: userSet.has(pos),
    correct: correctSet.has(pos),
    is_correct: userSet.has(pos) === correctSet.has(pos),
  }));

  res.json({
    is_correct:       positionResults.every(p => p.is_correct),
    comma_positions:  task.comma_positions,
    position_results: positionResults,
    explanation_md:   task.explanation_md,
  });
});

// POST /api/task19/next — следующее случайное задание
router.post('/next', (req, res) => {
  const { rule_type, exclude_ids } = req.body;
  const excluded = Array.isArray(exclude_ids) ? exclude_ids.map(Number) : [];

  let sql = 'SELECT id FROM task19_tasks WHERE 1=1';
  const params = [];
  // rule_types_json — JSON-массив; ищем вхождение строки через LIKE
  if (rule_type) { sql += ` AND rule_types_json LIKE ?`; params.push(`%"${rule_type}"%`); }
  if (excluded.length) {
    sql += ` AND id NOT IN (${excluded.map(() => '?').join(',')})`;
    params.push(...excluded);
  }
  sql += ' ORDER BY RANDOM() LIMIT 1';

  let task = db.prepare(sql).get(...params);
  if (!task) {
    const fallback = excluded.length
      ? `SELECT id FROM task19_tasks WHERE id NOT IN (${excluded.map(() => '?').join(',')}) ORDER BY RANDOM() LIMIT 1`
      : 'SELECT id FROM task19_tasks ORDER BY RANDOM() LIMIT 1';
    task = db.prepare(fallback).get(...excluded);
  }
  if (!task) return res.status(404).json({ error: 'Нет доступных заданий' });
  res.json({ id: task.id });
});

export default router;
