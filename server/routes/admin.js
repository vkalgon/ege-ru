import { Router } from 'express';
import db from '../db.js';

const admin = Router();

// Общая функция обработки ошибок
function handleError(res, error, message) {
  console.error(message, error);
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.status(400).json({ error: 'Запись с такими данными уже существует' });
  } else {
    res.status(500).json({ error: message });
  }
}

/* ----------------------
   УПРАВЛЕНИЕ ТИПАМИ ЗАДАНИЙ
----------------------- */

        // Получить все типы заданий
        admin.get('/task-types', (req, res) => {
          try {
            const rows = db.prepare(`
              SELECT id, title, description, form_config
              FROM task_types
              ORDER BY id
            `).all();
            res.json(rows);
          } catch (error) {
            handleError(res, error, 'Ошибка получения типов заданий');
          }
        });

        // Получить один тип задания
        admin.get('/task-types/:id', (req, res) => {
          try {
            const { id } = req.params;
            const row = db.prepare(`
              SELECT id, title, description, form_config
              FROM task_types
              WHERE id = ?
            `).get(id);
            
            if (!row) {
              return res.status(404).json({ error: 'Тип задания не найден' });
            }
            
            res.json(row);
          } catch (error) {
            handleError(res, error, 'Ошибка получения типа задания');
          }
        });

        // Обновить тип задания
        admin.put('/task-types/:id', (req, res) => {
          try {
            const { id } = req.params;
            const { title, description, form_config } = req.body;
            
            if (!title) {
              return res.status(400).json({ error: 'Название обязательно' });
            }

            const result = db.prepare(`
              UPDATE task_types 
              SET title = ?, description = ?, form_config = ?
              WHERE id = ?
            `).run(title, description || null, form_config || null, id);

            if (result.changes === 0) {
              return res.status(404).json({ error: 'Тип задания не найден' });
            }

            res.json({ message: 'Тип задания обновлен' });
          } catch (error) {
            handleError(res, error, 'Ошибка обновления типа задания');
          }
        });

/* ----------------------
   УПРАВЛЕНИЕ ТЕМАМИ
----------------------- */

        // Получить все темы для типа задания
        admin.get('/subtopics', (req, res) => {
          try {
            const typeId = req.query.typeId;
            let query = `
              SELECT s.id, s.type_id, s.title, s.description, s.order_index,
                     tt.title AS type_title
              FROM subtopics s
              JOIN task_types tt ON tt.id = s.type_id
            `;
            let params = [];
            
            if (typeId) {
              query += ` WHERE s.type_id = ?`;
              params.push(typeId);
            }
            
            query += ` ORDER BY s.type_id, s.id`;
            
            const rows = db.prepare(query).all(...params);
            res.json(rows);
          } catch (error) {
            handleError(res, error, 'Ошибка получения тем');
          }
        });

        // Добавить новую тему
        admin.post('/subtopics', (req, res) => {
          try {
            const { type_id, title, description, order_index } = req.body;
            
            if (!type_id || !title) {
              return res.status(400).json({ error: 'Тип задания и название темы обязательны' });
            }

            const result = db.prepare(`
              INSERT INTO subtopics (type_id, title, description, order_index)
              VALUES (?, ?, ?, NULL)
            `).run(type_id, title, description || null);

            res.json({ id: result.lastInsertRowid, message: 'Тема добавлена' });
          } catch (error) {
            handleError(res, error, 'Ошибка добавления темы');
          }
        });

// Удалить тему
admin.delete('/subtopics/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Сначала удаляем все задания в теме
    db.prepare('DELETE FROM assignments WHERE subtopic_id = ?').run(id);
    
    // Затем удаляем саму тему
    const result = db.prepare('DELETE FROM subtopics WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Тема не найдена' });
    }
    
    res.json({ message: 'Тема и все её задания удалены' });
  } catch (error) {
    handleError(res, error, 'Ошибка удаления темы');
  }
});

/* ----------------------
   УПРАВЛЕНИЕ ЗАДАНИЯМИ
----------------------- */

