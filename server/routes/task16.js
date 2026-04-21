// server/routes/task16.js — Задание №16: Знаки при однородных членах и в ССП
import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, logTaskCompletion } from './progress.js';

const router = Router();

/* ─── Справочник типов правил ─────────────────────────────── */

export const RULE_TYPE_LABELS = {
  homogeneous:    'Однородные члены',
  ssp:            'ССП (сложносочинённое предложение)',
  double_union:   'Двойной союз (как...так и, не только...но и)',
  repeated_union: 'Повторяющийся союз (и...и, или...или)',
  none:           'Запятая не нужна (ловушка)',
};

/* ─── Хелперы ────────────────────────────────────────────── */

/**
 * Парсит позиции запятых из текста с запятыми.
 * Возвращает массив 0-based gap-индексов: gap[i] = пробел после слова i.
 *
 * Пример: "прибирал, да" → слово "прибирал," на индексе 2 → [2]
 */
function parseGaps(text) {
  const words = text.trim().split(/\s+/);
  const gaps = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].endsWith(',')) gaps.push(i);
  }
  return gaps;
}

/** Убирает запятые из текста → строка для ученика */
function stripCommas(text) {
  return text.replace(/,(\s)/g, '$1').replace(/,$/, '').trim();
}

function parseSentence(s) {
  return {
    ...s,
    comma_positions: JSON.parse(s.comma_positions_json || '[]'),
    rule_types:      JSON.parse(s.rule_types_json || '[]'),
  };
}

function getFullTask(taskId) {
  const task = db.prepare('SELECT * FROM task16_tasks WHERE id = ?').get(taskId);
  if (!task) return null;

  const sentences = db.prepare(`
    SELECT ts.position,
           s.id AS sentence_id, s.source_text,
           s.comma_positions_json, s.rule_types_json, s.explanation_md, s.source
    FROM task16_task_sentences ts
    JOIN task16_sentences s ON s.id = ts.sentence_id
    WHERE ts.task_id = ?
    ORDER BY ts.position
  `).all(taskId);

  return { ...task, sentences: sentences.map(parseSentence) };
}

/* ─── БАНК ПРЕДЛОЖЕНИЙ (админ) ───────────────────────────── */

// GET /api/task16/sentences
router.get('/sentences', (req, res) => {
  const { rule_type } = req.query;
  let sql = 'SELECT * FROM task16_sentences WHERE 1=1';
  const params = [];
  if (rule_type) { sql += " AND rule_types_json LIKE ?"; params.push(`%"${rule_type}"%`); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(parseSentence));
});

// GET /api/task16/sentences/:id
router.get('/sentences/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM task16_sentences WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Предложение не найдено' });
  res.json(parseSentence(s));
});

// POST /api/task16/sentences
// body: { source_text, rule_types, explanation_md, source }
// source_text — предложение С запятыми; позиции вычисляются автоматически
router.post('/sentences', (req, res) => {
  const { source_text, rule_types, explanation_md, source } = req.body;
  if (!source_text || !source_text.trim())
    return res.status(400).json({ error: 'source_text обязателен' });

  const gaps = parseGaps(source_text.trim());

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO task16_sentences
      (source_text, base_text, comma_positions_json, rule_types_json, explanation_md, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    source_text.trim(),
    source_text.trim(),          // base_text = то же самое (для обратной совместимости)
    JSON.stringify(gaps),
    Array.isArray(rule_types) ? JSON.stringify(rule_types) : null,
    explanation_md || null,
    source || null,
  );

  res.json({ id: lastInsertRowid });
});

// PUT /api/task16/sentences/:id
router.put('/sentences/:id', (req, res) => {
  const { source_text, rule_types, explanation_md, source } = req.body;
  if (!source_text || !source_text.trim())
    return res.status(400).json({ error: 'source_text обязателен' });

  const gaps = parseGaps(source_text.trim());

  const r = db.prepare(`
    UPDATE task16_sentences
    SET source_text=?, base_text=?, comma_positions_json=?, rule_types_json=?, explanation_md=?, source=?
    WHERE id=?
  `).run(
    source_text.trim(),
    source_text.trim(),
    JSON.stringify(gaps),
    Array.isArray(rule_types) ? JSON.stringify(rule_types) : null,
    explanation_md || null,
    source || null,
    req.params.id,
  );

  if (r.changes === 0) return res.status(404).json({ error: 'Предложение не найдено' });
  res.json({ ok: true });
});

// DELETE /api/task16/sentences/:id
router.delete('/sentences/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task16_sentences WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Предложение не найдено' });
  res.json({ ok: true });
});

/* ─── ЗАДАНИЯ (админ) ────────────────────────────────────── */

