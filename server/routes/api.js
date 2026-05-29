// server/routes/api.js
import { Router } from 'express';
import db from '../db.js';

const api = Router();

/* ----------------------
   ТЕМЫ по типу
   GET /api/subtopics?type=1
----------------------- */
api.get('/subtopics', (req, res) => {
  const type = Number(req.query.type);
  if (!type) return res.status(400).json({ error: 'type required' });

  const rows = db.prepare(`
    SELECT 
      s.id,
      s.title,
      s.description,
      s.order_index,
      s.type_id,
      COUNT(a.id) as assignments_count
    FROM subtopics s
    LEFT JOIN assignments a ON a.subtopic_id = s.id
    WHERE s.type_id = ?
    GROUP BY s.id, s.title, s.description, s.order_index, s.type_id
    ORDER BY s.id
  `).all(type);

  res.json(rows);
});


/* ----------------------
   ЗАДАНИЯ по теме
   GET /api/assignments?subtopicId=1
----------------------- */
api.get('/assignments', (req, res) => {
  const subtopicId = req.query.subtopicId ? Number(req.query.subtopicId) : null;
  if (!subtopicId) return res.status(400).json({ error: 'subtopicId required' });

  const rows = db.prepare(`
    SELECT
      a.id,
      a.fipi_number,
      a.source,
      a.prompt,
      a.context,
      a.answer,
      a.explanation,
      a.rule_ref,
      a.alt_answers,
      a.extra_data
    FROM assignments a
    WHERE a.subtopic_id = ?
    ORDER BY a.id
  `).all(subtopicId);

  res.json(rows);
});


/* ----------------------
   ЗАДАНИЯ по типу (все задания типа)
   GET /api/assignments/by-type?type=1
----------------------- */
api.get('/assignments/by-type', (req, res) => {
  const type = Number(req.query.type);
  if (!type) return res.status(400).json({ error: 'type required' });

  const rows = db.prepare(`
    SELECT
      a.id,
      a.subtopic_id,
      s.title AS subtopic_title,
      a.fipi_number,
      a.source,
      a.prompt,
      a.context,
      a.answer,
      a.explanation,
      a.rule_ref,
      a.alt_answers,
      a.extra_data
    FROM assignments a
    JOIN subtopics s ON s.id = a.subtopic_id
    WHERE s.type_id = ?
    ORDER BY a.subtopic_id, a.id
  `).all(type);

  res.json(rows);
});


/* ----------------------
   ОДНО ЗАДАНИЕ по id (для страницы решения)
   GET /api/assignments/by-id/:id
----------------------- */
api.get('/assignments/by-id/:id', (req, res) => {
  const id = Number(req.params.id);
  const a = db.prepare(`
    SELECT
      a.id,
      a.subtopic_id,
      st.title AS subtopic_title,
      st.type_id,
      a.fipi_number,
      a.source,
      a.prompt,
      a.context,
      a.answer,
      a.explanation,
      a.rule_ref,
      a.alt_answers,
      a.extra_data,
      a.passage_id,
      p.context AS passage_context
    FROM assignments a
    LEFT JOIN subtopics st ON st.id = a.subtopic_id
    LEFT JOIN text_passages p ON p.id = a.passage_id
    WHERE a.id = ?
  `).get(id);

  if (!a) return res.status(404).json({ error: 'not found' });

  // Если у задания есть пассаж — контекст берём из него
  if (a.passage_id && a.passage_context) {
    a.context = a.passage_context;
  }
  delete a.passage_context;

  res.json(a);
});


/* ----------------------
   ПРОВЕРКА ОТВЕТА по assignmentId
   POST /api/check/by-id
   body: { assignmentId, userAnswer, userId? }
----------------------- */
api.post('/check/by-id', (req, res) => {
  const { assignmentId, userAnswer, userId } = req.body || {};
  if (!assignmentId) {
    return res.status(400).json({ ok:false, error:'assignmentId required' });
  }
  if (typeof userAnswer !== 'string') {
    return res.status(400).json({ ok:false, error:'userAnswer must be string' });
  }
  if (userAnswer.trim() === '') {
    return res.status(400).json({ ok:false, error:'empty answer' });
  }

  const norm = s => (s || '').trim().toLowerCase();

  // Получаем задание с ответами
  const assignment = db.prepare(`
    SELECT id, answer, alt_answers
    FROM assignments
    WHERE id = ?
  `).get(assignmentId);

  if (!assignment) {
    return res.status(404).json({ ok: false, error: 'assignment not found' });
  }

  const userNorm = norm(userAnswer);
  const mainAnswer = norm(assignment.answer);
  const altAnswers = assignment.alt_answers ? JSON.parse(assignment.alt_answers) : [];
  
  // Проверяем основной ответ
  const isMainMatch = mainAnswer === userNorm;
  
  // Проверяем дополнительные ответы
  const isAltMatch = altAnswers.some(alt => norm(alt) === userNorm);
  
  const ok = isMainMatch || isAltMatch;

  // Логируем попытку
  try {
    db.prepare(`
      INSERT INTO answers_log (assignment_id, user_id, user_answer, is_correct)
      VALUES (?, ?, ?, ?)
    `).run(assignmentId, userId || null, userAnswer, ok ? 1 : 0);
  } catch {}

  if (ok) {
    return res.json({
      ok: true,
      matched: {
        value: assignment.answer
      }
    });
  }

  res.json({
    ok: false,
    hint: {
      value: assignment.answer
    }
  });
});


