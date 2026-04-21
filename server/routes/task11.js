import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, updateWordProgress, logTaskCompletion, getWeakWordIds, getNewWordIds, pickWeighted, resolveWeakUserFromReq } from './progress.js';

const router = Router();

/* ─── утилиты ─────────────────────────────────────────────── */

function getTaskWithRows(taskId) {
  const task = db.prepare('SELECT * FROM task11_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const rows = db.prepare('SELECT * FROM task11_rows WHERE task_id = ? ORDER BY row_index').all(taskId);
  for (const row of rows) {
    row.words = db.prepare(`
      SELECT tc.cell_index, w.id AS word_id,
             w.suffix_display, w.correct_vowel, w.suffix
      FROM task11_cells tc
      JOIN task11_words w ON w.id = tc.word_id
      WHERE tc.row_id = ?
      ORDER BY tc.cell_index
    `).all(row.id);
  }
  task.rows = rows;
  return task;
}

function saveTaskRows(taskId, rows) {
  const insertRow  = db.prepare('INSERT INTO task11_rows (task_id, row_index, is_correct) VALUES (?, ?, ?)');
  const insertCell = db.prepare('INSERT INTO task11_cells (row_id, cell_index, word_id) VALUES (?, ?, ?)');
  for (const row of rows) {
    const { lastInsertRowid: rowId } = insertRow.run(taskId, row.row_index, row.is_correct ? 1 : 0);
    for (let i = 0; i < row.word_ids.length; i++) {
      insertCell.run(rowId, i + 1, row.word_ids[i]);
    }
  }
}

function validateUniqueWords(rows) {
  const ids = rows.flatMap(r => r.word_ids || []).map(Number);
  if (ids.some(id => !Number.isInteger(id) || id < 1)) return 'Некорректный идентификатор слова';
  if (new Set(ids).size !== ids.length) return 'Одно и то же слово не может встречаться в задании дважды';
  return null;
}

/* ─── СЛОВАРЬ СЛОВ (админ) ───────────────────────────────── */

router.get('/words', (req, res) => {
  const { suffix } = req.query;
  let sql = 'SELECT * FROM task11_words WHERE 1=1';
  const params = [];
  if (suffix) { sql += ' AND suffix = ?'; params.push(suffix); }
  sql += ' ORDER BY suffix, correct_vowel, suffix_display';
  res.json(db.prepare(sql).all(...params));
});

router.post('/words', (req, res) => {
  const { suffix_display, correct_vowel, suffix, part_of_speech, category, vowel_pair } = req.body;
  if (!suffix_display || correct_vowel == null || !suffix || !part_of_speech || !category || !vowel_pair)
    return res.status(400).json({ error: 'Все поля обязательны' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO task11_words (suffix_display, correct_vowel, suffix, part_of_speech, category, vowel_pair) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(suffix_display.trim(), String(correct_vowel).trim().toLowerCase(), suffix, part_of_speech, category, vowel_pair);
  res.json({ id: lastInsertRowid });
});

router.put('/words/:id', (req, res) => {
  const { suffix_display, correct_vowel, suffix, part_of_speech, category, vowel_pair } = req.body;
  if (!suffix_display || correct_vowel == null || !suffix || !part_of_speech || !category || !vowel_pair)
    return res.status(400).json({ error: 'Все поля обязательны' });
  const r = db.prepare(
    'UPDATE task11_words SET suffix_display=?, correct_vowel=?, suffix=?, part_of_speech=?, category=?, vowel_pair=? WHERE id=?'
  ).run(suffix_display.trim(), String(correct_vowel).trim().toLowerCase(), suffix, part_of_speech, category, vowel_pair, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

router.delete('/words/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task11_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

/* ─── ГОТОВЫЕ ЗАДАНИЯ (админ) ────────────────────────────── */

router.get('/tasks', (_req, res) => {
  res.json(db.prepare('SELECT id, is_generated, created_at FROM task11_tasks WHERE is_practice = 0 ORDER BY created_at DESC').all());
});

router.post('/tasks', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 строк' });
  for (const row of rows) {
    if (!Array.isArray(row.word_ids) || row.word_ids.length !== 3)
      return res.status(400).json({ error: 'В каждой строке должно быть 3 слова' });
  }
  const correct = rows.filter(r => r.is_correct).length;
  if (correct < 2 || correct > 5)
    return res.status(400).json({ error: 'Правильных строк должно быть от 2 до 5' });
  const uniqErr = validateUniqueWords(rows);
  if (uniqErr) return res.status(400).json({ error: uniqErr });

  const create = db.transaction(() => {
    const { lastInsertRowid: taskId } = db.prepare('INSERT INTO task11_tasks (is_generated) VALUES (0)').run();
    saveTaskRows(taskId, rows);
    return taskId;
  });
  res.json({ id: create() });
});

router.get('/tasks/:id', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(task);
});

router.put('/tasks/:id', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 строк' });
  const uniqErr = validateUniqueWords(rows);
  if (uniqErr) return res.status(400).json({ error: uniqErr });
  const update = db.transaction(() => {
    db.prepare('DELETE FROM task11_rows WHERE task_id = ?').run(req.params.id);
    saveTaskRows(req.params.id, rows);
  });
  update();
  res.json({ ok: true });
});

router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task11_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── ГЕНЕРАЦИЯ ───────────────────────────────────────────── */

router.post('/generate', (req, res) => {
  let { suffix, rules, correct_count = 3, correct_counts, tasks_count = 1, is_practice = false } = req.body;
  const practiceFlag = is_practice ? 1 : 0;

  const selectedRules = Array.isArray(rules)
    ? rules.map(String).map(s => s.trim()).filter(Boolean)
    : (suffix ? [String(suffix).trim()] : []);

  let allowedCorrectCounts;
  if (Array.isArray(correct_counts)) {
    const raw = correct_counts.map(String).map(s => s.trim()).filter(Boolean);
    if (raw.includes('any_2_4')) {
      allowedCorrectCounts = [2, 3, 4];
    } else {
      allowedCorrectCounts = [...new Set(raw.map(Number).filter(n => Number.isInteger(n) && n >= 2 && n <= 4))];
    }
  } else if (correct_count === 'any_2_4') {
    allowedCorrectCounts = [2, 3, 4];
  } else {
    const n = Number(correct_count);
    allowedCorrectCounts = Number.isInteger(n) && n >= 2 && n <= 4 ? [n] : [];
  }
  if (!allowedCorrectCounts.length)
    return res.status(400).json({ error: 'Нужно выбрать 2, 3, 4 или вариант any_2_4' });

  tasks_count = Number(tasks_count);
  if (!Number.isInteger(tasks_count) || tasks_count < 1 || tasks_count > 20)
    return res.status(400).json({ error: 'tasks_count должен быть от 1 до 20' });

  let sql = 'SELECT * FROM task11_words WHERE 1=1';
  const params = [];
  if (selectedRules.length === 1) { sql += ' AND suffix = ?'; params.push(selectedRules[0]); }
  else if (selectedRules.length > 1) {
    sql += ' AND suffix IN (' + selectedRules.map(() => '?').join(',') + ')';
    params.push(...selectedRules);
  }
  const allWords = db.prepare(sql).all(...params);

  const targetUserId = resolveWeakUserFromReq(req);
  const weakIds = targetUserId ? getWeakWordIds(targetUserId, 'task11_words') : new Set();
  const newIds = targetUserId ? getNewWordIds(targetUserId, 'task11_words') : new Set();

  const byVowel = {};
  for (const w of allWords) {
    byVowel[w.correct_vowel] ??= [];
    byVowel[w.correct_vowel].push(w);
  }
  const vowelKeys = Object.keys(byVowel);

  function pickRandom(arr, n) {
    return pickWeighted(arr, n, weakIds, 3, newIds, 2);
  }

  function generateOne(correct_count) {
    const validForCorrect = Object.entries(byVowel)
      .filter(([, words]) => words.length >= 3)
      .map(([vowel, words]) => ({ vowel, words }));

    const usedWordIds = new Set();
    const rows = [];

    for (let i = 0; i < correct_count; i++) {
      const candidates = validForCorrect.filter(
        vl => vl.words.filter(w => !usedWordIds.has(w.id)).length >= 3
      );
      if (!candidates.length) return { error: 'Недостаточно уникальных слов для правильных строк' };

      const vl = candidates[Math.floor(Math.random() * candidates.length)];
      const three = pickRandom(vl.words.filter(w => !usedWordIds.has(w.id)), 3);
      three.forEach(w => usedWordIds.add(w.id));
      rows.push({ row_index: 0, is_correct: 1, word_ids: three.map(w => w.id) });
    }

    const wrongCount = 5 - correct_count;
    if (wrongCount > 0) {
      if (vowelKeys.length < 2) return { error: 'Недостаточно вариантов букв для некорректных строк' };

      for (let i = 0; i < wrongCount; i++) {
        let solved = null;
        const shuffled = [...vowelKeys].sort(() => Math.random() - 0.5);

        for (let attempt = 0; attempt < 30 && !solved; attempt++) {
          const pool0 = byVowel[shuffled[0]].filter(w => !usedWordIds.has(w.id));
          const pool1 = byVowel[shuffled[1 % shuffled.length]].filter(w => !usedWordIds.has(w.id));
          if (!pool0.length || !pool1.length) break;

          const a = pool0[Math.floor(Math.random() * pool0.length)];
          const bPool = pool1.filter(w => w.id !== a.id);
          if (!bPool.length) continue;
          const b = bPool[Math.floor(Math.random() * bPool.length)];

          const cPool = allWords.filter(w => !usedWordIds.has(w.id) && w.id !== a.id && w.id !== b.id);
          if (!cPool.length) continue;
          const c = cPool[Math.floor(Math.random() * cPool.length)];

          if (a.correct_vowel === b.correct_vowel && b.correct_vowel === c.correct_vowel) continue;
          solved = [a, b, c];
        }

        if (!solved) return { error: 'Недостаточно уникальных слов для некорректных строк' };
        solved.forEach(w => usedWordIds.add(w.id));
        rows.push({ row_index: 0, is_correct: 0, word_ids: solved.map(w => w.id) });
      }
    }

    rows.sort(() => Math.random() - 0.5);
    rows.forEach((r, idx) => { r.row_index = idx + 1; });
    return { rows };
  }

  const create = db.transaction(() => {
    let lastId = null;
    for (let t = 0; t < tasks_count; t++) {
      const cc = allowedCorrectCounts[Math.floor(Math.random() * allowedCorrectCounts.length)];
      const result = generateOne(cc);
      if (result.error) throw Object.assign(new Error(result.error), { clientError: true });
      const { lastInsertRowid: taskId } = db.prepare('INSERT INTO task11_tasks (is_generated, is_practice) VALUES (1, ?)').run(practiceFlag);
      saveTaskRows(taskId, result.rows);
      lastId = taskId;
    }
    return lastId;
  });

  try {
    const id = create();
    res.json({ id, count: tasks_count });
  } catch (err) {
    if (err.clientError) return res.status(400).json({ error: err.message });
    throw err;
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
      word_id:        w.word_id,
      suffix_display: w.suffix_display,
      cell_index:     w.cell_index
    }))
  }));
  res.json({ id: task.id, rows: safeRows });
});

