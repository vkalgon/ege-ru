import { Router } from 'express';
import db from '../db.js';
import crypto from 'crypto';

const auth = Router();

// Генерация session ID
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Хеширование пароля
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Проверка пароля
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

/* ----------------------
   TELEGRAM AUTH
   POST /api/auth/telegram
----------------------- */
auth.post('/telegram', (req, res) => {
  try {
    const { id, username, first_name, last_name, auth_date, hash } = req.body;
    
    if (!id || !auth_date || !hash) {
      return res.status(400).json({ error: 'Недостаточно данных для авторизации' });
    }
    
    // В реальном проекте здесь должна быть проверка подписи от Telegram
    // Для демонстрации пропускаем проверку
    
    // Ищем пользователя по telegram_id
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(id);
    
    if (!user) {
      // Создаем нового пользователя
      const result = db.prepare(`
        INSERT INTO users (telegram_id, username, first_name, last_name, last_login)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(id, username || null, first_name || null, last_name || null);
      
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      // Обновляем время последнего входа
      db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);
    }
    
    // Создаем сессию
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
    
    db.prepare(`
      INSERT INTO user_sessions (user_id, session_id, expires_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, sessionId, expiresAt.toISOString(), req.get('User-Agent'), req.ip);
    
    // Устанавливаем cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
      sameSite: 'lax'
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar: user.avatar || null,
      }
    });
    
  } catch (error) {
    console.error('Ошибка Telegram авторизации:', error);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

/* ----------------------
   LOGIN/PASSWORD AUTH
   POST /api/auth/login
----------------------- */
auth.post('/login', (req, res) => {
  try {
    const { login, password } = req.body;
    
    if (!login || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    
    // Ищем пользователя по логину
    const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
    
    if (!user) {
      return res.status(400).json({ error: 'Неверный логин или пароль' });
    }
    
    // Проверяем пароль
    if (!verifyPassword(password, user.password)) {
      return res.status(400).json({ error: 'Неверный логин или пароль' });
    }
    
    // Обновляем время последнего входа
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);
    
    // Создаем сессию
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
    
    db.prepare(`
      INSERT INTO user_sessions (user_id, session_id, expires_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, sessionId, expiresAt.toISOString(), req.get('User-Agent'), req.ip);
    
    // Устанавливаем cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
      sameSite: 'lax'
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        role: user.role || 'student',
        avatar: user.avatar || null,
      }
    });

  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

/* ----------------------
   REGISTER NEW USER
   POST /api/auth/register
----------------------- */
auth.post('/register', (req, res) => {
  try {
    const { login, password, first_name, last_name, email, teacher_code } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    // Проверяем, не существует ли уже такой логин
    const existingUser = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    // Проверяем уникальность email если указан
    if (email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existingEmail) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }
    }

    // Валидируем роль
    const role = (req.body.role === 'teacher') ? 'teacher' : 'student';

    // Проверяем код учителя (если передан)
    let teacherFromCode = null;
    if (teacher_code && role === 'student') {
      teacherFromCode = db.prepare(
        'SELECT * FROM teacher_invites WHERE code = ?'
      ).get(teacher_code.trim().toUpperCase());
      if (!teacherFromCode) {
        return res.status(400).json({ error: 'Неверный код учителя' });
      }
    }

    // Создаем нового пользователя
    const hashedPassword = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (login, password, first_name, last_name, email, role, last_login)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      login,
      hashedPassword,
      first_name || null,
      last_name || null,
      email ? email.trim().toLowerCase() : null,
      role
    );

    const userId = result.lastInsertRowid;

    // Если был код учителя — привязываем ученика
    if (teacherFromCode) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO teacher_students (teacher_id, student_id)
          VALUES (?, ?)
        `).run(teacherFromCode.teacher_id, userId);
        db.prepare('UPDATE teacher_invites SET used_count = used_count + 1 WHERE id = ?')
          .run(teacherFromCode.id);
      } catch {}
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    // Создаем сессию
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

    db.prepare(`
      INSERT INTO user_sessions (user_id, session_id, expires_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, sessionId, expiresAt.toISOString(), req.get('User-Agent'), req.ip);

    // Устанавливаем cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
      sameSite: 'lax'
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin,
        role: user.role || 'student',
        onboarding_done: user.onboarding_done || 0,
        avatar: user.avatar || null,
      }
    });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

/* ----------------------
   ONBOARDING
   POST /api/auth/onboarding
----------------------- */
auth.post('/onboarding', (req, res) => {
  try {
    const sessionId = req.cookies.session_id;
    if (!sessionId) return res.status(401).json({ error: 'Не авторизован' });

    const session = db.prepare(`
      SELECT u.id, u.role FROM users u
      JOIN user_sessions s ON s.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);
    if (!session) return res.status(401).json({ error: 'Сессия истекла' });

    const { level, target_score, weak_tasks } = req.body;

    // Сохраняем или обновляем ответы опросника
    db.prepare(`
      INSERT INTO student_onboarding (user_id, level, target_score, weak_tasks)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        level = excluded.level,
        target_score = excluded.target_score,
        weak_tasks = excluded.weak_tasks,
        completed_at = datetime('now')
    `).run(
      session.id,
      level || null,
      target_score ? Number(target_score) : null,
      weak_tasks ? JSON.stringify(weak_tasks) : null
    );

    db.prepare('UPDATE users SET onboarding_done = 1 WHERE id = ?').run(session.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка онбординга:', error);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

/* ----------------------
   LOGOUT
   POST /api/auth/logout
----------------------- */
auth.post('/logout', (req, res) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (sessionId) {
      // Удаляем сессию из базы
      db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId);
    }
    
    // Очищаем cookie
    res.clearCookie('session_id');
    res.json({ success: true });
    
  } catch (error) {
    console.error('Ошибка выхода:', error);
    res.status(500).json({ error: 'Ошибка выхода' });
  }
});

/* ----------------------
   GET CURRENT USER
   GET /api/auth/me
----------------------- */
auth.get('/me', (req, res) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Проверяем сессию
    const session = db.prepare(`
      SELECT u.*,
             so.task4_mechanics_done,
             so.task17_mechanics_done
      FROM users u
      JOIN user_sessions s ON s.user_id = u.id
      LEFT JOIN student_onboarding so ON so.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Сессия истекла' });
    }
    
    res.json({
      success: true,
      user: {
        id: session.id,
        telegram_id: session.telegram_id,
        phone: session.phone,
        username: session.username,
        first_name: session.first_name,
        last_name: session.last_name,
        email: session.email,
        is_admin: session.is_admin,
        role: session.role || 'student',
        onboarding_done: session.onboarding_done || 0,
        task4_mechanics_done: session.task4_mechanics_done || 0,
        task17_mechanics_done: session.task17_mechanics_done || 0,
        avatar: session.avatar || null,
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения данных пользователя' });
  }
});

/* ----------------------
   TASK4 MECHANICS ONBOARDING
   POST /api/auth/onboarding/task-mechanics/done
----------------------- */
auth.post('/onboarding/task-mechanics/done', (req, res) => {
  try {
    const sessionId = req.cookies.session_id;
    if (!sessionId) return res.status(401).json({ error: 'Не авторизован' });

    const session = db.prepare(`
      SELECT u.id, u.role FROM users u
      JOIN user_sessions s ON s.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);
    if (!session) return res.status(401).json({ error: 'Сессия истекла' });

    db.prepare(`
      INSERT INTO student_onboarding (user_id, task4_mechanics_done, completed_at)
      VALUES (?, 1, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        task4_mechanics_done = 1,
        completed_at = datetime('now')
    `).run(session.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка онбординга task4 механик:', error);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

/* ----------------------
   TASK17 MECHANICS ONBOARDING
   POST /api/auth/onboarding/task17-mechanics/done
----------------------- */
auth.post('/onboarding/task17-mechanics/done', (req, res) => {
  try {
    const sessionId = req.cookies.session_id;
    if (!sessionId) return res.status(401).json({ error: 'Не авторизован' });

    const session = db.prepare(`
      SELECT u.id
      FROM users u
      JOIN user_sessions s ON s.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);
    if (!session) return res.status(401).json({ error: 'Сессия истекла' });

    db.prepare(`
      INSERT INTO student_onboarding (user_id, task17_mechanics_done, completed_at)
      VALUES (?, 1, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        task17_mechanics_done = 1,
        completed_at = datetime('now')
    `).run(session.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка онбординга task17 механик:', error);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

/* ----------------------
   UPDATE AVATAR
   POST /api/auth/avatar
----------------------- */
auth.post('/avatar', (req, res) => {
  try {
    const sessionId = req.cookies.session_id;
    if (!sessionId) return res.status(401).json({ error: 'Не авторизован' });

    const session = db.prepare(`
      SELECT u.id
      FROM users u
      JOIN user_sessions s ON s.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);
    if (!session) return res.status(401).json({ error: 'Сессия истекла' });

    const rawAvatar = req.body?.avatar;
    const avatar = typeof rawAvatar === 'string' ? rawAvatar.trim() : '';

    if (!avatar) {
      db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(session.id);
      return res.json({ success: true, avatar: null });
    }

    const isDataImage = avatar.startsWith('data:image/');
    const isEmoji = avatar.startsWith('emoji:') && avatar.length <= 24;
    const isStatic = avatar.startsWith('/images/');
    if (!isDataImage && !isEmoji && !isStatic) {
      return res.status(400).json({ error: 'Неверный формат аватара' });
    }
    if (avatar.length > 1_200_000) {
      return res.status(400).json({ error: 'Файл аватара слишком большой' });
    }

    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, session.id);
    res.json({ success: true, avatar });
  } catch (error) {
    console.error('Ошибка сохранения аватара:', error);
    res.status(500).json({ error: 'Ошибка сохранения аватара' });
  }
});

export default auth;
