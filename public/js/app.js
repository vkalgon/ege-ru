// public/app.js

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
    if (res.ok) {
      fb.className = 'feedback feedback--ok';
      fb.textContent = 'Верно ✅';
    } else {
      fb.className = 'feedback feedback--bad';
      fb.textContent = `Неверно ❌. Правильный ответ: «${res.correct}»`;
    }
  });
});