router.get('/tasks/:id/solution', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  const correct_line_numbers = task.rows
    .filter(r => r.is_correct)
    .map(r => r.row_index)
    .sort((a, b) => a - b);
  const rows = task.rows.map(row => ({
    row_index: row.row_index,
    is_correct: !!row.is_correct,
    words: row.words.map(w => ({
      word_id: w.word_id,
      suffix_display: w.suffix_display,
      correct_vowel: w.correct_vowel,
    })),
  }));
  res.json({ correct_line_numbers, rows });
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
      const letter = userLetter ? String(userLetter.letter).trim().toLowerCase() : '';
      return {
        word_id:        w.word_id,
        suffix_display: w.suffix_display,
        cell_index:     w.cell_index,
        user_letter:    letter,
        correct_vowel:  w.correct_vowel,
        letter_correct: letter === w.correct_vowel.toLowerCase()
      };
    });
    return {
      row_id: row.id, row_index: row.row_index,
      is_correct: row.is_correct, user_selected: userRow.selected || false,
      selection_correct: selectionCorrect, words
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
        updateWordProgress(userInfo.id, 'task11_words', w.word_id, w.letter_correct);
      }
    }
    logTaskCompletion(userInfo.id, 'task11_words');
  }

  res.json({ rows: resultRows, letters_correct: lettersCorrect, letters_total: lettersTotal, rows_correct: rowsCorrect });
});

export default router;
