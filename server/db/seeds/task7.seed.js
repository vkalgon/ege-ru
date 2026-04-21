// Заполнение банка слов для задания №7 (Морфологические нормы)
// Запуск:          npm run seed:task7
// Перезапись:      npm run seed:task7 -- --force

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const db = new Database(path.join(__dirname, '..', '..', '..', 'data', 'app.sqlite'));

const FORCE = process.argv.includes('--force');

// ── Категории ────────────────────────────────────────────────────────────────
const CAT = {
  IM_MN:   'Им.п. мн.ч. существительных',
  ROD_MN:  'Р.п. мн.ч. существительных',
  STEP:    'Степени сравнения прилагательных',
  CHISL:   'Падежные формы числительных',
  POVEL:   'Повелительное наклонение',
  GLAGOL:  'Личные формы глаголов',
};

// ── Данные ───────────────────────────────────────────────────────────────────
const words = [

  // ── Именительный падеж мн.ч. — нормативно -Ы/-И (ошибочно -А) ──────────
  { category: CAT.IM_MN, correct_form: 'ДОГОВОРЫ',    error_form: 'ДОГОВОРА',    before_text: 'заключить',     after_text: '' },
  { category: CAT.IM_MN, correct_form: 'ИНЖЕНЕРЫ',    error_form: 'ИНЖЕНЕРА',    before_text: 'опытные',       after_text: '' },
  { category: CAT.IM_MN, correct_form: 'ТРЕНЕРЫ',     error_form: 'ТРЕНЕРА',     before_text: 'наши',          after_text: '' },
  { category: CAT.IM_MN, correct_form: 'ШОФЁРЫ',      error_form: 'ШОФЕРА',      before_text: 'опытные',       after_text: '' },
  { category: CAT.IM_MN, correct_form: 'КОНСТРУКТОРЫ',error_form: 'КОНСТРУКТОРА',before_text: 'опытные',       after_text: '' },
  { category: CAT.IM_MN, correct_form: 'РЕДАКТОРЫ',   error_form: 'РЕДАКТОРА',   before_text: 'главные',       after_text: '' },
  { category: CAT.IM_MN, correct_form: 'КОМПЬЮТЕРЫ',  error_form: 'КОМПЬЮТЕРА',  before_text: 'мощные',        after_text: '' },
  { category: CAT.IM_MN, correct_form: 'БУХГАЛТЕРЫ',  error_form: 'БУХГАЛТЕРА',  before_text: 'наши',          after_text: '' },

  // ── Именительный падеж мн.ч. — нормативно -А/-Я (ошибочно -Ы) ──────────
  { category: CAT.IM_MN, correct_form: 'ДИРЕКТОРА',   error_form: 'ДИРЕКТОРЫ',   before_text: 'новые',         after_text: '' },
  { category: CAT.IM_MN, correct_form: 'ПРОФЕССОРА',  error_form: 'ПРОФЕССОРЫ',  before_text: 'известные',     after_text: '' },
  { category: CAT.IM_MN, correct_form: 'ДОКТОРА',     error_form: 'ДОКТОРЫ',     before_text: 'вызвали',       after_text: '' },
  { category: CAT.IM_MN, correct_form: 'ПОВАРА',      error_form: 'ПОВАРЫ',      before_text: 'опытные',       after_text: '' },

  // ── Р.п. мн.ч. — нулевое окончание (ошибочно -ОВ/-ЕЙ) ─────────────────
  { category: CAT.ROD_MN, correct_form: 'МАНЖЕТ',     error_form: 'МАНЖЕТОВ',   before_text: 'нет пяти',      after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'КОЧЕРЁГ',    error_form: 'КОЧЕРЁГОВ',  before_text: 'нет',           after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'ТУФЕЛЬ',     error_form: 'ТУФЛЕЙ',     before_text: 'пара',          after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'ЧУЛОК',      error_form: 'ЧУЛКОВ',     before_text: 'пара',          after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'САПОГ',      error_form: 'САПОГОВ',    before_text: 'пара',          after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'СЕРЁГ',      error_form: 'СЕРЁГОВ',    before_text: 'нет',           after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'ЯБЛОК',      error_form: 'ЯБЛОКОВ',    before_text: 'нет',           after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'СОЛДАТ',     error_form: 'СОЛДАТОВ',   before_text: 'отряд',         after_text: '' },

  // ── Р.п. мн.ч. — с -ОВ/-ЕВ (ошибочно нулевое) ──────────────────────────
  { category: CAT.ROD_MN, correct_form: 'НОСКОВ',     error_form: 'НОСОК',      before_text: 'пара',          after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'ДЖИНСОВ',    error_form: 'ДЖИНС',      before_text: 'нет новых',     after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'ПОМИДОРОВ',  error_form: 'ПОМИДОР',    before_text: 'нет спелых',    after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'АПЕЛЬСИНОВ', error_form: 'АПЕЛЬСИН',   before_text: 'нет',           after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'МАНДАРИНОВ', error_form: 'МАНДАРИН',   before_text: 'нет',           after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'ТОМАТОВ',    error_form: 'ТОМАТ',      before_text: 'нет',           after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'ГРАММОВ',    error_form: 'ГРАММ',      before_text: 'сто',           after_text: '' },
  { category: CAT.ROD_MN, correct_form: 'КИЛОГРАММОВ',error_form: 'КИЛОГРАММ',  before_text: 'пять',          after_text: '' },

  // ── Степени сравнения прилагательных ─────────────────────────────────────
  { category: CAT.STEP, correct_form: 'КРАСИВЕЕ',     error_form: 'БОЛЕЕ КРАСИВЕЕ',    before_text: 'нарисовать',  after_text: '' },
  { category: CAT.STEP, correct_form: 'НАИВЫСШЕЕ',    error_form: 'НАИВЫСОЧАЙШЕЕ',     before_text: '',            after_text: 'достижение' },
  { category: CAT.STEP, correct_form: 'ВЫСОЧАЙШЕЕ',   error_form: 'САМОЕ ВЫСОЧАЙШЕЕ',  before_text: 'это',         after_text: 'здание' },
  { category: CAT.STEP, correct_form: 'ДЛИННЕЕ',      error_form: 'БОЛЕЕ ДЛИННЕЕ',     before_text: 'этот путь',   after_text: '' },
  { category: CAT.STEP, correct_form: 'УМНЕЕ',        error_form: 'БОЛЕЕ УМНЕЕ',       before_text: 'она',         after_text: 'чем он' },
  { category: CAT.STEP, correct_form: 'КРАТЧАЙШИЙ',   error_form: 'САМЫЙ КРАТЧАЙШИЙ',  before_text: '',            after_text: 'путь' },

  // ── Падежные формы числительных ─────────────────────────────────────────
  { category: CAT.CHISL, correct_form: 'ПОЛУТОРА',            error_form: 'ПОЛТОРА',             before_text: 'в течение',  after_text: 'часа' },
  { category: CAT.CHISL, correct_form: 'ПОЛУТОРАСТА',         error_form: 'ПОЛТОРАСТА',          before_text: 'более',      after_text: 'рублей' },
  { category: CAT.CHISL, correct_form: 'ПЯТИСОТ',             error_form: 'ПЯТИСТА',             before_text: 'нет',        after_text: 'рублей' },
  { category: CAT.CHISL, correct_form: 'ТРЁХСОТ',             error_form: 'ТРЁХСТА',             before_text: 'около',      after_text: 'человек' },
  { category: CAT.CHISL, correct_form: 'ТЫСЯЧА ДЕВЯТИСОТОМ', error_form: 'ТЫСЯЧИ ДЕВЯТИСОТОМ', before_text: 'в',          after_text: 'году' },
  { category: CAT.CHISL, correct_form: 'ОБЕИХ',               error_form: 'ОБОИХ',               before_text: 'не было',    after_text: 'сестёр' },
  { category: CAT.CHISL, correct_form: 'ОБОИХ',               error_form: 'ОБЕИХ',               before_text: 'не было',    after_text: 'братьев' },

  // ── Повелительное наклонение ─────────────────────────────────────────────
  { category: CAT.POVEL, correct_form: 'ПОЕЗЖАЙ',   error_form: 'ЕЗЖАЙ',    before_text: '',  after_text: 'быстрее' },
  { category: CAT.POVEL, correct_form: 'ПОЕЗЖАЙТЕ', error_form: 'ЕДЬТЕ',    before_text: '',  after_text: 'осторожнее' },
  { category: CAT.POVEL, correct_form: 'ЛЯГ',       error_form: 'ЛЯЖЬ',     before_text: '',  after_text: 'на диван' },
  { category: CAT.POVEL, correct_form: 'ЛЯГТЕ',     error_form: 'ЛЯЖЬТЕ',   before_text: '',  after_text: 'на пол' },
  { category: CAT.POVEL, correct_form: 'ПОЛОЖИ',    error_form: 'ПОЛОЖЬ',   before_text: '',  after_text: 'книгу на стол' },
  { category: CAT.POVEL, correct_form: 'ВЫЙДИ',     error_form: 'ВЫЙДЬ',    before_text: '',  after_text: 'из комнаты' },

  // ── Личные формы глаголов ───────────────────────────────────────────────
  { category: CAT.GLAGOL, correct_form: 'ОН МАШЕТ',  error_form: 'ОН МАХАЕТ',   before_text: '',  after_text: 'рукой' },
  { category: CAT.GLAGOL, correct_form: 'ОН ПРОМОК',  error_form: 'ОН ПРОМОКНУЛ', before_text: '', after_text: 'под дождём' },
  { category: CAT.GLAGOL, correct_form: 'ОН ЗАМЁРЗ',  error_form: 'ОН ЗАМЁРЗНУЛ', before_text: '', after_text: 'на морозе' },
];

