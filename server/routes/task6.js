import { Router } from 'express';
import db from '../db.js';

const router = Router();

function normalizeAnswer(s) {
  return (s || '').trim().toLowerCase();
}

// GET /api/task6/sentences?subtype=exclude|replace
router.get('/sentences', (req, res) => {
  const { subtype } = req.query;
  let sql = 'SELECT * FROM task6_sentences WHERE 1=1';
  const params = [];
  if (subtype) { sql += ' AND subtype = ?'; params.push(subtype); }
  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/task6/sentences
router.post('/sentences', (req, res) => {
  const { subtype, sentence, answer, alt_answers, explanation, source } = req.body;
  if (!subtype || !['exclude', 'replace'].includes(subtype))
    return res.status(400).json({ error: 'subtype должен быть "exclude" или "replace"' });
  if (!sentence?.trim()) return res.status(400).json({ error: 'sentence обязателен' });
  if (!answer?.trim())   return res.status(400).json({ error: 'answer обязателен' });

  const altJson = Array.isArray(alt_answers)
    ? JSON.stringify(alt_answers.map(a => String(a).trim()).filter(Boolean))
    : null;

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO task6_sentences (subtype, sentence, answer, alt_answers, explanation, source) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(subtype, sentence.trim(), answer.trim(), altJson, explanation?.trim() || null, source?.trim() || null);
  res.json({ id: lastInsertRowid });
});

// PUT /api/task6/sentences/:id
router.put('/sentences/:id', (req, res) => {
  const { subtype, sentence, answer, alt_answers, explanation, source } = req.body;
  if (!subtype || !['exclude', 'replace'].includes(subtype))
    return res.status(400).json({ error: 'subtype должен быть "exclude" или "replace"' });
  if (!sentence?.trim()) return res.status(400).json({ error: 'sentence обязателен' });
  if (!answer?.trim())   return res.status(400).json({ error: 'answer обязателен' });

  const altJson = Array.isArray(alt_answers)
    ? JSON.stringify(alt_answers.map(a => String(a).trim()).filter(Boolean))
    : null;

  const r = db.prepare(
    'UPDATE task6_sentences SET subtype=?, sentence=?, answer=?, alt_answers=?, explanation=?, source=? WHERE id=?'
  ).run(subtype, sentence.trim(), answer.trim(), altJson, explanation?.trim() || null, source?.trim() || null, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

// DELETE /api/task6/sentences/:id
router.delete('/sentences/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task6_sentences WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

// GET /api/task6/sentences/:id/play — без ответа
router.get('/sentences/:id/play', (req, res) => {
  const row = db.prepare(
    'SELECT id, subtype, sentence, source FROM task6_sentences WHERE id = ?'
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(row);
});

// POST /api/task6/sentences/:id/check
router.post('/sentences/:id/check', (req, res) => {
  const row = db.prepare('SELECT * FROM task6_sentences WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Задание не найдено' });

  const userAnswer = normalizeAnswer(req.body.answer);
  if (!userAnswer) return res.status(400).json({ error: 'answer обязателен' });

  const correctAnswer = normalizeAnswer(row.answer);
  let altAnswers = [];
  try { altAnswers = row.alt_answers ? JSON.parse(row.alt_answers) : []; } catch {}

  const isCorrect = userAnswer === correctAnswer
    || altAnswers.some(a => normalizeAnswer(a) === userAnswer);

  res.json({
    is_correct: isCorrect,
    correct_answer: row.answer,
    alt_answers: altAnswers,
    explanation: row.explanation || null,
  });
});

// POST /api/task6/next — случайное следующее задание
router.post('/next', (req, res) => {
  const { subtype, exclude_ids } = req.body;
  const excluded = Array.isArray(exclude_ids) ? exclude_ids.map(Number) : [];

  let sql = 'SELECT id FROM task6_sentences WHERE 1=1';
  const params = [];
  if (subtype) { sql += ' AND subtype = ?'; params.push(subtype); }
  if (excluded.length) {
    sql += ` AND id NOT IN (${excluded.map(() => '?').join(',')})`;
    params.push(...excluded);
  }
  sql += ' ORDER BY RANDOM() LIMIT 1';

  const row = db.prepare(sql).get(...params);
  if (!row) return res.status(404).json({ error: 'Нет доступных заданий' });
  res.json({ id: row.id });
});

export default router;
