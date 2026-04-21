// server/routes/student.js
import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq } from './progress.js';

const router = Router();

function requireStudent(req, res, next) {
  const user = getUserIdFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  req.student = user;
  next();
}

/* ─── Мои ДЗ ───────────────────────────────────────────────── */

// GET /api/student/homework — список ДЗ для текущего ученика
router.get('/homework', requireStudent, (req, res) => {
  const list = db.prepare(`
    SELECT h.*,
      u.login AS teacher_login, u.first_name AS teacher_first, u.last_name AS teacher_last,
      hr.submitted_at, hr.total_score, hr.max_score, hr.teacher_comment
    FROM homework h
    JOIN users u ON u.id = h.teacher_id
    LEFT JOIN homework_results hr ON hr.homework_id = h.id
    WHERE h.student_id = ?
    ORDER BY h.assigned_at DESC
  `).all(req.student.id);

  res.json({ homework: list });
});

// POST /api/student/homework/:id/submit — сдать ДЗ
router.post('/homework/:id/submit', requireStudent, (req, res) => {
  const hw = db.prepare('SELECT * FROM homework WHERE id = ? AND student_id = ?')
    .get(Number(req.params.id), req.student.id);
  if (!hw) return res.status(404).json({ error: 'ДЗ не найдено' });

  const { scores, total_score, max_score } = req.body;

  // Upsert результата
  db.prepare(`
    INSERT INTO homework_results (homework_id, student_id, scores_json, total_score, max_score)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(homework_id) DO UPDATE SET
      scores_json = excluded.scores_json,
      total_score = excluded.total_score,
      max_score = excluded.max_score,
      submitted_at = datetime('now')
  `).run(
    hw.id,
    req.student.id,
    scores ? JSON.stringify(scores) : null,
    total_score != null ? Number(total_score) : null,
    max_score != null ? Number(max_score) : null
  );

  db.prepare("UPDATE homework SET status = 'submitted' WHERE id = ?").run(hw.id);
  res.json({ ok: true });
});

/* ─── Входящие запросы на подключение от учителей ───────────── */

// GET /api/student/connection-requests — запросы, ожидающие ответа
router.get('/connection-requests', requireStudent, (req, res) => {
  const requests = db.prepare(`
    SELECT cr.id, cr.from_user_id AS teacher_id, cr.status,
           u.login, u.first_name, u.last_name
    FROM connection_requests cr
    JOIN users u ON u.id = cr.from_user_id
    WHERE cr.to_user_id = ? AND cr.status = 'pending'
    ORDER BY cr.id DESC
  `).all(req.student.id);
  res.json({ requests });
});

// POST /api/student/connection-requests/:id/accept
router.post('/connection-requests/:id/accept', requireStudent, (req, res) => {
  const reqRow = db.prepare('SELECT * FROM connection_requests WHERE id = ? AND to_user_id = ?')
    .get(Number(req.params.id), req.student.id);
  if (!reqRow) return res.status(404).json({ error: 'Запрос не найден' });

  db.prepare("UPDATE connection_requests SET status = 'accepted' WHERE id = ?").run(reqRow.id);
  try {
    db.prepare('INSERT OR IGNORE INTO teacher_students (teacher_id, student_id) VALUES (?, ?)')
      .run(reqRow.from_user_id, req.student.id);
  } catch {}
  res.json({ ok: true });
});

// POST /api/student/connection-requests/:id/decline
router.post('/connection-requests/:id/decline', requireStudent, (req, res) => {
  const reqRow = db.prepare('SELECT * FROM connection_requests WHERE id = ? AND to_user_id = ?')
    .get(Number(req.params.id), req.student.id);
  if (!reqRow) return res.status(404).json({ error: 'Запрос не найден' });

  db.prepare("UPDATE connection_requests SET status = 'declined' WHERE id = ?").run(reqRow.id);
  res.json({ ok: true });
});

/* ─── Присоединиться к учителю по коду ─────────────────────── */

// POST /api/student/join-teacher
router.post('/join-teacher', requireStudent, (req, res) => {
  const code = req.body?.code?.trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Введите код' });

  const invite = db.prepare('SELECT * FROM teacher_invites WHERE code = ?').get(code);
  if (!invite) return res.status(400).json({ error: 'Неверный код' });

  if (invite.teacher_id === req.student.id) {
    return res.status(400).json({ error: 'Нельзя добавить себя' });
  }

  const already = db.prepare('SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?')
    .get(invite.teacher_id, req.student.id);
  if (already) return res.status(400).json({ error: 'Вы уже в списке у этого учителя' });

  db.prepare('INSERT OR IGNORE INTO teacher_students (teacher_id, student_id) VALUES (?, ?)')
    .run(invite.teacher_id, req.student.id);
  db.prepare('UPDATE teacher_invites SET used_count = used_count + 1 WHERE id = ?').run(invite.id);

  const teacher = db.prepare('SELECT login, first_name, last_name FROM users WHERE id = ?').get(invite.teacher_id);
  const teacherName = teacher?.first_name
    ? teacher.first_name + (teacher.last_name ? ' ' + teacher.last_name : '')
    : teacher?.login || 'Учитель';

  res.json({ ok: true, teacher_name: teacherName });
});

// GET /api/student/teacher — текущий учитель ученика (если есть)
router.get('/teacher', requireStudent, (req, res) => {
  const teacher = db.prepare(`
    SELECT u.id, u.login, u.first_name, u.last_name
    FROM teacher_students ts
    JOIN users u ON u.id = ts.teacher_id
    WHERE ts.student_id = ?
    ORDER BY ts.id DESC
    LIMIT 1
  `).get(req.student.id);

  if (!teacher) return res.json({ teacher: null });

  const teacherName = teacher.first_name
    ? teacher.first_name + (teacher.last_name ? ' ' + teacher.last_name : '')
    : teacher.login;

  res.json({
    teacher: {
      id: teacher.id,
      login: teacher.login,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      name: teacherName,
    },
  });
});

// POST /api/student/teacher/detach — открепиться от текущего учителя
router.post('/teacher/detach', requireStudent, (req, res) => {
  const link = db.prepare(`
    SELECT ts.id, ts.teacher_id
    FROM teacher_students ts
    WHERE ts.student_id = ?
    ORDER BY ts.id DESC
    LIMIT 1
  `).get(req.student.id);

  if (!link) return res.status(404).json({ error: 'Вы не прикреплены к учителю' });

  db.prepare('DELETE FROM teacher_students WHERE teacher_id = ? AND student_id = ?')
    .run(link.teacher_id, req.student.id);

  res.json({ ok: true });
});

export default router;