// ── Вставка ──────────────────────────────────────────────────────────────────
const existing = db.prepare('SELECT COUNT(*) AS c FROM task7_words').get().c;
if (existing > 0 && !FORCE) {
  console.log(`⚠️  В таблице task7_words уже есть ${existing} записей.`);
  console.log('Для перезаписи запустите: npm run seed:task7 -- --force');
  process.exit(0);
}

if (FORCE && existing > 0) {
  db.exec('DELETE FROM task7_words');
  console.log(`🗑  Старые данные удалены (${existing} записей).`);
}

const insertWord = db.prepare(
  'INSERT INTO task7_words (correct_form, error_form, category) VALUES (?, ?, ?)'
);
const insertCtx = db.prepare(
  'INSERT INTO task7_contexts (word_id, before_text, after_text) VALUES (?, ?, ?)'
);

const seed = db.transaction(() => {
  for (const w of words) {
    const { lastInsertRowid: wordId } = insertWord.run(
      w.correct_form.trim(),
      w.error_form.trim(),
      w.category
    );
    insertCtx.run(wordId, w.before_text.trim(), w.after_text.trim());
  }
});

seed();
console.log(`✅ Добавлено ${words.length} слов в банк задания №7.`);

// Статистика по категориям
const cats = {};
for (const w of words) cats[w.category] = (cats[w.category] || 0) + 1;
for (const [cat, count] of Object.entries(cats))
  console.log(`   ${cat}: ${count} слов`);
