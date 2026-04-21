/**
 * task-card-shell.js
 * Общая оболочка карточки задания — используется во всех заданиях.
 *
 * API:
 *   TaskCardShell.buildCardShell(opts)  → строка HTML оболочки
 *   TaskCardShell.showResult(uid, ok, bodyHtml)  → показывает карточку результата
 *   TaskCardShell.lockCard(uid)  → блокирует все input/button внутри карточки
 *   TaskCardShell.escHtml(s)  → экранирование HTML
 *
 * opts для buildCardShell:
 *   taskNum      — номер задания (например, 5)
 *   taskId       — ID задания из БД
 *   bodyHtml     — HTML внутри .task-content (до кнопок)
 *   controlsHtml — HTML внутри .task-controls (кнопки, инпут)
 *   uid          — уникальный префикс для id-элементов (по умолчанию tc-<taskNum>-<taskId>)
 */
(function (global) {
  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Генерирует HTML стандартной карточки задания.
   * Результирующий DOM:
   *   .task-card.task17-card.task-play-card#<uid>-card
   *     .task-meta
   *       .task-meta__number  «№ N»
   *       .task-meta__source  «Задание #ID»
   *     .task-content
   *       [bodyHtml]
   *       .task-controls
   *         [controlsHtml]
   *   .task-play-result#<uid>-result  (скрыт)
   */
  function buildCardShell(opts) {
    const { taskNum, taskId, bodyHtml = '', controlsHtml = '' } = opts;
    const uid = opts.uid || ('tc-' + taskNum + '-' + taskId);
    return `<div class="task-card task17-card task-play-card" id="${uid}-card">
  <div class="task-meta">
    <span class="task-meta__number">№ ${escHtml(String(taskNum))}</span>
    <span class="task-meta__source">Задание #${escHtml(String(taskId))}</span>
  </div>
  <div class="task-content">
    ${bodyHtml}
    <div class="task-controls">
      ${controlsHtml}
    </div>
  </div>
</div>
<div class="task-play-result" id="${uid}-result" style="display:none;margin-top:16px;"></div>`;
  }

  /**
   * Показывает карточку результата под карточкой задания.
   * uid      — тот же, что передавался в buildCardShell
   * ok       — true = правильный ответ
   * bodyHtml — содержимое внутри .task-content карточки результата
   */
  function showResult(uid, ok, bodyHtml) {
    const el = document.getElementById(uid + '-result');
    if (!el) return;
    el.innerHTML = `<div class="task-card task17-card">
  <div class="task-meta">
    <span class="task-meta__number" style="color:${ok ? 'var(--brand)' : '#D69295'};">${ok ? '✓ Верно' : 'Есть ошибки'}</span>
  </div>
  <div class="task-content" style="gap:12px;">
    ${bodyHtml}
  </div>
</div>`;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Блокирует все интерактивные элементы внутри карточки (после проверки).
   */
  function lockCard(uid) {
    const card = document.getElementById(uid + '-card');
    if (!card) return;
    card.querySelectorAll('input, button, textarea, select').forEach(function (el) {
      el.disabled = true;
    });
  }

  global.TaskCardShell = { buildCardShell, showResult, lockCard, escHtml };
})(typeof window !== 'undefined' ? window : globalThis);
