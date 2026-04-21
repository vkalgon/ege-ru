import db from '../db.js';

const words = [
  // ── з / с (чередование) ──────────────────────────────────────────
  // з (следует звонкий согласный или гласный)
  { prefix_display: 'ра..бросать',    correct_letter: 'з', rule: 'з/с' },
  { prefix_display: 'бе..граничный',  correct_letter: 'з', rule: 'з/с' },
  { prefix_display: 'и..гнать',       correct_letter: 'з', rule: 'з/с' },
  { prefix_display: 'ра..делить',     correct_letter: 'з', rule: 'з/с' },
  { prefix_display: 'и..давна',       correct_letter: 'з', rule: 'з/с' },
  { prefix_display: 'бе..умный',      correct_letter: 'з', rule: 'з/с' },
  { prefix_display: 'во..звать',      correct_letter: 'з', rule: 'з/с' },
  { prefix_display: 'ни..вергнуть',   correct_letter: 'з', rule: 'з/с' },
  // с (следует глухой согласный)
  { prefix_display: 'бе..конечный',   correct_letter: 'с', rule: 'з/с' },
  { prefix_display: 'и..чезнуть',     correct_letter: 'с', rule: 'з/с' },
  { prefix_display: 'во..ходить',     correct_letter: 'с', rule: 'з/с' },
  { prefix_display: 'чере..чур',      correct_letter: 'с', rule: 'з/с' },
  { prefix_display: 'ра..писать',     correct_letter: 'с', rule: 'з/с' },
  { prefix_display: 'бе..полезный',   correct_letter: 'с', rule: 'з/с' },
  { prefix_display: 'ра..смотреть',   correct_letter: 'с', rule: 'з/с' },
  { prefix_display: 'ни..провергнуть',correct_letter: 'с', rule: 'з/с' },

  // ── ъ / ь (разделительные знаки) ─────────────────────────────────
  // ъ (после приставки, оканчивающейся на согласную, перед е ё ю я)
  { prefix_display: 'об..явить',      correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'с..езд',         correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'пред..явить',    correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'раз..яснить',    correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'под..езд',       correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'в..ехать',       correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'из..явить',      correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'об..единить',    correct_letter: 'ъ', rule: 'ъ/ь' },
  { prefix_display: 'вз..ерошить',    correct_letter: 'ъ', rule: 'ъ/ь' },
  // ь (внутри корня, не после приставки, перед е ё ю я)
  { prefix_display: 'в..юга',         correct_letter: 'ь', rule: 'ъ/ь' },
  { prefix_display: 'руж..ё',         correct_letter: 'ь', rule: 'ъ/ь' },
  { prefix_display: 'п..еса',         correct_letter: 'ь', rule: 'ъ/ь' },
  { prefix_display: 'бур..ян',        correct_letter: 'ь', rule: 'ъ/ь' },
  { prefix_display: 'стат..я',        correct_letter: 'ь', rule: 'ъ/ь' },
  { prefix_display: 'обез..яна',      correct_letter: 'ь', rule: 'ъ/ь' },
  { prefix_display: 'ш..ют',          correct_letter: 'ь', rule: 'ъ/ь' },
  { prefix_display: 'л..ют',          correct_letter: 'ь', rule: 'ъ/ь' },

  // ── пре / при ────────────────────────────────────────────────────
  // е (пре-)
  { prefix_display: 'пр..красный',    correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..лестный',    correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..града',      correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..одолеть',    correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..небречь',    correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..следовать',  correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..вратить',    correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..кратить',    correct_letter: 'е', rule: 'пре/при' },
  { prefix_display: 'пр..ступление',  correct_letter: 'е', rule: 'пре/при' },
  // и (при-)
  { prefix_display: 'пр..ходить',     correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..носить',     correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..вязать',     correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..бежать',     correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..ближение',   correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..ключение',   correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..землиться',  correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..шивать',     correct_letter: 'и', rule: 'пре/при' },
  { prefix_display: 'пр..смотреть',   correct_letter: 'и', rule: 'пре/при' },

  // ── пра / про ────────────────────────────────────────────────────
  // а (пра- — исконная, означает «древний, первоначальный»)
  { prefix_display: 'пр..бабушка',    correct_letter: 'а', rule: 'пра/про' },
  { prefix_display: 'пр..дед',        correct_letter: 'а', rule: 'пра/про' },
  { prefix_display: 'пр..родитель',   correct_letter: 'а', rule: 'пра/про' },
  { prefix_display: 'пр..внук',       correct_letter: 'а', rule: 'пра/про' },
  { prefix_display: 'пр..язык',       correct_letter: 'а', rule: 'пра/про' },
  { prefix_display: 'пр..славянский', correct_letter: 'а', rule: 'пра/про' },
  // о (про-)
  { prefix_display: 'пр..йти',        correct_letter: 'о', rule: 'пра/про' },
  { prefix_display: 'пр..читать',     correct_letter: 'о', rule: 'пра/про' },
  { prefix_display: 'пр..должать',    correct_letter: 'о', rule: 'пра/про' },
  { prefix_display: 'пр..верить',     correct_letter: 'о', rule: 'пра/про' },
  { prefix_display: 'пр..гулять',     correct_letter: 'о', rule: 'пра/про' },
  { prefix_display: 'пр..лететь',     correct_letter: 'о', rule: 'пра/про' },
  { prefix_display: 'пр..сить',       correct_letter: 'о', rule: 'пра/про' },
  { prefix_display: 'пр..жить',       correct_letter: 'о', rule: 'пра/про' },

  // ── ы / и после приставок ────────────────────────────────────────
  // ы (приставка оканчивается на согласную → и→ы в начале корня)
  { prefix_display: 'с..грать',           correct_letter: 'ы', rule: 'ы/и' },
  { prefix_display: 'раз..грать',         correct_letter: 'ы', rule: 'ы/и' },
  { prefix_display: 'от..скать',          correct_letter: 'ы', rule: 'ы/и' },
  { prefix_display: 'под..тожить',        correct_letter: 'ы', rule: 'ы/и' },
  { prefix_display: 'без..нтересный',     correct_letter: 'ы', rule: 'ы/и' },
  { prefix_display: 'пред..стория',       correct_letter: 'ы', rule: 'ы/и' },
  { prefix_display: 'об..грать',          correct_letter: 'ы', rule: 'ы/и' },
  { prefix_display: 'из..сканный',        correct_letter: 'ы', rule: 'ы/и' },
  // и (приставка на гласную, или меж-/сверх-/иностранные)
  { prefix_display: 'вы..грать',          correct_letter: 'и', rule: 'ы/и' },
  { prefix_display: 'вы..скать',          correct_letter: 'и', rule: 'ы/и' },
  { prefix_display: 'сверх..нтересный',   correct_letter: 'и', rule: 'ы/и' },
  { prefix_display: 'меж..здательский',   correct_letter: 'и', rule: 'ы/и' },
  { prefix_display: 'пост..ндустриальный',correct_letter: 'и', rule: 'ы/и' },
  { prefix_display: 'контр..гра',         correct_letter: 'и', rule: 'ы/и' },

  // ── неизменяемые (с гласными) — пропущена гласная приставки ──────
  // а (приставки на-/за-)
  { prefix_display: 'н..писать',  correct_letter: 'а', rule: 'неизменяемые гласные' },
  { prefix_display: 'н..клонить', correct_letter: 'а', rule: 'неизменяемые гласные' },
  { prefix_display: 'н..бросить', correct_letter: 'а', rule: 'неизменяемые гласные' },
  { prefix_display: 'з..крыть',   correct_letter: 'а', rule: 'неизменяемые гласные' },
  { prefix_display: 'з..держать', correct_letter: 'а', rule: 'неизменяемые гласные' },
  { prefix_display: 'з..метить',  correct_letter: 'а', rule: 'неизменяемые гласные' },
  // о (приставки до-/по-)
  { prefix_display: 'д..нести',   correct_letter: 'о', rule: 'неизменяемые гласные' },
  { prefix_display: 'д..смотреть',correct_letter: 'о', rule: 'неизменяемые гласные' },
  { prefix_display: 'д..ехать',   correct_letter: 'о', rule: 'неизменяемые гласные' },
  { prefix_display: 'п..читать',  correct_letter: 'о', rule: 'неизменяемые гласные' },
  { prefix_display: 'п..смотреть',correct_letter: 'о', rule: 'неизменяемые гласные' },
  { prefix_display: 'п..ехать',   correct_letter: 'о', rule: 'неизменяемые гласные' },

  // ── неизменяемые (с согласными) — пропущен согласный приставки ───
  // д (приставки под-/над-/пред-)
  { prefix_display: 'по..держать',  correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'по..брасывать',correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'по..ходить',   correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'по..черкнуть', correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'на..пись',     correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'на..стройка',  correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'на..рез',      correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'пре..ставить', correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'пре..сказание',correct_letter: 'д', rule: 'неизменяемые согласные' },
  { prefix_display: 'пре..мет',     correct_letter: 'д', rule: 'неизменяемые согласные' },
  // т (приставка от-)
  { prefix_display: 'о..дать',      correct_letter: 'т', rule: 'неизменяемые согласные' },
  { prefix_display: 'о..везти',     correct_letter: 'т', rule: 'неизменяемые согласные' },
  { prefix_display: 'о..ступить',   correct_letter: 'т', rule: 'неизменяемые согласные' },
  { prefix_display: 'о..крыть',     correct_letter: 'т', rule: 'неизменяемые согласные' },
];

const stmt = db.prepare(
  'INSERT INTO task10_words (prefix_display, correct_letter, rule) VALUES (?, ?, ?)'
);

const insertAll = db.transaction(() => {
  for (const w of words) {
    stmt.run(w.prefix_display, w.correct_letter, w.rule);
  }
});

insertAll();
console.log(`Inserted ${words.length} task10 words.`);
