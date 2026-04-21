// server/routes/progress.js
// Утилиты для отслеживания прогресса ученика + REST API

import { Router } from 'express';
import db from '../db.js';

const router = Router();

export const MASTERY_THRESHOLD = 5; // сколько правильных подряд = "освоено"

export const WORD_TABLE_LABELS = {
  task4_words:  'Задание 4 — Ударения',
  task9_words:  'Задание 9 — Гласные в корне',
  task10_words: 'Задание 10 — Приставки',
  task11_words: 'Задание 11 — Суффиксы',
  task12_words: 'Задание 12 — Окончания и суффиксы',
  task18_words: 'Задание 18 — Вводные слова',
};

/* ─── helpers ──────────────────────────────────────────────── */

/** Возвращает { id, role } из cookie-сессии, или null */
export function getUserIdFromReq(req) {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return null;
  const row = db.prepare(`
    SELECT u.id, u.role FROM users u
    JOIN user_sessions s ON s.user_id = u.id
    WHERE s.session_id = ? AND s.expires_at > datetime('now')
  `).get(sessionId);
  return row || null;
}

/**
 * Определяет userId для приоритизации при генерации:
 * - если учитель передал for_student_id и этот ученик у него — возвращает id ученика
 * - иначе возвращает id самого пользователя
 */
export function resolveWeakUserFromReq(req) {
  const userInfo = getUserIdFromReq(req);
  if (!userInfo) return null;
  const forStudentId = req.body?.for_student_id ? Number(req.body.for_student_id) : null;
  if (forStudentId && userInfo.role === 'teacher') {
    const link = db.prepare(
      'SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?'
    ).get(userInfo.id, forStudentId);
    if (link) return forStudentId;
  }
  return userInfo.id;
}

/** Записывает факт завершения одного задания целиком. */
export function logTaskCompletion(userId, wordTable) {
  db.prepare(`INSERT INTO task_completions (user_id, word_table) VALUES (?, ?)`).run(userId, wordTable);
}

/** Обновляет прогресс ученика для одного слова. */
export function updateWordProgress(userId, wordTable, wordId, isCorrect) {
  const existing = db.prepare(`
    SELECT correct_streak, total_attempts, total_correct
    FROM student_word_progress
    WHERE user_id = ? AND word_table = ? AND word_id = ?
  `).get(userId, wordTable, wordId);

  const newStreak = isCorrect ? (existing ? existing.correct_streak + 1 : 1) : 0;
  const newMastered = newStreak >= MASTERY_THRESHOLD ? 1 : 0;

  if (!existing) {
    db.prepare(`
      INSERT INTO student_word_progress
        (user_id, word_table, word_id, correct_streak, total_attempts, total_correct, is_mastered, last_attempted)
      VALUES (?, ?, ?, ?, 1, ?, ?, datetime('now'))
    `).run(userId, wordTable, wordId, newStreak, isCorrect ? 1 : 0, newMastered);
  } else {
    db.prepare(`
      UPDATE student_word_progress
      SET correct_streak = ?,
          total_attempts = total_attempts + 1,
          total_correct  = total_correct + ?,
          is_mastered    = ?,
          last_attempted = datetime('now')
      WHERE user_id = ? AND word_table = ? AND word_id = ?
    `).run(newStreak, isCorrect ? 1 : 0, newMastered, userId, wordTable, wordId);
  }
}

/** Возвращает Set word_id слов с ошибками (не освоенных). */
export function getWeakWordIds(userId, wordTable) {
  if (!userId) return new Set();
  const rows = db.prepare(`
    SELECT word_id FROM student_word_progress
    WHERE user_id = ? AND word_table = ? AND is_mastered = 0
      AND total_attempts > 0 AND total_correct < total_attempts
  `).all(userId, wordTable);
  return new Set(rows.map(r => r.word_id));
}

/**
 * Возвращает Set word_id слов, с которыми ученик пока вообще не работал.
 * "Новые" = в `student_word_progress` отсутствует строка для userId + wordTable.
 */
