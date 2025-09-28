// === Глобальные переменные ===
let lessonsDB = {};
let currentLesson = null;
let words = [];
let transcriptions = [];
let translations = [];
let examples = [];
let currentPhase = 3;
let currentIndex = 0;
let wrongQueue = [];

// Индексы прогресса для каждой фазы
let phaseIndexes = {
  3: 0,
  4: 0,
  5: 0,
  6: 0
};

// Загружаем JSON
fetch("lessons.json")
  .then(res => res.json())
  .then(data => {
    lessonsDB = data;
    generateLevelsMenu(Object.keys(lessonsDB));
  })
  .catch(err => console.error("Ошибка загрузки JSON:", err));

// Меню
document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("menuDropdown").classList.toggle("show");
});

// Генерация кнопок уровней
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

// Подуровни
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
    li.onclick = () => loadLesson(level, lessonKey, li);
    ul.appendChild(li);
  }

  button.parentNode.appendChild(ul);
}

// Загрузка урока
function loadLesson(level, lessonKey, liEl) {
  document.querySelectorAll(".submenu li").forEach(li => li.classList.remove("active"));
  liEl.classList.add("active");

  const lesson = lessonsDB[level][lessonKey];
  currentLesson = lesson;
  words = [...lesson.english];
  transcriptions = [...lesson.transcriptions];
  translations = [...lesson.translated];
  examples = [...lesson.example];

  currentPhase = 3;
  currentIndex = 0;
  wrongQueue = [];

  // Сбрасываем индексы прогресса для всех фаз
  phaseIndexes = {3:0, 4:0, 5:0, 6:0};

  startPhase(currentPhase);

  document.getElementById("lessonContent").scrollIntoView({ behavior: "smooth" });
}

// === Логика фаз ===
function startPhase(phase) {
  hideAllPages();
  currentPhase = phase;

  // Восстанавливаем индекс прогресса для фазы
  currentIndex = phaseIndexes[phase] || 0;

  updateProgress();

  if (phase === 3) showNextCard();
  if (phase === 4) showPhase2();
  if (phase === 5) showPhase3();
  if (phase === 6) showDictation();
}

