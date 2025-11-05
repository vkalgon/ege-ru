// server/db/seeds/task17.seed.js
import db from '../db.js';

// Данные для примера задания №17
const source_text = "Высокие, узкие клочья тумана (1) густые и белые (2) бродили над рекой (3) заслоняя (4) отражение звёзд (5) и (6) цепляясь (7) за ивы.";

const base_text = "Высокие, узкие клочья тумана густые и белые бродили над рекой заслоняя отражение звёзд и цепляясь за ивы.";

const commaless_text = base_text.replace(/,/g, "");

const digits = [1, 2, 3, 4, 5, 6, 7];

// Позиции запятых (межсимвольные индексы для commaless_text)
// Длина текста: 104 символа (с точкой в конце)
// После "Высокие" -> 7
// После "тумана" -> 27
// После "белые" -> 42
// После "рекой" -> 60
// После "звёзд" -> 85
// После "и" перед "цепляясь" -> 87
// После "ивы" -> 103 (последняя позиция перед точкой)

const comma_positions = [7, 27, 42, 60, 85, 87, 103];

// Спаны (обороты) относительно commaless_text
const spans = [
  {
    type: 'gerund',
    startOffset: 61,  // "заслоняя отражение звёзд"
    endOffset: 85     // конец слова "звёзд"
  },
  {
    type: 'gerund',
    startOffset: 88,  // "цепляясь за ивы"
    endOffset: 103     // конец слова "ивы" (до точки)
  }
];

const answer_text = "Запятые нужны при (1)–(7). Деепричастные обороты: «заслоняя отражение звёзд», «цепляясь за ивы».";

const explanation_md = `**Почему так.**

Деепричастные обороты обозначают добавочные действия при сказуемом и **всегда** выделяются запятыми. 

В конструкции с союзом **«и»** перед деепричастным оборотом запятая сохраняется: 

«... звёзд, **и, цепляясь,** ...».`;

// Вставляем задание
console.log('Создание задания №17...');

const taskResult = db.prepare(`
  INSERT INTO task17 (source_text, base_text, commaless_text, answer_text, explanation_md, reveal_policy)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  source_text,
  base_text,
  commaless_text,
  answer_text,
  explanation_md,
  'after_correct'
);

const taskId = taskResult.lastInsertRowid;
console.log(`Задание создано с ID: ${taskId}`);

// Вставляем эталонные ответы
db.prepare(`
  INSERT INTO task17_answer (task_id, digits_json, comma_positions_json, spans_json)
  VALUES (?, ?, ?, ?)
`).run(
  taskId,
  JSON.stringify(digits),
  JSON.stringify(comma_positions),
  JSON.stringify(spans)
);

console.log('Эталонные ответы сохранены');
console.log(`\nЗадание готово! ID: ${taskId}`);
console.log(`\nДанные:`);
console.log(`- source_text: ${source_text.substring(0, 50)}...`);
console.log(`- commaless_text длина: ${commaless_text.length}`);
console.log(`- Цифры: [${digits.join(', ')}]`);
console.log(`- Позиции запятых: [${comma_positions.join(', ')}]`);
console.log(`- Спаны: ${spans.length} шт.`);

export default taskId;
