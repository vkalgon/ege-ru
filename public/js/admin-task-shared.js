/**
 * Общая логика админок заданий №9–12: вкладки, список сгенерированных, кнопка «Сгенерировать»,
 * взаимоисключающие чекбоксы, удаление задания, escHtml / escAttr.
 */
(function (global) {
  const AT = {};

  AT.escHtml = function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  /** Для подстановки в onclick="fn('…')" (атрибут в двойных кавычках). */
  AT.escAttr = function escAttr(s) {
    return String(s ?? '').replace(/'/g, '&#39;');
  };

  /**
   * Заполняет #gen-tasks-list (или listId) только сгенерированными заданиями.
   * @param {object} opt
   * @param {string} opt.apiBase — '/api/task10'
   * @param {string} opt.playPath — '/task10' (ссылка «Открыть»)
   * @param {string} [opt.listId='gen-tasks-list']
   * @param {function(object): string} [opt.rowActionsHtml] — доп. кнопки перед «Удалить»
   * @param {string} [opt.deleteFnName='deleteGenTask']
   */
  AT.renderGeneratedTasksList = async function renderGeneratedTasksList(opt) {
    const listId = opt.listId || 'gen-tasks-list';
    const list = document.getElementById(listId);
    if (!list) return;
    const res = await fetch(opt.apiBase + '/tasks');
    const tasks = await res.json();
    const gen = (tasks || []).filter((t) => t.is_generated);
    if (!gen.length) {
      list.innerHTML =
        '<p style="color:var(--text-secondary);">Сгенерированных заданий пока нет</p>';
      return;
    }
    const delFn = opt.deleteFnName || 'deleteGenTask';
    list.innerHTML = gen.map((t) => AT._generatedRowHtml(t, opt, delFn)).join('');
  };

  AT._generatedRowHtml = function _generatedRowHtml(t, opt, delFn) {
    const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('ru') : '';
    const extra = opt.rowActionsHtml ? opt.rowActionsHtml(t) : '';
    return (
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:var(--radius-lg);">' +
      '<span>Задание #' +
      t.id +
      ' <span style="font-size:11px;color:var(--text-secondary);margin-left:8px;">(сгенерировано)</span>' +
      ' <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">' +
      AT.escHtml(dateStr) +
      '</span></span>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<a href="' +
      opt.playPath +
      '/' +
      t.id +
      '" target="_blank" class="btn btn-sm btn-secondary">Открыть</a>' +
      extra +
      '<button type="button" class="btn btn-sm btn-secondary" onclick="' +
      delFn +
      '(' +
      t.id +
      ')">Удалить</button>' +
      '</div></div>'
    );
  };

  AT.deleteGeneratedTask = async function deleteGeneratedTask(apiBase, id) {
    if (!confirm('Удалить задание #' + id + '?')) return false;
    await fetch(apiBase + '/tasks/' + id, { method: 'DELETE' });
    return true;
  };

  /**
   * @param {object} opt
   * @param {string} opt.generateUrl — полный URL POST (например '/api/task10/generate')
   * @param {function(): object} opt.buildBody — вернуть тело или { error: 'текст' }
   * @param {function(object): string} opt.formatSuccess — innerHTML для #gen-result
   * @param {function(object)} [opt.afterSuccess]
   * @param {string} [opt.buttonId='btn-generate-task']
   * @param {string} [opt.resultId='gen-result']
   */
  AT.bindGenerateButton = function bindGenerateButton(opt) {
    const btn = document.getElementById(opt.buttonId || 'btn-generate-task');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const resultDiv = document.getElementById(opt.resultId || 'gen-result');
      btn.disabled = true;
      btn.textContent = 'Генерируем...';
      if (resultDiv) resultDiv.innerHTML = '';
      try {
        const body = opt.buildBody();
        if (body && body.error) {
          if (resultDiv) {
            resultDiv.innerHTML =
              '<span style="color:#D69295;">' + AT.escHtml(body.error) + '</span>';
          }
          return;
        }
        const res = await fetch(opt.generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {}),
        });
        const data = await res.json();
        if (data.error) {
          if (resultDiv) {
            resultDiv.innerHTML =
              '<span style="color:#D69295;">' + AT.escHtml(data.error) + '</span>';
          }
          return;
        }
        if (resultDiv) resultDiv.innerHTML = opt.formatSuccess(data);
        if (opt.afterSuccess) opt.afterSuccess(data);
      } catch (err) {
        if (resultDiv) {
          resultDiv.innerHTML =
            '<span style="color:#D69295;">Ошибка: ' + AT.escHtml(err.message) + '</span>';
        }
      } finally {
        btn.disabled = false;
        btn.textContent = opt.buttonDoneText || 'Сгенерировать и сохранить';
      }
    });
  };

  /**
   * Радиоповедение: только один чекбокс в группе отмечен.
   * @param {string} rootSelector — '#tab-generate'
   * @param {string} checkboxSelector — '.task10-count-checkbox'
   */
  AT.bindExclusiveCheckboxes = function bindExclusiveCheckboxes(rootSelector, checkboxSelector) {
    document.querySelectorAll(rootSelector + ' ' + checkboxSelector).forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        if (!checkbox.checked) return;
        document.querySelectorAll(rootSelector + ' ' + checkboxSelector).forEach((other) => {
          if (other !== checkbox) other.checked = false;
        });
      });
    });
  };

  /**
   * @param {object} cfg
   * @param {string[]} cfg.tabIds — ['words','tasks','generate'] или с 'groups'
   * @param {object<string, function>} cfg.onShow — колбэки при открытии вкладки
   */
  AT.createSwitchTab = function createSwitchTab(cfg) {
    return function switchTab(name, btn) {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      (cfg.tabIds || []).forEach((tab) => {
        const el = document.getElementById('tab-' + tab);
        if (el) el.style.display = name === tab ? '' : 'none';
      });
      const fn = cfg.onShow && cfg.onShow[name];
      if (typeof fn === 'function') fn();
    };
  };

  // ===== КАСТОМНЫЙ DROPDOWN ДЛЯ .word-select =====
  AT.initWordSelectDropdowns = function initWordSelectDropdowns() {
    document.querySelectorAll('select.word-select').forEach(select => {
      if (select.closest('.custom-dropdown')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-dropdown';
      wrapper.style.position = 'relative';
      wrapper.style.zIndex = '10';
      wrapper.style.width = 'auto';
      wrapper.style.minWidth = (select.style.minWidth || '140px');
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);

      select.style.position = 'absolute';
      select.style.opacity = '0';
      select.style.pointerEvents = 'none';
      select.style.width = '1px';
      select.style.height = '1px';
      select.style.left = '-9999px';
      select.style.top = '-9999px';
      select.style.visibility = 'hidden';
      select.style.zIndex = '-1';

      const trigger = document.createElement('div');
      trigger.className = 'custom-dropdown__trigger';
      trigger.setAttribute('tabindex', '0');
      const triggerText = document.createElement('span');
      triggerText.className = 'custom-dropdown__trigger-text';
      trigger.appendChild(triggerText);
      const arrow = document.createElement('div');
      arrow.className = 'custom-dropdown__arrow';
      trigger.appendChild(arrow);
      wrapper.insertBefore(trigger, select);

      const menu = document.createElement('div');
      menu.className = 'custom-dropdown__menu';
      document.body.appendChild(menu);

      let scrollHandler = null;
      let resizeHandler = null;
      let scrollUpdateScheduled = false;

      const positionMenu = (force) => {
        if (!force && !menu.classList.contains('open')) return;
        const rect = trigger.getBoundingClientRect();
        menu.style.top = (rect.bottom + 8) + 'px';
        menu.style.left = rect.left + 'px';
        menu.style.width = rect.width + 'px';
      };

      const schedulePositionUpdate = () => {
        if (scrollUpdateScheduled) return;
        scrollUpdateScheduled = true;
        requestAnimationFrame(() => {
          if (menu.classList.contains('open')) positionMenu();
          scrollUpdateScheduled = false;
        });
      };

      const closeMenu = () => {
        trigger.classList.remove('active');
        menu.classList.remove('open');
        if (scrollHandler) { window.removeEventListener('scroll', scrollHandler, true); scrollHandler = null; }
        if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
      };

      const updateOptions = () => {
        menu.innerHTML = '';
        let hasSelected = false;
        Array.from(select.options).forEach(option => {
          const menuOption = document.createElement('div');
          menuOption.className = 'custom-dropdown__option';
          menuOption.dataset.value = option.value;
          const content = document.createElement('div');
          content.className = 'custom-dropdown__option-content';
          content.textContent = option.text;
          content.style.flex = '1';
          menuOption.appendChild(content);
          if (option.value === '') menuOption.classList.add('placeholder');
          if (option.value === select.value) {
            menuOption.classList.add('selected');
            triggerText.textContent = option.text;
            triggerText.classList.toggle('placeholder', option.value === '');
            hasSelected = true;
          }
          const handleSelection = (e) => {
            e.stopPropagation();
            e.preventDefault();
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            menu.querySelectorAll('.custom-dropdown__option').forEach(o => o.classList.remove('selected'));
            menuOption.classList.add('selected');
            triggerText.textContent = option.text;
            triggerText.classList.toggle('placeholder', option.value === '');
            closeMenu();
            trigger.blur();
          };
          menuOption.addEventListener('mousedown', handleSelection);
          menuOption.addEventListener('click', handleSelection);
          menu.appendChild(menuOption);
        });
        if (!hasSelected && select.options.length > 0) {
          triggerText.textContent = select.options[0].text;
          triggerText.classList.toggle('placeholder', select.options[0].value === '');
        }
      };

      updateOptions();

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isOpen = menu.classList.contains('open');
        document.querySelectorAll('.custom-dropdown__menu').forEach(m => { if (m !== menu) m.classList.remove('open'); });
        document.querySelectorAll('.custom-dropdown__trigger').forEach(t => { if (t !== trigger) t.classList.remove('active'); });
        if (isOpen) {
          closeMenu();
        } else {
          positionMenu(true);
          trigger.classList.add('active');
          menu.classList.add('open');
          requestAnimationFrame(() => positionMenu());
          if (!scrollHandler) { scrollHandler = schedulePositionUpdate; window.addEventListener('scroll', scrollHandler, true); }
          if (!resizeHandler) { resizeHandler = schedulePositionUpdate; window.addEventListener('resize', resizeHandler); }
        }
        return false;
      });

      let clickOutsideTimeout;
      const handleOutsideClick = (e) => {
        if (!wrapper.contains(e.target) && !menu.contains(e.target) && menu.classList.contains('open')) {
          clearTimeout(clickOutsideTimeout);
          clickOutsideTimeout = setTimeout(() => { if (menu.classList.contains('open')) closeMenu(); }, 150);
        }
      };
      document.addEventListener('mousedown', handleOutsideClick, false);
      document.addEventListener('click', handleOutsideClick, false);

      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
      });

      select.addEventListener('change', updateOptions);
    });
  };

  // Авто-запуск для страниц с .word-select
  if (typeof window !== 'undefined') {
    const runInit = () => AT.initWordSelectDropdowns();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runInit);
    } else {
      runInit();
    }
    // MutationObserver — реагируем на динамически добавленные .word-select
    let debounceTimer;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runInit, 50);
    });
    const startObserver = () => {
      observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserver);
    } else {
      startObserver();
    }
  }

  global.AdminTasks = AT;
})(typeof window !== 'undefined' ? window : globalThis);
