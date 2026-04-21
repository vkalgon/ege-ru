// server/routes/pages.js
import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import db from '../db.js';

const pages = Router();

// главная
pages.get('/', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'index.ejs'), {});
    res.render('pages/layout', { 
      title: 'ЕГЭ · Главная', 
      body,
      breadcrumbs: null // На главной странице breadcrumbs не нужны
    });
  } catch (err) {
    next(err);
  }
});

// страница "Презентация диплома"
pages.get('/presentation', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'presentation.ejs'), {});
    res.render('pages/layout', { 
      title: 'ЕГЭ · Презентация диплома', 
      body,
      breadcrumbs: [
        { title: 'Главная', url: '/' },
        { title: 'Презентация диплома' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Темы" — через общий лейаут с хеддером
pages.get('/subtopics', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'subtopics.ejs'), {});
    res.render('pages/layout', { 
      title: 'ЕГЭ · Темы', 
      body,
      breadcrumbs: [
        { title: 'Темы' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Теория"
pages.get('/theory', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'theory.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Теория',
      body,
      breadcrumbs: [{ title: 'Теория' }]
    });
  } catch (err) { next(err); }
});

// страница "Задания" — через общий лейаут с хеддером
pages.get('/tasks', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'tasks.ejs'), {});
    res.render('pages/layout', { 
      title: 'ЕГЭ · Задания', 
      body,
      breadcrumbs: [
        { title: 'Задания' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Профиль"
pages.get('/profile', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'profile.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Личный кабинет',
      body,
      breadcrumbs: [{ title: 'Личный кабинет' }]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Тренировка" — сессия из N заданий по ошибкам ученика
pages.get('/practice', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'practice.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Тренировка',
      body,
      breadcrumbs: [
        { title: 'Личный кабинет', url: '/profile' },
        { title: 'Тренировка' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Задание" — через общий лейаут с хеддером
pages.get('/assignment/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'assignment.ejs'), {});
    res.render('pages/layout', { 
      title: 'ЕГЭ · Задание', 
      body,
      breadcrumbs: [
        { title: 'Задания', url: '/tasks' },
        { title: `Задание #${req.params.id}` }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Админка" — через общий лейаут с хеддером
pages.get('/admin', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin.ejs'), { initialSection: null });
    res.render('pages/layout', {
      title: 'ЕГЭ · Администрирование',
      body,
      breadcrumbs: [
        { title: 'Администрирование' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Админка §17" — открывает admin.ejs сразу на вкладке task17
pages.get('/admin/task17', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin.ejs'), { initialSection: 'task17' });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №17',
      body,
      breadcrumbs: [
        { title: 'Администрирование', url: '/admin' },
        { title: 'Задание №17' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница редактирования задания — через общий лейаут с хеддером
pages.get('/admin/assignment/:id/edit', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-assignment-edit.ejs'), {
      assignmentId: req.params.id
    });
    res.render('pages/layout', { 
      title: 'ЕГЭ · Редактирование задания', 
      body,
      breadcrumbs: [
        { title: 'Администрирование', url: '/admin' },
        { title: 'Редактирование задания' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница управления текстами для заданий 1–3
pages.get('/admin/passages', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-passages.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Тексты для заданий 1–3',
      body,
      breadcrumbs: [
        { title: 'Администрирование', url: '/admin' },
        { title: 'Тексты для заданий 1–3' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница редактирования тем — через общий лейаут с хеддером
pages.get('/admin/subtopics/:typeId', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-subtopics.ejs'), {
      typeId: req.params.typeId
    });
    res.render('pages/layout', { 
      title: 'ЕГЭ · Управление темами', 
      body,
      breadcrumbs: [
        { title: 'Администрирование', url: '/admin' },
        { title: `Управление темами (№${req.params.typeId})` }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница "Вход" — через общий лейаут с хеддером
pages.get('/login', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'login.ejs'), {});
    res.render('pages/layout', { 
      title: 'ЕГЭ · Вход', 
      body,
      breadcrumbs: [
        { title: 'Вход' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница списка заданий №9
pages.get('/task9', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task9.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №9',
      body,
      breadcrumbs: [{ title: 'Задание №9' }]
    });
  } catch (err) { next(err); }
});

// теория задания №9 (до /task9/:id)
pages.get('/task9/theory', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task9-theory.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №9 — Теория',
      body,
      breadcrumbs: [
        { title: 'Задание №9', url: '/task9' },
        { title: 'Теория' }
      ]
    });
  } catch (err) { next(err); }
});

pages.get('/task9/theory/alternating', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task9-theory-alternating.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №9 — Чередующиеся корни',
      body,
      breadcrumbs: [
        { title: 'Задание №9', url: '/task9' },
        { title: 'Теория', url: '/task9/theory' },
        { title: 'Чередующиеся корни' }
      ]
    });
  } catch (err) { next(err); }
});

pages.get('/task9/theory/unverifiable', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task9-theory-unverifiable.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №9 — Словарные слова',
      body,
      breadcrumbs: [
        { title: 'Задание №9', url: '/task9' },
        { title: 'Теория', url: '/task9/theory' },
        { title: 'Словарные слова' }
      ]
    });
  } catch (err) { next(err); }
});

// генерация задания №9 (до /task9/:id, иначе :id перехватит «generate»)
pages.get('/task9/generate', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task9-generate.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №9 · Генерация',
      body,
      breadcrumbs: [
        { title: 'Задание №9', url: '/task9' },
        { title: 'Генерация' }
      ]
    });
  } catch (err) { next(err); }
});

// страница решения задания №9
pages.get('/task9/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task9-play.ejs'), {
      taskId: req.params.id
    });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №9',
      body,
      breadcrumbs: [
        { title: 'Задание №9', url: '/task9' },
        { title: `Задание #${req.params.id}` }
      ]
    });
  } catch (err) { next(err); }
});

// страница админки для задания №9
pages.get('/admin/task9', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task9.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Админка Задание №9',
      body,
      breadcrumbs: [
        { title: 'Администрирование', url: '/admin' },
        { title: 'Задание №9' }
      ]
    });
  } catch (err) { next(err); }
});

// страница списка заданий №10
pages.get('/task10', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task10.ejs'), {});
    res.render('pages/layout', { title: 'ЕГЭ · Задание №10', body, breadcrumbs: [{ title: 'Задание №10' }] });
  } catch (err) { next(err); }
});
pages.get('/task10/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task10-play.ejs'), { taskId: req.params.id });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №10', body,
      breadcrumbs: [{ title: 'Задание №10', url: '/task10' }, { title: `Задание #${req.params.id}` }]
    });
  } catch (err) { next(err); }
});
pages.get('/admin/task10', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task10.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Админка Задание №10', body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №10' }]
    });
  } catch (err) { next(err); }
});

