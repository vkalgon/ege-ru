import { Router } from 'express';
import db from '../db.js';

const admin = Router();

/* ----------------------
   УПРАВЛЕНИЕ ТЕМАМИ
----------------------- */

// Получить все темы
admin.get('/subtopics', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT st.id, st.type_id, st.code, st.title, tt.title AS type_title
      FROM subtopics st
      JOIN task_types tt ON tt.id = st.type_id
      ORDER BY st.type_id, st.id
    `).all();
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения тем:', error);
    res.status(500).json({ error: 'Ошибка получения тем' });
  }
});

// Добавить новую тему
admin.post('/subtopics', (req, res) => {
  try {
    const { type_id, code, title } = req.body;
    
    if (!type_id || !code || !title) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const result = db.prepare(`
      INSERT INTO subtopics (type_id, code, title)
      VALUES (?, ?, ?)
    `).run(type_id, code, title);

    res.json({ id: result.lastInsertRowid, message: 'Тема добавлена' });
  } catch (error) {
    console.error('Ошибка добавления темы:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Тема с таким кодом уже существует' });
    } else {
      res.status(500).json({ error: 'Ошибка добавления темы' });
    }
  }
});

// Удалить тему
admin.delete('/subtopics/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare('DELETE FROM subtopics WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Тема не найдена' });
    }
    
    res.json({ message: 'Тема удалена' });
  } catch (error) {
    console.error('Ошибка удаления темы:', error);
    res.status(500).json({ error: 'Ошибка удаления темы' });
  }
});

/* ----------------------
   УПРАВЛЕНИЕ ЗАДАНИЯМИ
----------------------- */

// Получить все задания
admin.get('/assignments', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        a.id, a.subtopic_id, a.sub_number, a.prompt, a.context,
        a.answer, a.explanation, a.rule_ref, a.alt_answers,
        st.title AS subtopic_title, st.code AS subtopic_code, st.type_id
      FROM assignments a
      JOIN subtopics st ON st.id = a.subtopic_id
      ORDER BY a.id
    `).all();
    
    // Парсим JSON для alt_answers
    const processedRows = rows.map(row => ({
      ...row,
      alt_answers: row.alt_answers ? JSON.parse(row.alt_answers) : []
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
        a.id, a.subtopic_id, a.sub_number, a.prompt, a.context,
        a.answer, a.explanation, a.rule_ref, a.alt_answers,
        st.title AS subtopic_title, st.code AS subtopic_code, st.type_id
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
    const { subtopic_id, sub_number, prompt, context, answer, explanation, rule_ref, alt_answers } = req.body;
    
    if (!subtopic_id || !prompt || !answer) {
      return res.status(400).json({ error: 'Тема, условие и ответ обязательны' });
    }

    const result = db.prepare(`
      INSERT INTO assignments (subtopic_id, sub_number, prompt, context, answer, explanation, rule_ref, alt_answers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subtopic_id, 
      sub_number || null, 
      prompt, 
      context || null,
      answer,
      explanation || null,
      rule_ref || null,
      alt_answers ? JSON.stringify(alt_answers) : null
    );

    res.json({ id: result.lastInsertRowid, message: 'Задание добавлено' });
  } catch (error) {
    console.error('Ошибка добавления задания:', error);
    res.status(500).json({ error: 'Ошибка добавления задания' });
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
    console.error('Ошибка обновления задания:', error);
    res.status(500).json({ error: 'Ошибка обновления задания' });
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
    console.error('Ошибка удаления задания:', error);
    res.status(500).json({ error: 'Ошибка удаления задания' });
  }
});

export default admin;