/* ----------------------
   (опционально) список тем с количеством заданий
   GET /api/subtopics/with-count?type=1
----------------------- */
api.get('/subtopics/with-count', (req, res) => {
  const type = Number(req.query.type);
  if (!type) return res.status(400).json({ error: 'type required' });

  const rows = db.prepare(`
    SELECT
      s.id, s.title, s.description,
      COUNT(a.id) AS assignments_count
    FROM subtopics s
    LEFT JOIN assignments a ON a.subtopic_id = s.id
    WHERE s.type_id = ?
    GROUP BY s.id, s.title, s.description
    ORDER BY s.id
  `).all(type);

  res.json(rows);
});

/* ----------------------
   УПРАВЛЕНИЕ ИСТОЧНИКАМИ
   GET /api/sources - получить все источники
   POST /api/sources - добавить новый источник
----------------------- */

api.get('/sources', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name, created_at
      FROM sources
      ORDER BY name
    `).all();
    
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения источников:', error);
    res.status(500).json({ error: 'Ошибка получения источников' });
  }
});

api.post('/sources', (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Название источника обязательно' });
    }
    
    const result = db.prepare(`
      INSERT INTO sources (name)
      VALUES (?)
    `).run(name.trim());
    
    res.json({ id: result.lastInsertRowid, name: name.trim(), message: 'Источник добавлен' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Источник с таким названием уже существует' });
    }
    console.error('Ошибка добавления источника:', error);
    res.status(500).json({ error: 'Ошибка добавления источника' });
  }
});

api.put('/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Название источника обязательно' });
    }
    
    const result = db.prepare(`
      UPDATE sources
      SET name = ?
      WHERE id = ?
    `).run(name.trim(), id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Источник не найден' });
    }
    
    res.json({ id: parseInt(id), name: name.trim(), message: 'Источник обновлен' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Источник с таким названием уже существует' });
    }
    console.error('Ошибка обновления источника:', error);
    res.status(500).json({ error: 'Ошибка обновления источника' });
  }
});

api.delete('/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем, используется ли источник в заданиях
    const usage = db.prepare(`
      SELECT COUNT(*) as count FROM task17 WHERE source = (SELECT name FROM sources WHERE id = ?)
    `).get(id);
    
    if (usage && usage.count > 0) {
      return res.status(400).json({ error: `Невозможно удалить источник: он используется в ${usage.count} задании(ях)` });
    }
    
    const result = db.prepare(`
      DELETE FROM sources
      WHERE id = ?
    `).run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Источник не найден' });
    }
    
    res.json({ message: 'Источник удален' });
  } catch (error) {
    console.error('Ошибка удаления источника:', error);
    res.status(500).json({ error: 'Ошибка удаления источника' });
  }
});

/* ── Theory unlock system ─────────────────────────────── */

// Создаём таблицу если не существует
db.exec(`
  CREATE TABLE IF NOT EXISTS theory_unlocks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    theory_key TEXT    NOT NULL,
    unlocked_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, theory_key)
  )
`);

// GET /api/theory/unlocks — список разблокированных для текущего пользователя
api.get('/theory/unlocks', (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return res.json({ unlocked: [] });
  const session = db.prepare('SELECT user_id FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) return res.json({ unlocked: [] });
  const rows = db.prepare('SELECT theory_key FROM theory_unlocks WHERE user_id = ?').all(session.user_id);
  res.json({ unlocked: rows.map(r => r.theory_key) });
});

// POST /api/theory/unlock — разблокировать раздел теории
api.post('/theory/unlock', (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return res.status(401).json({ error: 'Требуется авторизация' });
  const session = db.prepare('SELECT user_id FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) return res.status(401).json({ error: 'Требуется авторизация' });
  const { theory_key } = req.body;
  if (!theory_key) return res.status(400).json({ error: 'theory_key required' });
  db.prepare('INSERT OR IGNORE INTO theory_unlocks (user_id, theory_key) VALUES (?, ?)').run(session.user_id, theory_key);
  res.json({ ok: true });
});

export default api;