// GET /api/task16/tasks
router.get('/tasks', (_req, res) => {
  const tasks = db.prepare(`
    SELECT t.id, t.source, t.created_at, COUNT(ts.id) AS sentence_count
    FROM task16_tasks t
    LEFT JOIN task16_task_sentences ts ON ts.task_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
  res.json(tasks);
});

// GET /api/task16/tasks/:id
router.get('/tasks/:id', (req, res) => {
  const task = getFullTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(task);
});

// POST /api/task16/tasks
router.post('/tasks', (req, res) => {
  const { source, sentences } = req.body;
  if (!Array.isArray(sentences) || sentences.length === 0)
    return res.status(400).json({ error: 'sentences обязателен' });

  const create = db.transaction(() => {
    const { lastInsertRowid: taskId } = db.prepare(
      'INSERT INTO task16_tasks (source) VALUES (?)'
    ).run(source || null);
    const ins = db.prepare('INSERT INTO task16_task_sentences (task_id, sentence_id, position) VALUES (?, ?, ?)');
    for (const s of sentences) ins.run(taskId, s.sentence_id, s.position);
    return taskId;
  });

  res.json({ id: create() });
});

// PUT /api/task16/tasks/:id
router.put('/tasks/:id', (req, res) => {
  const { source, sentences } = req.body;
  if (!Array.isArray(sentences) || sentences.length === 0)
    return res.status(400).json({ error: 'sentences обязателен' });

  if (!db.prepare('SELECT 1 FROM task16_tasks WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Задание не найдено' });

  db.transaction(() => {
    db.prepare('UPDATE task16_tasks SET source=? WHERE id=?').run(source || null, req.params.id);
    db.prepare('DELETE FROM task16_task_sentences WHERE task_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO task16_task_sentences (task_id, sentence_id, position) VALUES (?, ?, ?)');
    for (const s of sentences) ins.run(req.params.id, s.sentence_id, s.position);
  })();

  res.json({ ok: true });
});

// DELETE /api/task16/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task16_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── ИГРА (ученик) ──────────────────────────────────────── */

// GET /api/task16/tasks/:id/play
// Возвращает предложения БЕЗ запятых — ученик расставляет сам
router.get('/tasks/:id/play', (req, res) => {
  const task = db.prepare('SELECT id, source FROM task16_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const rows = db.prepare(`
    SELECT ts.position, s.id AS sentence_id, s.source_text
    FROM task16_task_sentences ts
    JOIN task16_sentences s ON s.id = ts.sentence_id
    WHERE ts.task_id = ?
    ORDER BY ts.position
  `).all(req.params.id);

  const sentences = rows.map(r => ({
    position:    r.position,
    sentence_id: r.sentence_id,
    play_text:   stripCommas(r.source_text),  // без запятых
  }));

  res.json({ id: task.id, source: task.source, sentences });
});

// POST /api/task16/tasks/:id/check
// body: { answers: { "1": [2], "2": [0,3], ... } }
//   ключ — позиция предложения (1–5)
//   значение — массив gap-индексов (0-based: пробел после слова i)
router.post('/tasks/:id/check', (req, res) => {
  const task = getFullTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const { answers } = req.body;
  if (!answers || typeof answers !== 'object')
    return res.status(400).json({ error: 'answers обязателен: { "1": [gap-индексы], ... }' });

  const sentenceResults = task.sentences.map(s => {
    const userSelected = (answers[String(s.position)] || []).map(Number);
    const correctSet   = new Set(s.comma_positions);
    const userSet      = new Set(userSelected);

    const wordCount = s.source_text.trim().split(/\s+/).length;
    const allGaps   = Array.from({ length: wordCount - 1 }, (_, i) => i);

    const gapResults = allGaps.map(g => ({
      gap:           g,
      user_selected: userSet.has(g),
      correct:       correctSet.has(g),
      is_correct:    userSet.has(g) === correctSet.has(g),
    }));

    return {
      position:       s.position,
      sentence_id:    s.sentence_id,
      source_text:    s.source_text,       // с запятыми — показываем после проверки
      play_text:      stripCommas(s.source_text),
      is_correct:     gapResults.every(r => r.is_correct),
      gap_results:    gapResults,
      rule_types:     s.rule_types,
      explanation_md: s.explanation_md,
    };
  });

  const isCorrect = sentenceResults.every(r => r.is_correct);

  const userInfo = getUserIdFromReq(req);
  if (userInfo) logTaskCompletion(userInfo.id, 'task16');

  res.json({ is_correct: isCorrect, sentence_results: sentenceResults });
});

// POST /api/task16/next
router.post('/next', (req, res) => {
  const { exclude_ids } = req.body;
  const excluded = Array.isArray(exclude_ids) ? exclude_ids.map(Number) : [];
  let sql = 'SELECT id FROM task16_tasks';
  if (excluded.length) sql += ` WHERE id NOT IN (${excluded.map(() => '?').join(',')})`;
  sql += ' ORDER BY RANDOM() LIMIT 1';
  const row = db.prepare(sql).get(...excluded);
  if (!row) return res.status(404).json({ error: 'Нет доступных заданий' });
  res.json({ id: row.id });
});

export default router;
