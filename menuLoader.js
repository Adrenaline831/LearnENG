<script>
/* ---- ЛОГИКА ЗАГРУЗКИ И ТРЕНИНГА ---- */
document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("menuDropdown").classList.toggle("show");
});

let lessonsDB = {};
let currentLesson = null;
let cards = [];
let cardIndex = 0;
let phase = 0; // 1..4

// Fetch JSON 
function loadJSON() {
  fetch('lessons.json')
    .then(res => {
      if (!res.ok) throw new Error('HTTP error ' + res.status);
      return res.json();
    })
    .then(data => {
      lessonsDB = data;
      generateLevelsMenu(Object.keys(lessonsDB));
      console.log('lessons loaded', lessonsDB);
    })
    .catch(err => {
      console.error('Ошибка загрузки JSON:', err);
      document.getElementById('lessonTitle').textContent = 'Ошибка загрузки lessons.json — открой через локальный сервер';
    });
}

function generateLevelsMenu(levels) {
  const menu = document.getElementById("menuDropdown");
  menu.innerHTML = "";
  levels.forEach(level => {
    const li = document.createElement("li");
    li.className = "menu__nav-item";
    const button = document.createElement("button");
    button.textContent = level;
    button.className = "level-btn";
    button.onclick = () => toggleLessons(level, button);
    li.appendChild(button);
    menu.appendChild(li);
  });
}

function toggleLessons(level, button) {
  const existing = button.parentNode.querySelector('.submenu');
  if (existing) { existing.remove(); return; }

  const ul = document.createElement("ul");
  ul.className = "submenu";
  const lessons = lessonsDB[level] || {};
  for (const lessonKey in lessons) {
    const lesson = lessons[lessonKey];
    const li = document.createElement("li");
    li.textContent = lesson.title || lessonKey;
    li.onclick = () => loadLesson(level, lessonKey);
    ul.appendChild(li);
  }
  button.parentNode.appendChild(ul);
}

function loadLesson(level, lessonKey) {
  const lesson = lessonsDB[level] && lessonsDB[level][lessonKey];
  if (!lesson) {
    console.error('Урок не найден', level, lessonKey);
    return;
  }
  currentLesson = {level, lessonKey, data: lesson};

  // Показываем заголовок
  document.getElementById('lessonTitle').textContent = lesson.title || `${level} - ${lessonKey}`;
  document.getElementById('lessonMeta').innerHTML = `<strong>Уровень:</strong> ${level} &nbsp; <strong>Ключ:</strong> ${lessonKey}`;

  // Заполняем текстовые поля (не перезаписываем page-разметку)
  document.getElementById('englishWords').value = Array.isArray(lesson.english) ? lesson.english.join('\n') : (lesson.english || '').toString();
  document.getElementById('englishTranscription').value = Array.isArray(lesson.transcriptions) ? lesson.transcriptions.join('\n') : (lesson.transcriptions || '').toString();
  document.getElementById('translatedWords').value = Array.isArray(lesson.translated) ? lesson.translated.join('\n') : (lesson.translated || '').toString();

  // также можно показать примеры под заголовком
  if (Array.isArray(lesson.example) && lesson.example.length) {
    const ex = lesson.example.map(e => `<li>${e}</li>`).join('');
    const meta = document.getElementById('lessonMeta');
    meta.innerHTML += `<div><strong>Примеры:</strong><ul class="wordlist">${ex}</ul></div>`;
  }

  // reset training state
  cards = [];
  cardIndex = 0;
  phase = 0;
  updateProgress(0);

  // оставить показ page1 по умолчанию
  showPage('page1');
}

/* ----- УТИЛИТЫ ПОКАЗА СТРАНИЦ ----- */
function showPage(id) {
  ['page1','page1_5','page2','page3','page4','page5','page6'].forEach(p => {
    const el = document.getElementById(p);
    if (!el) return;
    if (p === id) el.classList.remove('hidden'); else el.classList.add('hidden');
  });
}

/* ----- ПРОГРЕСС ----- */
function updateProgress(percent) {
  const bar = document.getElementById('progressBar');
  bar.style.width = percent + '%';
  bar.textContent = percent + '%';
  document.getElementById('progressText').textContent = `Прогресс: ${percent}%`;
}

/* ----- Функции фаз (грубая, но рабочая логика) ----- */
function goToTranscription() { showPage('page1_5'); }
function skipTranscription() { document.getElementById('englishTranscription').value = ''; goToTranslations(); }
function goToTranslations() { showPage('page2'); }

