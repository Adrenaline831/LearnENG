
let lessonsDB = {};
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
let currentPair4 = null;
let queue2 = [], queue3 = [], queue4 = [];
let dictationIndex = 0;

// --- Меню ---
document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("menuDropdown").classList.toggle("show");
});

// --- Загрузка JSON и генерация меню ---
fetch("data.json")
  .then(res => res.json())
  .then(data => {
    lessonsDB = data;
    generateLevelsMenu(Object.keys(lessonsDB));
  })
  .catch(err => console.error("Ошибка загрузки JSON:", err));

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
  const existing = button.nextElementSibling;
  if (existing) { existing.remove(); return; }

  const ul = document.createElement("ul");
  ul.className = "submenu";

  const lessons = lessonsDB[level];
  for (const lessonKey in lessons) {
    const lesson = lessons[lessonKey];
    const li = document.createElement("li");
    li.textContent = lesson.title;
    li.style.cursor = "pointer";
    li.onclick = () => loadLesson(level, lessonKey, li);
    ul.appendChild(li);
  }

  button.parentNode.appendChild(ul);
}

// --- Загрузка урока ---
function loadLesson(level, lessonKey, lessonElement) {
  currentLesson = lessonsDB[level][lessonKey];
  if (!currentLesson) return console.error("Урок не найден:", level, lessonKey);

  // Подсветка выбранного урока
  document.querySelectorAll(".submenu li").forEach(li => li.style.background = "");
  lessonElement.style.background = "#d3f0ff";

  english = currentLesson.english || [];
  transcriptions = currentLesson.transcriptions || [];
  translated = currentLesson.translated || [];
  examples = currentLesson.example || [];

  // Скрыть меню
  document.getElementById("menuDropdown").classList.remove("show");

  // Скрыть все страницы
  document.querySelectorAll("div[id^='page']").forEach(div => div.style.display = "none");

  // Прокрутка к содержимому урока
  document.getElementById("lessonContent").scrollIntoView({ behavior: "smooth" });

  // Сброс прогресса
  currentIndex = 0;
  usedIndices = [];
  currentPhase = 1;

  startPhase1();
}

// ================== Вспомогательные ==================
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function updateProgress(current, total, phase) {
  const progress = document.getElementById("progress");
  if (progress) progress.textContent = `${phase}: ${current} / ${total}`;
}

// ================== ФАЗА 1 ==================
function startPhase1() {
  document.getElementById("page3").style.display = "block";
  showNextCard();
}

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
  queue2 = english.map((w, i) => ({ eng: w, rus: translated[i], transcr: transcriptions[i], ex: examples[i] }));
  queue2 = shuffleArray(queue2);
  nextPhase2Card();
}

function nextPhase2Card() {
  if (queue2.length === 0) {
    document.getElementById("page4").style.display = "none";
    startPhase3();
    return;
  }

  currentPair2 = queue2.shift();
  document.getElementById("phase2-question").textContent = currentPair2.rus;
  document.getElementById("phase2-answer").textContent = "";
  updateProgress(english.length - queue2.length, english.length, "Фаза 2");
}

function showPhase2Answer() {
  document.getElementById("phase2-answer").innerHTML =
    `${currentPair2.eng} ${currentPair2.transcr ? "[" + currentPair2.transcr + "]" : ""}` +
    (currentPair2.ex ? `<br><em>Пример: ${currentPair2.ex}</em>` : "");
}

// ================== ФАЗА 3 ==================
function startPhase3() {
  document.getElementById("page5").style.display = "block";
  queue3 = english.map((w, i) => ({ eng: w, rus: translated[i], transcr: transcriptions[i], ex: examples[i] }));
  queue3 = shuffleArray(queue3);
  nextPhase3Card();
}

function nextPhase3Card() {
  if (queue3.length === 0) {
    document.getElementById("page5").style.display = "none";
    startPhase4();
    return;
  }

  currentPair3 = queue3.shift();
  document.getElementById("phase3-question").textContent = currentPair3.eng;
  document.getElementById("phase3-answer").textContent = "";
  updateProgress(english.length - queue3.length, english.length, "Фаза 3");
}

function showPhase3Answer() {
  document.getElementById("phase3-answer").innerHTML =
    `${currentPair3.rus}` + (currentPair3.ex ? `<br><em>Пример: ${currentPair3.ex}</em>` : "");
}

// ================== ФАЗА 4 (диктант) ==================
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
  updateProgress(dictationIndex, english.length, "Фаза 4");
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

// --- Кнопка "Пропустить этап" ---
function goToNextPage() {
  if (document.getElementById("page3").style.display === "block") {
    document.getElementById("page3").style.display = "none";
    startPhase2();
  } else if (document.getElementById("page4").style.display === "block") {
    document.getElementById("page4").style.display = "none";
    startPhase3();
  } else if (document.getElementById("page5").style.display === "block") {
    document.getElementById("page5").style.display = "none";
    startPhase4();
  }
}

// --- Повторить этап ---
function repeatPhase() {
  if (currentPhase === 1) {
    currentIndex = 0;
    document.getElementById("page3").style.display = "block";
    showNextCard();
  } else if (currentPhase === 2) {
    startPhase2();
  } else if (currentPhase === 3) {
    startPhase3();
  } else if (currentPhase === 4) {
    startPhase4();
  }
}
</script>
