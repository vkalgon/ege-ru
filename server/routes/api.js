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
    ORDER BY s.order_index, s.id
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
      a.extra_data
    FROM assignments a
    JOIN subtopics st ON st.id = a.subtopic_id
    WHERE a.id = ?
  `).get(id);

  if (!a) return res.status(404).json({ error: 'not found' });
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
    ORDER BY s.order_index, s.title
  `).all(type);

  res.json(rows);
});

export default api;