// Получить все задания
admin.get('/assignments', (req, res) => {
  try {
    const typeId = req.query.typeId;
    let query = `
      SELECT
        a.id, a.subtopic_id, a.fipi_number, a.source, a.prompt, a.context,
        a.answer, a.explanation, a.rule_ref, a.alt_answers, a.extra_data,
        a.passage_id,
        s.title AS subtopic_title,
        s.type_id,
        tt.title AS type_title
      FROM assignments a
      LEFT JOIN subtopics s ON s.id = a.subtopic_id
      LEFT JOIN task_types tt ON tt.id = s.type_id
    `;
    let params = [];
    
    if (typeId) {
      query += ` WHERE s.type_id = ?`;
      params.push(typeId);
    }
    
    query += ` ORDER BY s.type_id, a.subtopic_id, a.id`;
    
    const rows = db.prepare(query).all(...params);
    
    // Парсим JSON для alt_answers и extra_data
    const processedRows = rows.map(row => ({
      ...row,
      alt_answers: row.alt_answers ? JSON.parse(row.alt_answers) : [],
      extra_data: row.extra_data ? JSON.parse(row.extra_data) : {}
    }));
    
    res.json(processedRows);
  } catch (error) {
    console.error('Ошибка получения заданий:', error);
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});

// Получить одно задание
admin.get('/assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== API: Получение задания ===');
    console.log('ID задания:', id);
    
    const assignment = db.prepare(`
      SELECT
        a.id, a.subtopic_id, a.fipi_number, a.source, a.prompt, a.context,
        a.answer, a.explanation, a.rule_ref, a.alt_answers, a.extra_data,
        st.title AS subtopic_title, st.type_id
      FROM assignments a
      LEFT JOIN subtopics st ON st.id = a.subtopic_id
      WHERE a.id = ?
    `).get(id);
    
    console.log('Результат запроса к БД:', assignment);
    
    if (!assignment) {
      console.log('Задание не найдено в БД');
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    // Парсим JSON для alt_answers
    assignment.alt_answers = assignment.alt_answers ? JSON.parse(assignment.alt_answers) : [];
    
    console.log('Отправляем данные клиенту:', assignment);
    res.json(assignment);
  } catch (error) {
    console.error('Ошибка получения задания:', error);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
});

        // Добавить новое задание
        admin.post('/assignments', (req, res) => {
          try {
            const { subtopic_id, fipi_number, source, prompt, context, answer, explanation, rule_ref, alt_answers, extra_data } = req.body;
            
            if (!subtopic_id || !source || !prompt || !answer) {
              return res.status(400).json({ error: 'Тема, источник, условие и ответ обязательны' });
            }

            // Обрабатываем JSON данные от Editor.js
            const processedPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
            const processedContext = context ? (typeof context === 'string' ? context : JSON.stringify(context)) : null;
            const processedExplanation = explanation ? (typeof explanation === 'string' ? explanation : JSON.stringify(explanation)) : null;

            const result = db.prepare(`
              INSERT INTO assignments (subtopic_id, fipi_number, source, prompt, context, answer, explanation, rule_ref, alt_answers, extra_data)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              subtopic_id,
              fipi_number || null,
              source,
              processedPrompt, 
              processedContext,
              answer,
              processedExplanation,
              rule_ref || null,
              alt_answers ? JSON.stringify(alt_answers) : null,
              extra_data ? JSON.stringify(extra_data) : null
            );

            res.json({ id: result.lastInsertRowid, message: 'Задание добавлено' });
          } catch (error) {
            handleError(res, error, 'Ошибка добавления задания');
          }
        });

// Обновить задание
admin.put('/assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { subtopic_id, fipi_number, source, prompt, context, answer, explanation, rule_ref, alt_answers, extra_data } = req.body;
    
    if (!subtopic_id || !source || !prompt || !answer) {
      return res.status(400).json({ error: 'Тема, источник, условие и ответ обязательны' });
    }

    // Обрабатываем JSON данные от Editor.js
    const processedPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const processedContext = context ? (typeof context === 'string' ? context : JSON.stringify(context)) : null;
    const processedExplanation = explanation ? (typeof explanation === 'string' ? explanation : JSON.stringify(explanation)) : null;

    const result = db.prepare(`
      UPDATE assignments 
      SET subtopic_id = ?, fipi_number = ?, source = ?, prompt = ?, context = ?, 
          answer = ?, explanation = ?, rule_ref = ?, alt_answers = ?, extra_data = ?
      WHERE id = ?
    `).run(
      subtopic_id, 
      fipi_number || null,
      source,
      processedPrompt, 
      processedContext,
      answer,
      processedExplanation,
      rule_ref || null,
      alt_answers ? JSON.stringify(alt_answers) : null,
      extra_data ? JSON.stringify(extra_data) : null,
      id
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    res.json({ message: 'Задание обновлено' });
  } catch (error) {
    handleError(res, error, 'Ошибка обновления задания');
  }
});

// Удалить задание
admin.delete('/assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    res.json({ message: 'Задание удалено' });
  } catch (error) {
    handleError(res, error, 'Ошибка удаления задания');
  }
});

/* ----------------------
   ТЕКСТЫ-ПАССАЖИ (задания 1–3)
----------------------- */

// Получить все пассажи (со счётчиком прикреплённых заданий по типам)
admin.get('/passages', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        p.id, p.source, p.fipi_number, p.notes, p.created_at,
        substr(p.context, 1, 120) AS context_preview,
        COUNT(DISTINCT a.id) AS assignment_count,
        GROUP_CONCAT(DISTINCT s.type_id) AS type_ids
      FROM text_passages p
      LEFT JOIN assignments a ON a.passage_id = p.id
      LEFT JOIN subtopics s ON s.id = a.subtopic_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `).all();
    res.json(rows);
  } catch (error) {
    handleError(res, error, 'Ошибка получения пассажей');
  }
});

