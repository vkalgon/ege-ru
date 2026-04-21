import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, updateWordProgress, logTaskCompletion, getWeakWordIds, getNewWordIds, pickWeighted, resolveWeakUserFromReq } from './progress.js';

const router = Router();

/** Слов в одной строке задания (как в №11 — две позиции). */
const WORDS_PER_ROW = 2;

/* ─── утилиты ─────────────────────────────────────────────── */

function getTaskWithRows(taskId) {
  const task = db.prepare('SELECT * FROM task12_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const rows = db.prepare('SELECT * FROM task12_rows WHERE task_id = ? ORDER BY row_index').all(taskId);
  for (const row of rows) {
    const cells = db.prepare(`
      SELECT tc.cell_index,
             w.id AS word_id, w.word_display,
             w.correct_vowel AS correct_letter,
             w.vowel_pair,
             w.conjugation, w.form_type, w.base_verb, w.rule
      FROM task12_cells tc
      JOIN task12_words w ON w.id = tc.word_id
      WHERE tc.row_id = ?
      ORDER BY tc.cell_index
    `).all(row.id);
    row.words = cells;
  }
  task.rows = rows;
  return task;
}

function saveTaskRows(taskId, rows) {
  const insertRow = db.prepare(
    'INSERT INTO task12_rows (task_id, row_index, is_correct) VALUES (?, ?, ?)'
  );
  const insertCell = db.prepare(
    'INSERT INTO task12_cells (row_id, cell_index, word_id) VALUES (?, ?, ?)'
  );
  for (const row of rows) {
    const { lastInsertRowid: rowId } = insertRow.run(taskId, row.row_index, row.is_correct ? 1 : 0);
    for (let i = 0; i < row.word_ids.length; i++) {
      insertCell.run(rowId, i + 1, row.word_ids[i]);
    }
  }
}

function validateUniqueWords(rows) {
  const ids = [];
  for (const row of rows) {
    if (!Array.isArray(row.word_ids)) continue;
    for (const raw of row.word_ids) {
      const id = Number(raw);
      if (!Number.isInteger(id) || id < 1) return 'Некорректный идентификатор слова';
      ids.push(id);
    }
  }
  if (new Set(ids).size !== ids.length)
    return 'Одно и то же слово не может встречаться в задании дважды';
  return null;
}

/* ─── СЛОВАРЬ СЛОВ (админ) ───────────────────────────────── */

// GET /api/task12/words
router.get('/words', (req, res) => {
  const { vowel_pair, form_type, base_verb, word_display } = req.query;
  let sql = `
    SELECT *, correct_vowel AS correct_letter
    FROM task12_words
    WHERE word_display != ''
  `;
  const params = [];
  if (vowel_pair)    { sql += ' AND vowel_pair = ?'; params.push(vowel_pair); }
  if (form_type)     { sql += ' AND form_type = ?';  params.push(form_type); }
  if (base_verb)     { sql += ' AND base_verb = ? COLLATE NOCASE'; params.push(base_verb); }
  if (word_display)  { sql += ' AND word_display = ? COLLATE NOCASE'; params.push(word_display); }
  sql += req.query.sort === 'recent'
    ? ' ORDER BY created_at DESC, id DESC'
    : ' ORDER BY vowel_pair, correct_vowel, word_display COLLATE NOCASE';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/task12/words/next-group-id
router.get('/words/next-group-id', (req, res) => {
  const row = db.prepare('SELECT COALESCE(MAX(word_group_id), 0) + 1 AS next_id FROM task12_words').get();
  res.json({ next_id: row.next_id });
});

// POST /api/task12/words
router.post('/words', (req, res) => {
  const { word_display, correct_letter, vowel_pair, form_type, conjugation, base_verb, rule, word_group_id } = req.body;
  if (!word_display || !correct_letter || !vowel_pair || !form_type)
    return res.status(400).json({ error: 'Поля word_display, correct_letter, vowel_pair, form_type обязательны' });

  // morpheme_type имеет старый CHECK — маппим новые типы на совместимое значение
  const morphemeType = ['verb','active_part','passive_part'].includes(form_type)
    ? form_type : 'verb';

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO task12_words
      (word_display, correct_vowel, vowel_pair, morpheme_type,
       before_morpheme, morpheme_display, after_morpheme,
       conjugation, form_type, base_verb, rule, word_group_id)
    VALUES (?, ?, ?, ?, '', ?, '', ?, ?, ?, ?, ?)
  `).run(
    word_display.trim(),
    correct_letter.trim(),
    vowel_pair.trim(),
    morphemeType,
    word_display.trim(),
    conjugation ? String(conjugation) : '',
    form_type,
    base_verb?.trim() || null,
    rule?.trim() || null,
    word_group_id ? Number(word_group_id) : null
  );
  res.json({ id: lastInsertRowid });
});

// PUT /api/task12/words/:id
router.put('/words/:id', (req, res) => {
  const { word_display, correct_letter, vowel_pair, form_type, conjugation, base_verb, rule, word_group_id } = req.body;
  if (!word_display || !correct_letter || !vowel_pair || !form_type)
    return res.status(400).json({ error: 'Поля word_display, correct_letter, vowel_pair, form_type обязательны' });

  const morphemeTypeU = ['verb','active_part','passive_part'].includes(form_type)
    ? form_type : 'verb';

  const r = db.prepare(`
    UPDATE task12_words SET
      word_display=?, correct_vowel=?, vowel_pair=?, morpheme_type=?,
      morpheme_display=?, conjugation=?, form_type=?,
      base_verb=?, rule=?, word_group_id=?
    WHERE id=?
  `).run(
    word_display.trim(), correct_letter.trim(), vowel_pair.trim(), morphemeTypeU,
    word_display.trim(),
    conjugation ? String(conjugation) : '', form_type,
    base_verb?.trim() || null, rule?.trim() || null,
    word_group_id ? Number(word_group_id) : null,
    req.params.id
  );
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// POST /api/task12/words/new-group
router.post('/words/new-group', (req, res) => {
  const { word_id } = req.body;
  if (!word_id) return res.status(400).json({ error: 'word_id обязателен' });
  const row = db.prepare('SELECT MAX(word_group_id) AS mx FROM task12_words').get();
  const newGroupId = (row.mx || 0) + 1;
  db.prepare('UPDATE task12_words SET word_group_id = ? WHERE id = ?').run(newGroupId, word_id);
  res.json({ word_group_id: newGroupId });
});

// PUT /api/task12/words/:id/group
router.put('/words/:id/group', (req, res) => {
  const { word_group_id } = req.body;
  const r = db.prepare('UPDATE task12_words SET word_group_id = ? WHERE id = ?')
    .run(word_group_id ? Number(word_group_id) : null, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// GET /api/task12/words/groups
router.get('/words/groups', (_req, res) => {
  const words = db.prepare(`
    SELECT id, word_display, correct_vowel AS correct_letter, vowel_pair, conjugation, word_group_id
    FROM task12_words WHERE word_group_id IS NOT NULL ORDER BY word_group_id, id
  `).all();
  const groups = {};
  for (const w of words) {
    groups[w.word_group_id] ??= [];
    groups[w.word_group_id].push(w);
  }
  res.json(Object.entries(groups).map(([id, words]) => ({ id: Number(id), words })));
});

// DELETE /api/task12/words/:id
router.delete('/words/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task12_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

/* ─── ГОТОВЫЕ ЗАДАНИЯ (админ) ────────────────────────────── */

router.get('/tasks', (_req, res) => {
  res.json(db.prepare('SELECT id, is_generated, created_at FROM task12_tasks WHERE is_practice = 0 ORDER BY created_at DESC').all());
});

router.post('/tasks', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 строк' });
  for (const row of rows) {
    if (!Array.isArray(row.word_ids) || row.word_ids.length !== WORDS_PER_ROW)
      return res.status(400).json({ error: `В каждой строке должно быть ${WORDS_PER_ROW} слова` });
  }
  const correctCount = rows.filter(r => r.is_correct).length;
  if (correctCount < 2 || correctCount > 5)
    return res.status(400).json({ error: 'Правильных строк должно быть от 2 до 5' });
  const uniqErr = validateUniqueWords(rows);
  if (uniqErr) return res.status(400).json({ error: uniqErr });
  const create = db.transaction(() => {
    const { lastInsertRowid: taskId } = db.prepare('INSERT INTO task12_tasks (is_generated) VALUES (0)').run();
    saveTaskRows(taskId, rows);
    return taskId;
  });
  res.json({ id: create() });
});

router.get('/tasks/:id/solution', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  const rows = task.rows.map(row => ({
    row_index: row.row_index,
    is_correct: !!row.is_correct,
    words: row.words.map(w => ({
      word_id: w.word_id,
      word_display: w.word_display,
      correct_letter: w.correct_letter,
      vowel_pair: w.vowel_pair,
      conjugation: w.conjugation,
      form_type: w.form_type,
      base_verb: w.base_verb,
      rule: w.rule,
    })),
  }));
  const correct_line_numbers = task.rows.filter(r => r.is_correct).map(r => r.row_index).sort((a, b) => a - b);
  res.json({ rows, correct_line_numbers });
});

router.get('/tasks/:id', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(task);
});

router.put('/tasks/:id', (req, res) => {
  const exists = db.prepare('SELECT 1 FROM task12_tasks WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Задание не найдено' });
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 строк' });
  for (const row of rows) {
    if (!Array.isArray(row.word_ids) || row.word_ids.length !== WORDS_PER_ROW)
      return res.status(400).json({ error: `В каждой строке должно быть ${WORDS_PER_ROW} слова` });
  }
  const correctCount = rows.filter(r => r.is_correct).length;
  if (correctCount < 2 || correctCount > 5)
    return res.status(400).json({ error: 'Правильных строк должно быть от 2 до 5' });
  const uniqErr = validateUniqueWords(rows);
  if (uniqErr) return res.status(400).json({ error: uniqErr });
  const update = db.transaction(() => {
    db.prepare('DELETE FROM task12_rows WHERE task_id = ?').run(req.params.id);
    saveTaskRows(req.params.id, rows);
  });
  update();
  res.json({ ok: true });
});

router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task12_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── ГЕНЕРАЦИЯ ──────────────────────────────────────────── */
// Группировка по vowel_pair + correct_letter.
// Правильная строка: WORDS_PER_ROW слова одной пары с одной буквой, из разных word_group_id.
// Неправильная строка: та же пара, разные буквы (по одному слову из двух разных букв).

router.post('/generate', (req, res) => {
  let {
    vowel_pairs,
    form_types,
    correct_count = 3,
    correct_counts,
    tasks_count = 1,
    is_practice = false,
  } = req.body;
  const practiceFlag = is_practice ? 1 : 0;

  const selectedPairs = Array.isArray(vowel_pairs)
    ? vowel_pairs.map(String).map(s => s.trim()).filter(Boolean)
    : [];

  const selectedFormTypes = Array.isArray(form_types)
    ? form_types.map(String).filter(Boolean)
    : [];

  let allowedCorrectCounts;
  if (Array.isArray(correct_counts)) {
    const raw = correct_counts.map(String).map(s => s.trim()).filter(Boolean);
    if (raw.includes('any_2_4')) {
      allowedCorrectCounts = [2, 3, 4];
    } else {
      allowedCorrectCounts = [...new Set(
        raw.map(Number).filter(n => Number.isInteger(n) && n >= 2 && n <= 5)
      )];
    }
  } else if (correct_count === 'any_2_4') {
    allowedCorrectCounts = [2, 3, 4];
  } else {
    const n = Number(correct_count);
    allowedCorrectCounts = Number.isInteger(n) && n >= 2 && n <= 5 ? [n] : [];
  }
  if (!allowedCorrectCounts.length)
    return res.status(400).json({
      error: 'Нужно выбрать 2, 3, 4, 5 или вариант any_2_4 (любое от 2 до 4)',
    });

  tasks_count = Number(tasks_count);
  if (!Number.isInteger(tasks_count) || tasks_count < 1 || tasks_count > 20)
    return res.status(400).json({ error: 'tasks_count должен быть от 1 до 20' });

  // Загружаем слова
  let sql = `SELECT *, correct_vowel AS correct_letter FROM task12_words WHERE word_display != ''`;
  const params = [];
  if (selectedPairs.length) {
    sql += ` AND vowel_pair IN (${selectedPairs.map(() => '?').join(',')})`;
    params.push(...selectedPairs);
  }
  if (selectedFormTypes.length) {
    sql += ` AND form_type IN (${selectedFormTypes.map(() => '?').join(',')})`;
    params.push(...selectedFormTypes);
  }
  const allWords = db.prepare(sql).all(...params);

  const targetUserId = resolveWeakUserFromReq(req);
  const weakIds = targetUserId ? getWeakWordIds(targetUserId, 'task12_words') : new Set();
  const newIds = targetUserId ? getNewWordIds(targetUserId, 'task12_words') : new Set();

  // Группируем: { 'е/и': { 'е': [...], 'и': [...] }, 'у/а': { 'у': [...], 'а': [...] }, ... }
  const grouped = {};
  for (const w of allWords) {
    grouped[w.vowel_pair] ??= {};
    grouped[w.vowel_pair][w.correct_letter] ??= [];
    grouped[w.vowel_pair][w.correct_letter].push(w);
  }

  // Пары где хватает слов для правильной строки (≥ WORDS_PER_ROW слов одной буквы)
  const validForCorrect = [];
  for (const [pair, byLetter] of Object.entries(grouped)) {
    for (const [letter, words] of Object.entries(byLetter)) {
      if (words.length >= WORDS_PER_ROW) validForCorrect.push({ pair, letter, words });
    }
  }

  // Для неправильной строки: ≥2 слова в паре, ≥2 разных буквы
  const validForIncorrect = [];
  for (const [pair, byLetter] of Object.entries(grouped)) {
    const allInPair = Object.values(byLetter).flat();
    const letters = Object.keys(byLetter);
    if (allInPair.length >= WORDS_PER_ROW && letters.length >= 2) {
      validForIncorrect.push({ pair, byLetter, allInPair });
    }
  }

  function pickRandom(arr, n) {
    return pickWeighted(arr, n, weakIds, 3, newIds, 2);
  }

  function buildRowsForOneTask() {
    const cc = allowedCorrectCounts[Math.floor(Math.random() * allowedCorrectCounts.length)];
    const usedWordIds = new Set();
    const rows = [];

    function useWord(w) {
      usedWordIds.add(w.id);
      if (w.word_group_id) {
        allWords
          .filter(x => x.word_group_id === w.word_group_id && x.id !== w.id)
          .forEach(x => usedWordIds.add(x.id));
      }
    }

    // Правильные строки
    for (let i = 0; i < cc; i++) {
      const candidates = validForCorrect.filter(
        vp => vp.words.filter(w => !usedWordIds.has(w.id)).length >= WORDS_PER_ROW
      );
      if (!candidates.length) throw new Error(
        'Недостаточно уникальных слов для правильных строк (каждое слово в задании только один раз)'
      );
      const vp = candidates[Math.floor(Math.random() * candidates.length)];
      const available = vp.words.filter(w => !usedWordIds.has(w.id));
      const picked = pickRandom(available, WORDS_PER_ROW);
      picked.forEach(useWord);
      rows.push({ row_index: 0, is_correct: 1, word_ids: picked.map(w => w.id) });
    }

    // Неправильные строки
    const wrongCount = 5 - cc;
    for (let i = 0; i < wrongCount; i++) {
      if (!validForIncorrect.length) throw new Error('Недостаточно слов для неправильных строк');

      const shuffledPairs = [...validForIncorrect].sort(() => Math.random() - 0.5);
      let solved = null;
      for (const { byLetter } of shuffledPairs) {
        const letters = Object.keys(byLetter);
        if (letters.length < 2) continue;
        const pool0 = byLetter[letters[0]].filter(w => !usedWordIds.has(w.id));
        const pool1 = byLetter[letters[1]].filter(w => !usedWordIds.has(w.id));
        if (!pool0.length || !pool1.length) continue;
        const a = pool0[Math.floor(Math.random() * pool0.length)];
        const b = pool1[Math.floor(Math.random() * pool1.length)];
        solved = [a, b];
        break;
      }
      if (!solved) throw new Error(
        'Недостаточно уникальных слов для неправильных строк'
      );
      solved.forEach(useWord);
      rows.push({ row_index: 0, is_correct: 0, word_ids: solved.map(w => w.id) });
    }

    rows.sort(() => Math.random() - 0.5);
    rows.forEach((r, i) => { r.row_index = i + 1; });
    return rows;
  }

  try {
    const ids = db.transaction(() => {
      const createdIds = [];
      for (let i = 0; i < tasks_count; i++) {
        const rows = buildRowsForOneTask();
        const { lastInsertRowid: taskId } = db.prepare(
          'INSERT INTO task12_tasks (is_generated, is_practice) VALUES (1, ?)'
        ).run(practiceFlag);
        saveTaskRows(taskId, rows);
        createdIds.push(taskId);
      }
      return createdIds;
    })();
    res.json({ id: ids[0], ids, count: ids.length });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Не удалось сгенерировать задания' });
  }
});

/* ─── РЕШЕНИЕ (ученик) ───────────────────────────────────── */

router.get('/tasks/:id/play', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  const safeRows = task.rows.map(row => ({
    id: row.id,
    row_index: row.row_index,
    words: row.words.map(w => ({
      word_id: w.word_id,
      word_display: w.word_display,
      cell_index: w.cell_index,
    }))
  }));
  res.json({ id: task.id, rows: safeRows });
});

router.post('/tasks/:id/check', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const userRows = req.body.rows;
  if (!Array.isArray(userRows))
    return res.status(400).json({ error: 'Неверный формат ответа' });

  const resultRows = task.rows.map(row => {
    const userRow = userRows.find(r => r.row_id === row.id) || { selected: false, letters: [] };
    const selectionCorrect = (userRow.selected ? 1 : 0) === row.is_correct;

    const words = row.words.map(w => {
      const userLetter = (userRow.letters || []).find(l => l.word_id === w.word_id);
      const letter = userLetter ? userLetter.letter.trim().toLowerCase() : '';
      return {
        word_id: w.word_id,
        word_display: w.word_display,
        cell_index: w.cell_index,
        user_letter: letter,
        correct_letter: w.correct_letter,
        letter_correct: letter === w.correct_letter.toLowerCase(),
        vowel_pair: w.vowel_pair,
        conjugation: w.conjugation,
        form_type: w.form_type,
        base_verb: w.base_verb,
        rule: w.rule,
      };
    });

    return {
      row_id: row.id,
      row_index: row.row_index,
      is_correct: row.is_correct,
      user_selected: userRow.selected || false,
      selection_correct: selectionCorrect,
      words,
    };
  });

  const lettersTotal   = resultRows.reduce((s, r) => s + r.words.length, 0);
  const lettersCorrect = resultRows.reduce((s, r) => s + r.words.filter(w => w.letter_correct).length, 0);
  const rowsCorrect    = resultRows.every(r => r.selection_correct);

  // Отслеживаем прогресс ученика
  const userInfo = getUserIdFromReq(req);
  if (userInfo) {
    for (const row of resultRows) {
      for (const w of row.words) {
        updateWordProgress(userInfo.id, 'task12_words', w.word_id, w.letter_correct);
      }
    }
    logTaskCompletion(userInfo.id, 'task12_words');
  }

  res.json({ rows: resultRows, letters_correct: lettersCorrect, letters_total: lettersTotal, rows_correct: rowsCorrect });
});

export default router;
