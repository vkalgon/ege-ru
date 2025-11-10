// server/routes/task17.js
import { Router } from 'express';
import db from '../db.js';

const task17 = Router();

// Порог IoU для совпадения спанов (из .env или по умолчанию)
const SPANS_IOU_THRESHOLD = parseFloat(process.env.SPANS_IOU_THRESHOLD || '0.9');

/* ----------------------
   УТИЛИТЫ ДЛЯ ПРОВЕРКИ
----------------------- */

// Вычисление IoU (Intersection over Union) для двух интервалов
function calculateIoU(start1, end1, start2, end2) {
  const intersectionStart = Math.max(start1, start2);
  const intersectionEnd = Math.min(end1, end2);
  
  if (intersectionStart >= intersectionEnd) {
    return 0;
  }
  
  const intersection = intersectionEnd - intersectionStart;
  const union = (end1 - start1) + (end2 - start2) - intersection;
  
  return intersection / union;
}

// Жадный матчинг спанов (best-first matching)
function matchSpans(targetSpans, userSpans) {
  const matched = new Set();
  const results = [];
  
  for (const target of targetSpans) {
    let bestMatch = null;
    let bestIoU = 0;
    
    for (let i = 0; i < userSpans.length; i++) {
      if (matched.has(i)) continue;
      
      const user = userSpans[i];
      if (target.type !== user.type) continue;
      
      const iou = calculateIoU(
        target.startOffset, target.endOffset,
        user.startOffset, user.endOffset
      );
      
      if (iou >= SPANS_IOU_THRESHOLD && iou > bestIoU) {
        bestIoU = iou;
        bestMatch = i;
      }
    }
    
    if (bestMatch !== null) {
      matched.add(bestMatch);
      const user = userSpans[bestMatch];
      results.push({
        type: target.type,
        target: [target.startOffset, target.endOffset],
        user: [user.startOffset, user.endOffset],
        iou: bestIoU,
        ok: true
      });
    } else {
      results.push({
        type: target.type,
        target: [target.startOffset, target.endOffset],
        user: null,
        iou: 0,
        ok: false
      });
    }
  }
  
  // Отмечаем лишние пользовательские спаны
  for (let i = 0; i < userSpans.length; i++) {
    if (!matched.has(i)) {
      const user = userSpans[i];
      results.push({
        type: user.type,
        target: null,
        user: [user.startOffset, user.endOffset],
        iou: 0,
        ok: false
      });
    }
  }
  
  return results;
}

// Валидация индексов для строки
function validateOffsets(text, offsets) {
  // НОВАЯ ЛОГИКА: offsets теперь содержат индексы пробелов (0, 1, 2...), а не позиции
  // Максимальный индекс = количество пробелов - 1
  const spaceCount = (text.match(/\s/g) || []).length;
  const maxIndex = spaceCount - 1;
  for (const offset of offsets) {
    if (typeof offset !== 'number' || offset < 0 || offset > maxIndex) {
      return false;
    }
  }
  return true;
}

// Нормализация текста: убирает множественные пробелы, приводит к единому формату
function normalizeText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