export function getNewWordIds(userId, wordTable) {
  if (!userId) return new Set();

  // Защита от случайной передачи непредусмотренной таблицы
  const allowedWordTables = new Set([
    'task4_words',
    'task9_words',
    'task10_words',
    'task11_words',
    'task12_words',
  ]);
  if (!allowedWordTables.has(wordTable)) return new Set();

  const sql = `
    SELECT w.id
    FROM ${wordTable} w
    LEFT JOIN student_word_progress sp
      ON sp.user_id = ? AND sp.word_table = ? AND sp.word_id = w.id
    WHERE sp.word_id IS NULL
  `;

  const rows = db.prepare(sql).all(userId, wordTable);
  return new Set(rows.map(r => r.id));
}

/**
 * Выбирает n слов с приоритетом для слабых (boostFactor раз чаще).
 * Возвращает n уникальных слов.
 */
export function pickWeighted(arr, n, weakIds, boostFactor = 3, newIds = null, newBoostFactor = 2) {
  const expanded = [];
  for (const w of arr) {
    const isWeak = weakIds?.has?.(w.id);
    const isNew = !isWeak && newIds?.has?.(w.id);

    // Слабые имеют более высокий приоритет, новые — второй уровень
    const times = isWeak ? boostFactor : (isNew ? newBoostFactor : 1);
    for (let i = 0; i < times; i++) expanded.push(w);
  }
  expanded.sort(() => Math.random() - 0.5);
  const seen = new Set();
  const result = [];
  for (const w of expanded) {
    if (!seen.has(w.id)) {
      seen.add(w.id);
      result.push(w);
      if (result.length >= n) break;
    }
  }
  return result;
}

/* ─── buildWeakWordsForUser ────────────────────────────────── */

const CAT_RULES_T4 = {
  past_fem_verb: 'Глаголы прош. вр. ж.р. — ударение на окончание -А',
  short_part_fem: 'Краткие причастия ж.р. — ударение на -А',
  verb_it: 'Глаголы на -ИТЬ — ударение на окончание',
  verb_from_adj: 'Глаголы от прилагательных — ударение на -ИТЬ',
  active_part_vsh: 'Действ. причастия с -ВШ- — ударение перед суффиксом',
  part_bent: 'Причастия загнуть/согнуть — ударение на приставку',
  part_enn: 'Причастия с -ЁНН- — ударение на Ё',
  bal_root: 'Слова с корнем БАЛ- — ударение НЕ на корень',
  gerund_vsh: 'Деепричастия с -ВШ- — ударение перед суффиксом',
  foreign_noun: 'Иностр. существительные — ударение на последний слог',
  deverbal_noun: 'Отглагольные существительные — совпадает с глаголом',
  fixed_stress: 'Неподвижное ударение на корне (все формы)',
  adj_from_noun: 'Прилагательные от сущ. — ударение как у сущ.',
  krasivee: 'красИвый — ударение неизменно на И',
  adv_do: 'Наречия с ДО- — ударение на приставку',
  adv_za: 'Наречия с ЗА- — ударение на приставку',
  other: 'Орфоэпический минимум — запомнить',
};

