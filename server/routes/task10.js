import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, updateWordProgress, logTaskCompletion, getWeakWordIds, getNewWordIds, pickWeighted, resolveWeakUserFromReq } from './progress.js';

const router = Router();

/* ─── утилиты ─────────────────────────────────────────────── */

function getTaskWithRows(taskId) {
  const task = db.prepare('SELECT * FROM task10_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const rows = db.prepare('SELECT * FROM task10_rows WHERE task_id = ? ORDER BY row_index').all(taskId);
  for (const row of rows) {
    row.words = db.prepare(`
      SELECT tc.cell_index, w.id AS word_id,
             w.prefix_display, w.correct_letter, w.rule
      FROM task10_cells tc
      JOIN task10_words w ON w.id = tc.word_id
      WHERE tc.row_id = ?
      ORDER BY tc.cell_index
    `).all(row.id);
  }
  task.rows = rows;
  return task;
}

function saveTaskRows(taskId, rows) {
  const insertRow  = db.prepare('INSERT INTO task10_rows (task_id, row_index, is_correct) VALUES (?, ?, ?)');
  const insertCell = db.prepare('INSERT INTO task10_cells (row_id, cell_index, word_id) VALUES (?, ?, ?)');
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
  const { rule } = req.query;
  let sql = 'SELECT * FROM task10_words WHERE 1=1';
  const params = [];
  if (rule) { sql += ' AND rule = ?'; params.push(rule); }
  sql += ' ORDER BY rule, correct_letter, prefix_display';
  res.json(db.prepare(sql).all(...params));
});

