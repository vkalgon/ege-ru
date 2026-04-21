/**
 * Универсальная карточка «строки + номера + проверка» для заданий №9–12.
 * Параметры типа задания — в PRESETS; снаружи по-прежнему renderTask9CardHTML / initTask9Card и т.д.
 */
(function (global) {
  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function parseIndicesFromInput(str) {
    const set = new Set();
    const cleaned = String(str || '').replace(/\s/g, '');
    for (const ch of cleaned) {
      const d = parseInt(ch, 10);
      if (!Number.isNaN(d) && d >= 1 && d <= 9) set.add(d);
    }
    return set;
  }

  function formatAnswerFromSelection(state) {
    return Array.from(state.selectedRowIndices)
      .filter((i) => state.validRowIndices.has(i))
      .sort((a, b) => a - b)
      .join('');
  }

  function renderWord(w, preset) {
    const raw = w[preset.displayField] != null ? String(w[preset.displayField]) : '';
    const parts = raw.split('..');
    return `<span class="task9-word" data-word-id="${w.word_id}">
      ${escHtml(parts[0])}<input
        type="text" maxlength="${preset.inputMaxLength}"
        data-word-id="${w.word_id}"
        placeholder="·"
        onclick="event.stopPropagation()"
        oninput="this.value=this.value.toLowerCase().slice(-1)"
      />${escHtml(parts[1] || '')}
    </span>`;
  }

  function getCorrectLetter(w, preset) {
    return w[preset.correctField];
  }

  /* ── Решение только для №9 ─────────────────────────────── */
  function formatWordSolutionLine9(w) {
    const full = String(w.word_display).includes('..')
      ? String(w.word_display).replace(/\.\./, w.correct_vowel)
      : w.word_display;
    const bits = [];
    bits.push(
      '<strong>' + escHtml(full) + '</strong> — буква «' + escHtml(w.correct_vowel) + '», пара ' + escHtml(w.vowel_pair)
    );
    if (w.category === 'verifiable') {
      bits.push('безударная проверяемая');
      if (w.verification_word) bits.push('проверка: ' + escHtml(w.verification_word));
    } else if (w.category === 'unverifiable') {
      bits.push('безударная непроверяемая');
    } else if (w.category === 'alternating') {
      bits.push('чередующийся корень');
      if (w.alternation_rule) bits.push('правило: ' + escHtml(w.alternation_rule));
    }
    return bits.join('. ') + '.';
  }

  function buildSolutionPanelHtml9(data) {
    let h = '<div class="task-card task17-card task9-solution-card">';
    h += '<div class="task-meta"><span class="task-meta__number">Решение</span></div>';
    h += '<div class="task-content task9-solution-body" style="gap:14px;">';
    h +=
      '<p class="task-prompt" style="margin:0;font-size:15px;line-height:1.5;"><strong>Отметить строки:</strong> ' +
      (data.correct_line_numbers && data.correct_line_numbers.length
        ? data.correct_line_numbers.join(', ')
        : '—') +
      '. В отмеченных строках во всех словах в корне одна и та же буква.</p>';
    for (const row of data.rows) {
      h += '<div class="task9-solution-row">';
      h +=
        '<div style="font-weight:600;margin-bottom:8px;font-size:15px;">Строка ' +
        row.row_index +
        (row.is_correct
          ? ' <span style="color:var(--brand);font-weight:500;">— отметить</span>'
          : ' <span style="color:var(--text-secondary);font-weight:500;">— не отмечать</span>') +
        '</div>';
      h += '<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.55;color:var(--text-primary);">';
      for (const w of row.words) {
        h += '<li style="margin-bottom:8px;">' + formatWordSolutionLine9(w) + '</li>';
      }
      h += '</ul></div>';
    }
    h += '</div></div>';
    return h;
  }

  function buildSolutionPanelHtmlGeneric(data, preset) {
    let h = '<div class="task-card task17-card task9-solution-card">';
    h += '<div class="task-meta"><span class="task-meta__number">Решение</span></div>';
    h += '<div class="task-content task9-solution-body" style="gap:14px;">';
    h +=
      '<p class="task-prompt" style="margin:0;font-size:15px;line-height:1.5;"><strong>Отметить строки:</strong> ' +
      (data.correct_line_numbers && data.correct_line_numbers.length
        ? data.correct_line_numbers.join(', ')
        : '—') +
      '.</p>';
    for (const row of data.rows) {
      h += '<div class="task9-solution-row">';
      h +=
        '<div style="font-weight:600;margin-bottom:8px;font-size:15px;">Строка ' +
        row.row_index +
        (row.is_correct
          ? ' <span style="color:var(--brand);font-weight:500;">— отметить</span>'
          : ' <span style="color:var(--text-secondary);font-weight:500;">— не отмечать</span>') +
        '</div>';
      h += '<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.55;color:var(--text-primary);">';
      for (const w of row.words) {
        const raw = String(w[preset.displayField] || '');
        const letter = escHtml(String(w[preset.correctField] || ''));
        const full = raw.replace('..', '<strong style="color:var(--brand);">' + letter + '</strong>');
        h += '<li style="margin-bottom:4px;">' + full + '</li>';
      }
      h += '</ul></div>';
    }
    h += '</div></div>';
    return h;
  }

  const PRESETS = {
    task9: {
      key: 'task9',
      num: 9,
      listPath: '/task9',
      apiBase: '/api/task9',
      displayField: 'word_display',
      inputMaxLength: 1,
      correctField: 'correct_letter',
      instructionHtml:
        'Вставьте пропущенные буквы в каждое слово и отметьте строки,\n' +
        'в которых во всех словах можно вставить <strong>одну и ту же букву</strong>.',
      showSolutionButton: true,
    },
    task10: {
      key: 'task10',
      num: 10,
      listPath: '/task10',
      apiBase: '/api/task10',
      displayField: 'prefix_display',
      inputMaxLength: 2,
      correctField: 'correct_letter',
      instructionHtml:
        'Вставьте пропущенную букву в приставке каждого слова и отметьте строки,\n' +
        'в которых во всех трёх словах пишется <strong>одна и та же буква</strong>.',
      showSolutionButton: true,
    },
    task11: {
      key: 'task11',
      num: 11,
      listPath: '/task11',
      apiBase: '/api/task11',
      displayField: 'suffix_display',
      inputMaxLength: 2,
      correctField: 'correct_vowel',
      instructionHtml:
        'Вставьте пропущенную букву в суффиксе каждого слова и отметьте строки,\n' +
        'в которых во всех трёх словах пишется <strong>одна и та же буква</strong>.',
      showSolutionButton: true,
    },
    task12: {
      key: 'task12',
      num: 12,
      listPath: '/task12',
      apiBase: '/api/task12',
      displayField: 'word_display',
      inputMaxLength: 2,
      correctField: 'correct_letter',
      instructionHtml:
        'Вставьте пропущенную букву в каждом слове и отметьте строки,\n' +
        'в которых в <strong>обоих</strong> словах пишется <strong>одна и та же буква</strong>\n' +
        '(одно спряжение / одно правило).',
      showSolutionButton: false,
    },
  };

  function renderTaskPlayCardHTML(presetId, taskId, task, opts) {
    const preset = PRESETS[presetId];
    if (!preset) throw new Error('Unknown task preset: ' + presetId);
    const o = opts || {};
    const standalone = !!o.standalone;
    const listLink = standalone
      ? `<a href="${preset.listPath}" class="btn btn-secondary task9-back-btn">← К списку</a>`
      : '';

    const rowsHtml = task.rows
      .map(
        (row) => `
      <div class="task9-line" data-row-id="${row.id}" data-row-index="${row.row_index}">
        <button type="button" class="task9-num-square" data-row-index="${row.row_index}"
          aria-pressed="false" aria-label="Номер ${row.row_index}">${row.row_index}</button>
        <div class="task9-words-row">
          ${row.words.map((w) => renderWord(w, preset)).join('')}
        </div>
      </div>
    `
      )
      .join('');

    const instruction = preset.instructionHtml.replace(/\n/g, ' ');

    const solutionBtnHtml = preset.showSolutionButton
      ? `<button type="button" class="btn btn-secondary task9-back-btn" id="${preset.key}-solution-btn-${taskId}">Решение</button>`
      : '';

    const solutionWrapHtml = preset.showSolutionButton
      ? `<div class="task9-solution-wrap" id="${preset.key}-solution-wrap-${taskId}" style="display:none;margin-top:16px;"></div>`
      : '';

    return `
      <div class="task-card task17-card task9-play-card">
        <div class="task-meta">
          <span class="task-meta__number">№ ${preset.num}</span>
          <span class="task-meta__source">Задание #${taskId}</span>
        </div>
        <div class="task-content">
          <p class="task-prompt task9-instruction" style="margin:0;">${instruction}</p>

          <div class="task9-all-rows">
            ${rowsHtml}
          </div>

          <div class="task-controls task9-task-controls">
            <input
              type="text"
              id="${preset.key}-answer-${taskId}"
              class="task-input"
              placeholder="Номера строк — впишите вручную или отметьте квадраты слева"
              inputmode="numeric"
              autocomplete="off"
            />
            <button type="button" class="task-send" id="${preset.key}-check-${taskId}">Проверить</button>
            ${solutionBtnHtml}
            ${listLink}
          </div>
          ${solutionWrapHtml}
        </div>
      </div>
      <div class="task-play-card-result" id="${preset.key}-result-${taskId}" style="display:none;margin-top:16px;"></div>
    `;
  }

  function initTaskPlayCard(presetId, root, taskId, task, opts) {
    const preset = PRESETS[presetId];
    if (!preset) throw new Error('Unknown task preset: ' + presetId);
    const o = opts || {};
    const standalone = !!o.standalone;
    const state = {
      selectedRowIndices: new Set(),
      validRowIndices: new Set(task.rows.map((r) => r.row_index)),
    };

    const answerEl = root.querySelector('#' + preset.key + '-answer-' + taskId);
    const checkBtn = root.querySelector('#' + preset.key + '-check-' + taskId);

    function updateNumSquares() {
      root.querySelectorAll('.task9-num-square').forEach((btn) => {
        const idx = +btn.dataset.rowIndex;
        const on = state.selectedRowIndices.has(idx);
        btn.classList.toggle('selected', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function syncInputFromSelection() {
      if (!answerEl) return;
      answerEl.value = formatAnswerFromSelection(state);
      updateNumSquares();
    }

    function syncSelectionFromInput() {
      if (!answerEl) return;
      const parsed = parseIndicesFromInput(answerEl.value);
      state.selectedRowIndices = new Set([...parsed].filter((i) => state.validRowIndices.has(i)));
      const normalized = formatAnswerFromSelection(state);
      if (answerEl.value.replace(/\s/g, '') !== normalized) answerEl.value = normalized;
      updateNumSquares();
    }

    const rowsEl = root.querySelector('.task9-all-rows');
    if (rowsEl) {
      rowsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.task9-num-square');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        const rowIndex = +btn.dataset.rowIndex;
        if (!state.validRowIndices.has(rowIndex)) return;
        if (state.selectedRowIndices.has(rowIndex)) state.selectedRowIndices.delete(rowIndex);
        else state.selectedRowIndices.add(rowIndex);
        syncInputFromSelection();
      });
    }

    if (answerEl) {
      answerEl.addEventListener('input', syncSelectionFromInput);
      answerEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (checkBtn) checkBtn.click();
        }
      });
    }

    function showValidationWarning(message) {
      let warn = root.querySelector('.task9-validation-warn');
      if (!warn) {
        warn = document.createElement('div');
        warn.className = 'task9-validation-warn';
        const controls = root.querySelector('.task9-task-controls');
        if (controls) controls.insertAdjacentElement('afterend', warn);
      }
      warn.textContent = message;
      warn.classList.add('visible');
      clearTimeout(warn._hideTimer);
      warn._hideTimer = setTimeout(() => warn.classList.remove('visible'), 3500);
    }

    function submitCheck() {
      if (state.selectedRowIndices.size === 0) {
        showValidationWarning('Отметьте номера строк, прежде чем проверять');
        if (answerEl) {
          answerEl.classList.add('input-shake');
          answerEl.addEventListener('animationend', () => answerEl.classList.remove('input-shake'), { once: true });
        }
        return;
      }

      const rowEls = root.querySelectorAll('.task9-line');
      const payload = Array.from(rowEls).map((lineEl) => {
        const rowId = +lineEl.dataset.rowId;
        const rowIndex = +lineEl.dataset.rowIndex;
        const selected = state.selectedRowIndices.has(rowIndex);
        const inputs = lineEl.querySelectorAll('input[data-word-id]');
        const letters = Array.from(inputs).map((inp) => ({
          word_id: +inp.dataset.wordId,
          letter: inp.value.trim().toLowerCase(),
        }));
        return { row_id: rowId, selected, letters };
      });

      fetch(preset.apiBase + '/tasks/' + taskId + '/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      })
        .then((r) => r.json())
        .then(showResult);
    }

    function showResult(result) {
      const resultDiv = root.querySelector('#' + preset.key + '-result-' + taskId);
      if (result.error) {
        if (resultDiv) {
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<p style="color:#D69295;margin:0;">' + escHtml(result.error) + '</p>';
        }
        return;
      }

      if (checkBtn) checkBtn.disabled = true;
      if (answerEl) answerEl.disabled = true;
      root.querySelectorAll('.task9-num-square').forEach((btn) => {
        btn.disabled = true;
      });

      result.rows.forEach((row) => {
        const lineEl = root.querySelector('.task9-line[data-row-id="' + row.row_id + '"]');
        if (!lineEl) return;
        lineEl.classList.add(row.selection_correct ? 'result-correct' : 'result-incorrect');

        const sq = lineEl.querySelector('.task9-num-square');
        if (sq) {
          sq.classList.remove('selected');
          sq.classList.add(row.selection_correct ? 'result-num-correct' : 'result-num-incorrect');
        }

        row.words.forEach((w) => {
          const inp = lineEl.querySelector('input[data-word-id="' + w.word_id + '"]');
          if (!inp) return;
          const c = getCorrectLetter(w, preset);
          if (!inp.value && c) inp.value = c;
          inp.classList.add(w.letter_correct ? 'letter-correct' : 'letter-incorrect');
          if (!w.letter_correct) {
            inp.title = c != null && c !== '' ? 'Правильно: «' + String(c) + '»' : 'Правильно: (пусто)';
          }
        });
      });

      const pct = Math.round((result.letters_correct / result.letters_total) * 100);
      const allOk = result.rows_correct && result.letters_correct === result.letters_total;
      if (!resultDiv) return;
      resultDiv.style.display = 'block';

      const correctAnswer = result.rows
        .filter((r) => r.is_correct)
        .map((r) => r.row_index)
        .sort((a, b) => a - b)
        .join('') || '—';
      const userAnswer = result.rows
        .filter((r) => r.user_selected)
        .map((r) => r.row_index)
        .sort((a, b) => a - b)
        .join('') || '—';
      const rowsOk = result.rows_correct;

      const backToListLink = standalone
        ? `<a href="${preset.listPath}" class="btn btn-secondary" style="margin-top:16px;">← Другое задание</a>`
        : '';

      resultDiv.innerHTML = `
        <div class="task-card task17-card">
          <div class="task-meta">
            <span class="task-meta__number">${allOk ? '✓ Верно' : 'Результат'}</span>
          </div>
          <div class="task-content">
            <div class="task-prompt" style="display:flex;flex-direction:column;gap:10px;">
              <div class="play-answer-row">
                <span class="play-answer-label">Правильный ответ:</span>
                <span class="play-answer-value play-answer-correct">${escHtml(correctAnswer)}</span>
              </div>
              <div class="play-answer-row">
                <span class="play-answer-label">Ваш ответ:</span>
                <span class="play-answer-value ${rowsOk ? 'play-answer-ok' : 'play-answer-wrong'}">${escHtml(userAnswer)}</span>
              </div>
              <div style="color:var(--text-secondary);font-size:13px;padding-top:4px;border-top:1px solid var(--border);">
                Буквы: ${result.letters_correct} / ${result.letters_total} (${pct}%)
              </div>
              ${backToListLink}
            </div>
          </div>
        </div>
      `;
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Callback for practice session mode
      if (o.onChecked) o.onChecked(result, resultDiv);
    }

    if (checkBtn) checkBtn.addEventListener('click', submitCheck);

    if (preset.showSolutionButton) {
      const solBtn = root.querySelector('#' + preset.key + '-solution-btn-' + taskId);
      const solWrap = root.querySelector('#' + preset.key + '-solution-wrap-' + taskId);
      if (solBtn && solWrap) {
        solBtn.addEventListener('click', async () => {
          if (solWrap.dataset.loaded === '1') {
            const open = solWrap.style.display !== 'none';
            solWrap.style.display = open ? 'none' : 'block';
            solBtn.textContent = open ? 'Решение' : 'Скрыть решение';
            return;
          }
          solBtn.disabled = true;
          try {
            const res = await fetch(preset.apiBase + '/tasks/' + taskId + '/solution');
            if (!res.ok) throw new Error('Не удалось загрузить решение');
            const data = await res.json();
            solWrap.innerHTML = preset.key === 'task9'
              ? buildSolutionPanelHtml9(data)
              : buildSolutionPanelHtmlGeneric(data, preset);
            solWrap.dataset.loaded = '1';
            solWrap.style.display = 'block';
            solBtn.textContent = 'Скрыть решение';
          } catch (e) {
            alert(e.message || 'Ошибка');
          } finally {
            solBtn.disabled = false;
          }
        });
      }
    }
  }

  function bindPair(name, id) {
    global['renderTask' + name + 'CardHTML'] = function (taskId, task, opts) {
      return renderTaskPlayCardHTML(id, taskId, task, opts);
    };
    global['initTask' + name + 'Card'] = function (root, taskId, task, opts) {
      initTaskPlayCard(id, root, taskId, task, opts);
    };
  }

  bindPair('9', 'task9');
  bindPair('10', 'task10');
  bindPair('11', 'task11');
  bindPair('12', 'task12');

  global.TASK_PLAY_CARD_PRESETS = PRESETS;
})(typeof window !== 'undefined' ? window : globalThis);