// Получить один пассаж + прикреплённые задания
admin.get('/passages/:id', (req, res) => {
  try {
    const { id } = req.params;
    const passage = db.prepare('SELECT * FROM text_passages WHERE id = ?').get(id);
    if (!passage) return res.status(404).json({ error: 'Пассаж не найден' });

    const assignments = db.prepare(`
      SELECT a.id, a.subtopic_id, a.prompt, a.answer, a.alt_answers,
             a.explanation, a.rule_ref, s.type_id, tt.title AS type_title
      FROM assignments a
      JOIN subtopics s ON s.id = a.subtopic_id
      JOIN task_types tt ON tt.id = s.type_id
      WHERE a.passage_id = ?
      ORDER BY s.type_id
    `).all(id);

    assignments.forEach(a => {
      a.alt_answers = a.alt_answers ? JSON.parse(a.alt_answers) : [];
    });

    res.json({ ...passage, assignments });
  } catch (error) {
    handleError(res, error, 'Ошибка получения пассажа');
  }
});

// Создать пассаж
admin.post('/passages', (req, res) => {
  try {
    const { context, source, fipi_number, notes } = req.body;
    if (!context || !source) {
      return res.status(400).json({ error: 'Текст и источник обязательны' });
    }
    const processedContext = typeof context === 'string' ? context : JSON.stringify(context);
    const result = db.prepare(
      'INSERT INTO text_passages (context, source, fipi_number, notes) VALUES (?, ?, ?, ?)'
    ).run(processedContext, source, fipi_number || null, notes || null);
    res.json({ id: result.lastInsertRowid, message: 'Пассаж создан' });
  } catch (error) {
    handleError(res, error, 'Ошибка создания пассажа');
  }
});

// Обновить пассаж
admin.put('/passages/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { context, source, fipi_number, notes } = req.body;
    if (!context || !source) {
      return res.status(400).json({ error: 'Текст и источник обязательны' });
    }
    const processedContext = typeof context === 'string' ? context : JSON.stringify(context);
    const result = db.prepare(`
      UPDATE text_passages SET context = ?, source = ?, fipi_number = ?, notes = ? WHERE id = ?
    `).run(processedContext, source, fipi_number || null, notes || null, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Пассаж не найден' });
    res.json({ message: 'Пассаж обновлён' });
  } catch (error) {
    handleError(res, error, 'Ошибка обновления пассажа');
  }
});

// Удалить пассаж (задания открепляются — passage_id → NULL)
admin.delete('/passages/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE assignments SET passage_id = NULL WHERE passage_id = ?').run(id);
    const result = db.prepare('DELETE FROM text_passages WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Пассаж не найден' });
    res.json({ message: 'Пассаж удалён' });
  } catch (error) {
    handleError(res, error, 'Ошибка удаления пассажа');
  }
});

// Прикрепить задание к пассажу
admin.post('/passages/:id/attach', (req, res) => {
  try {
    const { id } = req.params;
    const { assignment_id } = req.body;
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id обязателен' });
    const passage = db.prepare('SELECT id FROM text_passages WHERE id = ?').get(id);
    if (!passage) return res.status(404).json({ error: 'Пассаж не найден' });
    db.prepare('UPDATE assignments SET passage_id = ? WHERE id = ?').run(id, assignment_id);
    res.json({ message: 'Задание прикреплено' });
  } catch (error) {
    handleError(res, error, 'Ошибка прикрепления задания');
  }
});

// Открепить задание от пассажа
admin.post('/passages/:id/detach', (req, res) => {
  try {
    const { id } = req.params;
    const { assignment_id } = req.body;
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id обязателен' });
    db.prepare('UPDATE assignments SET passage_id = NULL WHERE id = ? AND passage_id = ?').run(assignment_id, id);
    res.json({ message: 'Задание откреплено' });
  } catch (error) {
    handleError(res, error, 'Ошибка открепления задания');
  }
});

export default admin;
