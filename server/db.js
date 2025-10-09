import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'data', 'app.sqlite'));

// Создаем таблицы по новой схеме
db.exec(`
  -- Типы заданий (1, 2, 9, 11 и т.п.)
  CREATE TABLE IF NOT EXISTS task_types (
    id        INTEGER PRIMARY KEY,   -- сам номер типа, удобно хранить как id
    title     TEXT NOT NULL,         -- например: "Личные местоимения"
    description TEXT,                -- описание типа задания
    form_config TEXT                 -- JSON конфигурация формы для этого типа
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
  
  -- Темы (подтемы) по типу
  CREATE TABLE IF NOT EXISTS subtopics (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    type_id INTEGER NOT NULL REFERENCES task_types(id),
    title   TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  
  -- Задания внутри тем
  CREATE TABLE IF NOT EXISTS assignments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    subtopic_id INTEGER NOT NULL REFERENCES subtopics(id),
    fipi_number TEXT,                -- номер задания из банка ФИПИ
    source      TEXT NOT NULL,       -- источник (ФИПИ или другой)
    prompt      TEXT NOT NULL,
    context     TEXT,
    answer      TEXT NOT NULL,
    explanation TEXT,
    rule_ref    TEXT,
    alt_answers TEXT,
    extra_data  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  
  -- Лог ответов пользователей
  CREATE TABLE IF NOT EXISTS answers_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    user_id TEXT,
    user_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Вставляем все 27 типов заданий ЕГЭ
db.exec(`
  INSERT OR IGNORE INTO task_types (id, title, description, form_config) VALUES 
  (1, 'Информационная обработка письменных текстов', 'Задания на понимание содержания текста', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (2, 'Средства связи предложений в тексте', 'Задания на определение средств связи', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (3, 'Лексическое значение слова', 'Задания на определение значения слова', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (4, 'Орфоэпические нормы', 'Задания на постановку ударения', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (5, 'Лексические нормы', 'Задания на употребление паронимов', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (6, 'Морфологические нормы', 'Задания на образование форм слов', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (7, 'Синтаксические нормы', 'Задания на согласование и управление', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (8, 'Правописание корней', 'Задания на правописание корней', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (9, 'Правописание приставок', 'Задания на правописание приставок', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (10, 'Правописание суффиксов', 'Задания на правописание суффиксов', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (11, 'Правописание личных окончаний', 'Задания на правописание личных окончаний', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (12, 'Правописание НЕ и НИ', 'Задания на правописание НЕ и НИ', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (13, 'Слитное, дефисное, раздельное написание', 'Задания на слитное и раздельное написание', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (14, 'Пунктуация в простом предложении', 'Задания на пунктуацию в простом предложении', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (15, 'Знаки препинания в предложениях с однородными членами', 'Задания на пунктуацию с однородными членами', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (16, 'Знаки препинания в предложениях с обособленными членами', 'Задания на пунктуацию с обособленными членами', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (17, 'Знаки препинания в предложениях со словами и конструкциями', 'Задания на пунктуацию со словами и конструкциями', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (18, 'Знаки препинания в сложносочинённом предложении', 'Задания на пунктуацию в сложносочинённом предложении', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (19, 'Знаки препинания в сложноподчинённом предложении', 'Задания на пунктуацию в сложноподчинённом предложении', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (20, 'Знаки препинания в сложном предложении с разными видами связи', 'Задания на пунктуацию в сложном предложении', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (21, 'Знаки препинания в предложениях с прямой речью', 'Задания на пунктуацию с прямой речью', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (22, 'Знаки препинания в предложениях с цитатами', 'Задания на пунктуацию с цитатами', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (23, 'Синтаксический анализ предложения', 'Задания на синтаксический анализ', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (24, 'Синтаксический анализ словосочетания', 'Задания на анализ словосочетания', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (25, 'Синтаксический анализ текста', 'Задания на анализ текста', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (26, 'Лексический анализ слова', 'Задания на лексический анализ', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers"]}'),
  (27, 'Сочинение', 'Задания на написание сочинения', '{"fields": ["prompt", "context", "answer", "explanation", "rule_ref", "alt_answers", "criteria"]}');
`);

export default db;