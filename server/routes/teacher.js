// server/routes/teacher.js
import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import { getUserIdFromReq, buildSummaryForUser, buildWeakWordsForUser, MASTERY_THRESHOLD } from './progress.js';

const router = Router();

/** Middleware: только для учителей */
function requireTeacher(req, res, next) {
  const user = getUserIdFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  if (user.role !== 'teacher') return res.status(403).json({ error: 'Только для учителей' });
  req.teacher = user;
  next();
}

/* ─── Мои ученики ──────────────────────────────────────────── */

// GET /api/teacher/students
router.get('/students', requireTeacher, (req, res) => {
  const students = db.prepare(`
    SELECT u.id, u.login, u.first_name, u.last_name, u.username, ts.created_at AS linked_at
    FROM teacher_students ts
    JOIN users u ON u.id = ts.student_id
    WHERE ts.teacher_id = ?
    ORDER BY ts.created_at DESC
  `).all(req.teacher.id);

  const result = students.map(s => {
    const stats = db.prepare(`
      SELECT SUM(total_attempts) AS ta, SUM(total_correct) AS tc,
             SUM(is_mastered) AS mastered,
             SUM(CASE WHEN is_mastered=0 AND total_correct < total_attempts THEN 1 ELSE 0 END) AS weak
      FROM student_word_progress WHERE user_id = ?
    `).get(s.id);
    const ta = stats?.ta || 0;
    const tc = stats?.tc || 0;
    return {
      id: s.id,
      login: s.login,
      first_name: s.first_name,
      last_name: s.last_name,
      username: s.username,
      linked_at: s.linked_at,
      total_attempts: ta,
      accuracy: ta > 0 ? Math.round(tc / ta * 100) : 0,
      mastered_count: stats?.mastered || 0,
      weak_count: stats?.weak || 0,
    };
  });

  res.json({ students: result });
});

// POST /api/teacher/students  — добавить ученика по логину
router.post('/students', requireTeacher, (req, res) => {
  const login = req.body?.login?.trim();
  if (!login) return res.status(400).json({ error: 'Введите логин ученика' });

  const student = db.prepare(
    `SELECT id, login, first_name, last_name, role FROM users WHERE login = ?`
  ).get(login);
  if (!student) return res.status(404).json({ error: 'Пользователь с таким логином не найден' });
  if (student.role !== 'student') return res.status(400).json({ error: 'Этот пользователь не является учеником' });
  if (student.id === req.teacher.id) return res.status(400).json({ error: 'Нельзя добавить себя' });

  const exists = db.prepare(
    `SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?`
  ).get(req.teacher.id, student.id);
  if (exists) return res.status(400).json({ error: 'Этот ученик уже добавлен' });

  db.prepare(`INSERT INTO teacher_students (teacher_id, student_id) VALUES (?, ?)`).run(req.teacher.id, student.id);

  // Возвращаем сразу с базовой статистикой
  res.json({
    ok: true,
    student: {
      id: student.id, login: student.login,
      first_name: student.first_name, last_name: student.last_name,
      total_attempts: 0, accuracy: 0, mastered_count: 0, weak_count: 0,
    }
  });
});

// DELETE /api/teacher/students/:id  — убрать ученика
router.delete('/students/:id', requireTeacher, (req, res) => {
  const r = db.prepare(
    `DELETE FROM teacher_students WHERE teacher_id=? AND student_id=?`
  ).run(req.teacher.id, Number(req.params.id));
  if (r.changes === 0) return res.status(404).json({ error: 'Ученик не найден в вашем списке' });
  res.json({ ok: true });
});

/* ─── Статистика ученика ───────────────────────────────────── */

// GET /api/teacher/students/:id/stats
router.get('/students/:id/stats', requireTeacher, (req, res) => {
  const link = db.prepare(
    `SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?`
  ).get(req.teacher.id, Number(req.params.id));
  if (!link) return res.status(403).json({ error: 'Нет доступа к этому ученику' });

  const summary = buildSummaryForUser(Number(req.params.id));
  res.json({ summary });
});

// GET /api/teacher/students/:id/weak-words
router.get('/students/:id/weak-words', requireTeacher, (req, res) => {
  const link = db.prepare(
    `SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?`
  ).get(req.teacher.id, Number(req.params.id));
  if (!link) return res.status(403).json({ error: 'Нет доступа к этому ученику' });

  const weak_words = buildWeakWordsForUser(Number(req.params.id));
  res.json({ weak_words, mastery_threshold: MASTERY_THRESHOLD });
});

/* ─── Коды приглашения ──────────────────────────────────────── */

// GET /api/teacher/invite — получить текущий код (или создать)
router.get('/invite', requireTeacher, (req, res) => {
  let invite = db.prepare('SELECT * FROM teacher_invites WHERE teacher_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.teacher.id);

  if (!invite) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const result = db.prepare('INSERT INTO teacher_invites (teacher_id, code) VALUES (?, ?)').run(req.teacher.id, code);
    invite = db.prepare('SELECT * FROM teacher_invites WHERE id = ?').get(result.lastInsertRowid);
  }

  res.json({ code: invite.code, used_count: invite.used_count, created_at: invite.created_at });
});

// POST /api/teacher/invite/refresh — сгенерировать новый код
router.post('/invite/refresh', requireTeacher, (req, res) => {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const result = db.prepare('INSERT INTO teacher_invites (teacher_id, code) VALUES (?, ?)').run(req.teacher.id, code);
  const invite = db.prepare('SELECT * FROM teacher_invites WHERE id = ?').get(result.lastInsertRowid);
  res.json({ code: invite.code, used_count: 0, created_at: invite.created_at });
});

