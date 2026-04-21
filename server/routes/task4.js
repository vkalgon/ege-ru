import { Router } from 'express';
import db from '../db.js';
import { getUserIdFromReq, updateWordProgress, logTaskCompletion, getWeakWordIds, getNewWordIds, pickWeighted, resolveWeakUserFromReq } from './progress.js';

const router = Router();

/** Описания категорий: правило + пример. Используются в ответе /check и /categories. */
export const CATEGORIES = {
  past_fem_verb: {
    name: 'Глаголы прош. вр. женского рода',
    rule: 'Ударение падает на окончание -А: бралА, гналА, позвалА.',
    example: 'бралА, началА, позвалА',
  },
  short_part_fem: {
    name: 'Краткие страдательные причастия ж.р.',
    rule: 'Ударение падает на окончание -А: занятА, запертА, снятА.',
    example: 'занятА, запертА, налитА',
  },
  verb_it: {
    name: 'Глаголы на -ИТЬ (спряжение)',
    rule: 'При спряжении ударение падает на окончание: -ИШЬ, -ИТ, -ИМ, -ИТЕ, -АТ/-ЯТ.',
    example: 'звонИт, сверлИшь, включИт',
  },
  verb_from_adj: {
    name: 'Глаголы от прилагательных',
    rule: 'Ударение чаще всего падает на -ИТЬ: убыстрИть, облегчИть, углубИть.',
    example: 'убыстрИть, углубИть, обострИть',
  },
  active_part_vsh: {
    name: 'Действит. причастия с -ВШ-',
    rule: 'Ударение падает на гласную перед суффиксом -ВШ-: начАвший, понЯвший.',
    example: 'начАвший, понЯвший, нажИвший',
  },
  part_bent: {
    name: 'Причастия от загнуть/согнуть/изогнуть',
    rule: 'Ударение падает на приставку: зАгнутый, сОгнутый, изОгнутый.',
    example: 'зАгнутый, сОгнутый, изОгнутый',
  },
  part_enn: {
    name: 'Причастия с суффиксом -ЁНН-',
    rule: 'Ударение всегда на Ё в полной форме; в краткой ж.р. переходит на окончание -А.',
    example: 'включЁнный, заселенА, отключЁн',
  },
  bal_root: {
    name: 'Слова с корнем БАЛ-',
    rule: 'Ударение НЕ на корень БАЛ: баловАть, балУясь, балОванный.',
    example: 'баловАть, балУясь, избалОванный',
  },
  gerund_vsh: {
    name: 'Деепричастия с -ВШ-/-ВШИ-',
    rule: 'Ударение падает на гласную перед суффиксом -ВШ-: начАв, понЯв, создАв.',
    example: 'начАв, поднЯв, прибЫв',
  },
  foreign_noun: {
    name: 'Существительные иностр. происхождения',
    rule: 'Ударение, как правило, на последнем слоге: дефИс, каталОг, квартАл.',
    example: 'дефИс, диспансЕр, жалюзИ',
  },
  deverbal_noun: {
    name: 'Отглагольные существительные',
    rule: 'Ударение совпадает с глаголом: обеспЕчить → обеспЕчение; провОд → водопровОд.',
    example: 'вероисповЕдание, водопровОд, обеспЕчение',
  },
  fixed_stress: {
    name: 'Неподвижное ударение на корне',
    rule: 'Ударение не меняется во всех формах числа и падежа: тОрт — тОрты — тОртов.',
    example: 'тОрты, бАнты, шАрфы, крАны',
  },
  adj_from_noun: {
    name: 'Прилагательные от существительных',
    rule: 'Ударение совпадает с исходным существительным: слИва → слИвовый; кУхня → кУхонный.',
    example: 'слИвовый, кУхонный',
  },
  krasivee: {
    name: 'Степени сравнения «красИвый»',
    rule: 'Ударение неизменно на И: красИвый → красИвее → красИвейший.',
    example: 'красИвее, красИвейший',
  },
  adv_do: {
    name: 'Наречия с ДО-',
    rule: 'Ударение на приставку ДО: дОверху, дОнизу, дОсуха. Исключения: добелА, донЕльзя, докраснА.',
    example: 'дОверху, дОнизу, дОсуха',
  },
  adv_za: {
    name: 'Наречия с ЗА-',
    rule: 'Ударение на приставку ЗА: зАгодя, зАсветло, зАтемно. Исключение: завИдно.',
    example: 'зАгодя, зАсветло, зАтемно',
  },
  other: {
    name: 'Орфоэпический минимум',
    rule: 'Слово из орфоэпического минимума ЕГЭ. Необходимо запомнить.',
    example: '',
  },
};

