import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, updateWordProgress, logTaskCompletion, getWeakWordIds, getNewWordIds, pickWeighted, resolveWeakUserFromReq } from './progress.js';

const router = Router();

/* ─── утилиты ─────────────────────────────────────────────── */

function getTaskWithRows(taskId) {
  const task = db.prepare('SELECT * FROM task9_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const rows = db.prepare('SELECT * FROM task9_rows WHERE task_id = ? ORDER BY row_index').all(taskId);
  for (const row of rows) {
    const cells = db.prepare(`
      SELECT tc.cell_index, w.id AS word_id, w.word_display, w.correct_vowel, w.vowel_pair, w.category,
             w.verification_word, w.alternation_rule
      FROM task9_cells tc
      JOIN task9_words w ON w.id = tc.word_id
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
    'INSERT INTO task9_rows (task_id, row_index, is_correct) VALUES (?, ?, ?)'
  );
  const insertCell = db.prepare(
    'INSERT INTO task9_cells (row_id, cell_index, word_id) VALUES (?, ?, ?)'
  );
  for (const row of rows) {
    const { lastInsertRowid: rowId } = insertRow.run(taskId, row.row_index, row.is_correct ? 1 : 0);
    for (let i = 0; i < row.word_ids.length; i++) {
      insertCell.run(rowId, i + 1, row.word_ids[i]);
    }
  }
}

/** Во всём задании каждый word_id встречается не более одного раза. */
function validateTask9UniqueWords(rows) {
  const ids = [];
  for (const row of rows) {
    if (!Array.isArray(row.word_ids)) continue;
    for (const raw of row.word_ids) {
      const id = Number(raw);
      if (!Number.isInteger(id) || id < 1) return 'Некорректный идентификатор слова';
      ids.push(id);
    }
  }
  const set = new Set(ids);
  if (set.size !== ids.length) {
    return 'Одно и то же слово не может встречаться в задании дважды';
  }
  return null;
}

/* ─── СЛОВАРЬ СЛОВ (админ) ───────────────────────────────── */

// GET /api/task9/alternation-types — карта типов чередования и их корней
router.get('/alternation-types', (_req, res) => {
  res.json(ALTERNATION_TYPE_RULES);
});

// GET /api/task9/words
router.get('/words', (req, res) => {
  const { category, vowel_pair } = req.query;
  let sql = 'SELECT * FROM task9_words WHERE 1=1';
  const params = [];
  if (category)   { sql += ' AND category = ?';   params.push(category); }
  if (vowel_pair) { sql += ' AND vowel_pair = ?';  params.push(vowel_pair); }
  sql += ' ORDER BY word_display COLLATE NOCASE';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/task9/words
router.post('/words', (req, res) => {
  const { word_display, correct_vowel, vowel_pair, category, verification_word, alternation_rule, word_group_id } = req.body;
  if (!word_display || !correct_vowel || !vowel_pair || !category)
    return res.status(400).json({ error: 'Все поля обязательны' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO task9_words (word_display, correct_vowel, vowel_pair, category, verification_word, alternation_rule, word_group_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(word_display.trim(), correct_vowel.trim(), vowel_pair.trim(), category,
    verification_word?.trim() || null, alternation_rule || null,
    word_group_id ? Number(word_group_id) : null);
  res.json({ id: lastInsertRowid });
});

// PUT /api/task9/words/:id
router.put('/words/:id', (req, res) => {
  const { word_display, correct_vowel, vowel_pair, category, verification_word, alternation_rule, word_group_id } = req.body;
  if (!word_display || !correct_vowel || !vowel_pair || !category)
    return res.status(400).json({ error: 'Все поля обязательны' });
  const r = db.prepare(
    'UPDATE task9_words SET word_display=?, correct_vowel=?, vowel_pair=?, category=?, verification_word=?, alternation_rule=?, word_group_id=? WHERE id=?'
  ).run(word_display.trim(), correct_vowel.trim(), vowel_pair.trim(), category,
    verification_word?.trim() || null, alternation_rule || null,
    word_group_id ? Number(word_group_id) : null,
    req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// POST /api/task9/words/new-group  — создать новую группу и назначить слово
router.post('/words/new-group', (req, res) => {
  const { word_id } = req.body;
  if (!word_id) return res.status(400).json({ error: 'word_id обязателен' });
  // Новый group_id = max(word_group_id) + 1
  const row = db.prepare('SELECT MAX(word_group_id) AS mx FROM task9_words').get();
  const newGroupId = (row.mx || 0) + 1;
  db.prepare('UPDATE task9_words SET word_group_id = ? WHERE id = ?').run(newGroupId, word_id);
  res.json({ word_group_id: newGroupId });
});

// PUT /api/task9/words/:id/group  — назначить слово в группу (или снять: group_id=null)
router.put('/words/:id/group', (req, res) => {
  const { word_group_id } = req.body;
  const r = db.prepare('UPDATE task9_words SET word_group_id = ? WHERE id = ?')
    .run(word_group_id ? Number(word_group_id) : null, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// GET /api/task9/words/groups  — все группы со словами
router.get('/words/groups', (_req, res) => {
  const words = db.prepare(
    'SELECT id, word_display, correct_vowel, word_group_id FROM task9_words WHERE word_group_id IS NOT NULL ORDER BY word_group_id, id'
  ).all();
  // Собираем в Map: groupId → [words]
  const groups = {};
  for (const w of words) {
    groups[w.word_group_id] ??= [];
    groups[w.word_group_id].push(w);
  }
  res.json(Object.entries(groups).map(([id, words]) => ({ id: Number(id), words })));
});

// DELETE /api/task9/words/:id
router.delete('/words/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task9_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

/* ─── ГОТОВЫЕ ЗАДАНИЯ (админ) ────────────────────────────── */

// GET /api/task9/tasks
router.get('/tasks', (_req, res) => {
  const tasks = db.prepare(
    'SELECT id, is_generated, created_at FROM task9_tasks WHERE is_practice = 0 ORDER BY created_at DESC'
  ).all();
  res.json(tasks);
});

// POST /api/task9/tasks  — создать готовое задание
router.post('/tasks', (req, res) => {
  const { rows } = req.body; // [{row_index, is_correct, word_ids:[id,id,id]}, ...]
  if (!Array.isArray(rows) || rows.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 строк' });
  for (const row of rows) {
    if (!Array.isArray(row.word_ids) || row.word_ids.length !== 3)
      return res.status(400).json({ error: 'В каждой строке должно быть 3 слова' });
  }
  const correctCount = rows.filter(r => r.is_correct).length;
  if (correctCount < 2 || correctCount > 5)
    return res.status(400).json({ error: 'Правильных строк должно быть от 2 до 5' });

  const uniqErr = validateTask9UniqueWords(rows);
  if (uniqErr) return res.status(400).json({ error: uniqErr });

  const create = db.transaction(() => {
    const { lastInsertRowid: taskId } = db.prepare(
      'INSERT INTO task9_tasks (is_generated) VALUES (0)'
    ).run();
    saveTaskRows(taskId, rows);
    return taskId;
  });
  res.json({ id: create() });
});

// GET /api/task9/tasks/:id/solution — ответ и пояснения по словарю (без игровой сессии)
router.get('/tasks/:id/solution', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  const rows = task.rows.map((row) => ({
    row_index: row.row_index,
    is_correct: !!row.is_correct,
    words: row.words.map((w) => ({
      word_id: w.word_id,
      word_display: w.word_display,
      correct_vowel: w.correct_vowel,
      vowel_pair: w.vowel_pair,
      category: w.category,
      verification_word: w.verification_word,
      alternation_rule: w.alternation_rule,
    })),
  }));
  const correct_line_numbers = task.rows
    .filter((r) => r.is_correct)
    .map((r) => r.row_index)
    .sort((a, b) => a - b);
  res.json({ rows, correct_line_numbers });
});

// GET /api/task9/tasks/:id
router.get('/tasks/:id', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(task);
});

// PUT /api/task9/tasks/:id
router.put('/tasks/:id', (req, res) => {
  const exists = db.prepare('SELECT 1 FROM task9_tasks WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Задание не найдено' });

  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 строк' });
  for (const row of rows) {
    if (!Array.isArray(row.word_ids) || row.word_ids.length !== 3)
      return res.status(400).json({ error: 'В каждой строке должно быть 3 слова' });
  }
  const correctCount = rows.filter((r) => r.is_correct).length;
  if (correctCount < 2 || correctCount > 5)
    return res.status(400).json({ error: 'Правильных строк должно быть от 2 до 5' });

  const uniqErr = validateTask9UniqueWords(rows);
  if (uniqErr) return res.status(400).json({ error: uniqErr });

  const update = db.transaction(() => {
    db.prepare('DELETE FROM task9_rows WHERE task_id = ?').run(req.params.id);
    saveTaskRows(req.params.id, rows);
  });
  update();
  res.json({ ok: true });
});

// DELETE /api/task9/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task9_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── ГЕНЕРАЦИЯ (ученик / админ) ─────────────────────────── */

/** Классификация корней с чередованием по типу правила. */
export const ALTERNATION_TYPE_RULES = {
  stress:    ['гар/гор', 'зар/зор', 'клан/клон', 'твар/твор'],
  suffix:    ['бир/бер', 'блест/блист', 'дир/дер', 'жиг/жег', 'им/ин', 'мир/мер', 'пир/пер', 'стел/стил', 'тир/тер', 'чет/чит'],
  consonant: ['кас/кос', 'лаг/лож', 'раст/рос', 'скак/скоч'],
  meaning:   ['мак/мок', 'равн/ровн', 'плав/плов/плыв'],
};

// POST /api/task9/generate
router.post('/generate', (req, res) => {
  let {
    category,
    categories,
    vowel_pair,
    vowel_pairs,
    correct_count = 3,
    correct_counts,
    tasks_count = 1,
    alternation_types,
    alternation_rules,
    is_practice = false,
  } = req.body;
  const practiceFlag = is_practice ? 1 : 0;

  const selectedCategories = Array.isArray(categories)
    ? categories.map(String).map((s) => s.trim()).filter(Boolean)
    : (category ? [String(category).trim()] : []);

  const selectedPairs = Array.isArray(vowel_pairs)
    ? vowel_pairs.map(String).map((s) => s.trim()).filter(Boolean)
    : (vowel_pair ? [String(vowel_pair).trim()] : []);

  let allowedCorrectCounts;
  if (Array.isArray(correct_counts)) {
    allowedCorrectCounts = [...new Set(
      correct_counts.map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 5)
    )];
  } else {
    const n = Number(correct_count);
    allowedCorrectCounts = Number.isInteger(n) && n >= 2 && n <= 5 ? [n] : [];
  }
  if (!allowedCorrectCounts.length)
    return res.status(400).json({ error: 'Нужно выбрать количество правильных строк от 2 до 5' });

  tasks_count = Number(tasks_count);
  if (!Number.isInteger(tasks_count) || tasks_count < 1 || tasks_count > 20)
    return res.status(400).json({ error: 'tasks_count должен быть от 1 до 20' });

  // Вычисляем фильтр по конкретным корням чередования
  // Приоритет: явные корни > типы > без фильтра
  let effectiveRules = [];
  if (Array.isArray(alternation_rules) && alternation_rules.length) {
    effectiveRules = alternation_rules.map(String).filter(Boolean);
  } else if (Array.isArray(alternation_types) && alternation_types.length) {
    for (const t of alternation_types) {
      effectiveRules.push(...(ALTERNATION_TYPE_RULES[t] || []));
    }
  }

  // Загружаем подходящие слова
  let sql = 'SELECT * FROM task9_words WHERE 1=1';
  const params = [];
  if (selectedCategories.length) {
    sql += ` AND category IN (${selectedCategories.map(() => '?').join(',')})`;
    params.push(...selectedCategories);
  }
  if (selectedPairs.length) {
    sql += ` AND vowel_pair IN (${selectedPairs.map(() => '?').join(',')})`;
    params.push(...selectedPairs);
  }
  // Фильтр по корням чередования применяется только к словам категории 'alternating'
  if (effectiveRules.length) {
    sql += ` AND (category != 'alternating' OR alternation_rule IN (${effectiveRules.map(() => '?').join(',')}))`;
    params.push(...effectiveRules);
  }
  const allWords = db.prepare(sql).all(...params);

  // Слабые слова ученика (для приоритизации); учитель может передать for_student_id
  const targetUserId = resolveWeakUserFromReq(req);
  const weakIds = targetUserId ? getWeakWordIds(targetUserId, 'task9_words') : new Set();
  const newIds = targetUserId ? getNewWordIds(targetUserId, 'task9_words') : new Set();

  // Группируем: { 'о/а': { 'о': [...], 'а': [...] }, ... }
  const grouped = {};
  for (const w of allWords) {
    grouped[w.vowel_pair] ??= {};
    grouped[w.vowel_pair][w.correct_vowel] ??= [];
    grouped[w.vowel_pair][w.correct_vowel].push(w);
  }

  // Пары, у которых хватает слов для корректной строки (≥3 слов одной буквы)
  const validPairsForCorrect = [];
  for (const [pair, byVowel] of Object.entries(grouped)) {
    for (const [vowel, words] of Object.entries(byVowel)) {
      if (words.length >= 3) validPairsForCorrect.push({ pair, vowel, words });
    }
  }
  // Пары, у которых хватает слов для некорректной строки (≥3 слов, смешанные буквы)
  const validPairsForIncorrect = [];
  for (const [pair, byVowel] of Object.entries(grouped)) {
    const allInPair = Object.values(byVowel).flat();
    const vowels = Object.keys(byVowel);
    if (allInPair.length >= 3 && vowels.length >= 2) {
      validPairsForIncorrect.push({ pair, byVowel, allInPair });
    }
  }

  function pickRandom(arr, n) {
    return pickWeighted(arr, n, weakIds, 3, newIds, 2);
  }

  function buildRowsForOneTask() {
    const correct_count = allowedCorrectCounts[Math.floor(Math.random() * allowedCorrectCounts.length)];
    const usedWordIds = new Set();
    const rows = [];

    /** Добавляет слово и блокирует все слова из той же группы вариантов */
    function useWord(w) {
      usedWordIds.add(w.id);
      if (w.word_group_id) {
        allWords
          .filter((x) => x.word_group_id === w.word_group_id && x.id !== w.id)
          .forEach((x) => usedWordIds.add(x.id));
      }
    }

    for (let i = 0; i < correct_count; i++) {
      const candidates = validPairsForCorrect.filter(
        (vp) => vp.words.filter((w) => !usedWordIds.has(w.id)).length >= 3
      );
      if (candidates.length === 0) {
        throw new Error(
          'Недостаточно уникальных слов для правильных строк (каждое слово в задании только один раз)'
        );
      }
      const vp = candidates[Math.floor(Math.random() * candidates.length)];
      const available = vp.words.filter((w) => !usedWordIds.has(w.id));
      const three = pickRandom(available, 3);
      three.forEach(useWord);
      rows.push({ row_index: 0, is_correct: 1, word_ids: three.map((w) => w.id) });
    }

    const wrongCount = 5 - correct_count;
    if (wrongCount > 0) {
      if (validPairsForIncorrect.length === 0) {
        throw new Error('Недостаточно слов для некорректных строк');
      }
      for (let i = 0; i < wrongCount; i++) {
        const shuffledPairs = [...validPairsForIncorrect].sort(() => Math.random() - 0.5);
        let solved = null;
        for (const { byVowel } of shuffledPairs) {
          const vowels = Object.keys(byVowel);
          if (vowels.length < 2) continue;
          const pool0 = byVowel[vowels[0]].filter((w) => !usedWordIds.has(w.id));
          const pool1 = byVowel[vowels[1]].filter((w) => !usedWordIds.has(w.id));
          if (!pool0.length || !pool1.length) continue;
          const a = pool0[Math.floor(Math.random() * pool0.length)];
          const bOpts = pool1.filter((w) => w.id !== a.id);
          if (!bOpts.length) continue;
          const b = bOpts[Math.floor(Math.random() * bOpts.length)];
          const thirdPool = Object.values(byVowel)
            .flat()
            .filter((w) => !usedWordIds.has(w.id) && w.id !== a.id && w.id !== b.id);
          if (!thirdPool.length) continue;
          const c = thirdPool[Math.floor(Math.random() * thirdPool.length)];
          solved = [a, b, c];
          break;
        }
        if (!solved) {
          throw new Error(
            'Недостаточно уникальных слов для некорректных строк (каждое слово в задании только один раз)'
          );
        }
        solved.forEach(useWord);
        rows.push({ row_index: 0, is_correct: 0, word_ids: solved.map((w) => w.id) });
      }
    }

    rows.sort(() => Math.random() - 0.5);
    rows.forEach((r, i) => {
      r.row_index = i + 1;
    });
    return rows;
  }

  try {
    const ids = db.transaction(() => {
      const createdIds = [];
      for (let i = 0; i < tasks_count; i++) {
        const rows = buildRowsForOneTask();
        const { lastInsertRowid: taskId } = db.prepare(
          'INSERT INTO task9_tasks (is_generated, is_practice) VALUES (1, ?)'
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

// GET /api/task9/tasks/:id/play  — задание без правильных ответов
router.get('/tasks/:id/play', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  // Убираем правильные ответы
  const safeRows = task.rows.map(row => ({
    id: row.id,
    row_index: row.row_index,
    words: row.words.map(w => ({
      word_id: w.word_id,
      word_display: w.word_display,
      cell_index: w.cell_index
    }))
  }));
  res.json({ id: task.id, rows: safeRows });
});

// POST /api/task9/tasks/:id/check
router.post('/tasks/:id/check', (req, res) => {
  const task = getTaskWithRows(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  // req.body.rows: [{row_id, selected: bool, letters: [{word_id, letter}]}]
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
        correct_letter: w.correct_vowel,
        letter_correct: letter === w.correct_vowel.toLowerCase()
      };
    });

    return {
      row_id: row.id,
      row_index: row.row_index,
      is_correct: row.is_correct,
      user_selected: userRow.selected || false,
      selection_correct: selectionCorrect,
      words
    };
  });

  const lettersTotal = resultRows.reduce((s, r) => s + r.words.length, 0);
  const lettersCorrect = resultRows.reduce((s, r) => s + r.words.filter(w => w.letter_correct).length, 0);
  const rowsCorrect = resultRows.every(r => r.selection_correct);

  // Отслеживаем прогресс ученика
  const userInfo = getUserIdFromReq(req);
  if (userInfo) {
    for (const row of resultRows) {
      for (const w of row.words) {
        updateWordProgress(userInfo.id, 'task9_words', w.word_id, w.letter_correct);
      }
    }
    logTaskCompletion(userInfo.id, 'task9_words');
  }

  res.json({ rows: resultRows, letters_correct: lettersCorrect, letters_total: lettersTotal, rows_correct: rowsCorrect });
});

export default router;
