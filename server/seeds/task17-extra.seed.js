import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new Database(path.join(__dirname, '..', '..', 'data', 'app.sqlite'));

const tasks = [
  {
    source_text: 'Каждый вечер после карт Модест Алексеич (1) взволнованный (2) шептался с чиновницами (3) озабоченно поглядывая на Аню (4) и потом долго ходил из угла в угол (5) о чем-то думая.',
    answer: '12345'
  },
  {
    source_text: 'Когда Аня (1) идя вверх по лестнице (2) под руку с мужем (3) услышала музыку и увидала в громадном зеркале всю себя (4) освещенную множеством огней (5) то в душе ее проснулась радость и то самое предчувствие счастья.',
    answer: '1345'
  },
  {
    source_text: 'Собаки (1) уже мокрые (2) стояли (3) поджав хвосты (4) и смотрели на них с умилением.',
    answer: '1234'
  },
  {
    source_text: 'Тут около телег стояли (1) мокрые (2) лошади (3) понурив головы (4) и ходили люди (5) накрывшись мешками.',
    answer: '345'
  },
  {
    source_text: 'Буркин и Иван Иваныч (1) одетые в шелковые халаты и теплые туфли (2) сидели в креслах, а сам Алехин (3) умытый (4) причесанный (5) ходил по гостиной (6) с наслаждением ощущая тепло (7) и когда красивая Пелагея (8) бесшумно ступая по ковру (9) и мягко улыбаясь (10) подавала на подносе чай с вареньем, только тогда Иван Иваныч приступил к рассказу.',
    answer: '1234567810'
  },
  {
    source_text: 'И (1) оставшись один на платформе (2) и (3) глядя в темную даль (4) Гуров слушал крик кузнечиков и гудение телеграфных проволок.',
    answer: '14'
  },
  {
    source_text: 'Гуров (1) сидевший тоже в партере (2) подошел к ней и сказал (3) дрожащим голосом (4) улыбаясь насильно: — Здравствуйте.',
    answer: '124'
  },
  {
    source_text: 'Он стоял (1) испуганный (2) ее смущением (3) не решаясь (4) сесть рядом.',
    answer: '13'
  },
  {
    source_text: 'Екатерина Ивановна играла трудный пассаж (1) интересный именно своею трудностью (2) длинный (3) и (4) однообразный (5) и Старцев (6) слушая (7) рисовал себе, как с высокой горы сыплются камни, сыплются и всё сыплются, и ему хотелось, чтобы они поскорее перестали сыпаться, и в то же время Екатерина Ивановна (8) розовая от напряжения (9) очень нравилась ему.',
    answer: '1256789'
  },
  {
    source_text: 'Когда гости (1) сытые (2) и (3) довольные (4) толпились в передней (5) разбирая свои пальто и трости (6) около них суетился лакей Павлуша.',
    answer: '1456'
  }
];

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDigits(answer) {
  return String(answer)
    .match(/\d+/g)
    .map((n) => Number(n));
}

function buildBaseText(sourceText, digits) {
  const digitsSet = new Set(digits);
  const withCommas = sourceText.replace(/\((\d+)\)/g, (_, rawDigit) => {
    const digit = Number(rawDigit);
    return digitsSet.has(digit) ? ',' : '';
  });

  return normalizeText(withCommas)
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ', ');
}

const insertTask = db.prepare(`
  INSERT INTO task17 (source_text, base_text, commaless_text, answer_text, explanation_md, source, reveal_policy)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAnswer = db.prepare(`
  INSERT INTO task17_answer (task_id, digits_json, comma_positions_json, spans_json)
  VALUES (?, ?, ?, ?)
`);

console.log('Добавляем 10 заданий в банк task17...');

const insertedIds = db.transaction(() => {
  const ids = [];

  for (const task of tasks) {
    const sourceText = normalizeText(task.source_text);
    const digits = parseDigits(task.answer);
    const baseText = buildBaseText(sourceText, digits);
    const commalessText = normalizeText(baseText.replace(/,/g, ''));

    const taskResult = insertTask.run(
      sourceText,
      baseText,
      commalessText,
      `Ответ: ${task.answer}`,
      null,
      'user-added',
      'after_check'
    );

    insertAnswer.run(
      taskResult.lastInsertRowid,
      JSON.stringify(digits),
      JSON.stringify([]),
      JSON.stringify([])
    );

    ids.push(taskResult.lastInsertRowid);
  }

  return ids;
})();

console.log(`Готово. Добавлены ID: ${insertedIds.join(', ')}`);
db.close();