/** Вставляет объединяющий знак ударения U+0301 после символа на позиции charIndex. */
function addStress(word, charIndex) {
  return word.slice(0, charIndex + 1) + '\u0301' + word.slice(charIndex + 1);
}

function getTaskWithItems(taskId) {
  const task = db.prepare('SELECT * FROM task4_tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const items = db.prepare(`
    SELECT ti.id, ti.item_index, ti.is_correct,
           w.id AS word_id, w.word, w.correct_stress_index, w.wrong_stress_index,
           w.hint, w.category, w.is_exception, w.part_of_speech
    FROM task4_items ti
    JOIN task4_words w ON w.id = ti.word_id
    WHERE ti.task_id = ?
    ORDER BY ti.item_index
  `).all(taskId);
  task.items = items;
  return task;
}

/* ─── КАТЕГОРИИ ──────────────────────────────────────────── */

// GET /api/task4/categories
router.get('/categories', (_req, res) => {
  res.json(
    Object.entries(CATEGORIES).map(([key, val]) => ({ key, ...val }))
  );
});

/* ─── СЛОВАРЬ СЛОВ ───────────────────────────────────────── */

// GET /api/task4/words?category=&is_exception=
router.get('/words', (req, res) => {
  let sql = 'SELECT * FROM task4_words WHERE 1=1';
  const params = [];
  if (req.query.category) { sql += ' AND category = ?'; params.push(req.query.category); }
  if (req.query.is_exception != null && req.query.is_exception !== '')
    { sql += ' AND is_exception = ?'; params.push(Number(req.query.is_exception)); }
  sql += ' ORDER BY category, word COLLATE NOCASE';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/task4/words
router.post('/words', (req, res) => {
  const { word, correct_stress_index, wrong_stress_index, hint, category, is_exception, part_of_speech } = req.body;
  if (!word || correct_stress_index == null || wrong_stress_index == null)
    return res.status(400).json({ error: 'word, correct_stress_index, wrong_stress_index обязательны' });
  const w = word.trim();
  const ci = Number(correct_stress_index);
  const wi = Number(wrong_stress_index);
  if (!Number.isInteger(ci) || ci < 0 || ci >= w.length)
    return res.status(400).json({ error: 'Некорректный индекс правильного ударения' });
  if (!Number.isInteger(wi) || wi < 0 || wi >= w.length)
    return res.status(400).json({ error: 'Некорректный индекс ошибочного ударения' });
  if (ci === wi)
    return res.status(400).json({ error: 'Индексы правильного и ошибочного ударения должны различаться' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO task4_words (word, correct_stress_index, wrong_stress_index, hint, category, is_exception, part_of_speech) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(w, ci, wi, hint?.trim() || null, category || 'other', is_exception ? 1 : 0, part_of_speech || 'other');
  res.json({ id: lastInsertRowid });
});

// PUT /api/task4/words/:id
router.put('/words/:id', (req, res) => {
  const { word, correct_stress_index, wrong_stress_index, hint, category, is_exception, part_of_speech } = req.body;
  if (!word || correct_stress_index == null || wrong_stress_index == null)
    return res.status(400).json({ error: 'word, correct_stress_index, wrong_stress_index обязательны' });
  const w = word.trim();
  const ci = Number(correct_stress_index);
  const wi = Number(wrong_stress_index);
  if (!Number.isInteger(ci) || ci < 0 || ci >= w.length)
    return res.status(400).json({ error: 'Некорректный индекс правильного ударения' });
  if (!Number.isInteger(wi) || wi < 0 || wi >= w.length)
    return res.status(400).json({ error: 'Некорректный индекс ошибочного ударения' });
  if (ci === wi)
    return res.status(400).json({ error: 'Индексы правильного и ошибочного ударения должны различаться' });
  const r = db.prepare(
    'UPDATE task4_words SET word=?, correct_stress_index=?, wrong_stress_index=?, hint=?, category=?, is_exception=?, part_of_speech=? WHERE id=?'
  ).run(w, ci, wi, hint?.trim() || null, category || 'other', is_exception ? 1 : 0, part_of_speech || 'other', req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

// DELETE /api/task4/words/:id
router.delete('/words/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task4_words WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Слово не найдено' });
  res.json({ ok: true });
});

/* ─── ЗАДАНИЯ ────────────────────────────────────────────── */

// GET /api/task4/tasks
router.get('/tasks', (_req, res) => {
  res.json(db.prepare('SELECT id, is_generated, created_at FROM task4_tasks ORDER BY created_at DESC').all());
});

// POST /api/task4/tasks  — создать задание вручную
router.post('/tasks', (req, res) => {
  const { items } = req.body; // [{word_id, is_correct}] × 5
  if (!Array.isArray(items) || items.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 позиций' });
  const correctCount = items.filter(i => i.is_correct).length;
  if (correctCount < 2 || correctCount > 4)
    return res.status(400).json({ error: 'Правильных слов должно быть от 2 до 4' });
  const wordIds = items.map(i => Number(i.word_id));
  if (new Set(wordIds).size !== 5)
    return res.status(400).json({ error: 'Все 5 слов должны быть разными' });

  const create = db.transaction(() => {
    const { lastInsertRowid: taskId } = db.prepare('INSERT INTO task4_tasks (is_generated) VALUES (0)').run();
    const ins = db.prepare('INSERT INTO task4_items (task_id, item_index, word_id, is_correct) VALUES (?, ?, ?, ?)');
    items.forEach((item, i) => ins.run(taskId, i + 1, Number(item.word_id), item.is_correct ? 1 : 0));
    return taskId;
  });
  res.json({ id: create() });
});

// GET /api/task4/tasks/:id
router.get('/tasks/:id', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  res.json(task);
});

// PUT /api/task4/tasks/:id
router.put('/tasks/:id', (req, res) => {
  const exists = db.prepare('SELECT 1 FROM task4_tasks WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'Задание не найдено' });
  const { items } = req.body;
  if (!Array.isArray(items) || items.length !== 5)
    return res.status(400).json({ error: 'Нужно ровно 5 позиций' });
  const correctCount = items.filter(i => i.is_correct).length;
  if (correctCount < 2 || correctCount > 4)
    return res.status(400).json({ error: 'Правильных слов должно быть от 2 до 4' });
  const wordIds = items.map(i => Number(i.word_id));
  if (new Set(wordIds).size !== 5)
    return res.status(400).json({ error: 'Все 5 слов должны быть разными' });

  const update = db.transaction(() => {
    db.prepare('DELETE FROM task4_items WHERE task_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO task4_items (task_id, item_index, word_id, is_correct) VALUES (?, ?, ?, ?)');
    items.forEach((item, i) => ins.run(req.params.id, i + 1, Number(item.word_id), item.is_correct ? 1 : 0));
  });
  update();
  res.json({ ok: true });
});

// DELETE /api/task4/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const r = db.prepare('DELETE FROM task4_tasks WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Задание не найдено' });
  res.json({ ok: true });
});

/* ─── РЕЖИМ ИГРЫ (ученик) ────────────────────────────────── */

// GET /api/task4/tasks/:id/play  — без правильных ответов
router.get('/tasks/:id/play', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });
  const safeItems = task.items.map(item => {
    const stressIndex = item.is_correct ? item.correct_stress_index : item.wrong_stress_index;
    return {
      id: item.id,
      item_index: item.item_index,
      word_id: item.word_id,
      word: item.word,
      word_stressed: addStress(item.word, stressIndex),
    };
  });
  res.json({ id: task.id, items: safeItems });
});

// POST /api/task4/tasks/:id/check
router.post('/tasks/:id/check', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const { selected } = req.body; // array of item_index values user thinks are correct
  if (!Array.isArray(selected))
    return res.status(400).json({ error: 'selected должен быть массивом индексов' });

  const selectedSet = new Set(selected.map(Number));

  const resultItems = task.items.map(item => {
    const userThinkCorrect = selectedSet.has(item.item_index);
    const actualCorrect = !!item.is_correct;
    const catInfo = CATEGORIES[item.category] || CATEGORIES.other;
    return {
      item_index: item.item_index,
      word: item.word,
      word_stressed: addStress(item.word, item.is_correct ? item.correct_stress_index : item.wrong_stress_index),
      correct_stressed: addStress(item.word, item.correct_stress_index),
      is_correct: actualCorrect,
      user_selected: userThinkCorrect,
      item_ok: userThinkCorrect === actualCorrect,
      hint: item.hint,
      category: item.category,
      is_exception: !!item.is_exception,
      category_name: catInfo.name,
      category_rule: catInfo.rule,
    };
  });

  const correct_indices = task.items
    .filter(i => i.is_correct)
    .map(i => i.item_index)
    .sort((a, b) => a - b);
  const all_correct = resultItems.every(i => i.item_ok);

  // Отслеживаем прогресс ученика
  const userInfo = getUserIdFromReq(req);
  if (userInfo) {
    for (const item of resultItems) {
      const taskItem = task.items.find(i => i.item_index === item.item_index);
      if (taskItem) {
        updateWordProgress(userInfo.id, 'task4_words', taskItem.word_id, item.item_ok);
      }
    }
    logTaskCompletion(userInfo.id, 'task4_words');
  }

  res.json({ items: resultItems, correct_indices, all_correct });
});

// GET /api/task4/tasks/:id/solution
router.get('/tasks/:id/solution', (req, res) => {
  const task = getTaskWithItems(req.params.id);
  if (!task) return res.status(404).json({ error: 'Задание не найдено' });

  const correct_indices = task.items
    .filter(i => i.is_correct)
    .map(i => i.item_index)
    .sort((a, b) => a - b);

  const items = task.items.map(item => {
    const catInfo = CATEGORIES[item.category] || CATEGORIES.other;
    return {
      item_index: item.item_index,
      word: item.word,
      word_stressed: addStress(item.word, item.correct_stress_index),
      is_correct: !!item.is_correct,
      correct_stress_index: item.correct_stress_index,
      hint: item.hint,
      is_exception: !!item.is_exception,
      category_name: catInfo.name,
      category_rule: catInfo.rule,
    };
  });

  res.json({ correct_indices, items });
});

/* ─── ГЕНЕРАЦИЯ ──────────────────────────────────────────── */

// POST /api/task4/generate
router.post('/generate', (req, res) => {
  let { correct_count, correct_counts, tasks_count = 1, category } = req.body;

  let allowedCorrectCounts;
  if (Array.isArray(correct_counts) && correct_counts.length) {
    allowedCorrectCounts = [...new Set(
      correct_counts.map(Number).filter(n => Number.isInteger(n) && n >= 2 && n <= 4)
    )];
  } else {
    const n = Number(correct_count);
    allowedCorrectCounts = Number.isInteger(n) && n >= 2 && n <= 4 ? [n] : [2, 3, 4];
  }
  if (!allowedCorrectCounts.length)
    return res.status(400).json({ error: 'Правильных слов должно быть от 2 до 4' });

  tasks_count = Number(tasks_count);
  if (!Number.isInteger(tasks_count) || tasks_count < 1 || tasks_count > 20)
    return res.status(400).json({ error: 'tasks_count должен быть от 1 до 20' });

  let sql = 'SELECT * FROM task4_words';
  const sqlParams = [];
  if (category) { sql += ' WHERE category = ?'; sqlParams.push(category); }
  const allWords = db.prepare(sql).all(...sqlParams);
  if (allWords.length < 5)
    return res.status(400).json({ error: `Недостаточно слов в словаре: есть ${allWords.length}, нужно минимум 5` });

  const targetUserId = resolveWeakUserFromReq(req);
  const weakIds = targetUserId ? getWeakWordIds(targetUserId, 'task4_words') : new Set();
  const newIds = targetUserId ? getNewWordIds(targetUserId, 'task4_words') : new Set();

  try {
    const ids = db.transaction(() => {
      const createdIds = [];
      for (let t = 0; t < tasks_count; t++) {
        const cc = allowedCorrectCounts[Math.floor(Math.random() * allowedCorrectCounts.length)];
        // Выбираем 5 слов с приоритетом слабых
        const shuffled = pickWeighted(allWords, 5, weakIds, 3, newIds, 2);
        // Перемешиваем и назначаем is_correct первым cc словам
        shuffled.sort(() => Math.random() - 0.5);
        const items = shuffled.map((word, i) => ({
          word_id: word.id,
          is_correct: i < cc ? 1 : 0,
          item_index: i + 1,
        }));

        const { lastInsertRowid: taskId } = db.prepare(
          'INSERT INTO task4_tasks (is_generated) VALUES (1)'
        ).run();
        const ins = db.prepare(
          'INSERT INTO task4_items (task_id, item_index, word_id, is_correct) VALUES (?, ?, ?, ?)'
        );
        items.forEach(item => ins.run(taskId, item.item_index, item.word_id, item.is_correct));
        createdIds.push(taskId);
      }
      return createdIds;
    })();

    res.json({ id: ids[0], ids, count: ids.length });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Не удалось сгенерировать задания' });
  }
});

export default router;
