<script>
let currentLevel = null;
let currentLesson = null;
let english = [];
let transcriptions = [];
let translated = [];
let examples = [];

let currentIndex = 0;
let usedIndices = [];
let currentPhase = 1;
let currentPair2 = null;
let currentPair3 = null;
let dictationIndex = 0;

// 📌 Загрузка уровней из JSON
async function loadLevels() {
  const response = await fetch("data.json");
  const data = await response.json();

  const levelsContainer = document.getElementById("levels-container");
  levelsContainer.innerHTML = "";

  Object.keys(data).forEach(level => {
    const btn = document.createElement("button");
    btn.textContent = level;
    btn.onclick = () => showLessons(level, data[level]);
    levelsContainer.appendChild(btn);
  });
}

// 📌 Показ уроков
function showLessons(level, lessons) {
  currentLevel = level;

  const lessonsContainer = document.getElementById("lessons-container");
  lessonsContainer.innerHTML = "";

  Object.keys(lessons).forEach(lessonKey => {
    const btn = document.createElement("button");
    btn.textContent = lessons[lessonKey].title;
    btn.onclick = () => loadLesson(lessons[lessonKey]);
    lessonsContainer.appendChild(btn);
  });

  document.getElementById("page1").style.display = "none";
  document.getElementById("page2").style.display = "block";
}

// 📌 Загрузка урока
function loadLesson(lesson) {
  currentLesson = lesson;
  english = lesson.english || [];
  transcriptions = lesson.transcriptions || [];
  translated = lesson.translated || [];
  examples = lesson.example || [];

  document.getElementById("page2").style.display = "none";
  document.getElementById("page3").style.display = "block";

  currentIndex = 0;
  usedIndices = [];
  currentPhase = 1;

  showNextCard();

  // 📌 Автопрокрутка вниз к уроку
  document.getElementById("page3").scrollIntoView({ behavior: "smooth" });
}

// 📌 Обновление прогресса
function updateProgress(current, total, phase) {
  const progress = document.getElementById("progress");
  progress.textContent = `${phase}: ${current} / ${total}`;
}

// ================== ФАЗА 1 ==================
function showNextCard() {
  if (currentIndex >= english.length) {
    document.getElementById("page3").style.display = "none";
    startPhase2();
    return;
  }

  const eng = english[currentIndex];
  const transcr = transcriptions[currentIndex] ? `[${transcriptions[currentIndex]}]` : "";
  const rus = translated[currentIndex];
  const example = examples[currentIndex] ? `<br><em>Пример: ${examples[currentIndex]}</em>` : "";

  const card = document.getElementById("card");
  card.style.opacity = 0;
  card.innerHTML = `<strong>${eng}</strong> ${transcr}<br>${rus}${example}`;
  setTimeout(() => { card.style.opacity = 1; }, 50);

  currentIndex++;
  updateProgress(currentIndex, english.length, "Фаза 1");
}

// ================== ФАЗА 2 ==================
function startPhase2() {
  document.getElementById("page4").style.display = "block";
  nextPhase2Card();
}

function nextPhase2Card() {
  if (usedIndices.length >= english.length) {
    document.getElementById("page4").style.display = "none";
    startPhase3();
    return;
  }

  let idx;
  do {
    idx = Math.floor(Math.random() * english.length);
  } while (usedIndices.includes(idx));
  usedIndices.push(idx);

  currentPair2 = { eng: english[idx], transcr: transcriptions[idx], rus: translated[idx], ex: examples[idx] };

  document.getElementById("phase2-question").textContent = currentPair2.rus;
  document.getElementById("phase2-answer").textContent = "";
}

function showPhase2Answer() {
  document.getElementById("phase2-answer").innerHTML =
    `${currentPair2.eng} ${currentPair2.transcr ? "[" + currentPair2.transcr + "]" : ""}` +
    (currentPair2.ex ? `<br><em>Пример: ${currentPair2.ex}</em>` : "");
}

// ================== ФАЗА 3 ==================
function startPhase3() {
  document.getElementById("page5").style.display = "block";
  usedIndices = [];
  nextPhase3Card();
}

function nextPhase3Card() {
  if (usedIndices.length >= english.length) {
    document.getElementById("page5").style.display = "none";
    startPhase4();
    return;
  }

  let idx;
  do {
    idx = Math.floor(Math.random() * english.length);
  } while (usedIndices.includes(idx));
  usedIndices.push(idx);

  currentPair3 = { eng: english[idx], transcr: transcriptions[idx], rus: translated[idx], ex: examples[idx] };

  document.getElementById("phase3-question").textContent = currentPair3.eng;
  document.getElementById("phase3-answer").textContent = "";
}

function showPhase3Answer() {
  document.getElementById("phase3-answer").innerHTML =
    `${currentPair3.rus}` + (currentPair3.ex ? `<br><em>Пример: ${currentPair3.ex}</em>` : "");
}

// ================== ФАЗА 4 (ДИКТАНТ) ==================
function startPhase4() {
  document.getElementById("page6").style.display = "block";
  dictationIndex = 0;
  nextDictationCard();
}

function nextDictationCard() {
  if (dictationIndex >= english.length) {
    alert("Поздравляем! Урок пройден 🎉");
    return;
  }

  document.getElementById("dictation-question").textContent = translated[dictationIndex];
  document.getElementById("dictation-input").value = "";
  document.getElementById("dictation-feedback").textContent = "";
}

function checkDictation() {
  const input = document.getElementById("dictation-input").value.trim().toLowerCase();
  const correct = english[dictationIndex].toLowerCase();

  if (input === correct) {
    document.getElementById("dictation-feedback").textContent = "✅ Верно!";
    dictationIndex++;
    setTimeout(nextDictationCard, 800);
  } else {
    document.getElementById("dictation-feedback").innerHTML =
      `❌ Ошибка. Правильный ответ: <strong>${english[dictationIndex]}</strong>` +
      (examples[dictationIndex] ? `<br><em>Пример: ${examples[dictationIndex]}</em>` : "") +
      `<br><button onclick="skipAfterError()">Продолжить</button>`;
  }
}

function skipAfterError() {
  dictationIndex++;
  nextDictationCard();
}

// ================== ДОП. ФУНКЦИЯ: ПОВТОРИТЬ ЭТАП ==================
function repeatPhase() {
  if (currentPhase === 1) {
    currentIndex = 0;
    document.getElementById("page3").style.display = "block";
    showNextCard();
  } else if (currentPhase === 2) {
    usedIndices = [];
    document.getElementById("page4").style.display = "block";
    nextPhase2Card();
  } else if (currentPhase === 3) {
    usedIndices = [];
    document.getElementById("page5").style.display = "block";
    nextPhase3Card();
  } else if (currentPhase === 4) {
    dictationIndex = 0;
    document.getElementById("page6").style.display = "block";
    nextDictationCard();
  }
}


