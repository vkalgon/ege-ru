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
    const body = await ejs.renderFile(path.join(ROOT, 'views', 'pages', 'admin.ejs'), {});
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

export default pages;
