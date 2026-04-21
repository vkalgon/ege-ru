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
import task16 from './routes/task16.js';
import task17 from './routes/task17.js';
import task18 from './routes/task18.js';
import task19 from './routes/task19.js';
import task9  from './routes/task9.js';
import task10 from './routes/task10.js';
import task11 from './routes/task11.js';
import task12 from './routes/task12.js';
import task4  from './routes/task4.js';
import task5  from './routes/task5.js';
import task7  from './routes/task7.js';
import progress from './routes/progress.js';
import teacher from './routes/teacher.js';
import student from './routes/student.js';
import variant from './routes/variant.js';

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
app.use('/api/task16', task16);
app.use('/api/task17', task17);
app.use('/api/task18', task18);
app.use('/api/task19', task19);
app.use('/api/task9',  task9);
app.use('/api/task10', task10);
app.use('/api/task11', task11);
app.use('/api/task12', task12);
app.use('/api/task4',  task4);
app.use('/api/task5',  task5);
app.use('/api/task7',  task7);
app.use('/api/progress', progress);
app.use('/api/teacher', teacher);
app.use('/api/student', student);
app.use('/api/variant', variant);

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
