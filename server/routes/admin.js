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
            
            query += ` ORDER BY s.type_id, s.order_index, s.id`;
            
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
              VALUES (?, ?, ?, ?)
            `).run(type_id, title, description || null, order_index || 0);

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
    
    const assignment = db.prepare(`
      SELECT 
        a.id, a.subtopic_id, a.fipi_number, a.source, a.prompt, a.context,
        a.answer, a.explanation, a.rule_ref, a.alt_answers,
        st.title AS subtopic_title, st.type_id
      FROM assignments a
      JOIN subtopics st ON st.id = a.subtopic_id
      WHERE a.id = ?
    `).get(id);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    // Парсим JSON для alt_answers
    assignment.alt_answers = assignment.alt_answers ? JSON.parse(assignment.alt_answers) : [];
    
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

            const result = db.prepare(`
              INSERT INTO assignments (subtopic_id, fipi_number, source, prompt, context, answer, explanation, rule_ref, alt_answers, extra_data)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              subtopic_id,
              fipi_number || null,
              source,
              prompt, 
              context || null,
              answer,
              explanation || null,
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
    const { subtopic_id, sub_number, prompt, context, answer, explanation, rule_ref, alt_answers } = req.body;
    
    if (!subtopic_id || !prompt || !answer) {
      return res.status(400).json({ error: 'Тема, условие и ответ обязательны' });
    }

    const result = db.prepare(`
      UPDATE assignments 
      SET subtopic_id = ?, sub_number = ?, prompt = ?, context = ?, 
          answer = ?, explanation = ?, rule_ref = ?, alt_answers = ?
      WHERE id = ?
    `).run(
      subtopic_id, 
      sub_number || null, 
      prompt, 
      context || null,
      answer,
      explanation || null,
      rule_ref || null,
      alt_answers ? JSON.stringify(alt_answers) : null,
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

export default admin;
