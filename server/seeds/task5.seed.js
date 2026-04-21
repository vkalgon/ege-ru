/**
 * Seed: начальные данные для задания №5 (Паронимы)
 * Запуск: node server/seeds/task5.seed.js
 *
 * Формат предложений: {{СЛОВО}} — это место, где слово будет выделено жирным.
 * is_error: true  — в этом предложении слово употреблено НЕВЕРНО (highlighted_word — ошибка, correct_word — правильный пароним)
 * is_error: false — слово употреблено верно
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const db = new Database(path.join(__dirname, '..', '..', 'data', 'app.sqlite'));

// Создаём таблицы, если ещё нет
db.exec(`
  CREATE TABLE IF NOT EXISTS task5_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task5_sentences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES task5_groups(id) ON DELETE CASCADE,
    sentence TEXT NOT NULL,
    highlighted_word TEXT NOT NULL,
    correct_word TEXT NOT NULL,
    is_error INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task5_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_generated INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task5_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES task5_tasks(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    sentence_id INTEGER NOT NULL REFERENCES task5_sentences(id)
  );
`);

const insertGroup = db.prepare('INSERT INTO task5_groups (title) VALUES (?)');
const insertSent  = db.prepare(
  'INSERT INTO task5_sentences (group_id, sentence, highlighted_word, correct_word, is_error) VALUES (?,?,?,?,?)'
);

function addGroup(title, sentences) {
  const g = insertGroup.run(title);
  const gid = g.lastInsertRowid;
  sentences.forEach(s => insertSent.run(gid, s.sentence, s.highlighted_word, s.correct_word, s.is_error ? 1 : 0));
  return gid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Данные
// ─────────────────────────────────────────────────────────────────────────────

const seedData = [

  // 1 ───────────────────────────────────────────────────────────────────────
  {
    title: 'КРАСОЧНЫЙ – КРАСЯЩИЙ – КРАШЕНЫЙ',
    sentences: [
      {
        sentence: 'Хром и марганец являются {{КРАСОЧНЫМИ}} веществами, компонентами многих красок, созданных на основе этих минералов.',
        highlighted_word: 'КРАСОЧНЫМИ',
        correct_word: 'КРАСЯЩИМИ',
        is_error: true,
      },
      {
        sentence: 'Пейзажи Крыма в полотнах Айвазовского отличались {{КРАСОЧНЫМИ}} переходами от золота к пурпуру.',
        highlighted_word: 'КРАСОЧНЫМИ',
        correct_word: 'КРАСОЧНЫМИ',
        is_error: false,
      },
      {
        sentence: 'В цех поступило новое {{КРАСЯЩЕЕ}} вещество для производства тканей.',
        highlighted_word: 'КРАСЯЩЕЕ',
        correct_word: 'КРАСЯЩЕЕ',
        is_error: false,
      },
      {
        sentence: 'На свежевыкрашенной скамейке висела табличка: «Осторожно, {{КРАШЕНАЯ}}!»',
        highlighted_word: 'КРАШЕНАЯ',
        correct_word: 'КРАШЕНАЯ',
        is_error: false,
      },
    ],
  },

  // 2 ───────────────────────────────────────────────────────────────────────
  {
    title: 'ВЕЛИКИЙ – ВЕЛИЧАВЫЙ – ВЕЛИЧЕСТВЕННЫЙ',
    sentences: [
      {
        sentence: 'В неясном, рассеянном свете ночи открылись перед нами {{ВЕЛИЧЕСТВЕННЫЕ}} и прекрасные перспективы Петербурга: Нева, набережная, каналы, дворцы.',
        highlighted_word: 'ВЕЛИЧЕСТВЕННЫЕ',
        correct_word: 'ВЕЛИЧЕСТВЕННЫЕ',
        is_error: false,
      },
      {
        sentence: 'Пушкин — {{ВЕЛИКИЙ}} русский поэт, чьё творчество определило развитие всей нашей литературы.',
        highlighted_word: 'ВЕЛИКИЙ',
        correct_word: 'ВЕЛИКИЙ',
        is_error: false,
      },
      {
        sentence: 'Старая графиня вошла в зал {{ВЕЛИКОЙ}} поступью, будто королева на балу.',
        highlighted_word: 'ВЕЛИКОЙ',
        correct_word: 'ВЕЛИЧАВОЙ',
        is_error: true,
      },
      {
        sentence: 'Перед нами возвышался {{ВЕЛИЧЕСТВЕННЫЙ}} горный хребет, уходящий в облака.',
        highlighted_word: 'ВЕЛИЧЕСТВЕННЫЙ',
        correct_word: 'ВЕЛИЧЕСТВЕННЫЙ',
        is_error: false,
      },
    ],
  },

  // 3 ───────────────────────────────────────────────────────────────────────
  {
    title: 'ДИПЛОМАТИЧЕСКИЙ – ДИПЛОМАТИЧНЫЙ',
    sentences: [
      {
        sentence: '{{ДИПЛОМАТИЧЕСКИЕ}} отношения между Россией и США были установлены в 1807 году.',
        highlighted_word: 'ДИПЛОМАТИЧЕСКИЕ',
        correct_word: 'ДИПЛОМАТИЧЕСКИЕ',
        is_error: false,
      },
      {
        sentence: 'Успех внешней политики государства во многом зависит от опыта и таланта {{ДИПЛОМАТОВ}}.',
        highlighted_word: 'ДИПЛОМАТОВ',
        correct_word: 'ДИПЛОМАТОВ',
        is_error: false,
      },
      {
        sentence: 'Его отказ был настолько {{ДИПЛОМАТИЧЕСКИМ}}, что никто не почувствовал обиды.',
        highlighted_word: 'ДИПЛОМАТИЧЕСКИМ',
        correct_word: 'ДИПЛОМАТИЧНЫМ',
        is_error: true,
      },
      {
        sentence: 'Молодой политик проявил {{ДИПЛОМАТИЧНЫЙ}} подход к решению конфликта между коллегами.',
        highlighted_word: 'ДИПЛОМАТИЧНЫЙ',
        correct_word: 'ДИПЛОМАТИЧНЫЙ',
        is_error: false,
      },
    ],
  },

  // 4 ───────────────────────────────────────────────────────────────────────
  {
    title: 'ГУМАНИСТИЧЕСКИЙ – ГУМАНИТАРНЫЙ – ГУМАННЫЙ',
    sentences: [
      {
        sentence: 'Самыми {{ГУМАННЫМИ}} профессиями на земле являются те, от которых зависят духовная жизнь и здоровье человека.',
        highlighted_word: 'ГУМАННЫМИ',
        correct_word: 'ГУМАННЫМИ',
        is_error: false,
      },
      {
        sentence: 'Эпоха Возрождения породила {{ГУМАНИСТИЧЕСКИЕ}} идеи о ценности человеческой личности.',
        highlighted_word: 'ГУМАНИСТИЧЕСКИЕ',
        correct_word: 'ГУМАНИСТИЧЕСКИЕ',
        is_error: false,
      },
      {
        sentence: 'В университете она изучала {{ГУМАНИСТИЧЕСКИЕ}} дисциплины: историю, философию и лингвистику.',
        highlighted_word: 'ГУМАНИСТИЧЕСКИЕ',
        correct_word: 'ГУМАНИТАРНЫЕ',
        is_error: true,
      },
      {
        sentence: 'ООН оказывает {{ГУМАНИТАРНУЮ}} помощь населению пострадавших от катастроф регионов.',
        highlighted_word: 'ГУМАНИТАРНУЮ',
        correct_word: 'ГУМАНИТАРНУЮ',
        is_error: false,
      },
    ],
  },

  // 5 ───────────────────────────────────────────────────────────────────────
  {
    title: 'ЭФФЕКТИВНЫЙ – ЭФФЕКТНЫЙ',
    sentences: [
      {
        sentence: 'Новое лекарство оказалось очень {{ЭФФЕКТИВНЫМ}}: уже через двое суток больному стало лучше.',
        highlighted_word: 'ЭФФЕКТИВНЫМ',
        correct_word: 'ЭФФЕКТИВНЫМ',
        is_error: false,
      },
      {
        sentence: 'Её выход на сцену был по-настоящему {{ЭФФЕКТНЫМ}}: зал ахнул от восторга.',
        highlighted_word: 'ЭФФЕКТНЫМ',
        correct_word: 'ЭФФЕКТНЫМ',
        is_error: false,
      },
      {
        sentence: 'Нам нужно принять {{ЭФФЕКТНЫЕ}} меры для борьбы с распространением вируса.',
        highlighted_word: 'ЭФФЕКТНЫЕ',
        correct_word: 'ЭФФЕКТИВНЫЕ',
        is_error: true,
      },
      {
        sentence: 'Артист завершил выступление {{ЭФФЕКТНЫМ}} прыжком, вызвав аплодисменты.',
        highlighted_word: 'ЭФФЕКТНЫМ',
        correct_word: 'ЭФФЕКТНЫМ',
        is_error: false,
      },
    ],
  },

  // 6 ───────────────────────────────────────────────────────────────────────
  {
    title: 'АБОНЕМЕНТ – АБОНЕНТ',
    sentences: [
      {
        sentence: 'Он приобрёл {{АБОНЕМЕНТ}} на весь сезон в Большом театре.',
        highlighted_word: 'АБОНЕМЕНТ',
        correct_word: 'АБОНЕМЕНТ',
        is_error: false,
      },
      {
        sentence: 'Телефонный {{АБОНЕНТ}} долгое время не отвечал на звонки.',
        highlighted_word: 'АБОНЕНТ',
        correct_word: 'АБОНЕНТ',
        is_error: false,
      },
      {
        sentence: 'Каждый {{АБОНЕНТ}} библиотеки обязан своевременно возвращать книги.',
        highlighted_word: 'АБОНЕНТ',
        correct_word: 'АБОНЕМЕНТ',
        is_error: true,
      },
      {
        sentence: 'Для пользования бассейном необходимо оформить {{АБОНЕМЕНТ}}.',
        highlighted_word: 'АБОНЕМЕНТ',
        correct_word: 'АБОНЕМЕНТ',
        is_error: false,
      },
    ],
  },

  // 7 ───────────────────────────────────────────────────────────────────────
  {
    title: 'ПРАКТИЧЕСКИЙ – ПРАКТИЧНЫЙ',
    sentences: [
      {
        sentence: 'Студенты медицинского факультета проходили {{ПРАКТИЧЕСКИЕ}} занятия в клинике.',
        highlighted_word: 'ПРАКТИЧЕСКИЕ',
        correct_word: 'ПРАКТИЧЕСКИЕ',
        is_error: false,
      },
      {
        sentence: 'Эта хозяйка очень {{ПРАКТИЧНА}}: она никогда не тратит деньги зря.',
        highlighted_word: 'ПРАКТИЧНА',
        correct_word: 'ПРАКТИЧНА',
        is_error: false,
      },
      {
        sentence: 'Тёмный цвет одежды {{ПРАКТИЧЕСКИЙ}}: на нём не видно загрязнений.',
        highlighted_word: 'ПРАКТИЧЕСКИЙ',
        correct_word: 'ПРАКТИЧНЫЙ',
        is_error: true,
      },
      {
        sentence: 'Конференция имела не только теоретическое, но и {{ПРАКТИЧЕСКОЕ}} значение для отрасли.',
        highlighted_word: 'ПРАКТИЧЕСКОЕ',
        correct_word: 'ПРАКТИЧЕСКОЕ',
        is_error: false,
      },
    ],
  },

  // 8 ───────────────────────────────────────────────────────────────────────
  {
    title: 'ОДЕТЬ – НАДЕТЬ',
    sentences: [
      {
        sentence: 'Мать {{ОДЕЛА}} ребёнка потеплее и отправила его на прогулку.',
        highlighted_word: 'ОДЕЛА',
        correct_word: 'ОДЕЛА',
        is_error: false,
      },
      {
        sentence: 'Перед выходом на мороз нужно {{НАДЕТЬ}} шапку и варежки.',
        highlighted_word: 'НАДЕТЬ',
        correct_word: 'НАДЕТЬ',
        is_error: false,
      },
      {
        sentence: 'Она {{ОДЕЛА}} пальто и вышла на улицу.',
        highlighted_word: 'ОДЕЛА',
        correct_word: 'НАДЕЛА',
        is_error: true,
      },
      {
        sentence: 'Он {{НАДЕЛ}} на палец обручальное кольцо.',
        highlighted_word: 'НАДЕЛ',
        correct_word: 'НАДЕЛ',
        is_error: false,
      },
    ],
  },

  // 9 ───────────────────────────────────────────────────────────────────────
  {
    title: 'НЕВЕЖА – НЕВЕЖДА',
    sentences: [
      {
        sentence: 'Он хамил всем подряд, как настоящий {{НЕВЕЖА}}: не здоровался и перебивал собеседников.',
        highlighted_word: 'НЕВЕЖА',
        correct_word: 'НЕВЕЖА',
        is_error: false,
      },
      {
        sentence: 'В вопросах живописи он был полным {{НЕВЕЖДОЙ}} и не мог отличить импрессионизм от кубизма.',
        highlighted_word: 'НЕВЕЖДОЙ',
        correct_word: 'НЕВЕЖДОЙ',
        is_error: false,
      },
      {
        sentence: 'Не зная элементарных правил поведения в обществе, он слыл {{НЕВЕЖДОЙ}}.',
        highlighted_word: 'НЕВЕЖДОЙ',
        correct_word: 'НЕВЕЖЕЙ',
        is_error: true,
      },
      {
        sentence: 'Молодой специалист оказался {{НЕВЕЖДОЙ}} в области современной физики.',
        highlighted_word: 'НЕВЕЖДОЙ',
        correct_word: 'НЕВЕЖДОЙ',
        is_error: false,
      },
    ],
  },

  // 10 ──────────────────────────────────────────────────────────────────────
  {
    title: 'ДЛИННЫЙ – ДЛИТЕЛЬНЫЙ',
    sentences: [
      {
        sentence: 'После {{ДЛИТЕЛЬНОГО}} лечения пациент наконец пошёл на поправку.',
        highlighted_word: 'ДЛИТЕЛЬНОГО',
        correct_word: 'ДЛИТЕЛЬНОГО',
        is_error: false,
      },
      {
        sentence: 'Судно имело {{ДЛИННЫЙ}} корпус и три мачты.',
        highlighted_word: 'ДЛИННЫЙ',
        correct_word: 'ДЛИННЫЙ',
        is_error: false,
      },
      {
        sentence: 'Его {{ДЛИННЫЙ}} монолог утомил всех присутствующих: он говорил уже больше часа.',
        highlighted_word: 'ДЛИННЫЙ',
        correct_word: 'ДЛИТЕЛЬНЫЙ',
        is_error: true,
      },
      {
        sentence: 'Мы наблюдали за {{ДЛИТЕЛЬНЫМ}} затмением солнца, которое продолжалось несколько минут.',
        highlighted_word: 'ДЛИТЕЛЬНЫМ',
        correct_word: 'ДЛИТЕЛЬНЫМ',
        is_error: false,
      },
    ],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// Вставка
// ─────────────────────────────────────────────────────────────────────────────

console.log('Заполняем задание №5 (Паронимы)…');

const run = db.transaction(() => {
  for (const group of seedData) {
    addGroup(group.title, group.sentences);
    console.log(`  Группа «${group.title}» добавлена`);
  }
});
run();

console.log('Готово!');
db.close();