function startPhase1() {
  // собираем данные из полей
  const eng = document.getElementById('englishWords').value.split('\n').map(s => s.trim()).filter(Boolean);
  const trans = document.getElementById('englishTranscription').value.split('\n').map(s => s.trim());
  const rus = document.getElementById('translatedWords').value.split('\n').map(s => s.trim());

  // соберём карточки
  cards = eng.map((word, i) => ({
    english: word,
    transcription: trans[i] || '',
    translated: rus[i] || ''
  }));
  cardIndex = 0;
  phase = 1;
  if (!cards.length) {
    alert('Слова пустые. Заполни поля или загрузите урок из JSON.');
    return;
  }
  showPage('page3');
  renderCard();
  updateProgress(5);
}

function renderCard() {
  const c = cards[cardIndex];
  document.getElementById('card').textContent = `${c.english} ${c.transcription ? '['+c.transcription+']' : ''} — ${c.translated}`;
}

function showNextCard() {
  cardIndex++;
  if (cardIndex >= cards.length) {
    goToNextPage(); // переход к фазе 2
    return;
  }
  renderCard();
  updateProgress(Math.round((cardIndex/cards.length)*50));
}

function goToNextPage() {
  if (phase === 1) {
    // старт фазы 2
    phase = 2;
    cardIndex = 0;
    document.getElementById('answerSection').classList.add('hidden');
    showPage('page4');
    renderPhase2();
    updateProgress(55);
  } else if (phase === 2) {
    // фаза 3
    phase = 3;
    cardIndex = 0;
    document.getElementById('answerSection3').classList.add('hidden');
    showPage('page5');
    renderPhase3();
    updateProgress(75);
  } else if (phase === 3) {
    // фаза 4 диктант
    phase = 4;
    cardIndex = 0;
    showPage('page6');
    renderDictation();
    updateProgress(90);
  } else {
    // завершение
    updateProgress(100);
    alert('Тренировка завершена.');
  }
}

/* Фаза 2: перевод -> оригинал */
function renderPhase2() {
  if (!cards.length) { document.getElementById('phase2-translation').textContent='Нет карточек'; return; }
  document.getElementById('phase2-translation').textContent = cards[cardIndex].translated;
  document.getElementById('phase2-answer').textContent = cards[cardIndex].english;
}

function showAnswer() {
  document.getElementById('answerSection').classList.remove('hidden');
}

function markAnswer(isCorrect) {
  // здесь можно сохранять правильность
  cardIndex++;
  if (cardIndex >= cards.length) { goToNextPage(); return; }
  renderPhase2();
  document.getElementById('answerSection').classList.add('hidden');
}

/* Фаза 3: оригинал -> перевод */
function renderPhase3() {
  if (!cards.length) { document.getElementById('phase3-original').textContent='Нет карточек'; return; }
  document.getElementById('phase3-original').textContent = cards[cardIndex].english;
  document.getElementById('phase3-answer').textContent = cards[cardIndex].translated;
}
function showAnswer3() { document.getElementById('answerSection3').classList.remove('hidden'); }
function markAnswer3(isCorrect) {
  cardIndex++;
  if (cardIndex >= cards.length) { goToNextPage(); return; }
  renderPhase3();
  document.getElementById('answerSection3').classList.add('hidden');
}

/* Фаза 4: диктант */
function renderDictation() {
  if (!cards.length) { document.getElementById('dictation-translation').textContent='Нет карточек'; return; }
  document.getElementById('dictation-translation').textContent = cards[cardIndex].translated;
  document.getElementById('dictation-input').value = '';
  document.getElementById('dictation-feedback').textContent = '';
}

function checkDictation() {
  const input = document.getElementById('dictation-input').value.trim();
  const correct = cards[cardIndex].english.trim();
  if (input.toLowerCase() === correct.toLowerCase()) {
    document.getElementById('dictation-feedback').textContent = 'Правильно!';
  } else {
    document.getElementById('dictation-feedback').textContent = `Неправильно. Правильно: ${correct}`;
  }
  cardIndex++;
  if (cardIndex >= cards.length) {
    updateProgress(100);
    alert('Диктант завершён.');
  } else {
    renderDictation();
    updateProgress(90 + Math.round((cardIndex/cards.length)*10));
  }
}

/* ----- старт ----- */
loadJSON();
</script>
