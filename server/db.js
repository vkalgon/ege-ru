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
  
  -- Задание №17: Пунктуация
  CREATE TABLE IF NOT EXISTS task17 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text    TEXT NOT NULL,   -- с (1)(2)(3)…
    base_text      TEXT NOT NULL,   -- без цифр, с пунктуацией
    commaless_text TEXT NOT NULL,   -- без цифр и без запятых
    answer_text    TEXT,            -- краткий ответ (человеческий)
    explanation_md TEXT,            -- подробное объяснение (Markdown)
    source         TEXT,            -- источник (ФИПИ, Другой источник и т.д.)
    reveal_policy  TEXT DEFAULT 'after_correct', -- 'never'|'after_check'|'after_correct'|'always'
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Таблица источников для заданий
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Вставляем стандартные источники
  INSERT OR IGNORE INTO sources (name) VALUES ('ФИПИ'), ('Другой источник');
  
  -- Эталонные ответы для задания №17
  CREATE TABLE IF NOT EXISTS task17_answer (
    task_id INTEGER PRIMARY KEY REFERENCES task17(id) ON DELETE CASCADE,
    digits_json           TEXT NOT NULL, -- JSON: numbers[] для режима "Цифры"
    comma_positions_json  TEXT NOT NULL, -- JSON: numbers[] для commaless_text (межсимвольные индексы)
    spans_json            TEXT NOT NULL  -- JSON: [{type:'participle'|'gerund',startOffset,endOffset}]
  );
  
  -- Задание №9: Правописание гласных в корне
  CREATE TABLE IF NOT EXISTS task9_words (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    word_display  TEXT NOT NULL,
    correct_vowel TEXT NOT NULL,
    vowel_pair         TEXT NOT NULL,
    category           TEXT NOT NULL CHECK (category IN ('alternating','verifiable','unverifiable')),
    verification_word  TEXT,
    alternation_rule   TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task9_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task9_rows (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES task9_tasks(id) ON DELETE CASCADE,
    row_index  INTEGER NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS task9_cells (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    row_id     INTEGER NOT NULL REFERENCES task9_rows(id) ON DELETE CASCADE,
    cell_index INTEGER NOT NULL,
    word_id    INTEGER NOT NULL REFERENCES task9_words(id)
  );

  -- Задание №10: Правописание приставок

  CREATE TABLE IF NOT EXISTS task10_words (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    before_prefix  TEXT NOT NULL DEFAULT '',
    prefix_display TEXT NOT NULL,
    after_prefix   TEXT NOT NULL DEFAULT '',
    correct_letter TEXT NOT NULL,
    rule           TEXT NOT NULL,
    created_at     TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task10_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task10_rows (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES task10_tasks(id) ON DELETE CASCADE,
    row_index  INTEGER NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS task10_cells (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    row_id     INTEGER NOT NULL REFERENCES task10_rows(id) ON DELETE CASCADE,
    cell_index INTEGER NOT NULL,
    word_id    INTEGER NOT NULL REFERENCES task10_words(id)
  );

  -- Задание №11: Правописание суффиксов
  CREATE TABLE IF NOT EXISTS task11_words (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    before_suffix   TEXT NOT NULL DEFAULT '',
    suffix_display  TEXT NOT NULL,
    after_suffix    TEXT NOT NULL DEFAULT '',
    correct_vowel   TEXT NOT NULL,
    vowel_pair      TEXT NOT NULL,
    suffix          TEXT NOT NULL,
    part_of_speech  TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('variable','fixed')),
    created_at      TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task11_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task11_rows (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES task11_tasks(id) ON DELETE CASCADE,
    row_index  INTEGER NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS task11_cells (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    row_id     INTEGER NOT NULL REFERENCES task11_rows(id) ON DELETE CASCADE,
    cell_index INTEGER NOT NULL,
    word_id    INTEGER NOT NULL REFERENCES task11_words(id)
  );

  -- Задание №12: Правописание личных окончаний и суффиксов
  CREATE TABLE IF NOT EXISTS task12_words (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    before_morpheme   TEXT NOT NULL DEFAULT '',
    morpheme_display  TEXT NOT NULL,
    after_morpheme    TEXT NOT NULL DEFAULT '',
    correct_vowel     TEXT NOT NULL,
    vowel_pair        TEXT NOT NULL,
    morpheme_type     TEXT NOT NULL,
    created_at        TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task12_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task12_rows (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES task12_tasks(id) ON DELETE CASCADE,
    row_index  INTEGER NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS task12_cells (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    row_id     INTEGER NOT NULL REFERENCES task12_rows(id) ON DELETE CASCADE,
    cell_index INTEGER NOT NULL,
    word_id    INTEGER NOT NULL REFERENCES task12_words(id)
  );

  -- Задание №4: Орфоэпические нормы (ударения)
  CREATE TABLE IF NOT EXISTS task4_words (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    word                 TEXT NOT NULL,
    correct_stress_index INTEGER NOT NULL,
    wrong_stress_index   INTEGER NOT NULL,
    hint                 TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task4_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task4_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES task4_tasks(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    word_id    INTEGER NOT NULL REFERENCES task4_words(id),
    is_correct INTEGER NOT NULL DEFAULT 1
  );

  -- Логи попыток для задания №17
  CREATE TABLE IF NOT EXISTS task17_attempt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES task17(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('digits','commas')),
    user_digits_json TEXT,
    user_comma_positions_json TEXT,
    user_spans_json TEXT,
    is_correct_digits INTEGER,
    is_correct_commas INTEGER,
    spans_report_json TEXT,
    explanation_shown INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Тексты для заданий 1–3 (общий пассаж) ──────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS text_passages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    context     TEXT NOT NULL,       -- сам текст (Editor.js JSON или plain)
    source      TEXT NOT NULL,       -- ФИПИ / Другой источник
    fipi_number TEXT,                -- номер из банка ФИПИ (необязательно)
    notes       TEXT,                -- внутренние заметки
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// Добавляем passage_id в assignments (безопасно при повторном запуске)
try { db.exec('ALTER TABLE assignments ADD COLUMN passage_id INTEGER REFERENCES text_passages(id) ON DELETE SET NULL'); } catch {}

// Миграции: добавляем колонки, которых могло не быть при старом CREATE TABLE
try { db.exec('ALTER TABLE task9_words  ADD COLUMN word_group_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE task10_words ADD COLUMN word_group_id INTEGER'); } catch {}

// Миграции task16_sentences: переход на маркерный формат
// Добавляем новые колонки если их нет
try { db.exec("ALTER TABLE task16_sentences ADD COLUMN source_text          TEXT"); } catch {}
try { db.exec("ALTER TABLE task16_sentences ADD COLUMN base_text            TEXT"); } catch {}
try { db.exec("ALTER TABLE task16_sentences ADD COLUMN comma_positions_json TEXT"); } catch {}
// Убираем старые колонки, которые больше не нужны (только если данных нет)
{
  const hasData = db.prepare('SELECT COUNT(*) AS c FROM task16_sentences').get().c > 0;
  if (!hasData) {
    const cols = db.prepare("PRAGMA table_info(task16_sentences)").all().map(c => c.name);
    if (cols.includes('text'))        try { db.exec('ALTER TABLE task16_sentences DROP COLUMN text'); }        catch {}
    if (cols.includes('needs_comma')) try { db.exec('ALTER TABLE task16_sentences DROP COLUMN needs_comma'); } catch {}
    if (cols.includes('comma_count')) try { db.exec('ALTER TABLE task16_sentences DROP COLUMN comma_count'); } catch {}
  }
}

// Роли пользователей: 'student' | 'teacher'
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'"); } catch {}

// Связь учитель — ученик
db.exec(`
  CREATE TABLE IF NOT EXISTS teacher_students (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(teacher_id, student_id)
  );
`);

// Прогресс ученика по словам
db.exec(`
  CREATE TABLE IF NOT EXISTS student_word_progress (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_table     TEXT NOT NULL,    -- 'task9_words', 'task10_words', etc.
    word_id        INTEGER NOT NULL,
    correct_streak INTEGER DEFAULT 0, -- серия правильных ответов подряд
    total_attempts INTEGER DEFAULT 0,
    total_correct  INTEGER DEFAULT 0,
    is_mastered    INTEGER DEFAULT 0, -- 1 если correct_streak >= 5
    last_attempted TEXT,
    UNIQUE(user_id, word_table, word_id)
  );
`);
// Миграции task12_words: приводим к нужной схеме
try { db.exec("ALTER TABLE task12_words ADD COLUMN word_display  TEXT NOT NULL DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE task12_words ADD COLUMN conjugation   TEXT NOT NULL DEFAULT '1'"); } catch {}
try { db.exec("ALTER TABLE task12_words ADD COLUMN form_type     TEXT NOT NULL DEFAULT 'verb'"); } catch {}
try { db.exec("ALTER TABLE task12_words ADD COLUMN base_verb     TEXT"); } catch {}
try { db.exec("ALTER TABLE task12_words ADD COLUMN rule          TEXT"); } catch {}
try { db.exec("ALTER TABLE task12_words ADD COLUMN word_group_id INTEGER"); } catch {}

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

// Задание №5: Паронимы
db.exec(`
  CREATE TABLE IF NOT EXISTS task5_groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task5_sentences (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id         INTEGER NOT NULL REFERENCES task5_groups(id) ON DELETE CASCADE,
    sentence         TEXT NOT NULL,
    highlighted_word TEXT NOT NULL,
    correct_word     TEXT NOT NULL,
    is_error         INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task5_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task5_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES task5_tasks(id) ON DELETE CASCADE,
    item_index  INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL REFERENCES task5_sentences(id)
  );
`);

// Миграции task4_words: категория и флаг исключения
try { db.exec("ALTER TABLE task4_words ADD COLUMN category TEXT DEFAULT 'other'"); } catch {}
try { db.exec("ALTER TABLE task4_words ADD COLUMN is_exception INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE task4_words ADD COLUMN part_of_speech TEXT DEFAULT 'other'"); } catch {}

// Миграции: добавляем колонки если их нет (безопасно при повторном запуске)
const task9Cols = db.prepare("PRAGMA table_info(task9_words)").all().map(c => c.name);
if (!task9Cols.includes('verification_word'))
  db.exec("ALTER TABLE task9_words ADD COLUMN verification_word TEXT");
if (!task9Cols.includes('alternation_rule'))
  db.exec("ALTER TABLE task9_words ADD COLUMN alternation_rule TEXT");

// Email пользователя (опциональный)
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
// Флаг завершения онбординга
try { db.exec("ALTER TABLE users ADD COLUMN onboarding_done INTEGER DEFAULT 0"); } catch {}
// Аватар пользователя: data URL, emoji:* или /images/*
try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT"); } catch {}

// Онбординг-опросник ученика
db.exec(`
  CREATE TABLE IF NOT EXISTS student_onboarding (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level        TEXT,           -- 'beginner'|'intermediate'|'advanced'
    target_score INTEGER,        -- целевой балл 50-100
    weak_tasks   TEXT,           -- JSON-массив номеров заданий ['9','10']
    completed_at TEXT DEFAULT (datetime('now'))
  );
`);

// Миграции onboarding: флаг завершения механик task4
try {
  db.exec('ALTER TABLE student_onboarding ADD COLUMN task4_mechanics_done INTEGER DEFAULT 0');
} catch (_) { /* колонка уже есть */ }
try {
  db.exec('ALTER TABLE student_onboarding ADD COLUMN task17_mechanics_done INTEGER DEFAULT 0');
} catch (_) { /* колонка уже есть */ }

// Коды приглашения учителя
db.exec(`
  CREATE TABLE IF NOT EXISTS teacher_invites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code       TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    used_count INTEGER DEFAULT 0
  );
`);

// Запросы на подключение (учитель → ученик по email или ученик → учитель)
db.exec(`
  CREATE TABLE IF NOT EXISTS connection_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT DEFAULT 'pending',  -- 'pending'|'accepted'|'declined'
    created_at   TEXT DEFAULT (datetime('now')),
    UNIQUE(from_user_id, to_user_id)
  );
`);

// Домашние задания
db.exec(`
  CREATE TABLE IF NOT EXISTS homework (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    task_type   TEXT NOT NULL,   -- 'task9'|'task10'|'task11'|'task12'|'task4'|'task17'
    task_ids    TEXT NOT NULL,   -- JSON-массив ID сгенерированных заданий
    due_date    TEXT,            -- срок сдачи (ISO datetime)
    assigned_at TEXT DEFAULT (datetime('now')),
    status      TEXT DEFAULT 'pending'  -- 'pending'|'submitted'|'reviewed'
  );
`);

// Задание №7: Морфологические нормы (образование форм слова)
try { db.exec('ALTER TABLE task7_words ADD COLUMN category TEXT'); } catch {}
db.exec(`
  CREATE TABLE IF NOT EXISTS task7_words (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    correct_form TEXT NOT NULL,
    error_form   TEXT NOT NULL,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task7_contexts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id     INTEGER NOT NULL REFERENCES task7_words(id) ON DELETE CASCADE,
    before_text TEXT NOT NULL DEFAULT '',
    after_text  TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS task7_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task7_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id        INTEGER NOT NULL REFERENCES task7_tasks(id) ON DELETE CASCADE,
    item_index     INTEGER NOT NULL,
    word_id        INTEGER NOT NULL REFERENCES task7_words(id),
    is_error       INTEGER NOT NULL DEFAULT 0,
    display_phrase TEXT NOT NULL,
    correct_form   TEXT NOT NULL
  );
`);

// Результаты домашних заданий
db.exec(`
  CREATE TABLE IF NOT EXISTS homework_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    homework_id INTEGER NOT NULL UNIQUE REFERENCES homework(id) ON DELETE CASCADE,
    student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scores_json TEXT,            -- JSON {taskId: score, ...}
    total_score INTEGER,
    max_score   INTEGER,
    teacher_comment TEXT,
    submitted_at TEXT DEFAULT (datetime('now'))
  );
`);

// Задание №18: Вводные слова и обращения
db.exec(`
  -- Банк вводных слов (и слов, не являющихся вводными)
  CREATE TABLE IF NOT EXISTS task18_words (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    phrase         TEXT NOT NULL UNIQUE,
    intro_type     TEXT NOT NULL DEFAULT 'always'
                   CHECK (intro_type IN ('always', 'never', 'context')),
    category       TEXT,     -- 'certainty'|'uncertainty'|'feeling'|'source'|'sequence'|'style'|'attention'|'usual'|'measure'|'expressive'|NULL
    rule_intro     TEXT,     -- объяснение: почему является вводным (для always/context)
    rule_not_intro TEXT,     -- объяснение: почему НЕ является вводным (для never/context)
    created_at     TEXT DEFAULT (datetime('now'))
  );

  -- Задания (предложения с (1)(2)… маркерами)
  CREATE TABLE IF NOT EXISTS task18_tasks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text    TEXT NOT NULL,   -- с (1)(2)… маркерами
    base_text      TEXT NOT NULL,   -- без маркеров, с правильными запятыми
    source         TEXT,
    explanation_md TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  -- Эталонные ответы (номера позиций, где должны стоять запятые)
  CREATE TABLE IF NOT EXISTS task18_answer (
    task_id              INTEGER PRIMARY KEY REFERENCES task18_tasks(id) ON DELETE CASCADE,
    comma_positions_json TEXT NOT NULL  -- JSON: [2, 4]
  );

  -- Связь задания со словами банка (для трекинга прогресса по словам)
  CREATE TABLE IF NOT EXISTS task18_task_words (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id               INTEGER NOT NULL REFERENCES task18_tasks(id) ON DELETE CASCADE,
    word_id               INTEGER NOT NULL REFERENCES task18_words(id),
    is_intro_in_task      INTEGER NOT NULL,   -- 1=вводное, 0=не вводное в этом предложении
    position_indices_json TEXT NOT NULL        -- JSON: [1,2] — маркеры вокруг слова
  );
`);

// Наполнение банка вводных слов (первичная загрузка)
const task18WordCount = db.prepare('SELECT COUNT(*) AS c FROM task18_words').get().c;
if (task18WordCount === 0) {
  const insertWord = db.prepare(
    'INSERT OR IGNORE INTO task18_words (phrase, intro_type, category, rule_intro, rule_not_intro) VALUES (?, ?, ?, ?, ?)'
  );
  const seedWords = db.transaction(() => {
    // Уверенность
    for (const p of ['без сомнения','безусловно','бесспорно','в сущности','действительно','естественно','как правило','конечно','несомненно','разумеется'])
      insertWord.run(p, 'always', 'certainty', 'Выражает уверенность говорящего. Обособляется запятыми.', null);
    // Неуверенность
    for (const p of ['вероятно','видимо','возможно','должно быть','думаю','знать','кажется','казалось','казалось бы','как видно','наверное','очевидно','может быть','быть может','может','надеюсь','надо думать','надо полагать','по всей вероятности','по всей видимости','пожалуй','по-видимому'])
      insertWord.run(p, 'context', 'uncertainty', 'Выражает неуверенность. Если является вводным — обособляется.', 'Если можно задать вопрос или является сказуемым/дополнением — не вводное.');
    // Чувства
    for (const p of ['к сожалению','к счастью','на счастью','по счастью','к несчастью','на несчастье','к прискорбию','к изумлению','к огорчению','к досаде','к стыду','к ужасу','на беду','не ровен час','нечего греха таить','странное дело','чего доброго'])
      insertWord.run(p, 'always', 'feeling', 'Выражает чувства говорящего. Обособляется запятыми.', null);
    // Источник сообщения
    for (const p of ['говорят','как известно','по-моему','по-твоему','помнится','по моему мнению','по слухам','по словам','по сообщению','по собственному признанию','по сообщениям СМИ','дескать','мол'])
      insertWord.run(p, 'always', 'source', 'Указывает на источник информации. Обособляется запятыми.', null);
    // Последовательность / связь мыслей
    for (const p of ['в общем','в частности','во-первых','во-вторых','в-третьих','впрочем','главное','далее','значит','итак','к примеру','к слову сказать','кроме того','кстати','кстати сказать','между прочим','наконец','наоборот','например','напротив','однако','повторяю','подчёркиваю','правда','прежде всего','с одной стороны','с другой стороны','сверх того','скажем','следовательно','стало быть','таким образом'])
      insertWord.run(p, 'context', 'sequence', 'Выражает связь/последовательность мыслей. Обособляется при вводном употреблении.', 'Если является союзом или членом предложения — не вводное.');
    // Способ оформления мыслей
    for (const p of ['другими словами','в самом деле','иначе говоря','иными словами','как говорится','как говорят','коротко говоря','короче говоря','лучше сказать','мягко выражаясь','одним словом','словом','так сказать','что называется','по совести говоря','попросту говоря','с позволения сказать'])
      insertWord.run(p, 'always', 'style', 'Указывает на способ оформления мысли. Обособляется запятыми.', null);
    // Привлечение внимания
    for (const p of ['вообразите','веришь ли','видишь ли','видите ли','знаешь ли','знаете ли','поверьте','помилуйте','представьте','представьте себе','согласитесь','пожалуйста'])
      insertWord.run(p, 'always', 'attention', 'Призывает к вниманию собеседника. Обособляется запятыми.', null);
    // Степень обычности
    for (const p of ['бывало','как всегда','по обыкновению','по обычаю','случается','случалось'])
      insertWord.run(p, 'context', 'usual', 'Выражает степень обычности. Обособляется при вводном употреблении.', 'Если является сказуемым — не вводное.');
    // Экспрессивность
    for (const p of ['кроме шуток','между нами','между нами говоря','по правде','по совести','по справедливости','право','признаться','сказать по правде','по правде говоря','говоря по чести'])
      insertWord.run(p, 'always', 'expressive', 'Выражает экспрессивную оценку. Обособляется запятыми.', null);

    // НИКОГДА не вводные (сложные)
    for (const p of ['в конечном счёте','в первую очередь','в целом','вроде бы','всё-таки','исключительно','как будто','как бы','между тем','решительно','словно','тем не менее','тем самым','фактически','якобы'])
      insertWord.run(p, 'never', null, null, 'Никогда не является вводным словом. Запятыми не выделяется.');
    // НИКОГДА не вводные (простые)
    for (const p of ['авось','буквально','будто','в основном','вдобавок','вдруг','ведь','вряд ли','всё равно','всё же','даже','едва ли','именно','к тому же','как раз','лишь','непременно','отчасти','приблизительно','притом','причём'])
      insertWord.run(p, 'never', null, null, 'Никогда не является вводным словом. Запятыми не выделяется.');
  });
  seedWords();
}

// Задание №16: Знаки препинания при однородных членах и в ССП
db.exec(`
  -- Банк предложений
  CREATE TABLE IF NOT EXISTS task16_sentences (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text          TEXT NOT NULL DEFAULT '',   -- с (1)(2)... маркерами в местах потенциальных запятых
    base_text            TEXT NOT NULL DEFAULT '',   -- без маркеров, с правильными запятыми
    comma_positions_json TEXT NOT NULL DEFAULT '[]', -- JSON: [1, 3] — номера маркеров, где нужны запятые
    rule_types_json      TEXT,   -- JSON: ['homogeneous','ssp','double_union','repeated_union','none']
    explanation_md       TEXT,
    source               TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  -- Задания (набор из 5 предложений)
  CREATE TABLE IF NOT EXISTS task16_tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source     TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Связь задания с предложениями (позиции 1–5)
  CREATE TABLE IF NOT EXISTS task16_task_sentences (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES task16_tasks(id) ON DELETE CASCADE,
    sentence_id INTEGER NOT NULL REFERENCES task16_sentences(id),
    position    INTEGER NOT NULL,  -- 1..5
    UNIQUE(task_id, position)
  );

  -- Эталонный ответ: номера позиций с одной запятой
  CREATE TABLE IF NOT EXISTS task16_answer (
    task_id     INTEGER PRIMARY KEY REFERENCES task16_tasks(id) ON DELETE CASCADE,
    answer_json TEXT NOT NULL   -- JSON: [2, 3] — позиции, требующие ровно одной запятой
  );
`);

// Задание №19: Знаки в сложноподчинённом предложении (СПП)
db.exec(`
  -- Задания (предложения с (1)(2)… маркерами)
  CREATE TABLE IF NOT EXISTS task19_tasks (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text      TEXT NOT NULL,   -- с (1)(2)… маркерами
    source           TEXT,
    rule_types_json  TEXT,            -- JSON: ['kotory','double_conj']
    explanation_md   TEXT,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  -- Эталонные ответы
  CREATE TABLE IF NOT EXISTS task19_answer (
    task_id              INTEGER PRIMARY KEY REFERENCES task19_tasks(id) ON DELETE CASCADE,
    comma_positions_json TEXT NOT NULL  -- JSON: [1, 3]
  );
`);

// Миграция: если таблица создана со старым столбцом rule_type — добавляем новый
try {
  db.exec(`ALTER TABLE task19_tasks ADD COLUMN rule_types_json TEXT`);
} catch (_) { /* столбец уже есть */ }

// Избранные паронимы (слабые места по теории задания 5)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_paronym_favorites (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paronym_id TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, paronym_id)
  );
`);

// Лог завершённых заданий (одна запись = одно пройденное задание целиком)
db.exec(`
  CREATE TABLE IF NOT EXISTS task_completions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_table   TEXT    NOT NULL,
    completed_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_task_completions_user ON task_completions(user_id, word_table);

  CREATE TABLE IF NOT EXISTS variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tasks_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;