// страница списка заданий №11
pages.get('/task11', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task11.ejs'), {});
    res.render('pages/layout', { title: 'ЕГЭ · Задание №11', body, breadcrumbs: [{ title: 'Задание №11' }] });
  } catch (err) { next(err); }
});
pages.get('/task11/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task11-play.ejs'), { taskId: req.params.id });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №11', body,
      breadcrumbs: [{ title: 'Задание №11', url: '/task11' }, { title: `Задание #${req.params.id}` }]
    });
  } catch (err) { next(err); }
});
pages.get('/admin/task11', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task11.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Админка Задание №11', body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №11' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task12', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task12.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №12', body,
      breadcrumbs: [{ title: 'Задание №12' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task12/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task12-play.ejs'), { taskId: req.params.id });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №12 #' + req.params.id, body,
      breadcrumbs: [{ title: 'Задание №12', url: '/task12' }, { title: `Задание #${req.params.id}` }]
    });
  } catch (err) { next(err); }
});

pages.get('/admin/task12', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task12.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Админка Задание №12', body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №12' }]
    });
  } catch (err) { next(err); }
});

// ── Задание №4: Ударения ────────────────────────────────────
pages.get('/task4', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task4.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №4',
      body,
      breadcrumbs: [{ title: 'Задание №4' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task4/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task4-play.ejs'), { taskId: req.params.id });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №4 #' + req.params.id,
      body,
      breadcrumbs: [{ title: 'Задание №4', url: '/task4' }, { title: `Задание #${req.params.id}` }]
    });
  } catch (err) { next(err); }
});

pages.get('/admin/task4', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task4.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Админка Задание №4',
      body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №4' }]
    });
  } catch (err) { next(err); }
});