router.post('/words', (req, res) => {
  const { prefix_display, correct_letter, rule } = req.body;
  if (!prefix_display || !correct_letter || !rule)
    return res.status(400).json({ error: 'prefix_display, correct_letter и rule обязательны' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO task10_words (prefix_display, correct_letter, rule) VALUES (?, ?, ?)'
  ).run(prefix_display.trim(), correct_letter.trim().toLowerCase(), rule);
  res.json({ id: lastInsertRowid });
});

router.put('/words/:id', (req, res) => {
  const { prefix_display, correct_letter, rule } = req.body;
  if (!prefix_display || !correct_letter || !rule)
    return res.status(400).json({ error: 'prefix_display, correct_letter и rule обязательны' });
  const r = db.prepare(
    'UPDATE task10_words SET prefix_display=?, correct_letter=?, rule=? WHERE id=?'
  ).run(prefix_display.trim(), correct_letter.trim().toLowerCase(), rule, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

router.delete('/words/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task10_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

/* ─── ГОТОВЫЕ ЗАДАНИЯ (админ) ────────────────────────────── */

router.get('/tasks', (_req, res) => {
  res.json(db.prepare('SELECT id, is_generated, created_at FROM task10_tasks WHERE is_practice = 0 ORDER BY created_at DESC').all());
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
    const { lastInsertRowid: taskId } = db.prepare('INSERT INTO task10_tasks (is_generated) VALUES (0)').run();
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
    db.prepare('DELETE FROM task10_rows WHERE task_id = ?').run(req.params.id);
    saveTaskRows(req.params.id, rows);
  });
  update();
  res.json({ ok: true });
});

router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task10_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── ГЕНЕРАЦИЯ ───────────────────────────────────────────── */

router.post('/generate', (req, res) => {
  let { rule, rules, correct_count = 3, correct_counts, tasks_count = 1, is_practice = false } = req.body;
  const practiceFlag = is_practice ? 1 : 0;

  const selectedRules = Array.isArray(rules)
    ? rules.map(String).map((s) => s.trim()).filter(Boolean)
    : (rule ? [String(rule).trim()] : []);

  let allowedCorrectCounts;
  if (Array.isArray(correct_counts)) {
    const raw = correct_counts.map(String).map((s) => s.trim()).filter(Boolean);
    if (raw.includes('any_2_4')) {
      allowedCorrectCounts = [2, 3, 4];
    } else {
      allowedCorrectCounts = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 4))];
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

  let sql = 'SELECT * FROM task10_words WHERE 1=1';
  const params = [];
  if (selectedRules.length) {
    sql += ` AND rule IN (${selectedRules.map(() => '?').join(',')})`;
    params.push(...selectedRules);
  }
  const allWords = db.prepare(sql).all(...params);

  const targetUserId = resolveWeakUserFromReq(req);
  const weakIds = targetUserId ? getWeakWordIds(targetUserId, 'task10_words') : new Set();
  const newIds = targetUserId ? getNewWordIds(targetUserId, 'task10_words') : new Set();

  // Группируем по правилу, внутри правила — по правильной букве.
  const byRule = {};
  for (const w of allWords) {
    byRule[w.rule] ??= {};
    byRule[w.rule][w.correct_letter] ??= [];
    byRule[w.rule][w.correct_letter].push(w);
  }

  // Для правильной строки: 3 слова одного правила и одной буквы.
  const validForCorrect = [];
  for (const [ruleName, byLetter] of Object.entries(byRule)) {
    for (const [letter, words] of Object.entries(byLetter)) {
      if (words.length >= 3) validForCorrect.push({ ruleName, letter, words });
    }
  }

  // Для неправильной строки: 3 слова одного правила, но не все с одной буквой.
  const validForIncorrect = [];
  for (const [ruleName, byLetter] of Object.entries(byRule)) {
    const letters = Object.keys(byLetter);
    const allInRule = Object.values(byLetter).flat();
    if (letters.length >= 2 && allInRule.length >= 3) {
      validForIncorrect.push({ ruleName, byLetter, allInRule });
    }
  }

  function pickRandom(arr, n) {
    return pickWeighted(arr, n, weakIds, 3, newIds, 2);
  }

  function buildRowsForOneTask() {
    const correct_count = allowedCorrectCounts[Math.floor(Math.random() * allowedCorrectCounts.length)];
    const usedWordIds = new Set();
    const rows = [];

    for (let i = 0; i < correct_count; i++) {
      const candidates = validForCorrect.filter(
        vl => vl.words.filter(w => !usedWordIds.has(w.id)).length >= 3
      );
      if (!candidates.length)
        throw new Error('Недостаточно уникальных слов для правильных строк');

      const vl = candidates[Math.floor(Math.random() * candidates.length)];
      const three = pickRandom(vl.words.filter(w => !usedWordIds.has(w.id)), 3);
      three.forEach(w => usedWordIds.add(w.id));
      rows.push({ row_index: 0, is_correct: 1, word_ids: three.map(w => w.id) });
    }

    const wrongCount = 5 - correct_count;
    if (wrongCount > 0) {
      if (!validForIncorrect.length)
        throw new Error('Недостаточно правил для некорректных строк (нужно минимум 2 буквы внутри одного правила)');

      for (let i = 0; i < wrongCount; i++) {
        let solved = null;
        const shuffledRules = [...validForIncorrect].sort(() => Math.random() - 0.5);

        for (const { byLetter, allInRule } of shuffledRules) {
          const letters = Object.keys(byLetter);
          if (letters.length < 2) continue;

          const shuffledLetters = [...letters].sort(() => Math.random() - 0.5);
          const pool0 = byLetter[shuffledLetters[0]].filter(w => !usedWordIds.has(w.id));
          const pool1 = byLetter[shuffledLetters[1]].filter(w => !usedWordIds.has(w.id));
          if (!pool0.length || !pool1.length) continue;

          const a = pool0[Math.floor(Math.random() * pool0.length)];
          const bPool = pool1.filter(w => w.id !== a.id);
          if (!bPool.length) continue;
          const b = bPool[Math.floor(Math.random() * bPool.length)];

          const cPool = allInRule.filter(w =>
            !usedWordIds.has(w.id) && w.id !== a.id && w.id !== b.id
          );
          if (!cPool.length) continue;

          const c = cPool[Math.floor(Math.random() * cPool.length)];
          if (a.correct_letter === b.correct_letter && b.correct_letter === c.correct_letter) continue;
          solved = [a, b, c];
          break;
        }

        if (!solved)
          throw new Error('Недостаточно уникальных слов, чтобы собрать некорректные строки внутри одного правила');

        solved.forEach(w => usedWordIds.add(w.id));
        rows.push({ row_index: 0, is_correct: 0, word_ids: solved.map(w => w.id) });
      }
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
        const { lastInsertRowid: taskId } = db.prepare('INSERT INTO task10_tasks (is_generated, is_practice) VALUES (1, ?)').run(practiceFlag);
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
      word_id:        w.word_id,
      prefix_display: w.prefix_display,
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
      prefix_display: w.prefix_display,
      correct_letter: w.correct_letter,
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
      const letter = userLetter ? userLetter.letter.trim().toLowerCase() : '';
      return {
        word_id:        w.word_id,
        prefix_display: w.prefix_display,
        cell_index:     w.cell_index,
        user_letter:    letter,
        correct_letter: w.correct_letter,
        letter_correct: letter === w.correct_letter.toLowerCase()
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
        updateWordProgress(userInfo.id, 'task10_words', w.word_id, w.letter_correct);
      }
    }
    logTaskCompletion(userInfo.id, 'task10_words');
  }

  res.json({ rows: resultRows, letters_correct: lettersCorrect, letters_total: lettersTotal, rows_correct: rowsCorrect });
});

export default router;