/** Возвращает массив групп слабых слов для userId. Используется и учеником, и учителем. */
export function buildWeakWordsForUser(userId) {
  const weakRecords = db.prepare(`
    SELECT word_table, word_id, correct_streak, total_attempts, total_correct
    FROM student_word_progress
    WHERE user_id = ? AND is_mastered = 0
      AND total_attempts > 0 AND total_correct < total_attempts
    ORDER BY (total_attempts - total_correct) DESC, total_attempts DESC
  `).all(userId);

  const byTable = {};
  for (const r of weakRecords) {
    byTable[r.word_table] ??= [];
    byTable[r.word_table].push(r);
  }

  const result = [];

  if (byTable.task9_words?.length) {
    const ids = byTable.task9_words.map(r => r.word_id);
    const words = db.prepare(
      `SELECT id, word_display, correct_vowel, vowel_pair, category, verification_word, alternation_rule
       FROM task9_words WHERE id IN (${ids.map(() => '?').join(',')})`
    ).all(...ids);
    const wm = Object.fromEntries(words.map(w => [w.id, w]));
    result.push({
      word_table: 'task9_words', label: WORD_TABLE_LABELS.task9_words,
      words: byTable.task9_words.map(r => {
        const w = wm[r.word_id]; if (!w) return null;
        const rule = w.category === 'alternating'
          ? (w.alternation_rule || 'Чередующаяся гласная — правило чередования')
          : w.category === 'verifiable'
          ? `Проверяемая: ${w.verification_word || 'проверочное слово'}`
          : 'Непроверяемая — словарное слово';
        return { word_id: r.word_id, word: w.word_display, correct_answer: w.correct_vowel, rule,
          errors: r.total_attempts - r.total_correct, streak: r.correct_streak,
          mastery: Math.min(Math.round(r.correct_streak / MASTERY_THRESHOLD * 100), 100) };
      }).filter(Boolean),
    });
  }

  if (byTable.task10_words?.length) {
    const ids = byTable.task10_words.map(r => r.word_id);
    const words = db.prepare(
      `SELECT id, before_prefix, prefix_display, after_prefix, correct_letter, rule
       FROM task10_words WHERE id IN (${ids.map(() => '?').join(',')})`
    ).all(...ids);
    const wm = Object.fromEntries(words.map(w => [w.id, w]));
    result.push({
      word_table: 'task10_words', label: WORD_TABLE_LABELS.task10_words,
      words: byTable.task10_words.map(r => {
        const w = wm[r.word_id]; if (!w) return null;
        return { word_id: r.word_id, word: w.before_prefix + w.prefix_display + w.after_prefix,
          correct_answer: w.correct_letter, rule: w.rule,
          errors: r.total_attempts - r.total_correct, streak: r.correct_streak,
          mastery: Math.min(Math.round(r.correct_streak / MASTERY_THRESHOLD * 100), 100) };
      }).filter(Boolean),
    });
  }

  if (byTable.task11_words?.length) {
    const ids = byTable.task11_words.map(r => r.word_id);
    const words = db.prepare(
      `SELECT id, before_suffix, suffix_display, after_suffix, correct_vowel, suffix, part_of_speech
       FROM task11_words WHERE id IN (${ids.map(() => '?').join(',')})`
    ).all(...ids);
    const wm = Object.fromEntries(words.map(w => [w.id, w]));
    result.push({
      word_table: 'task11_words', label: WORD_TABLE_LABELS.task11_words,
      words: byTable.task11_words.map(r => {
        const w = wm[r.word_id]; if (!w) return null;
        return { word_id: r.word_id, word: w.before_suffix + w.suffix_display + w.after_suffix,
          correct_answer: w.correct_vowel, rule: `Суффикс ${w.suffix} (${w.part_of_speech})`,
          errors: r.total_attempts - r.total_correct, streak: r.correct_streak,
          mastery: Math.min(Math.round(r.correct_streak / MASTERY_THRESHOLD * 100), 100) };
      }).filter(Boolean),
    });
  }

  if (byTable.task12_words?.length) {
    const ids = byTable.task12_words.map(r => r.word_id);
    const words = db.prepare(
      `SELECT id, word_display, correct_vowel, morpheme_type, rule
       FROM task12_words WHERE id IN (${ids.map(() => '?').join(',')})`
    ).all(...ids);
    const wm = Object.fromEntries(words.map(w => [w.id, w]));
    result.push({
      word_table: 'task12_words', label: WORD_TABLE_LABELS.task12_words,
      words: byTable.task12_words.map(r => {
        const w = wm[r.word_id]; if (!w) return null;
        return { word_id: r.word_id, word: w.word_display, correct_answer: w.correct_vowel,
          rule: w.rule || w.morpheme_type,
          errors: r.total_attempts - r.total_correct, streak: r.correct_streak,
          mastery: Math.min(Math.round(r.correct_streak / MASTERY_THRESHOLD * 100), 100) };
      }).filter(Boolean),
    });
  }

  if (byTable.task4_words?.length) {
    const ids = byTable.task4_words.map(r => r.word_id);
    const words = db.prepare(
      `SELECT id, word, category, hint FROM task4_words WHERE id IN (${ids.map(() => '?').join(',')})`
    ).all(...ids);
    const wm = Object.fromEntries(words.map(w => [w.id, w]));
    result.push({
      word_table: 'task4_words', label: WORD_TABLE_LABELS.task4_words,
      words: byTable.task4_words.map(r => {
        const w = wm[r.word_id]; if (!w) return null;
        return { word_id: r.word_id, word: w.word, correct_answer: null,
          rule: w.hint || CAT_RULES_T4[w.category] || 'Орфоэпический минимум',
          errors: r.total_attempts - r.total_correct, streak: r.correct_streak,
          mastery: Math.min(Math.round(r.correct_streak / MASTERY_THRESHOLD * 100), 100) };
      }).filter(Boolean),
    });
  }

  if (byTable.task18_words?.length) {
    const ids = byTable.task18_words.map(r => r.word_id);
    const words = db.prepare(
      `SELECT id, phrase, intro_type, category, rule_intro, rule_not_intro
       FROM task18_words WHERE id IN (${ids.map(() => '?').join(',')})`
    ).all(...ids);
    const wm = Object.fromEntries(words.map(w => [w.id, w]));
    result.push({
      word_table: 'task18_words', label: WORD_TABLE_LABELS.task18_words,
      words: byTable.task18_words.map(r => {
        const w = wm[r.word_id]; if (!w) return null;
        const rule = [w.rule_intro, w.rule_not_intro].filter(Boolean).join(' / ') || 'Вводное слово — изучите правило';
        return { word_id: r.word_id, word: w.phrase, correct_answer: null, rule,
          errors: r.total_attempts - r.total_correct, streak: r.correct_streak,
          mastery: Math.min(Math.round(r.correct_streak / MASTERY_THRESHOLD * 100), 100) };
      }).filter(Boolean),
    });
  }

  return result;
}

