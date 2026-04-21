/**
 * Слова к заданию №12: «брить» и производные (одна группа word_group_id).
 * Запуск из корня проекта: node server/seeds/seed-task12-brit.js
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', '..', 'data', 'app.sqlite'));

const GROUP_ID = 1;
const BASE = 'брить';
const CONJ = '1';

const words = [
  ['бр..ющий', 'е', 'е/и', 'active_part', 'I спр. «брить» (исключение): действит. прич., в корне -е-'],
  ['бр..ешь', 'е', 'е/и', 'verb', 'I спр. «брить» (исключение): личное окончание -е-'],
  ['бр..ем', 'е', 'е/и', 'verb', 'I спр. «брить» (исключение): личное окончание -е-'],
  ['бр..ет', 'е', 'е/и', 'verb', 'I спр. «брить» (исключение): личное окончание -е-'],
  ['бр..ют', 'е', 'е/и', 'verb', 'I спр. «брить» (исключение): 3 л. мн.ч., корень -е- (не -и-)'],
  ['сбр..вший', 'и', 'е/и', 'active_part', 'от «сбрить»: в корне -и- (сбри-), не -е-'],
  ['побр..вший', 'и', 'е/и', 'active_part', 'от «побрить»: в корне -и-'],
  ['выбр..вший', 'и', 'е/и', 'active_part', 'от «выбрить»: в корне -и-'],
  ['сбр..вающий', 'и', 'е/и', 'active_part', 'от «сбривать»: в корне -и-'],
  ['пробр..вающий', 'и', 'е/и', 'active_part', 'от «пробривать»: в корне -и-'],
  ['выбр..вающий', 'и', 'е/и', 'active_part', 'от «выбривать»: в корне -и-'],
  ['выбр..ет', 'е', 'е/и', 'verb', 'от «выбрить»: личное окончание -е-'],
  ['сбр..ешь', 'е', 'е/и', 'verb', 'от «сбрить»: личное окончание -е-'],
  ['побр..ем', 'е', 'е/и', 'verb', 'от «побрить»: личное окончание -е-'],
  ['выбр..ют', 'е', 'е/и', 'verb', 'от «выбрить»: 3 л. мн.ч., корень -е-'],
];

const getByDisplay = db.prepare('SELECT id, word_display FROM task12_words WHERE word_display = ?');
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
  const legacy = getByDisplay.get('бре..щий');
  if (legacy) {
    upd.run(
      'бр..ющий', 'е', 'е/и', 'active_part',
      'бр..ющий', CONJ, 'active_part', BASE,
      'I спр. «брить» (исключение): действит. прич., в корне -е-',
      GROUP_ID,
      legacy.id
    );
  }

  for (const [wd, letter, pair, ftype, rule] of words) {
    const row = getByDisplay.get(wd);
    if (row) {
      upd.run(wd, letter, pair, ftype, wd, CONJ, ftype, BASE, rule, GROUP_ID, row.id);
      continue;
    }
    ins.run(wd, letter, pair, ftype, wd, CONJ, ftype, BASE, rule, GROUP_ID);
  }
})();

db.close();
console.log('task12: добавлено/обновлено 15 форм «брить», группа', GROUP_ID);
