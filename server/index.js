// server/index.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import pages from './routes/pages.js';
import api from './routes/api.js';
import admin from './routes/admin.js';
import auth from './routes/auth.js';
import task17 from './routes/task17.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const app = express();

// базовые middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Подключаем cookie-parser
app.use(cookieParser());

// статика
app.use(express.static(path.join(ROOT, 'public')));

// EJS
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));

// маршруты
app.use('/', pages);
app.use('/api/auth', auth);
app.use('/api', api);
app.use('/api/admin', admin);
app.use('/api/task17', task17);

// 404
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

// централизованный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api')) {
    res.status(500).json({ error: 'server error' });
  } else {
    res.status(500).send('500 Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`▶ http://localhost:${PORT}`));