// ── Задание №5: Паронимы ─────────────────────────────────────
pages.get('/task5', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task5.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №5',
      body,
      breadcrumbs: [{ title: 'Задание №5' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task5/theory', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task5-theory.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №5 — Теория',
      body,
      breadcrumbs: [{ title: 'Задание №5', url: '/task5' }, { title: 'Теория' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task5/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task5-play.ejs'), { taskId: req.params.id });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №5 #' + req.params.id,
      body,
      breadcrumbs: [{ title: 'Задание №5', url: '/task5' }, { title: `Задание #${req.params.id}` }]
    });
  } catch (err) { next(err); }
});

pages.get('/admin/task5', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task5.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Админка Задание №5',
      body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №5' }]
    });
  } catch (err) { next(err); }
});

// ── Задание №7: Морфологические нормы ───────────────────────
pages.get('/task7', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task7.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №7',
      body,
      breadcrumbs: [{ title: 'Задание №7' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task7/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task7-play.ejs'), { taskId: req.params.id });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №7 #' + req.params.id,
      body,
      breadcrumbs: [{ title: 'Задание №7', url: '/task7' }, { title: `Задание #${req.params.id}` }]
    });
  } catch (err) { next(err); }
});

pages.get('/admin/task7', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task7.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Админка Задание №7',
      body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №7' }]
    });
  } catch (err) { next(err); }
});

// страница списка заданий №17 - с интерактивными заданиями
pages.get('/task17', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task17.ejs'), {});
    res.render('pages/layout', { 
      title: 'ЕГЭ · Задание №17', 
      body,
      breadcrumbs: [
        { title: 'Задание №17' }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// страница решения задания №17
pages.get('/task17/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task17-play.ejs'), {
      taskId: req.params.id
    });
    res.render('pages/layout', { 
      title: 'ЕГЭ · Задание №17', 
      body,
      breadcrumbs: [
        { title: 'Задание №17', url: '/task17' },
        { title: `Решение задания #${req.params.id}` }
      ]
    });
  } catch (err) {
    next(err);
  }
});

// ── Задание №18: Вводные слова ──────────────────────────────
pages.get('/task18', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task18.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №18',
      body,
      breadcrumbs: [{ title: 'Задание №18' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task18/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task18-play.ejs'), {
      taskId: req.params.id
    });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №18',
      body,
      breadcrumbs: [
        { title: 'Задание №18', url: '/task18' },
        { title: `Задание #${req.params.id}` }
      ]
    });
  } catch (err) { next(err); }
});

pages.get('/admin/task16', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task16.ejs'), {});
    res.render('pages/layout', {
      title: 'Админ · Задание №16',
      body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №16' }]
    });
  } catch (err) { next(err); }
});

pages.get('/admin/task18', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task18.ejs'), {});
    res.render('pages/layout', {
      title: 'Админ · Задание №18',
      body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №18' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task19', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task19.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №19',
      body,
      breadcrumbs: [{ title: 'Задание №19' }]
    });
  } catch (err) { next(err); }
});

pages.get('/task19/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task19-play.ejs'), {
      taskId: req.params.id
    });
    res.render('pages/layout', {
      title: 'ЕГЭ · Задание №19',
      body,
      breadcrumbs: [
        { title: 'Задание №19', url: '/task19' },
        { title: `Задание #${req.params.id}` }
      ]
    });
  } catch (err) { next(err); }
});

pages.get('/admin/task19', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin-task19.ejs'), {});
    res.render('pages/layout', {
      title: 'Админ · Задание №19',
      body,
      breadcrumbs: [{ title: 'Администрирование', url: '/admin' }, { title: 'Задание №19' }]
    });
  } catch (err) { next(err); }
});

// ── Генератор вариантов ─────────────────────────────────────
pages.get('/variant', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'variant-config.ejs'), {});
    res.render('pages/layout', {
      title: 'ЕГЭ · Генератор вариантов',
      body,
      breadcrumbs: [{ title: 'Генератор вариантов' }]
    });
  } catch (err) { next(err); }
});

pages.get('/variant/:id', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'variant-play.ejs'), {
      variantId: req.params.id
    });
    res.render('pages/layout', {
      title: `ЕГЭ · Вариант #${req.params.id}`,
      body,
      breadcrumbs: [
        { title: 'Генератор вариантов', url: '/variant' },
        { title: `Вариант #${req.params.id}` }
      ]
    });
  } catch (err) { next(err); }
});

export default pages;
