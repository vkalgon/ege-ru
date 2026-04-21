// server/routes/variant.js — генерация вариантов ЕГЭ
import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Конфиг доступных типов заданий
export const TASK_CONFIG = {
  task4:  { table: 'task4_tasks',  urlPrefix: '/task4',  label: 'Ударения',                          num: 4  },
  task5:  { table: 'task5_tasks',  urlPrefix: '/task5',  label: 'Паронимы',                          num: 5  },
  task7:  { table: 'task7_tasks',  urlPrefix: '/task7',  label: 'Морфологические нормы',              num: 7  },
  task9:  { table: 'task9_tasks',  urlPrefix: '/task9',  label: 'Правописание корней',               num: 9  },
  task10: { table: 'task10_tasks', urlPrefix: '/task10', label: 'Правописание приставок',            num: 10 },
  task11: { table: 'task11_tasks', urlPrefix: '/task11', label: 'Правописание суффиксов',            num: 11 },
  task12: { table: 'task12_tasks', urlPrefix: '/task12', label: 'Правописание НЕ и НИ',             num: 12 },
  task17: { table: 'task17',       urlPrefix: '/task17', label: 'Знаки препинания (обороты)',        num: 17 },
  task18: { table: 'task18_tasks', urlPrefix: '/task18', label: 'Вводные слова',                     num: 18 },
  task19: { table: 'task19_tasks', urlPrefix: '/task19', label: 'Сложноподчинённые предложения',     num: 19 },
};

/* ──────────────────────────────────────────────────────────────
   GET /api/variant/config
   Возвращает список типов заданий с количеством доступных задач
────────────────────────────────────────────────────────────── */
router.get('/config', (_req, res) => {
  const result = [];
  for (const [key, cfg] of Object.entries(TASK_CONFIG)) {
    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${cfg.table}`).get();
    result.push({
      key,
      num:   cfg.num,
      label: cfg.label,
      count: row.cnt,
    });
  }
  res.json(result);
});

/* ──────────────────────────────────────────────────────────────
   POST /api/variant/generate
   body: { task4: 2, task9: 3, ... }
   Генерирует вариант, сохраняет в variants, возвращает { id }
────────────────────────────────────────────────────────────── */
router.post('/generate', (req, res) => {
  const body = req.body || {};
  const tasks = [];

  for (const [key, cfg] of Object.entries(TASK_CONFIG)) {
    const count = Math.min(parseInt(body[key] || 0, 10), 10);
    if (!count || count < 1) continue;

    const rows = db.prepare(
      `SELECT id FROM ${cfg.table} ORDER BY RANDOM() LIMIT ?`
    ).all(count);

    for (const row of rows) {
      tasks.push({ type: key, taskId: row.id });
    }
  }

  if (tasks.length === 0) {
    return res.status(400).json({ error: 'Выберите хотя бы одно задание' });
  }

  // Перемешиваем задания по порядку номера типа, чтобы вариант шёл по нарастающей
  tasks.sort((a, b) => TASK_CONFIG[a.type].num - TASK_CONFIG[b.type].num);

  const result = db.prepare(
    `INSERT INTO variants (tasks_json) VALUES (?)`
  ).run(JSON.stringify(tasks));

  res.json({ id: result.lastInsertRowid });
});

/* ──────────────────────────────────────────────────────────────
   POST /api/variant/from-tasks
   body: { tasks: [{ type: 'task9', taskId: 123 }, ...] }
   Создаёт вариант из уже сгенерированных задач (конструктор ДЗ)
────────────────────────────────────────────────────────────── */
router.post('/from-tasks', (req, res) => {
  const body = req.body || {};
  const rawTasks = Array.isArray(body.tasks) ? body.tasks : [];

  if (!rawTasks.length) {
    return res.status(400).json({ error: 'Список заданий пуст' });
  }

  const tasks = [];
  for (const t of rawTasks) {
    const type = t?.type;
    const cfg = TASK_CONFIG[type];
    const taskId = Number(t?.taskId);
    if (!cfg || !taskId || taskId <= 0) continue;
    tasks.push({ type, taskId });
  }

  if (!tasks.length) {
    return res.status(400).json({ error: 'Нет валидных заданий для варианта' });
  }

  // Сортируем по номеру задания, как в обычном генераторе
  tasks.sort((a, b) => TASK_CONFIG[a.type].num - TASK_CONFIG[b.type].num);

  const result = db.prepare(
    `INSERT INTO variants (tasks_json) VALUES (?)`
  ).run(JSON.stringify(tasks));

  res.json({ id: result.lastInsertRowid });
});

/* ──────────────────────────────────────────────────────────────
   GET /api/variant/:id
   Возвращает вариант с обогащёнными данными задач
────────────────────────────────────────────────────────────── */
router.get('/:id', (req, res) => {
  const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(req.params.id);
  if (!variant) return res.status(404).json({ error: 'not found' });

  const rawTasks = JSON.parse(variant.tasks_json);
  const tasks = rawTasks.map((t, i) => {
    const cfg = TASK_CONFIG[t.type];
    return {
      index:  i + 1,
      type:   t.type,
      taskId: t.taskId,
      num:    cfg ? cfg.num : null,
      label:  cfg ? cfg.label : t.type,
      url:    cfg ? `${cfg.urlPrefix}/${t.taskId}` : null,
    };
  });

  res.json({ id: variant.id, created_at: variant.created_at, tasks });
});

export default router;