/* ─── Запросы на подключение (поиск по email) ───────────────── */

// POST /api/teacher/connect-request — учитель ищет ученика по email и отправляет запрос
router.post('/connect-request', requireTeacher, (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Введите email' });

  const student = db.prepare('SELECT id, login, first_name, last_name, email, role FROM users WHERE email = ?').get(email);
  if (!student) return res.status(404).json({ error: 'Пользователь с таким email не найден' });
  if (student.role !== 'student') return res.status(400).json({ error: 'Этот пользователь не является учеником' });

  const alreadyLinked = db.prepare('SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?')
    .get(req.teacher.id, student.id);
  if (alreadyLinked) return res.status(400).json({ error: 'Этот ученик уже в вашем списке' });

  try {
    db.prepare(`
      INSERT INTO connection_requests (from_user_id, to_user_id, status)
      VALUES (?, ?, 'pending')
      ON CONFLICT(from_user_id, to_user_id) DO UPDATE SET status='pending'
    `).run(req.teacher.id, student.id);
  } catch (e) {
    return res.status(400).json({ error: 'Запрос уже отправлен' });
  }

  res.json({ ok: true, student: { id: student.id, login: student.login, first_name: student.first_name, last_name: student.last_name } });
});

// GET /api/teacher/connect-requests — входящие ответы на запросы (для отображения)
router.get('/connect-requests', requireTeacher, (req, res) => {
  const requests = db.prepare(`
    SELECT cr.id, cr.to_user_id AS student_id, cr.status,
           u.login, u.first_name, u.last_name, u.email
    FROM connection_requests cr
    JOIN users u ON u.id = cr.to_user_id
    WHERE cr.from_user_id = ?
    ORDER BY cr.id DESC
  `).all(req.teacher.id);
  res.json({ requests });
});

/* ─── Домашние задания ──────────────────────────────────────── */

// POST /api/teacher/homework — создать ДЗ
router.post('/homework', requireTeacher, (req, res) => {
  const { student_id, title, task_type, task_ids, due_date } = req.body;

  if (!student_id || !title || !task_type || !task_ids?.length) {
    return res.status(400).json({ error: 'Не заполнены обязательные поля' });
  }

  // Проверяем, что ученик принадлежит учителю
  const link = db.prepare('SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?')
    .get(req.teacher.id, Number(student_id));
  if (!link) return res.status(403).json({ error: 'Нет доступа к этому ученику' });

  const result = db.prepare(`
    INSERT INTO homework (teacher_id, student_id, title, task_type, task_ids, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.teacher.id, Number(student_id), title, task_type, JSON.stringify(task_ids), due_date || null);

  res.json({ ok: true, homework_id: result.lastInsertRowid });
});

// GET /api/teacher/homework — список всех ДЗ учителя (по всем ученикам)
router.get('/homework', requireTeacher, (req, res) => {
  const list = db.prepare(`
    SELECT h.*, u.login, u.first_name, u.last_name,
      hr.submitted_at, hr.total_score, hr.max_score, hr.teacher_comment
    FROM homework h
    JOIN users u ON u.id = h.student_id
    LEFT JOIN homework_results hr ON hr.homework_id = h.id
    WHERE h.teacher_id = ?
    ORDER BY h.assigned_at DESC
  `).all(req.teacher.id);
  res.json({ homework: list });
});

// GET /api/teacher/homework/student/:id — ДЗ для конкретного ученика
router.get('/homework/student/:id', requireTeacher, (req, res) => {
  const link = db.prepare('SELECT 1 FROM teacher_students WHERE teacher_id=? AND student_id=?')
    .get(req.teacher.id, Number(req.params.id));
  if (!link) return res.status(403).json({ error: 'Нет доступа к этому ученику' });

  const list = db.prepare(`
    SELECT h.*,
      hr.submitted_at, hr.total_score, hr.max_score, hr.teacher_comment
    FROM homework h
    LEFT JOIN homework_results hr ON hr.homework_id = h.id
    WHERE h.teacher_id = ? AND h.student_id = ?
    ORDER BY h.assigned_at DESC
  `).all(req.teacher.id, Number(req.params.id));
  res.json({ homework: list });
});

// POST /api/teacher/homework/:id/comment — учитель добавляет комментарий к ДЗ
router.post('/homework/:id/comment', requireTeacher, (req, res) => {
  const hw = db.prepare('SELECT * FROM homework WHERE id = ? AND teacher_id = ?')
    .get(Number(req.params.id), req.teacher.id);
  if (!hw) return res.status(404).json({ error: 'ДЗ не найдено' });

  const { comment, score } = req.body;
  // Создаём строку если ещё нет, потом обновляем
  db.prepare(`INSERT OR IGNORE INTO homework_results (homework_id, student_id) VALUES (?, ?)`)
    .run(hw.id, hw.student_id);
  db.prepare(`
    UPDATE homework_results SET teacher_comment = ?, total_score = COALESCE(?, total_score)
    WHERE homework_id = ?
  `).run(comment || null, score != null ? Number(score) : null, hw.id);

  db.prepare("UPDATE homework SET status = 'reviewed' WHERE id = ?").run(hw.id);
  res.json({ ok: true });
});

export default router;
