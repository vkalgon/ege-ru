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
        last_name: user.last_name
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
        is_admin: user.is_admin
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
    const { login, password, first_name, last_name } = req.body;
    
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
    
    // Создаем нового пользователя
    const hashedPassword = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (login, password, first_name, last_name, last_login)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(login, hashedPassword, first_name || null, last_name || null);
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    
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
        is_admin: user.is_admin
      }
    });
    
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
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
      SELECT u.* FROM users u
      JOIN user_sessions s ON s.user_id = u.id
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
        last_name: session.last_name
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения данных пользователя' });
  }
});

export default auth;
