/**
 * FilterBar — pill-style generation filters.
 *
 * Usage:
 *   const bar = new FilterBar(containerEl);
 *
 *   // Single-select pill (e.g. "Правильных строк")
 *   const countPill = bar.addPill('Правильных строк', [
 *     { value: '2', label: '2' },
 *     { value: '3', label: '3' },
 *   ], { multi: false, defaultValue: '2' });
 *
 *   // Multi-select pill (e.g. "Правила")
 *   const rulesPill = bar.addPill('Правила', [...], { multi: true });
 *
 *   // Number pill
 *   const countInput = bar.addNumberPill('Количество заданий', 1, { min:1, max:20 });
 *
 *   // Read values
 *   rulesPill.getValues()   // → ['з/с', 'пре/при']  (empty = all)
 *   countPill.getValue()    // → '3'
 *   countInput.getValue()   // → 5
 */
class FilterBar {
  constructor(container) {
    this.container = container;
    this.container.classList.add('task-filter-bar');
    this.pills = [];
    this._openDropdown = null;
    this._closeHandler = (e) => {
      if (!e.target.closest('.task-filter-pill') && !e.target.closest('.task-filter-dropdown')) {
        this._closeAll();
      }
    };
    document.addEventListener('click', this._closeHandler);
  }

  destroy() {
    document.removeEventListener('click', this._closeHandler);
  }

  /** Single-select or multi-select pill with dropdown */
  addPill(label, options, { multi = false, defaultValue = null, placeholder = null } = {}) {
    const pill = new FilterPill(label, options, { multi, defaultValue, placeholder });
    this.container.appendChild(pill.el);
    this.pills.push(pill);

    pill.el.addEventListener('click', (e) => {
      if (e.target.closest('.task-filter-pill__clear')) return;
      if (pill._dropdown.classList.contains('open')) {
        this._closeAll();
      } else {
        this._closeAll();
        this._openDropdown = pill;
        pill.open();
      }
    });

    pill.el.querySelector('.task-filter-pill__clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      pill.clear();
    });

    return pill;
  }

  /** Number input pill */
  addNumberPill(label, defaultVal = 1, { min = 1, max = 20 } = {}) {
    const pill = new NumberFilterPill(label, defaultVal, { min, max });
    this.container.appendChild(pill.el);
    this.pills.push(pill);
    return pill;
  }

  _closeAll() {
    this.pills.forEach(p => p.close && p.close());
    this._openDropdown = null;
  }
}

class FilterPill {
  constructor(label, options, { multi = false, defaultValue = null, placeholder = null } = {}) {
    this.label = label;
    this.options = options;
    this.multi = multi;
    this._selected = new Set();
    if (defaultValue !== null) this._selected.add(defaultValue);

    this.el = document.createElement('div');
    this.el.className = 'task-filter-pill';
    this.el.setAttribute('tabindex', '0');

    this._dropdown = null;
    this._render();
    this._buildDropdown();
    this._syncState();
  }

  _render() {
    this.el.innerHTML = `
      <span class="task-filter-pill__label"></span>
      <span class="task-filter-pill__arrow"></span>
      <span class="task-filter-pill__clear" title="Сбросить" style="display:none">✕</span>
    `;
    this._labelEl = this.el.querySelector('.task-filter-pill__label');
    this._clearEl = this.el.querySelector('.task-filter-pill__clear');
  }

  _buildDropdown() {
    this._dropdown = document.createElement('div');
    this._dropdown.className = 'task-filter-dropdown';

    // "Все" option for single-select
    if (!this.multi) {
      const allOpt = this._makeOption({ value: '', label: 'Любое' }, true);
      this._dropdown.appendChild(allOpt);
      const div = document.createElement('div');
      div.className = 'task-filter-dropdown__divider';
      this._dropdown.appendChild(div);
    }

    this.options.forEach(opt => {
      this._dropdown.appendChild(this._makeOption(opt));
    });

    document.body.appendChild(this._dropdown);
  }

  _makeOption(opt, isAll = false) {
    const el = document.createElement('button');
    el.className = 'task-filter-dropdown__option';
    el.dataset.value = opt.value;

    if (this.multi) {
      el.innerHTML = `<span class="task-filter-dropdown__check"></span>${opt.label}`;
    } else {
      el.textContent = opt.label;
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.multi) {
        if (this._selected.has(opt.value)) {
          this._selected.delete(opt.value);
        } else {
          this._selected.add(opt.value);
        }
      } else {
        this._selected.clear();
        if (opt.value !== '') this._selected.add(opt.value);
        this.close();
      }
      this._syncState();
      this.el.dispatchEvent(new CustomEvent('change', { bubbles: true }));
    });

    return el;
  }

  _syncState() {
    const count = this._selected.size;
    const hasValue = count > 0;

    this.el.classList.toggle('has-value', hasValue);
    this._clearEl.style.display = hasValue ? '' : 'none';

    if (!hasValue) {
      this._labelEl.textContent = this.label;
    } else if (this.multi && count > 1) {
      this._labelEl.textContent = `${this.label} (${count})`;
    } else {
      const val = [...this._selected][0];
      const opt = this.options.find(o => o.value === val);
      this._labelEl.textContent = opt ? opt.label : val;
    }

    // Sync checkmarks in dropdown
    this._dropdown.querySelectorAll('.task-filter-dropdown__option').forEach(optEl => {
      const sel = this._selected.has(optEl.dataset.value);
      optEl.classList.toggle('selected', sel);
    });
  }

  open() {
    this.el.classList.add('open');
    const rect = this.el.getBoundingClientRect();
    this._dropdown.style.top = (rect.bottom + 6) + 'px';
    this._dropdown.style.left = rect.left + 'px';
    this._dropdown.classList.add('open');
  }

  close() {
    this.el.classList.remove('open');
    this._dropdown.classList.remove('open');
  }

  clear() {
    this._selected.clear();
    this._syncState();
    this.el.dispatchEvent(new CustomEvent('change', { bubbles: true }));
  }

  /** Returns array of selected values. Empty array = "all / not filtered". */
  getValues() {
    return [...this._selected];
  }

  /** For single-select: returns the selected value or null. */
  getValue() {
    const vals = this.getValues();
    return vals.length ? vals[0] : null;
  }

  setValue(value) {
    this._selected.clear();
    if (value !== null && value !== '') this._selected.add(value);
    this._syncState();
  }

  setValues(values) {
    this._selected = new Set(values);
    this._syncState();
  }

  updateOptions(newOptions) {
    this.options = newOptions;
    if (this.multi) {
      [...this._dropdown.querySelectorAll('.task-filter-dropdown__option')].forEach(el => el.remove());
    } else {
      [...this._dropdown.querySelectorAll('.task-filter-dropdown__option')].slice(1).forEach(el => el.remove());
    }
    newOptions.forEach(opt => this._dropdown.appendChild(this._makeOption(opt)));
    for (const val of [...this._selected]) {
      if (!newOptions.find(o => o.value === val)) this._selected.delete(val);
    }
    this._syncState();
  }
}

class NumberFilterPill {
  constructor(label, defaultVal = 1, { min = 1, max = 20 } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'task-filter-pill task-filter-pill--number';
    this.el.innerHTML = `
      <span>${label}</span>
      <input type="number" value="${defaultVal}" min="${min}" max="${max}">
    `;
    this._input = this.el.querySelector('input');
    // prevent pill close on input click
    this._input.addEventListener('click', e => e.stopPropagation());
  }

  getValue() {
    return parseInt(this._input.value, 10) || 1;
  }

  setValue(v) {
    this._input.value = v;
  }

  close() {}
}
