// server/routes/pages.js
import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';

const pages = Router();

// главная
pages.get('/', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'index.ejs'), {});
    res.render('pages/layout', { title: 'ЕГЭ · Главная', body });
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
    res.render('pages/layout', { title: 'ЕГЭ · Темы', body });
  } catch (err) {
    next(err);
  }
});

// страница "Задания" — через общий лейаут с хеддером
pages.get('/tasks', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'tasks.ejs'), {});
    res.render('pages/layout', { title: 'ЕГЭ · Задания', body });
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
    res.render('pages/layout', { title: 'ЕГЭ · Задание', body });
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
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin.ejs'), {});
    res.render('pages/layout', { title: 'ЕГЭ · Администрирование', body });
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
    res.render('pages/layout', { title: 'ЕГЭ · Редактирование задания', body });
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
    res.render('pages/layout', { title: 'ЕГЭ · Управление темами', body });
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
    res.render('pages/layout', { title: 'ЕГЭ · Вход', body });
  } catch (err) {
    next(err);
  }
});

// страница списка заданий №17
pages.get('/task17', async (req, res, next) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname  = path.dirname(__filename);
    const ROOT = path.join(__dirname, '..', '..');
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'task17.ejs'), {});
    res.render('pages/layout', { title: 'ЕГЭ · Задание №17', body });
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
    res.render('pages/layout', { title: 'ЕГЭ · Задание №17', body });
  } catch (err) {
    next(err);
  }
});

export default pages;