// НОВАЯ ЛОГИКА: Нормализация source_text - приводит все цифры к формату " (N) " (пробел слева, пробел справа)
// Пользователь может вводить текст как угодно, но мы нормализуем его
function normalizeSourceText(sourceText) {
  if (!sourceText) return '';
  
  let result = sourceText;
  const digitRegex = /\((\d+)\)/g;
  const replacements = [];
  let match;
  
  // Собираем все метки цифр
  while ((match = digitRegex.exec(sourceText)) !== null) {
    replacements.push({
      index: match.index,
      length: match[0].length,
      digit: match[1]
    });
  }
  
  // Применяем замены с конца, чтобы индексы не сдвигались
  for (let i = replacements.length - 1; i >= 0; i--) {
    const rep = replacements[i];
    const before = result.substring(0, rep.index);
    const after = result.substring(rep.index + rep.length);
    
    // Нормализуем: всегда " (N) " (пробел слева, пробел справа)
    // Убираем все пробелы вокруг метки и добавляем один пробел слева и один справа
    let beforeNormalized = before.trimEnd(); // Убираем пробелы в конце
    let afterNormalized = after.trimStart(); // Убираем пробелы в начале
    
    // Добавляем пробелы вокруг метки
    result = beforeNormalized + ' (' + rep.digit + ') ' + afterNormalized;
  }
  
  // Финальная нормализация: убираем множественные пробелы (но сохраняем пробелы вокруг цифр)
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

// Пересчет позиций запятых для нормализованного текста
// Если текст был нормализован, позиции нужно пересчитать
function recalculateCommaPositionsForNormalized(oldText, newText, oldPositions) {
  if (!oldText || !newText || !oldPositions || oldPositions.length === 0) {
    return oldPositions || [];
  }
  
  const normalizedOld = normalizeText(oldText);
  const normalizedNew = normalizeText(newText);
  
  // Если тексты одинаковы после нормализации, позиции не меняются
  if (normalizedOld === normalizedNew) {
    return oldPositions;
  }
  
  // Если тексты разные, нужно пересчитать позиции
  // Строим маппинг позиций из старого текста в новый
  const newPositions = [];
  let oldPos = 0;
  let newPos = 0;
  
  // Проходим по старому нормализованному тексту и новому
  while (oldPos < normalizedOld.length && newPos < normalizedNew.length) {
    if (normalizedOld[oldPos] === normalizedNew[newPos]) {
      // Символы совпадают - проверяем, есть ли запятая на этой позиции в старом тексте
      if (oldPositions.includes(oldPos)) {
        newPositions.push(newPos);
      }
      oldPos++;
      newPos++;
    } else if (normalizedOld[oldPos] === ' ' && normalizedNew[newPos] !== ' ') {
      // В старом тексте пробел, в новом нет - пропускаем старый
      oldPos++;
    } else if (normalizedOld[oldPos] !== ' ' && normalizedNew[newPos] === ' ') {
      // В новом тексте пробел, в старом нет - пропускаем новый
      newPos++;
    } else {
      // Разные символы - пропускаем оба
      oldPos++;
      newPos++;
    }
  }
  
  return newPositions;
}

// Восстановление commaless_text из source_text с правильными пробелами
// Убирает метки (N), добавляя пробелы там, где метка находится между буквами
// ВАЖНО: гарантирует, что все символы сохраняются, только метки удаляются
function restoreCommalessText(sourceText) {
  if (!sourceText) return '';
  
  // НОВАЯ ЛОГИКА: нормализуем исходный текст (на случай, если он еще не нормализован)
  const normalizedSourceText = normalizeSourceText(sourceText);
  let result = normalizedSourceText;
  const digitRegex = /\((\d+)\)/g;
  const replacements = [];
  let match;
  
  // Собираем все метки (с конца, чтобы индексы не сдвигались)
  while ((match = digitRegex.exec(normalizedSourceText)) !== null) {
    replacements.push({
      index: match.index,
      length: match[0].length
    });
  }
  
  // Применяем замены с конца
  for (let i = replacements.length - 1; i >= 0; i--) {
    const rep = replacements[i];
    const before = result.substring(0, rep.index);
    const after = result.substring(rep.index + rep.length);
    
    // Проверяем, находится ли метка между буквами
    const charBefore = rep.index > 0 ? result[rep.index - 1] : '';
    const charAfter = rep.index + rep.length < result.length ? result[rep.index + rep.length] : '';
    const isBetweenLetters = /[а-яёА-ЯЁa-zA-Z]/.test(charBefore) && /[а-яёА-ЯЁa-zA-Z]/.test(charAfter);
    
    // Проверяем пробелы вокруг метки
    const hasSpaceBefore = rep.index > 0 && result[rep.index - 1] === ' ';
    const hasSpaceAfter = rep.index + rep.length < result.length && result[rep.index + rep.length] === ' ';
    
    if (hasSpaceBefore || hasSpaceAfter) {
      // Был пробел - убираем пробел перед меткой (если был), оставляем один пробел
      if (hasSpaceBefore) {
        result = before.slice(0, -1) + ' ' + after;
      } else {
        result = before + ' ' + after;
      }
    } else if (isBetweenLetters) {
      // Метка между буквами - добавляем пробел, чтобы слова не склеились
      result = before + ' ' + after;
    } else {
      // Метка не между буквами - просто удаляем метку, сохраняя все остальные символы
      result = before + after;
    }
  }
  
  // Убираем запятые (они не нужны в commaless_text)
  result = result.replace(/,/g, '');
  
  // Финальная нормализация пробелов (убираем множественные пробелы)
  result = normalizeText(result);
  
  return result;
}

// Вычисление позиций запятых из цифр ответа
// НОВАЯ ЛОГИКА: source_text уже нормализован к формату " (N) " (пробел слева, пробел справа)
// Возвращает массив позиций пробелов в нормализованном commaless_text, где должны быть запятые
function calculateCommaPositionsFromDigits(sourceText, commalessText, digits) {
  if (!sourceText || !commalessText || !digits || digits.length === 0) {
    console.log('calculateCommaPositionsFromDigits: пустые входные данные');
    return [];
  }
  
  // НОВАЯ ЛОГИКА: нормализуем source_text (на случай, если он еще не нормализован)
  const normalizedSourceText = normalizeSourceText(sourceText);
  
  console.log('calculateCommaPositionsFromDigits: входные данные:', { 
    sourceText: normalizedSourceText.substring(0, 100), 
    commalessText: commalessText.substring(0, 100),
    digits 
  });
  
  // Строим нормализованный текст из source_text (убираем метки и запятые, нормализуем пробелы)
  // НОВАЯ ЛОГИКА: в нормализованном тексте все метки в формате " (N) " (пробел слева, пробел справа)
  let normalized = normalizedSourceText;
  // Убираем все метки " (N) " (пробел + метка + пробел) - заменяем на один пробел
  normalized = normalized.replace(/\s+\(\d+\)\s+/g, ' ');
  // Убираем запятые
  normalized = normalized.replace(/,/g, '');
  // Нормализуем пробелы (убираем множественные)
  normalized = normalizeText(normalized);
  
  console.log('calculateCommaPositionsFromDigits: normalized текст:', normalized.substring(0, 100));
  
  // Проверяем, что normalized совпадает с commaless_text (после нормализации)
  const normalizedCommaless = commalessText.replace(/\s+/g, ' ').trim();
  if (normalized !== normalizedCommaless) {
    console.warn('calculateCommaPositionsFromDigits: normalized не совпадает с normalizedCommaless');
    console.warn('normalized:', normalized);
    console.warn('normalizedCommaless:', normalizedCommaless);
  }
  
  // НОВАЯ ЛОГИКА: находим все метки в нормализованном source_text
  const digitRegex = /\((\d+)\)/g;
  const digitPositions = [];
  let match;
  
  while ((match = digitRegex.exec(normalizedSourceText)) !== null) {
    const digit = parseInt(match[1], 10);
    digitPositions.push({
      digit,
      index: match.index,
      length: match[0].length
    });
  }
  
  console.log('calculateCommaPositionsFromDigits: найдено меток:', digitPositions.length);
  
  // Создаем маппинг: цифра -> позиция в source_text
  const digitToSourcePos = new Map();
  digitPositions.forEach(pos => {
    digitToSourcePos.set(pos.digit, pos.index);
  });
  
  // Для каждой цифры из ответа находим позицию запятой
  const commaPositions = [];
  
  for (const digit of digits) {
    const sourcePos = digitToSourcePos.get(digit);
    if (sourcePos === undefined) {
      console.log(`calculateCommaPositionsFromDigits: цифра ${digit} не найдена в source_text`);
      continue;
    }
    
    // НОВАЯ ЛОГИКА: в нормализованном тексте метка всегда в формате " (N) " (пробел слева, пробел справа)
    // Запятая должна быть на позиции пробела перед меткой
    // Позиция пробела перед меткой = sourcePos - 1
    const spaceBeforeDigit = sourcePos - 1;
    
    // Строим normalized текст до пробела перед меткой
    let normalizedBefore = normalizedSourceText.substring(0, spaceBeforeDigit);
    // Убираем все метки " (N) " (пробел + метка + пробел) - заменяем на один пробел
    normalizedBefore = normalizedBefore.replace(/\s+\(\d+\)\s+/g, ' ');
    // Убираем запятые
    normalizedBefore = normalizedBefore.replace(/,/g, '');
    // Нормализуем пробелы
    normalizedBefore = normalizeText(normalizedBefore);
    
    // Позиция в normalized = длина normalizedBefore
    // Это позиция конца слова перед меткой в normalized тексте
    const posInNormalized = normalizedBefore.length;
    
    // Находим позицию пробела после слова в normalized
    // posInNormalized - это конец слова перед меткой
    // Проверяем, есть ли пробел сразу после слова
    let spacePos = posInNormalized;
    
    // Если на позиции posInNormalized уже пробел, используем его
    if (spacePos < normalized.length && normalized[spacePos] === ' ') {
      // Пробел найден
    } else {
      // Ищем пробел дальше (пропускаем текущее слово, если оно еще не закончилось)
      while (spacePos < normalized.length && normalized[spacePos] !== ' ') {
        spacePos++;
      }
    }
    
    // Если нашли пробел, проверяем что после него есть еще символы (не конец строки)
    // Исправление: проверяем правый пробел
    if (spacePos < normalized.length && normalized[spacePos] === ' ' && spacePos + 1 < normalized.length) {
      // НОВАЯ ЛОГИКА: находим индекс этого пробела (порядковый номер пробела в тексте)
      let spaceIndex = 0;
      for (let i = 0; i < spacePos; i++) {
        if (normalized[i] === ' ') {
          spaceIndex++;
        }
      }
      console.log(`calculateCommaPositionsFromDigits: цифра ${digit}, позиция пробела: ${spacePos}, индекс пробела: ${spaceIndex}`);
      commaPositions.push(spaceIndex);
    } else {
      console.log(`calculateCommaPositionsFromDigits: цифра ${digit}, пробел не найден или нет символов после пробела, spacePos=${spacePos}, normalized.length=${normalized.length}`);
    }
  }
  
  // Убираем дубликаты и сортируем
  const result = [...new Set(commaPositions)].sort((a, b) => a - b);
  console.log('calculateCommaPositionsFromDigits: результат (индексы пробелов):', result);
  return result; // Теперь возвращаем индексы пробелов, а не позиции
}

/**
 * Вычисляет позиции запятых в commaless_text на основе base_text
 * @param {string} base_text - текст с запятыми
 * @param {string} commaless_text - текст без запятых
 * @returns {number[]} - массив позиций (межсимвольные индексы для commaless_text)
 */
function calculateCommaPositions(base_text, commaless_text) {
  console.log('[calculateCommaPositions] Начало вычисления');
  console.log('[calculateCommaPositions] base_text:', base_text);
  console.log('[calculateCommaPositions] commaless_text:', commaless_text);
  
  // Нормализуем тексты перед вычислением
  const normalizedBase = normalizeText(base_text);
  const normalizedCommaless = normalizeText(commaless_text);
  
  console.log('[calculateCommaPositions] normalizedBase.length:', normalizedBase?.length);
  console.log('[calculateCommaPositions] normalizedCommaless.length:', normalizedCommaless?.length);
  
  // НОВАЯ ЛОГИКА: вычисляем индексы пробелов (0, 1, 2...), где стоят запятые
  // Проходим по base_text и для каждой запятой находим соответствующий пробел в commaless_text
  const spaceIndices = []; // Индексы пробелов (0, 1, 2...)
  let spaceIndex = 0; // Порядковый номер пробела в commaless_text
  let basePos = 0; // Позиция в base_text
  let commalessPos = 0; // Позиция в commaless_text
  
  // Проходим по base_text символ за символом
  while (basePos < normalizedBase.length) {
    if (normalizedBase[basePos] === ',') {
      // Нашли запятую в base_text
      // Пропускаем запятую и пробел после неё в base_text
      basePos++; // Пропускаем запятую
      if (basePos < normalizedBase.length && normalizedBase[basePos] === ' ') {
        basePos++; // Пропускаем пробел после запятой
      }
      
      // Теперь нужно найти соответствующий пробел в commaless_text
      // Продолжаем с текущей позиции commalessPos и ищем следующий пробел
      while (commalessPos < normalizedCommaless.length) {
        if (normalizedCommaless[commalessPos] === ' ') {
          // Нашли пробел - это тот, где должна быть запятая
          spaceIndices.push(spaceIndex);
          console.log(`[calculateCommaPositions] Найден пробел с индексом ${spaceIndex}, где стоит запятая`);
          spaceIndex++;
          commalessPos++;
          break;
        } else {
          // Не пробел - пропускаем символ
          commalessPos++;
        }
      }
    } else if (normalizedBase[basePos] === ' ') {
      // Пробел в base_text (без запятой)
      // Пропускаем пробел в commaless_text (он должен быть там же)
      if (commalessPos < normalizedCommaless.length && normalizedCommaless[commalessPos] === ' ') {
        spaceIndex++;
        commalessPos++;
      }
      basePos++;
    } else {
      // Обычный символ - синхронизируем
      if (commalessPos < normalizedCommaless.length && normalizedCommaless[commalessPos] === normalizedBase[basePos]) {
        basePos++;
        commalessPos++;
      } else {
        // Символы не совпадают - ошибка синхронизации
        console.error('[calculateCommaPositions] ОШИБКА: символы не совпадают!', {
          commalessPos,
          basePos,
          commalessChar: normalizedCommaless[commalessPos],
          baseChar: normalizedBase[basePos]
        });
        break;
      }
    }
  }
  
  console.log('[calculateCommaPositions] Вычисленные индексы пробелов:', spaceIndices);
  return spaceIndices; // Теперь возвращаем индексы пробелов, а не позиции
}

/* ----------------------
   АДМИНКА
----------------------- */

// POST /api/task17 - создать задание
task17.post('/', (req, res) => {
  try {
    const {
      source_text,
      base_text,
      commaless_text,
      digits,
      comma_positions,
      spans,
      answer_text,
      explanation_md,
      source,
      reveal_policy
    } = req.body;
    
    if (!source_text || !base_text || !commaless_text) {
      return res.status(400).json({ error: 'source_text, base_text, commaless_text обязательны' });
    }
    
    if (!digits || !Array.isArray(digits)) {
      return res.status(400).json({ error: 'digits должен быть массивом чисел' });
    }
    
    // НОРМАЛИЗУЕМ все тексты перед сохранением
    // НОВАЯ ЛОГИКА: source_text нормализуем специальной функцией (приводит цифры к формату " (N) ")
    const normalizedBaseText = normalizeText(base_text);
    const normalizedCommalessText = normalizeText(commaless_text);
    const normalizedSourceText = normalizeSourceText(source_text);
    
    // comma_positions может быть пустым массивом (для упрощенной формы админки)
    // Если пустой, вычисляем автоматически
    let finalCommaPositions = comma_positions && Array.isArray(comma_positions) && comma_positions.length > 0 
      ? comma_positions 
      : [];
    
    console.log('[CREATE] Получены comma_positions:', comma_positions);
    console.log('[CREATE] finalCommaPositions до вычисления:', finalCommaPositions);
    console.log('[CREATE] finalCommaPositions.length:', finalCommaPositions?.length);
    
    if (finalCommaPositions.length === 0) {
      // Пытаемся вычислить из base_text (если есть)
      if (normalizedBaseText && normalizedCommalessText) {
        console.log('[CREATE] Вычисляем позиции автоматически из base_text и commaless_text');
        finalCommaPositions = calculateCommaPositions(normalizedBaseText, normalizedCommalessText);
        console.log('[CREATE] Вычисленные позиции из base_text:', finalCommaPositions);
      } 
      // Если не получилось из base_text, пытаемся из digits (если есть)
      else if (digits && Array.isArray(digits) && digits.length > 0 && normalizedSourceText && normalizedCommalessText) {
        console.log('[CREATE] Вычисляем позиции из digits');
        finalCommaPositions = calculateCommaPositionsFromDigits(normalizedSourceText, normalizedCommalessText, digits);
        console.log('[CREATE] Вычисленные позиции из digits:', finalCommaPositions);
      }
    } else {
      // Если позиции были переданы, пересчитываем их для нормализованного текста
      finalCommaPositions = recalculateCommaPositionsForNormalized(commaless_text, normalizedCommalessText, finalCommaPositions);
    }
    
    console.log('[CREATE] ФИНАЛЬНЫЕ finalCommaPositions:', finalCommaPositions);
    console.log('[CREATE] ФИНАЛЬНЫЕ finalCommaPositions.length:', finalCommaPositions?.length);
    
    // Валидация индексов только если есть позиции
    if (finalCommaPositions.length > 0) {
      // Валидируем относительно нормализованного commaless_text
      if (!validateOffsets(normalizedCommalessText, finalCommaPositions)) {
        return res.status(400).json({ error: 'Некорректные индексы в comma_positions' });
      }
    }
    
    // spans может быть пустым массивом (обороты в объяснении не требуются для сохранения задания)
    const finalSpans = spans && Array.isArray(spans) ? spans : [];
    
    // Валидация спанов только если они есть
    for (const span of finalSpans) {
      if (span.startOffset < 0 || span.endOffset > commaless_text.length || span.startOffset >= span.endOffset) {
        return res.status(400).json({ error: `Некорректные offsets в span: ${JSON.stringify(span)}` });
      }
      if (span.type !== 'participle' && span.type !== 'gerund') {
        return res.status(400).json({ error: `Некорректный тип span: ${span.type}` });
      }
    }
    
    // Вставляем задание с нормализованными текстами
    const taskResult = db.prepare(`
      INSERT INTO task17 (source_text, base_text, commaless_text, answer_text, explanation_md, source, reveal_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalizedSourceText,
      normalizedBaseText,
      normalizedCommalessText,
      answer_text || null,
      explanation_md || null,
      source || null,
      reveal_policy || 'after_correct'
    );
    
    const taskId = taskResult.lastInsertRowid;
    
    // Вставляем ответы
    db.prepare(`
      INSERT INTO task17_answer (task_id, digits_json, comma_positions_json, spans_json)
      VALUES (?, ?, ?, ?)
    `).run(
      taskId,
      JSON.stringify(digits),
      JSON.stringify(finalCommaPositions),
      JSON.stringify(finalSpans)
    );
    
    res.json({ id: taskId, message: 'Задание создано' });
  } catch (error) {
    console.error('Ошибка создания задания:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка создания задания',
      details: error.message 
    });
  }
});

// GET /api/task17 - список заданий
task17.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const rows = db.prepare(`
      SELECT 
        id, source_text, base_text, commaless_text, 
        answer_text, explanation_md, source, reveal_policy, created_at
      FROM task17
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения заданий:', error);
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});

// GET /api/task17/:id - одно задание
task17.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const task = db.prepare(`
      SELECT 
        id, source_text, base_text, commaless_text,
        answer_text, explanation_md, source, reveal_policy, created_at
      FROM task17
      WHERE id = ?
    `).get(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    const answer = db.prepare(`
      SELECT digits_json, comma_positions_json, spans_json
      FROM task17_answer
      WHERE task_id = ?
    `).get(id);
    
    if (answer) {
      task.digits = JSON.parse(answer.digits_json);
      task.comma_positions = JSON.parse(answer.comma_positions_json);
      task.spans = JSON.parse(answer.spans_json);
    }
    
    res.json(task);
  } catch (error) {
    console.error('Ошибка получения задания:', error);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
});

// PUT /api/task17/:id - обновить задание
task17.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      source_text,
      base_text,
      commaless_text,
      digits,
      comma_positions,
      spans,
      answer_text,
      explanation_md,
      source,
      reveal_policy
    } = req.body;
    
    // Обновляем задание
    const taskResult = db.prepare(`
      UPDATE task17
      SET source_text = COALESCE(?, source_text),
          base_text = COALESCE(?, base_text),
          commaless_text = COALESCE(?, commaless_text),
          answer_text = COALESCE(?, answer_text),
          explanation_md = COALESCE(?, explanation_md),
          source = COALESCE(?, source),
          reveal_policy = COALESCE(?, reveal_policy)
      WHERE id = ?
    `).run(
      source_text || null,
      base_text || null,
      commaless_text || null,
      answer_text !== undefined ? answer_text : null,
      explanation_md !== undefined ? explanation_md : null,
      source !== undefined ? source : null,
      reveal_policy || null,
      id
    );
    
    if (taskResult.changes === 0) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    // Нормализуем тексты, если они были переданы
    const normalizedBaseText = base_text ? normalizeText(base_text) : null;
    const normalizedCommalessText = commaless_text ? normalizeText(commaless_text) : null;
    const normalizedSourceText = source_text ? normalizeSourceText(source_text) : null;
    
    // Обновляем тексты нормализованными версиями, если они были переданы
    if (normalizedBaseText || normalizedCommalessText || normalizedSourceText) {
      db.prepare(`
        UPDATE task17
        SET base_text = COALESCE(?, base_text),
            commaless_text = COALESCE(?, commaless_text),
            source_text = COALESCE(?, source_text)
        WHERE id = ?
      `).run(
        normalizedBaseText,
        normalizedCommalessText,
        normalizedSourceText,
        id
      );
    }
    
    // Обрабатываем ответы - разрешаем пустые массивы
    let finalCommaPositions = comma_positions && Array.isArray(comma_positions) && comma_positions.length > 0 
      ? comma_positions 
      : [];
    const finalSpans = spans && Array.isArray(spans) ? spans : [];
    
    // Если comma_positions пустой, вычисляем автоматически
    if (finalCommaPositions.length === 0) {
      // Получаем текущие значения из базы для вычисления
      const currentTask = db.prepare('SELECT base_text, commaless_text, source_text FROM task17 WHERE id = ?').get(id);
      const textToUse = {
        base_text: normalizedBaseText || normalizeText(currentTask?.base_text || ''),
        commaless_text: normalizedCommalessText || normalizeText(currentTask?.commaless_text || ''),
        source_text: normalizedSourceText || normalizeSourceText(currentTask?.source_text || '')
      };
      
      // Пытаемся вычислить из base_text (приоритет)
      if (textToUse.base_text && textToUse.commaless_text) {
        finalCommaPositions = calculateCommaPositions(textToUse.base_text, textToUse.commaless_text);
      } 
      // Если не получилось из base_text, пытаемся из digits (если есть)
      else if (digits && Array.isArray(digits) && digits.length > 0 && textToUse.source_text && textToUse.commaless_text) {
        finalCommaPositions = calculateCommaPositionsFromDigits(textToUse.source_text, textToUse.commaless_text, digits);
      }
    } else {
      // Если позиции были переданы, пересчитываем их для нормализованного текста
      const currentTask = db.prepare('SELECT commaless_text FROM task17 WHERE id = ?').get(id);
      const oldCommaless = currentTask?.commaless_text || '';
      const newCommaless = normalizedCommalessText || normalizeText(oldCommaless);
      finalCommaPositions = recalculateCommaPositionsForNormalized(oldCommaless, newCommaless, finalCommaPositions);
    }
    
    // Валидация индексов только если есть позиции
    if (normalizedCommalessText && finalCommaPositions.length > 0) {
      // Валидируем относительно нормализованного commaless_text
      if (!validateOffsets(normalizedCommalessText, finalCommaPositions)) {
        return res.status(400).json({ error: 'Некорректные индексы в comma_positions' });
      }
    }
    
    // Валидация спанов только если они есть
    if (commaless_text) {
      for (const span of finalSpans) {
        if (span.startOffset < 0 || span.endOffset > commaless_text.length || span.startOffset >= span.endOffset) {
          return res.status(400).json({ error: `Некорректные offsets в span: ${JSON.stringify(span)}` });
        }
        if (span.type !== 'participle' && span.type !== 'gerund') {
          return res.status(400).json({ error: `Некорректный тип span: ${span.type}` });
        }
      }
    }
    
    // Обновляем ответы, если переданы
    if (digits !== undefined || comma_positions !== undefined || spans !== undefined) {
      const existing = db.prepare('SELECT task_id FROM task17_answer WHERE task_id = ?').get(id);
      
      if (existing) {
        const current = db.prepare('SELECT digits_json, comma_positions_json, spans_json FROM task17_answer WHERE task_id = ?').get(id);
        const currentDigits = JSON.parse(current.digits_json);
        const currentCommas = JSON.parse(current.comma_positions_json);
        const currentSpans = JSON.parse(current.spans_json);
        
        db.prepare(`
          UPDATE task17_answer
          SET digits_json = ?,
              comma_positions_json = ?,
              spans_json = ?
          WHERE task_id = ?
        `).run(
          JSON.stringify(digits !== undefined ? digits : currentDigits),
          JSON.stringify(comma_positions !== undefined ? finalCommaPositions : currentCommas),
          JSON.stringify(spans !== undefined ? finalSpans : currentSpans),
          id
        );
      } else {
        // Если ответов нет, но переданы данные - создаем
        if (digits !== undefined || comma_positions !== undefined || spans !== undefined) {
          db.prepare(`
            INSERT INTO task17_answer (task_id, digits_json, comma_positions_json, spans_json)
            VALUES (?, ?, ?, ?)
          `).run(
            id,
            JSON.stringify(digits !== undefined ? digits : []),
            JSON.stringify(finalCommaPositions),
            JSON.stringify(finalSpans)
          );
        }
      }
    }
    
    res.json({ message: 'Задание обновлено' });
  } catch (error) {
    console.error('Ошибка обновления задания:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка обновления задания',
      details: error.message 
    });
  }
});