/** Сводная статистика по типам заданий для userId. */
export function buildSummaryForUser(userId) {
  const rows = db.prepare(`
    SELECT swp.word_table,
           COUNT(*) AS total_words_seen,
           SUM(swp.total_attempts) AS total_attempts,
           SUM(swp.total_correct) AS total_correct,
           SUM(swp.is_mastered) AS mastered_count,
           SUM(CASE WHEN swp.is_mastered = 0 AND swp.total_correct < swp.total_attempts THEN 1 ELSE 0 END) AS weak_count,
           MAX(swp.last_attempted) AS last_attempted_at,
           COALESCE(tc.completed_tasks, 0) AS completed_tasks
    FROM student_word_progress swp
    LEFT JOIN (
      SELECT word_table, COUNT(*) AS completed_tasks
      FROM task_completions
      WHERE user_id = ?
      GROUP BY word_table
    ) tc ON tc.word_table = swp.word_table
    WHERE swp.user_id = ?
    GROUP BY swp.word_table
  `).all(userId, userId);
  return rows.map(r => ({
    word_table: r.word_table,
    label: WORD_TABLE_LABELS[r.word_table] || r.word_table,
    total_words_seen: r.total_words_seen,
    total_attempts: r.total_attempts,
    total_correct: r.total_correct,
    accuracy: r.total_attempts > 0 ? Math.round(r.total_correct / r.total_attempts * 100) : 0,
    mastered_count: r.mastered_count,
    weak_count: r.weak_count,
    last_attempted_at: r.last_attempted_at,
    completed_tasks: r.completed_tasks,
  }));
}

/* ─── REST API ─────────────────────────────────────────────── */

// GET /api/progress/summary
router.get('/summary', (req, res) => {
  const user = getUserIdFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  res.json({ summary: buildSummaryForUser(user.id) });
});

// GET /api/progress/weak-words
router.get('/weak-words', (req, res) => {
  const user = getUserIdFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  res.json({ weak_words: buildWeakWordsForUser(user.id), mastery_threshold: MASTERY_THRESHOLD });
});

// DELETE /api/progress/words/:table/:wordId — удалить слово из прогресса
router.delete('/words/:table/:wordId', (req, res) => {
  const user = getUserIdFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  db.prepare(
    'DELETE FROM student_word_progress WHERE user_id = ? AND word_table = ? AND word_id = ?'
  ).run(user.id, req.params.table, Number(req.params.wordId));
  res.json({ ok: true });
});

// POST /api/progress/words/:table/:wordId/master — отметить как запомненное
router.post('/words/:table/:wordId/master', (req, res) => {
  const user = getUserIdFromReq(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  db.prepare(`
    UPDATE student_word_progress
    SET is_mastered = 1, correct_streak = ?
    WHERE user_id = ? AND word_table = ? AND word_id = ?
  `).run(MASTERY_THRESHOLD, user.id, req.params.table, Number(req.params.wordId));
  res.json({ ok: true });
});

export default router;
