/**
 * Задание №12: «стелить» и приставочные формы (группа word_group_id).
 * Запуск: node server/seeds/seed-task12-stelit.js
 *
 * Два варианта «постел..т» (е / ю) — различаются по correct_vowel и base_verb в паре с формой.
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', '..', 'data', 'app.sqlite'));

const row = db.prepare('SELECT MAX(word_group_id) AS m FROM task12_words').get();
const GROUP_ID = (row.m ?? 0) + 1;
const CONJ = '1';

/** @type {Array<[string, string, string, string, string, string]>} */
const words = [
  ['стел..щий', 'ю', 'ю/я', 'active_part', 'стелить', 'I спр. «стелить» (исключение): действит. прич., -ющ-'],
  ['стел..щая', 'ю', 'ю/я', 'active_part', 'стелить', 'I спр. «стелить» (исключение): действит. прич., -ющ-'],
  ['стел..щие', 'ю', 'ю/я', 'active_part', 'стелить', 'I спр. «стелить» (исключение): действит. прич., -ющ-'],
  ['стел..шь', 'е', 'е/и', 'verb', 'стелить', 'I спр. «стелить» (исключение): личное окончание -е-'],
  ['стел..м', 'е', 'е/и', 'verb', 'стелить', 'I спр. «стелить» (исключение): личное окончание -е-'],
  ['стел..т', 'ю', 'ю/я', 'verb', 'стелить', 'I спр. «стелить» (исключение): 3 л. мн.ч. -ют'],
  ['постел..вший', 'и', 'е/и', 'active_part', 'постелить', 'от «постелить»: в корне -и- (постели-), не -е-'],
  ['постел..вшая', 'и', 'е/и', 'active_part', 'постелить', 'от «постелить»: в корне -и-'],
  ['постел..вшие', 'и', 'е/и', 'active_part', 'постелить', 'от «постелить»: в корне -и-'],
  ['застел..вший', 'и', 'е/и', 'active_part', 'застелить', 'от «застелить»: в корне -и-'],
  ['застел..вшая', 'и', 'е/и', 'active_part', 'застелить', 'от «застелить»: в корне -и-'],
  ['застел..вшие', 'и', 'е/и', 'active_part', 'застелить', 'от «застелить»: в корне -и-'],
  ['расстел..вший', 'и', 'е/и', 'active_part', 'расстелить', 'от «расстелить»: в корне -и-'],
  ['расстел..вшая', 'и', 'е/и', 'active_part', 'расстелить', 'от «расстелить»: в корне -и-'],
  ['расстел..вшие', 'и', 'е/и', 'active_part', 'расстелить', 'от «расстелить»: в корне -и-'],
  ['стел..щийся', 'ю', 'ю/я', 'active_part', 'стелить', 'I спр. «стелить» (исключение): действит. прич. возвр.'],
  ['стел..щаяся', 'ю', 'ю/я', 'active_part', 'стелить', 'I спр. «стелить» (исключение): действит. прич. возвр.'],
  ['стел..щиеся', 'ю', 'ю/я', 'active_part', 'стелить', 'I спр. «стелить» (исключение): действит. прич. возвр.'],
  ['постел..т', 'е', 'е/и', 'verb', 'постелить', 'от «постелить»: 3 л. ед.ч. -ет'],
  ['застел..шь', 'е', 'е/и', 'verb', 'застелить', 'от «застелить»: личное окончание -е-'],
  ['расстел..м', 'е', 'е/и', 'verb', 'расстелить', 'от «расстелить»: личное окончание -е-'],
  ['постел..т', 'ю', 'ю/я', 'verb', 'постелить', 'от «постелить»: 3 л. мн.ч. -ют'],
];

const getRow = db.prepare(
  'SELECT id FROM task12_words WHERE word_display = ? AND correct_vowel = ? AND base_verb = ?'
);
const ins = db.prepare(`
  INSERT INTO task12_words
    (word_display, correct_vowel, vowel_pair, morpheme_type,
     before_morpheme, morpheme_display, after_morpheme,
     conjugation, form_type, base_verb, rule, word_group_id)
  VALUES (?, ?, ?, ?, '', ?, '', ?, ?, ?, ?, ?)
`);
const upd = db.prepare(`
  UPDATE task12_words SET
    word_display = ?, correct_vowel = ?, vowel_pair = ?, morpheme_type = ?,
    morpheme_display = ?, conjugation = ?, form_type = ?, base_verb = ?, rule = ?, word_group_id = ?
  WHERE id = ?
`);

db.transaction(() => {
  for (const [wd, letter, pair, ftype, base, rule] of words) {
    const ex = getRow.get(wd, letter, base);
    if (ex) {
      upd.run(wd, letter, pair, ftype, wd, CONJ, ftype, base, rule, GROUP_ID, ex.id);
    } else {
      ins.run(wd, letter, pair, ftype, wd, CONJ, ftype, base, rule, GROUP_ID);
    }
  }
})();

db.close();
console.log('task12: стелить — добавлено/обновлено', words.length, 'форм, группа', GROUP_ID);