// DELETE /api/task17/:id - удалить задание
task17.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare('DELETE FROM task17 WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    res.json({ message: 'Задание удалено' });
  } catch (error) {
    console.error('Ошибка удаления задания:', error);
    res.status(500).json({ error: 'Ошибка удаления задания' });
  }
});

/* ----------------------
   УЧЕБНЫЙ РЕЖИМ
----------------------- */

// GET /api/task17/:id/play - получить задание для решения
task17.get('/:id/play', (req, res) => {
  try {
    const { id } = req.params;
    const mode = req.query.mode || 'digits'; // 'digits' или 'commas'
    
    if (mode !== 'digits' && mode !== 'commas') {
      return res.status(400).json({ error: 'mode должен быть "digits" или "commas"' });
    }
    
    const task = db.prepare(`
      SELECT source_text, commaless_text, answer_text, explanation_md
      FROM task17
      WHERE id = ?
    `).get(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    // Для режима commas: всегда восстанавливаем commaless_text из source_text,
    // чтобы гарантировать правильные пробелы (на случай, если в БД сохранен неправильный текст)
    let displayText = mode === 'digits' ? task.source_text : task.commaless_text;
    
    if (mode === 'commas' && task.source_text) {
      // Восстанавливаем commaless_text из source_text с правильными пробелами
      displayText = restoreCommalessText(task.source_text);
      // Нормализуем результат
      displayText = normalizeText(displayText);
      console.log('[PLAY] Восстановленный и нормализованный commaless_text, длина:', displayText.length);
    } else if (mode === 'commas') {
      // Если source_text нет, нормализуем commaless_text
      displayText = normalizeText(displayText);
    }
    
    res.json({
      mode,
      text: displayText,
      source_text: task.source_text, // Добавляем исходный текст с цифрами для копирования
      allowSpanSelection: true,
      explanation: {
        answer_text: task.answer_text || null,
        explanation_md: task.explanation_md || null
      }
    });
  } catch (error) {
    console.error('Ошибка получения задания для решения:', error);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
});

// POST /api/task17/:id/check - проверить ответ
task17.post('/:id/check', (req, res) => {
  try {
    const { id } = req.params;
    const { mode, digits, comma_positions, spans } = req.body;
    
    if (!mode || (mode !== 'digits' && mode !== 'commas')) {
      return res.status(400).json({ error: 'mode должен быть "digits" или "commas"' });
    }
    
    // Получаем задание и эталонные ответы
    const task = db.prepare(`
      SELECT source_text, base_text, commaless_text, answer_text, explanation_md, reveal_policy
      FROM task17
      WHERE id = ?
    `).get(id);
    
    console.log('[CHECK] Загружено задание из БД:');
    console.log('[CHECK] task.id:', id);
    console.log('[CHECK] task.source_text:', task?.source_text);
    console.log('[CHECK] task.base_text:', task?.base_text);
    console.log('[CHECK] task.commaless_text:', task?.commaless_text);
    
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }
    
    const answer = db.prepare(`
      SELECT digits_json, comma_positions_json, spans_json
      FROM task17_answer
      WHERE task_id = ?
    `).get(id);
    
    if (!answer) {
      return res.status(500).json({ error: 'Эталонные ответы не найдены' });
    }
    
    const expectedDigits = JSON.parse(answer.digits_json);
    let expectedCommas = JSON.parse(answer.comma_positions_json);
    const expectedSpans = JSON.parse(answer.spans_json);
    
    console.log('[CHECK] Исходные позиции из БД:', expectedCommas);
    console.log('[CHECK] base_text:', task.base_text);
    console.log('[CHECK] commaless_text:', task.commaless_text);
    console.log('[CHECK] mode:', mode);
    
    // Если позиции запятых пустые, вычисляем автоматически
    if (!expectedCommas || expectedCommas.length === 0) {
      let baseTextToUse = task.base_text;
      let commalessTextToUse = task.commaless_text;
      
      // Если base_text отсутствует, пытаемся восстановить его из source_text
      // с учетом правильных цифр из ответа
      if (!baseTextToUse && task.source_text) {
        console.log('[CHECK] base_text отсутствует, восстанавливаем из source_text с учетом правильных цифр...');
        
        // Получаем правильные цифры из ответа
        const correctDigitsSet = new Set(expectedDigits.map(d => Number(d)));
        console.log('[CHECK] Правильные цифры для восстановления base_text:', Array.from(correctDigitsSet));
        
        // Восстанавливаем base_text: заменяем метки (N) на запятые, если N в правильных цифрах
        let reconstructedBase = task.source_text;
        const digitRegex = /\((\d+)\)/g;
        const replacements = [];
        let match;
        
        // Собираем все замены (с конца, чтобы индексы не сдвигались)
        while ((match = digitRegex.exec(task.source_text)) !== null) {
          const digit = parseInt(match[1], 10);
          const shouldAddComma = correctDigitsSet.has(digit);
          replacements.push({
            index: match.index,
            length: match[0].length,
            shouldAddComma: shouldAddComma
          });
        }
        
        // Применяем замены с конца
        for (let i = replacements.length - 1; i >= 0; i--) {
          const rep = replacements[i];
          const before = reconstructedBase.substring(0, rep.index);
          const after = reconstructedBase.substring(rep.index + rep.length);
          if (rep.shouldAddComma) {
            reconstructedBase = before + ',' + after;
          } else {
            reconstructedBase = before + after;
          }
        }
        
        // Убираем множественные пробелы
        baseTextToUse = reconstructedBase.replace(/\s+/g, ' ').trim();
        console.log('[CHECK] Восстановленный base_text:', baseTextToUse);
      }
      
      // Если commaless_text отсутствует, создаем его из base_text
      if (!commalessTextToUse && baseTextToUse) {
        console.log('[CHECK] commaless_text отсутствует, создаем из base_text...');
        commalessTextToUse = baseTextToUse.replace(/,/g, '');
        console.log('[CHECK] Созданный commaless_text:', commalessTextToUse);
      }
      
      // Пытаемся вычислить из base_text (приоритет)
      if (baseTextToUse && commalessTextToUse) {
        console.log('[CHECK] Вычисляем позиции автоматически из base_text...');
        expectedCommas = calculateCommaPositions(baseTextToUse, commalessTextToUse);
        console.log('[CHECK] Вычисленные позиции запятых из base_text:', expectedCommas);
      } 
      // Если не получилось из base_text, в режиме commas пытаемся из digits
      else if (mode === 'commas' && expectedDigits && expectedDigits.length > 0 && task.source_text && task.commaless_text) {
        console.log('[CHECK] Вычисляем позиции запятых из digits...');
        expectedCommas = calculateCommaPositionsFromDigits(task.source_text, task.commaless_text, expectedDigits);
        console.log('[CHECK] Вычисленные позиции запятых из digits:', expectedCommas);
      } else {
        console.log('[CHECK] Позиции НЕ вычисляются автоматически, причина:');
        if (!baseTextToUse) console.log('[CHECK] - base_text отсутствует и не может быть восстановлен');
        if (!commalessTextToUse) console.log('[CHECK] - commaless_text отсутствует и не может быть создан');
      }
    } else {
      console.log('[CHECK] Используем позиции из БД');
    }
    
    // Финальная проверка expectedCommas
    console.log('[CHECK] ФИНАЛЬНЫЙ expectedCommas перед проверкой:', expectedCommas);
    console.log('[CHECK] ФИНАЛЬНЫЙ expectedCommas.length:', expectedCommas?.length);
    
    // Нормализуем commaless_text для режима commas (как на клиенте)
    // Если commaless_text был восстановлен из source_text, используем его
    // ВАЖНО: используем тот же алгоритм, что и в /api/task17/:id/play
    let normalizedCommaless;
    let needRecalculatePositions = false;
    if (mode === 'commas' && task.source_text) {
      // Восстанавливаем commaless_text из source_text с правильными пробелами
      const restored = restoreCommalessText(task.source_text);
      // Нормализуем результат (как в /api/task17/:id/play)
      normalizedCommaless = normalizeText(restored);
      console.log('[CHECK] Восстановленный commaless_text из source_text, длина:', normalizedCommaless.length);
      console.log('[CHECK] Первые 100 символов:', normalizedCommaless.substring(0, 100));
      
      // Проверяем, совпадает ли восстановленный текст с текстом из БД
      const normalizedDbText = normalizeText(task.commaless_text || '');
      if (normalizedCommaless !== normalizedDbText) {
        console.log('[CHECK] Восстановленный текст отличается от текста в БД!');
        console.log('[CHECK] Длина восстановленного:', normalizedCommaless.length);
        console.log('[CHECK] Длина из БД:', normalizedDbText.length);
        // Нужно пересчитать позиции для восстановленного текста
        needRecalculatePositions = true;
      }
    } else {
      // Если source_text нет, нормализуем commaless_text из БД
      normalizedCommaless = normalizeText(task.commaless_text || '');
    }
    
    // Если текст отличается, пересчитываем позиции для восстановленного текста
    if (needRecalculatePositions && expectedCommas && expectedCommas.length > 0) {
      console.log('[CHECK] Пересчитываем позиции для восстановленного текста...');
      console.log('[CHECK] Старые позиции из БД:', expectedCommas);
      // Используем base_text или source_text с правильными цифрами для пересчета
      if (task.base_text) {
        const normalizedBase = normalizeText(task.base_text);
        expectedCommas = calculateCommaPositions(normalizedBase, normalizedCommaless);
        console.log('[CHECK] Пересчитанные позиции из base_text:', expectedCommas);
      } else if (task.source_text && expectedDigits && expectedDigits.length > 0) {
        expectedCommas = calculateCommaPositionsFromDigits(task.source_text, normalizedCommaless, expectedDigits);
        console.log('[CHECK] Пересчитанные позиции из digits:', expectedCommas);
      } else {
        console.log('[CHECK] Не удалось пересчитать позиции, используем старые из БД');
      }
    }
    
    // ВАЖНО: В режиме commas ВСЕГДА пересчитываем позиции для восстановленного текста
    // Позиции в БД могут быть рассчитаны для commaless_text из БД, который может отличаться от восстановленного
    // Поэтому мы всегда пересчитываем позиции, используя base_text или source_text с правильными цифрами
    if (mode === 'commas') {
      console.log('[CHECK] Режим commas: пересчитываем позиции для восстановленного текста');
      console.log('[CHECK] Длина восстановленного текста:', normalizedCommaless.length);
      console.log('[CHECK] Количество пробелов в восстановленном тексте:', (normalizedCommaless.match(/\s/g) || []).length);
      console.log('[CHECK] Старые позиции из БД:', expectedCommas);
      console.log('[CHECK] task.base_text:', task.base_text ? 'есть' : 'нет');
      console.log('[CHECK] task.source_text:', task.source_text ? 'есть' : 'нет');
      console.log('[CHECK] expectedDigits:', expectedDigits);
      
      // ВСЕГДА пересчитываем позиции для восстановленного текста
      // Используем base_text (приоритет) или source_text с правильными цифрами
      let recalculated = false;
      let oldExpectedCommas = expectedCommas;
      
      if (task.base_text) {
        console.log('[CHECK] Пересчитываем позиции из base_text...');
        const normalizedBase = normalizeText(task.base_text);
        console.log('[CHECK] normalizedBase длина:', normalizedBase.length);
        console.log('[CHECK] normalizedCommaless длина:', normalizedCommaless.length);
        expectedCommas = calculateCommaPositions(normalizedBase, normalizedCommaless);
        console.log('[CHECK] Пересчитанные позиции из base_text:', expectedCommas);
        console.log('[CHECK] Старые позиции были:', oldExpectedCommas);
        recalculated = true;
      } else if (task.source_text && expectedDigits && expectedDigits.length > 0) {
        console.log('[CHECK] Пересчитываем позиции из digits...');
        console.log('[CHECK] task.source_text длина:', task.source_text.length);
        console.log('[CHECK] normalizedCommaless длина:', normalizedCommaless.length);
        console.log('[CHECK] expectedDigits:', expectedDigits);
        expectedCommas = calculateCommaPositionsFromDigits(task.source_text, normalizedCommaless, expectedDigits);
        console.log('[CHECK] Пересчитанные позиции из digits:', expectedCommas);
        console.log('[CHECK] Старые позиции были:', oldExpectedCommas);
        recalculated = true;
      }
      
      if (!recalculated) {
        console.log('[CHECK] ВНИМАНИЕ: Не удалось пересчитать позиции!');
        console.log('[CHECK] task.base_text:', task.base_text ? `есть (длина: ${task.base_text.length})` : 'нет');
        console.log('[CHECK] task.source_text:', task.source_text ? `есть (длина: ${task.source_text.length})` : 'нет');
        console.log('[CHECK] expectedDigits:', expectedDigits);
        console.log('[CHECK] Используем старые позиции из БД (могут быть невалидными)');
        // Фильтруем невалидные позиции
        const maxPosition = normalizedCommaless.length - 1;
        expectedCommas = (expectedCommas || []).filter(p => {
          const pos = Number(p);
          return !isNaN(pos) && pos >= 0 && pos <= maxPosition;
        });
        console.log('[CHECK] Отфильтрованные позиции:', expectedCommas);
      }
      
      // Убеждаемся, что expectedCommas - это массив
      if (!Array.isArray(expectedCommas)) {
        console.log('[CHECK] ВНИМАНИЕ: expectedCommas не массив, инициализируем пустым массивом');
        expectedCommas = [];
      }
    }
    
    // Валидация пользовательских данных
    if (mode === 'digits') {
      if (!digits || !Array.isArray(digits)) {
        return res.status(400).json({ error: 'digits обязателен для mode=digits' });
      }
      // В режиме digits не валидируем comma_positions
    } else {
      // НОВАЯ ЛОГИКА: разрешаем пустой массив - пользователь может отправить ответ без выбора запятых
      if (!comma_positions || !Array.isArray(comma_positions)) {
        return res.status(400).json({ error: 'comma_positions должен быть массивом для mode=commas' });
      }
      // НОВАЯ ЛОГИКА: comma_positions теперь содержит индексы пробелов (0, 1, 2...), а не позиции
      // Валидируем, что индексы не превышают количество пробелов в тексте (только если массив не пустой)
      if (comma_positions.length > 0) {
        const spaceCount = (normalizedCommaless.match(/\s/g) || []).length;
        const maxIndex = spaceCount - 1;
        for (const idx of comma_positions) {
          const index = Number(idx);
          if (isNaN(index) || index < 0 || index > maxIndex) {
            return res.status(400).json({ 
              error: `Некорректный индекс пробела: ${index}. Допустимый диапазон: 0-${maxIndex}` 
            });
          }
        }
      }
    }
    
    if (spans) {
      if (!Array.isArray(spans)) {
        return res.status(400).json({ error: 'spans должен быть массивом' });
      }
      for (const span of spans) {
        if (span.startOffset < 0 || span.endOffset > task.commaless_text.length || span.startOffset >= span.endOffset) {
          return res.status(400).json({ error: `Некорректные offsets в span: ${JSON.stringify(span)}` });
        }
      }
    }
    
    // Проверка цифр
    let digitsResult = null;
    if (mode === 'digits') {
      // Преобразуем все значения в числа для корректного сравнения
      const expectedNums = expectedDigits.map(d => Number(d)).sort((a, b) => a - b);
      const userNums = digits.map(d => Number(d)).sort((a, b) => a - b);
      
      const expectedSet = new Set(expectedNums);
      const userSet = new Set(userNums);
      
      const missing = expectedNums.filter(d => !userSet.has(d));
      const extra = userNums.filter(d => !expectedSet.has(d));
      const isCorrect = missing.length === 0 && extra.length === 0;
      
      digitsResult = { isCorrect, missing, extra };
    }
    
    // Проверка запятых
    let commasResult = null;
    let expectedCommasNums = null;
    let expectedSpaceIndices = []; // Индексы пробелов для режима commas
    if (mode === 'commas') {
      // НОВАЯ ЛОГИКА: преобразуем индексы пробелов в позиции в тексте
      // Функция для преобразования индексов пробелов в позиции
      function convertSpaceIndicesToPositions(text, spaceIndices) {
        const normalizedText = normalizeText(text);
        const spacePositions = [];
        let spaceIndex = 0;
        
        for (let i = 0; i < normalizedText.length; i++) {
          if (normalizedText[i] === ' ') {
            if (spaceIndices.includes(spaceIndex)) {
              spacePositions.push(i);
            }
            spaceIndex++;
          }
        }
        
        return spacePositions;
      }
      
      // НОВАЯ ЛОГИКА: expectedCommas теперь уже содержит индексы пробелов (0, 1, 2...)
      // Функция calculateCommaPositions теперь возвращает индексы пробелов напрямую
      // Нужно только проверить валидность индексов
      console.log('[CHECK] Проверка валидности индексов пробелов:');
      console.log('[CHECK] normalizedCommaless длина:', normalizedCommaless.length);
      console.log('[CHECK] normalizedCommaless первые 100 символов:', normalizedCommaless.substring(0, 100));
      const spaceCount = (normalizedCommaless.match(/\s/g) || []).length;
      console.log('[CHECK] Количество пробелов в normalizedCommaless:', spaceCount);
      console.log('[CHECK] expectedCommas (индексы пробелов):', expectedCommas);
      
      // ВАЖНО: проверяем, что все индексы валидны
      const maxValidIndex = spaceCount - 1;
      expectedSpaceIndices = (expectedCommas || []).filter(idx => {
        const index = Number(idx);
        return !isNaN(index) && index >= 0 && index <= maxValidIndex;
      });
      
      if (expectedSpaceIndices.length !== (expectedCommas || []).length) {
        console.log('[CHECK] ВНИМАНИЕ: Некоторые индексы невалидны!');
        console.log('[CHECK] Валидные индексы:', expectedSpaceIndices);
        console.log('[CHECK] Невалидные индексы:', (expectedCommas || []).filter(idx => {
          const index = Number(idx);
          return isNaN(index) || index < 0 || index > maxValidIndex;
        }));
      }
      
      console.log('[CHECK] Валидные индексы пробелов:', expectedSpaceIndices);
      console.log('[CHECK] Количество индексов пробелов:', expectedSpaceIndices.length);
      
      // Пользовательские индексы уже в формате индексов пробелов (0, 1, 2...)
      const userSpaceIndices = comma_positions.map(p => Number(p));
      
      console.log('[CHECK] Ожидаемые индексы пробелов (после преобразования):', expectedSpaceIndices);
      console.log('[CHECK] Пользовательские индексы пробелов:', userSpaceIndices);
      console.log('[CHECK] Количество пробелов в тексте:', (normalizedCommaless.match(/\s/g) || []).length);
      
      const expectedSet = new Set(expectedSpaceIndices);
      const userSet = new Set(userSpaceIndices);
      
      const missing = expectedSpaceIndices.filter(idx => !userSet.has(idx));
      const extra = userSpaceIndices.filter(idx => !expectedSet.has(idx));
      const isCorrect = missing.length === 0 && extra.length === 0;
      
      console.log('[CHECK] Отсутствующие индексы:', missing);
      console.log('[CHECK] Лишние индексы:', extra);
      console.log('[CHECK] Правильно:', isCorrect);
      
      // expectedCommasNums оставляем для обратной совместимости (но не используем)
      expectedCommasNums = expectedCommas && expectedCommas.length > 0 
        ? expectedCommas.map(p => Number(p))
        : [];
      
      commasResult = { isCorrect, missing, extra };
    }
    
    // Проверка спанов
    const userSpans = spans || [];
    const spansReport = matchSpans(expectedSpans, userSpans);
    const spansCorrect = spansReport.filter(r => r.ok && r.target !== null).length;
    const spansTotal = expectedSpans.length;
    const spansOk = spansCorrect === spansTotal && userSpans.length === spansTotal;
    
    // Подсчет баллов
    // В задании 17 можно заработать только 1 балл: 1 если все правильно, 0 если есть ошибки
    const digitsOrCommasOk = mode === 'digits' ? digitsResult.isCorrect : commasResult.isCorrect;
    const score = {
      digitsOrCommas: digitsOrCommasOk ? 1 : 0,
      spans: 0, // Спаны не учитываются в баллах
      total: digitsOrCommasOk ? 1 : 0,
      max: 1
    };
    
    // Определяем, показывать ли объяснение
    let explanation = null;
    const shouldShow = 
      task.reveal_policy === 'always' ||
      (task.reveal_policy === 'after_check') ||
      (task.reveal_policy === 'after_correct' && digitsOrCommasOk && spansOk);
    
    if (shouldShow) {
      explanation = {
        answer_text: task.answer_text,
        explanation_md: task.explanation_md,
        shown: true
      };
    } else {
      explanation = { shown: false };
    }
    
    // Логируем попытку
    try {
      db.prepare(`
        INSERT INTO task17_attempt (
          task_id, mode, user_digits_json, user_comma_positions_json, user_spans_json,
          is_correct_digits, is_correct_commas, spans_report_json, explanation_shown
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        mode,
        mode === 'digits' ? JSON.stringify(digits) : null,
        mode === 'commas' ? JSON.stringify(comma_positions) : null,
        JSON.stringify(userSpans),
        mode === 'digits' ? (digitsResult.isCorrect ? 1 : 0) : null,
        mode === 'commas' ? (commasResult.isCorrect ? 1 : 0) : null,
        JSON.stringify(spansReport),
        explanation.shown ? 1 : 0
      );
    } catch (logError) {
      console.error('Ошибка логирования попытки:', logError);
    }
    
    // Формируем ответ
    let correctAnswer = null;
    if (mode === 'digits') {
      correctAnswer = expectedDigits.map(d => Number(d)).sort((a, b) => a - b);
    } else if (mode === 'commas') {
      // НОВАЯ ЛОГИКА: возвращаем индексы пробелов (0, 1, 2...), а не позиции
      // expectedSpaceIndices уже содержит индексы пробелов
      if (expectedSpaceIndices && expectedSpaceIndices.length > 0) {
        correctAnswer = expectedSpaceIndices.sort((a, b) => a - b);
      } else {
        // Если expectedSpaceIndices пустой, возвращаем пустой массив
        correctAnswer = [];
        console.log('[CHECK] ВНИМАНИЕ: correctAnswer пустой! expectedSpaceIndices:', expectedSpaceIndices);
      }
    }
    
    console.log('[CHECK] correctAnswer для отправки:', correctAnswer);
    console.log('[CHECK] mode:', mode);
    console.log('[CHECK] expectedCommasNums:', expectedCommasNums);
    console.log('[CHECK] expectedCommas (исходные):', expectedCommas);
    const response = {
      digits: digitsResult,
      commas: commasResult,
      spans: spansReport,
      score,
      explanation,
      correctAnswer
    };
    
    console.log('[CHECK] Полный ответ:', JSON.stringify(response, null, 2));
    
    res.json(response);
  } catch (error) {
    console.error('Ошибка проверки ответа:', error);
    res.status(500).json({ error: 'Ошибка проверки ответа' });
  }
});

export default task17;
