-- Типы заданий (1, 2, 9, 11 и т.п.)
CREATE TABLE IF NOT EXISTS task_types (
  id        INTEGER PRIMARY KEY,   -- сам номер типа, удобно хранить как id
  title     TEXT NOT NULL          -- например: "Личные местоимения"
);

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE,      -- ID пользователя в Telegram (если есть)
  username    TEXT,                -- имя пользователя из Telegram
  first_name  TEXT,                -- имя из Telegram
  last_name   TEXT,                -- фамилия из Telegram
  login       TEXT UNIQUE,         -- логин для входа (если есть)
  password    TEXT,                -- хеш пароля (если есть)
  is_admin    INTEGER DEFAULT 0,   -- флаг администратора
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);

-- Сессии пользователей
CREATE TABLE IF NOT EXISTS user_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Конкретные задания внутри типа (объединенная таблица с ответами)
CREATE TABLE IF NOT EXISTS assignments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  subtopic_id INTEGER NOT NULL,     -- ссылка на subtopics.id
  sub_number  INTEGER,               -- номер задания ВНУТРИ темы (1,2,3..)
  prompt      TEXT NOT NULL,        -- краткое условие
  context     TEXT,                  -- текст/абзац (может быть NULL)
  -- Поля для ответов (основной ответ)
  answer      TEXT NOT NULL,        -- основной правильный ответ
  explanation TEXT,                  -- объяснение правила
  rule_ref    TEXT,                 -- ссылка на правило
  -- Дополнительные ответы (через JSON)
  alt_answers TEXT,                  -- JSON массив альтернативных ответов
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subtopic_id) REFERENCES subtopics(id)
);