function hideAllPages() {
  ["page3","page4","page5","page6","finishPage"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
}

function updateProgress() {
  const total = words.length;
  const done = currentIndex;
  const percent = Math.min(100, Math.round((done / total) * 100));
  document.getElementById("progressText").textContent = `Прогресс: ${done}/${total}`;
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressBar").textContent = percent + "%";
}

// === Фаза 1 ===
function showNextCard() {
  if (currentIndex >= words.length) { goToNextPage(); return; }
  document.getElementById("page3").classList.remove("hidden");
  document.getElementById("card").innerHTML =
    `<strong>${words[currentIndex]}</strong> [${transcriptions[currentIndex]}] — ${translations[currentIndex]}`;
  document.getElementById("cardExample").textContent = examples[currentIndex] || "";
  currentIndex++;
  phaseIndexes[3] = currentIndex;
  updateProgress();
}

// === Фаза 2 ===
function showPhase2() {
  if (currentIndex >= words.length && wrongQueue.length === 0) { goToNextPage(); return; }
  document.getElementById("page4").classList.remove("hidden");
  document.getElementById("answerSection").classList.add("hidden");
  const i = getCurrentIndex();
  document.getElementById("phase2-translation").textContent = translations[i];
  document.getElementById("phase2-example").textContent = examples[i] || "";
}

function showAnswer() {
  const i = getCurrentIndex();
  document.getElementById("phase2-answer").textContent = `${words[i]} [${transcriptions[i]}]`;
  document.getElementById("answerSection").classList.remove("hidden");
}

function markAnswer(correct) {
  const i = getCurrentIndex();
  if (!correct) wrongQueue.push(i);
  nextIndex();
  showPhase2();
}

// === Фаза 3 ===
function showPhase3() {
  if (currentIndex >= words.length && wrongQueue.length === 0) { goToNextPage(); return; }
  document.getElementById("page5").classList.remove("hidden");
  document.getElementById("answerSection3").classList.add("hidden");
  const i = getCurrentIndex();
  document.getElementById("phase3-original").textContent = words[i];
  document.getElementById("phase3-example").textContent = examples[i] || "";
}

function showAnswer3() {
  const i = getCurrentIndex();
  document.getElementById("phase3-answer").textContent = translations[i];
  document.getElementById("answerSection3").classList.remove("hidden");
}

function markAnswer3(correct) {
  const i = getCurrentIndex();
  if (!correct) wrongQueue.push(i);
  nextIndex();
  showPhase3();
}

// === Фаза 4: Диктант ===
let dictationQueue = []; // очередь индексов для диктанта
let dictationWaiting = false; // флаг ожидания клика после ошибки

function startDictationPhase() {
  dictationQueue = words.map((_, i) => i); // создаем очередь всех слов
  currentPhase = 6;
  currentIndex = 0;
  dictationWaiting = false;
  showNextDictationWord();
}

function showNextDictationWord() {
  if (dictationQueue.length === 0) {
    finishLesson();
    return;
  }

  currentIndex = dictationQueue[0];
  dictationWaiting = false;

  document.getElementById("page6").classList.remove("hidden");
  document.getElementById("dictation-translation").textContent = translations[currentIndex];
  document.getElementById("dictation-example").textContent = examples[currentIndex] || "";
  document.getElementById("dictation-input").value = "";
  document.getElementById("dictation-feedback").textContent = "";
}

// Проверка ответа пользователя
function checkDictation() {
  if (dictationWaiting) return; // ждем клика пользователя после ошибки

  const input = document.getElementById("dictation-input").value.trim();

  if (input.toLowerCase() === words[currentIndex].toLowerCase()) {
    document.getElementById("dictation-feedback").textContent = "✅ Верно!";
    // удаляем текущее слово из очереди
    dictationQueue.shift();
    setTimeout(showNextDictationWord, 600);
  } else {
    document.getElementById("dictation-feedback").textContent =
      `❌ Ошибка. Правильно: ${words[currentIndex]}`;
    dictationWaiting = true;
    // переносим текущее слово в конец очереди
    dictationQueue.push(dictationQueue.shift());
  }
}

// Переход к следующему слову после ошибки по клику кнопки "Следующее"
function nextDictationAfterError() {
  if (!dictationWaiting) return;
  dictationWaiting = false;
  showNextDictationWord();
}


// === Общие функции ===
function nextIndex() {
  if (wrongQueue.length > 0) currentIndex = wrongQueue.shift();
  else currentIndex++;

  // Сохраняем индекс для текущей фазы
  phaseIndexes[currentPhase] = currentIndex;

  updateProgress();
}

function getCurrentIndex() {
  return (wrongQueue.length > 0) ? wrongQueue[0] : currentIndex;
}

function goToNextPage() {
  if (currentPhase === 3) startPhase(4);
  else if (currentPhase === 4) startPhase(5);
  else if (currentPhase === 5) startPhase(6);
  else finishLesson();
}

// Повтор предыдущей фазы
function repeatPhase() {
  if (currentPhase > 3) {
    startPhase(currentPhase - 1);
  } else {
    startPhase(currentPhase);
  }
}

function finishLesson() {
  hideAllPages();
  document.getElementById("finishPage").classList.remove("hidden");
}

function backToMenu() {
  hideAllPages();
  document.getElementById("menuDropdown").classList.add("show");
}

// === Горячие клавиши ===
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!document.getElementById("page3").classList.contains("hidden")) showNextCard();
    if (!document.getElementById("page4").classList.contains("hidden")) {
      if (document.getElementById("answerSection").classList.contains("hidden")) showAnswer();
      else markAnswer(true);
    }
    if (!document.getElementById("page5").classList.contains("hidden")) {
      if (document.getElementById("answerSection3").classList.contains("hidden")) showAnswer3();
      else markAnswer3(true);
    }
    if (!document.getElementById("page6").classList.contains("hidden")) checkDictation();
  }
  if (e.code === "Space") {
    if (!document.getElementById("page4").classList.contains("hidden")) showAnswer();
    if (!document.getElementById("page5").classList.contains("hidden")) showAnswer3();
  }
});
