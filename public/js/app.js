// public/app.js

// Theme switching
(function() {
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  
  // Get saved theme or default to dark
  const savedTheme = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
})();

// какой тип и номер задания показываем
const current = { type: 1, number: 1 };

const API = (p) => `${location.origin}/api${p}`;

async function loadAssignment({ type, number }) {
  const r = await fetch(API(`/assignments/${type}/${number}`));
  if (!r.ok) throw new Error('Не удалось загрузить задание');
  return r.json();
}

async function checkAnswer({ type, number }, userAnswer) {
  const r = await fetch(API(`/check`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, number, userAnswer })
  });
  if (!r.ok) throw new Error('Ошибка проверки');
  return r.json();
}

document.addEventListener('DOMContentLoaded', async () => {
  const titleEl   = document.querySelector('.text-heading'); // "Задания"
  const metaEl    = document.getElementById('meta');         // сюда "Тип / №"
  const promptEl  = document.getElementById('prompt');       // условие
  const fullText  = document.getElementById('fullText');     // скрываемый текст
  const toggleBtn = document.getElementById('toggleText');   // кнопка показать/скрыть
  const inputEl   = document.getElementById('answer');       // поле ответа
  const sendBtn   = document.getElementById('send');         // отправить
  const fb        = document.getElementById('feedback');     // блок фидбэка

  // загрузка задания
  const a = await loadAssignment(current);
  titleEl.textContent = 'Задания';
  metaEl.innerHTML =
    `<div class="task-meta__pair text-meta"><span>Тип</span><span>${a.type}</span></div>
     <div class="task-meta__pair text-meta"><span>№</span><span>${a.number}</span></div>`;
  promptEl.textContent = a.prompt;
  fullText.textContent = a.context || '';

  // показать/скрыть текст
  let shown = false;
  toggleBtn.addEventListener('click', () => {
    shown = !shown;
    fullText.style.display = shown ? 'block' : 'none';
    toggleBtn.textContent = shown ? 'Скрыть текст' : 'Показать текст';
  });

  // отправка ответа
  sendBtn.addEventListener('click', async () => {
    const val = inputEl.value.trim();
    if (!val) return;
    const res = await checkAnswer(current, val);
    const iconCheck = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="feedback__icon" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>';
    const iconX = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="feedback__icon" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>';
    if (res.ok) {
      fb.className = 'feedback feedback--ok';
      fb.innerHTML = `${iconCheck} Верно`;
    } else {
      fb.className = 'feedback feedback--bad';
      fb.innerHTML = `${iconX} Неверно. Правильный ответ: «${res.correct}»`;
    }
  });
});
