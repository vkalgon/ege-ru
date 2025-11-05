import db from '../db.js';

// Middleware для проверки авторизации
export function requireAuth(req, res, next) {
  const sessionId = req.cookies.session_id;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Требуется авторизация' });
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
  
  // Добавляем пользователя в запрос
  req.user = session;
  next();
}

// Middleware для опциональной авторизации
export function optionalAuth(req, res, next) {
  const sessionId = req.cookies.session_id;
  
  if (sessionId) {
    const session = db.prepare(`
      SELECT u.* FROM users u
      JOIN user_sessions s ON s.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);
    
    if (session) {
      req.user = session;
    }
  }
  
  next();
}

