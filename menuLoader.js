
  // === Глобальные переменные === 
let lessonsDB = {};
let currentLesson = null;
let currentLessonElement = null;
let words = [];
let transcriptions = [];
let translations = [];
let examples = [];
let currentPhase = 0;
let currentIndex = 0;
let wrongQueue = [];
let dictationQueue = [];
let dictationWaiting = false;
let pullExamplesFromJSON = true; // подтягивать примеры из JSON
let lastSpokenWord = "";
let slowMode = false;

// === LocalStorage: словарь и завершённые уроки ===
const LOCAL_STORAGE_KEY = "myDictionary";
const FINISHED_LESSONS_KEY = "finishedLessons";

function getMyDictionary() {
  const dict = localStorage.getItem(LOCAL_STORAGE_KEY);
  return dict ? JSON.parse(dict) : [];
}

function saveMyDictionary(dict) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dict));
}

function getFinishedLessons() {
  const finished = localStorage.getItem(FINISHED_LESSONS_KEY);
  return finished ? JSON.parse(finished) : {};
}

function saveFinishedLesson(level, lessonKey) {
  const finished = getFinishedLessons();
  if (!finished[level]) finished[level] = [];
  if (!finished[level].includes(lessonKey)) finished[level].push(lessonKey);
  localStorage.setItem(FINISHED_LESSONS_KEY, JSON.stringify(finished));
}

// === Проверка словаря ===
function isInDictionary(word) {
  return getMyDictionary().includes(word);
}

function toggleDictionary(word, button) {
  let dict = getMyDictionary();
  if (dict.includes(word)) {
    dict = dict.filter(w => w !== word);
    button.textContent = "☆";
  } else {
    dict.push(word);
    button.textContent = "★";
  }
  saveMyDictionary(dict);
}

// === Озвучка ===
function speakWord(word) {
  if (!word) return;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  utter.rate = slowMode ? 0.7 : 1.0;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
  slowMode = (lastSpokenWord === word) ? !slowMode : false;
  lastSpokenWord = word;
}

// === Загружаем JSON ===
fetch("lessons.json")
  .then(res => res.json())
  .then(data => {
    lessonsDB = data;
    generateLevelsMenu();
    addSettingsMenu();
  })
  .catch(err => console.error("Ошибка загрузки JSON:", err));

// === Меню ===
document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("menuDropdown").classList.toggle("show");
});

// === Генерация уровней и уроков ===
function generateLevelsMenu() {
  const menu = document.getElementById("menuDropdown");
  menu.innerHTML = "";
  const finished = getFinishedLessons();

  Object.keys(lessonsDB).forEach(level => {
    const li = document.createElement("li");
    li.classList.add("menu__nav-item");

    const btn = document.createElement("button");
    btn.textContent = level;
    btn.classList.add("level-btn");
    li.appendChild(btn);

    const ul = document.createElement("ul");
    ul.classList.add("submenu");
    ul.style.display = "none";

    Object.keys(lessonsDB[level]).forEach(lessonKey => {
      const lessonLi = document.createElement("li");
      lessonLi.textContent = lessonsDB[level][lessonKey].title;
      lessonLi.style.cursor = "pointer";

      if (finished[level] && finished[level].includes(lessonKey)) {
        lessonLi.style.backgroundColor = "#6fcf97";
        lessonLi.style.color = "#000";
      }

      lessonLi.addEventListener("click", () => {
        startLesson(level, lessonKey);

        if (currentLessonElement) {
          currentLessonElement.style.backgroundColor = "";
          currentLessonElement.style.color = "";
        }
        lessonLi.style.backgroundColor = "#ffd966";
        lessonLi.style.color = "#000";
        currentLessonElement = lessonLi;

        setTimeout(() => {
          document.getElementById("page3").scrollIntoView({ behavior: "smooth", block: "start" });
        }, 300);
      });

      ul.appendChild(lessonLi);
    });

    li.appendChild(ul);
    menu.appendChild(li);

    btn.addEventListener("click", () => {
      const isShown = ul.style.display === "block";
      document.querySelectorAll(".submenu").forEach(sub => sub.style.display = "none");
      ul.style.display = isShown ? "none" : "block";
    });
  });

  const dictBtn = document.createElement("li");
  dictBtn.innerHTML = `<button id="myDictionaryBtn">★ Мой словарь</button>`;
  menu.appendChild(dictBtn);
  document.getElementById("myDictionaryBtn").addEventListener("click", startDictionaryLesson);
}

// === Настройки ===
function addSettingsMenu() {
  const menu = document.getElementById("menuDropdown");

  const settingsLi = document.createElement("li");
  settingsLi.classList.add("menu__nav-item");

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "⚙ Настройки";
  settingsBtn.classList.add("level-btn");
  settingsLi.appendChild(settingsBtn);

  const settingsSubmenu = document.createElement("ul");
  settingsSubmenu.classList.add("submenu");
  settingsSubmenu.style.display = "none";

  const resetExamplesLi = document.createElement("li");
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Сброс примеров";
  resetBtn.style.cursor = "pointer";
  resetBtn.onclick = () => {
    pullExamplesFromJSON = false;
    examples = words.map(() => "");
    alert("Примеры больше не подтягиваются из JSON!");
  };
  resetExamplesLi.appendChild(resetBtn);
  settingsSubmenu.appendChild(resetExamplesLi);

  settingsLi.appendChild(settingsSubmenu);
  menu.appendChild(settingsLi);

  settingsBtn.addEventListener("click", () => {
    const isShown = settingsSubmenu.style.display === "block";
    document.querySelectorAll(".submenu").forEach(sub => sub.style.display = "none");
    settingsSubmenu.style.display = isShown ? "none" : "block";
  });
}

// === Запуск урока из JSON ===
function startLesson(level, lessonKey) {
  const lesson = lessonsDB[level][lessonKey];
  if (!lesson) return;

  currentLesson = { level, lessonKey };
  words = lesson.english;
  transcriptions = lesson.transcriptions;
  translations = lesson.translated;
  examples = pullExamplesFromJSON ? (lesson.example || []) : words.map(() => "");
  currentPhase = 3;
  currentIndex = 0;
  wrongQueue = [];
  startPhase(currentPhase);
  document.getElementById("menuDropdown").classList.remove("show");
}

// === Запуск урока из словаря ===
function normalizeDictionaryWord(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[’`´]/g, "'");
}

function findBestWordEntry(word) {
  const normalizedWord = normalizeDictionaryWord(word);
  if (!normalizedWord) return null;

  let fallback = null;

  for (const levelKey in lessonsDB) {
    for (const lessonKey in lessonsDB[levelKey]) {
      const lesson = lessonsDB[levelKey][lessonKey];
      const englishWords = lesson.english || [];

      for (let idx = 0; idx < englishWords.length; idx++) {
        const candidate = englishWords[idx];
        if (normalizeDictionaryWord(candidate) !== normalizedWord) continue;

        const entry = {
          word: candidate,
          transcription: (lesson.transcriptions && lesson.transcriptions[idx]) || "",
          translation: (lesson.translated && lesson.translated[idx]) || "",
          example: (lesson.example && lesson.example[idx]) || ""
        };

        if (!fallback) fallback = entry;
        if (entry.translation) return entry;
      }
    }
  }

  return fallback;
}

// === Запуск урока из словаря ===
function startDictionaryLesson() {
  const dict = getMyDictionary();
  if (dict.length === 0) { alert("Ваш словарь пуст."); return; }

  const foundWords = [];
  const foundTrans = [];
  const foundTransl = [];
  const foundExamples = [];

  for (const savedWord of dict) {
    const entry = findBestWordEntry(savedWord);

    if (entry) {
      foundWords.push(entry.word);
      foundTrans.push(entry.transcription);
      foundTransl.push(entry.translation || "(перевод отсутствует)");
      foundExamples.push(entry.example);
      continue;
    }

    foundWords.push(savedWord);
    foundTrans.push("");
    foundTransl.push("(слово не найдено в уроках)");
    foundExamples.push("");
  }

  words = foundWords;
  transcriptions = foundTrans;
  translations = foundTransl;
  examples = foundExamples;
  currentPhase = 3;
  currentIndex = 0;
  wrongQueue = [];
  hideAllPages();
  startPhase(currentPhase);
  document.getElementById("menuDropdown").classList.remove("show");
}

// === Самостоятельный ввод слов ===
function goToTranscription() {
  const rawWords = document.getElementById("englishWords").value.trim();
  if (!rawWords) { alert("Введите хотя бы одно слово"); return; }
  words = rawWords.split("\n").map(s => s.trim());
  transcriptions = words.map(() => "");
  translations = words.map(() => "");
  examples = words.map(() => "");
  hideAllPages();
  document.getElementById("page1_5").classList.remove("hidden");
}

function skipTranscription() {
  transcriptions = words.map(() => "");
  goToTranslations();
}

function goToTranslations() {
  const rawTrans = document.getElementById("englishTranscription").value.trim();
  if (rawTrans) {
    transcriptions = rawTrans.split("\n").map(s => s.trim());
    if (transcriptions.length !== words.length) { alert("Количество транскрипций должно совпадать с количеством слов"); return; }
  } else transcriptions = words.map(() => "");
  hideAllPages();
  document.getElementById("page2").classList.remove("hidden");
}

function startSelfLearning() {
  const rawTransl = document.getElementById("translatedWords").value.trim();
  if (!rawTransl) { alert("Введите переводы"); return; }
  translations = rawTransl.split("\n").map(s => s.trim());
  if (translations.length !== words.length) { alert("Количество переводов должно совпадать с количеством слов"); return; }
  examples = words.map(() => "");
  currentPhase = 3;
  currentIndex = 0;
  wrongQueue = [];
  hideAllPages();
  startPhase(currentPhase);
}

// === Управление страницами ===
function hideAllPages() {
  ["page0","page1_5","page2","page3","page4","page5","page6","finishPage"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
}

// === Фазы ===
function startPhase(phase) {
  hideAllPages();
  currentPhase = phase;
  currentIndex = 0;
  wrongQueue = [];
  updateProgress();

  if (phase === 3) showNextCard();
  if (phase === 4) showPhase2();
  if (phase === 5) showPhase3();
  if (phase === 6) startDictationPhase();
}

// === Прогресс ===
function updateProgress() {
  const total = words.length;
  const done = currentIndex;
  const percent = Math.min(100, Math.round((done / total) * 100));
  document.getElementById("progressText").textContent = `Прогресс: ${done}/${total}`;
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressBar").textContent = percent + "%";
}

// === Фаза 3 (карточки) ===
function showNextCard() {
  if (currentIndex >= words.length) { goToNextPage(); return; }
  document.getElementById("page3").classList.remove("hidden");
  const word = words[currentIndex];
  document.getElementById("card").innerHTML =
    `<strong>${word}</strong> [${transcriptions[currentIndex]}] — ${translations[currentIndex]}
     <button id="speakBtn">🔊</button>
     <button id="addToDictionaryBtn" class="dictionary-btn">${isInDictionary(word) ? "★" : "☆"}</button>`;
  document.getElementById("cardExample").textContent = examples[currentIndex] || "";

  document.getElementById("speakBtn").onclick = () => speakWord(word);
  document.getElementById("addToDictionaryBtn").onclick = () => toggleDictionary(word, document.getElementById("addToDictionaryBtn"));

  currentIndex++;
  updateProgress();
}

// === Фаза 4 ===
function showPhase2() {
  if (currentIndex >= words.length && wrongQueue.length === 0) { goToNextPage(); return; }
  document.getElementById("page4").classList.remove("hidden");
  document.getElementById("answerSection").classList.add("hidden");
  const i = getCurrentIndex();
  document.getElementById("phase2-translation").innerHTML = translations[i];
  document.getElementById("phase2-example").textContent = examples[i] || "";
}

function showAnswer() {
  const i = getCurrentIndex();
  const answerContainer = document.getElementById("answerSection");
  document.getElementById("phase2-answer").textContent = `${words[i]} [${transcriptions[i]}]`;
  answerContainer.classList.remove("hidden");

  let btn = document.getElementById("speakPhase4Btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "speakPhase4Btn";
    btn.textContent = "🔊";
    answerContainer.appendChild(btn);
  }
  btn.onclick = () => speakWord(words[i]);
}

function markAnswer(correct) {
  const i = getCurrentIndex();
  if (!correct) wrongQueue.push(i);
  nextIndex();
  showPhase2();
}

// === Фаза 5 ===
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
  const answerContainer = document.getElementById("answerSection3");
  document.getElementById("phase3-answer").textContent = translations[i];
  answerContainer.classList.remove("hidden");

  let btn = document.getElementById("speakPhase5Btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "speakPhase5Btn";
    btn.textContent = "🔊";
    answerContainer.appendChild(btn);
  }
  btn.onclick = () => speakWord(words[i]);
}

function markAnswer3(correct) {
  const i = getCurrentIndex();
  if (!correct) wrongQueue.push(i);
  nextIndex();
  showPhase3();
}

// === Общие функции ===
function nextIndex() {
  if (wrongQueue.length > 0) currentIndex = wrongQueue.shift();
  else currentIndex++;
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

// === Повторить этап ===
function repeatPhase() {
  if (currentPhase > 3) startPhase(currentPhase - 1);
  else startPhase(3);
}

// === Финал урока ===
function finishLesson() {
  hideAllPages();
  document.getElementById("finishPage").classList.remove("hidden");
  if (currentLesson) saveFinishedLesson(currentLesson.level, currentLesson.lessonKey);
  generateLevelsMenu();
}

function backToMenu() {
  hideAllPages();
  document.getElementById("page0").classList.remove("hidden");
  document.getElementById("menuDropdown").classList.add("show");
}

// === Диктант (Фаза 6) ===
function startDictationPhase() {
  dictationQueue = words.map((_, i) => i);
  currentIndex = 0;
  dictationWaiting = false;
  showNextDictationWord();
}

function showNextDictationWord() {
  if (dictationQueue.length === 0) { finishLesson(); return; }
  currentIndex = dictationQueue[0];
  dictationWaiting = false;
  hideAllPages();
  const page = document.getElementById("page6");
  page.classList.remove("hidden");
  document.getElementById("dictation-translation").textContent = translations[currentIndex];
  document.getElementById("dictation-example").textContent = examples[currentIndex] || "";
  document.getElementById("dictation-input").value = "";
  document.getElementById("dictation-feedback").textContent = "";

  let btn = document.getElementById("speakDictationBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "speakDictationBtn";
    btn.textContent = "🔊";
    page.appendChild(btn);
  }
  btn.onclick = () => speakWord(words[currentIndex]);
}

function checkDictation() {
  if (dictationWaiting) return;
  const input = document.getElementById("dictation-input").value.trim();
  if (input.toLowerCase() === words[currentIndex].toLowerCase()) {
    document.getElementById("dictation-feedback").textContent = "✅ Верно!";
    dictationQueue.shift();
    setTimeout(showNextDictationWord, 600);
  } else {
    document.getElementById("dictation-feedback").textContent = `❌ Ошибка. Правильно: ${words[currentIndex]}`;
    dictationQueue.push(dictationQueue.shift());
    dictationWaiting = true;
  }
}

function nextDictationAfterError() {
  if (!dictationWaiting) return;
  showNextDictationWord();
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
  // === Фаза 4 ===
function markAnswer(correct) {
  const i = currentIndex;
  if (!correct) {
    // добавляем в конец списка для повторного показа
    wrongQueue.push(i);
  }
  currentIndex++;
  // если дошли до конца основного списка, начинаем показывать неправильные
  if (currentIndex >= words.length && wrongQueue.length > 0) {
    currentIndex = wrongQueue.shift();
  }
  showPhase2();
}

// === Фаза 5 ===
function markAnswer3(correct) {
  const i = currentIndex;
  if (!correct) {
    wrongQueue.push(i);
  }
  currentIndex++;
  if (currentIndex >= words.length && wrongQueue.length > 0) {
    currentIndex = wrongQueue.shift();
  }
  showPhase3();
}
// === Фаза 4 ===
function markAnswer(correct) {
  if (!correct) {
    // Добавляем индекс текущего слова в конец очереди для повторного показа
    wrongQueue.push(currentIndex);
  }
  currentIndex++; // Идём дальше по словам
  if (currentIndex >= words.length && wrongQueue.length > 0) {
    // Когда дошли до конца списка, начинаем показывать ошибочные
    currentIndex = wrongQueue.shift();
  }
  showPhase2();
}

// === Фаза 5 ===
function markAnswer3(correct) {
  if (!correct) {
    wrongQueue.push(currentIndex);
  }
  currentIndex++;
  if (currentIndex >= words.length && wrongQueue.length > 0) {
    currentIndex = wrongQueue.shift();
  }
  showPhase3();
}

// === Общая логика при смене слова ===
function getCurrentIndex() {
  // теперь просто возвращаем текущий индекс
  return currentIndex;
}
// === Прогресс ===
function updateProgress() {
  const total = words.length;
  const passed = total - (wrongQueue.length + (total - currentIndex));
  const done = Math.max(0, Math.min(total, passed + 1));
  const percent = Math.min(100, Math.round((done / total) * 100));

  const bar = document.getElementById("progressBar");
  const text = document.getElementById("progressText");
  if (bar && text) {
    bar.style.width = percent + "%";
    bar.textContent = percent + "%";
    text.textContent = `Прогресс: ${done}/${total}`;
  }
}

// === Общие функции ===
function nextIndex() {
  if (wrongQueue.length > 0) {
    currentIndex = wrongQueue.shift();
  } else {
    currentIndex++;
  }
  updateProgress();
}

// === Фаза 4 ===
function markAnswer(correct) {
  if (!correct) {
    wrongQueue.push(currentIndex);
  }
  currentIndex++;

  if (currentIndex >= words.length && wrongQueue.length > 0) {
    currentIndex = wrongQueue.shift();
  }

  updateProgress();
  showPhase2();
}

// === Фаза 5 ===
function markAnswer3(correct) {
  if (!correct) {
    wrongQueue.push(currentIndex);
  }
  currentIndex++;

  if (currentIndex >= words.length && wrongQueue.length > 0) {
    currentIndex = wrongQueue.shift();
  }

  updateProgress();
  showPhase3();
}
// === Этап 4 (диктант — проверка) ===
function checkDictation() {
  const i = getCurrentIndex();
  const input = document.getElementById("dictationInput").value.trim();
  const correct = input.toLowerCase() === words[i].toLowerCase();

  const feedback = document.getElementById("dictationFeedback");
  const answerSection = document.getElementById("phase4-answerSection");

  if (correct) {
    feedback.textContent = "✅ Верно!";
  } else {
    feedback.textContent = `❌ Ошибка. Правильно: ${words[i]}`;
  }

  // Показываем секцию с ответом
  answerSection.classList.remove("hidden");

  // Добавляем кнопку озвучки только после проверки
  const existingBtn = document.getElementById("speakDictationBtn");
  if (existingBtn) existingBtn.remove(); // удаляем старую, если была

  const btn = document.createElement("button");
  btn.id = "speakDictationBtn";
  btn.textContent = "🔊 Озвучить слово";
  btn.onclick = () => speakWord(words[i]);
  answerSection.appendChild(btn);

  // Переход к следующему слову
  if (!correct) {
    wrongQueue.push(i);
  }
  currentIndex++;
  if (currentIndex >= words.length && wrongQueue.length > 0) {
    currentIndex = wrongQueue.shift();
  }
  updateProgress();
}
// === Настройки ===
function addSettingsMenu() {
  const menu = document.getElementById("menuDropdown");

  const settingsLi = document.createElement("li");
  settingsLi.classList.add("menu__nav-item");

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "⚙ Настройки";
  settingsBtn.classList.add("level-btn");
  settingsLi.appendChild(settingsBtn);

  // создаём новое пустое окно под кнопкой
  const settingsWindow = document.createElement("div");
  settingsWindow.id = "settingsWindow";
  settingsWindow.style.display = "none"; // по умолчанию скрыто
  settingsWindow.style.padding = "10px";
  settingsWindow.style.marginTop = "5px";
  settingsWindow.style.backgroundColor = "#3a3a3a";
  settingsWindow.style.borderRadius = "5px";

  // кнопка внутри окна
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Сброс примеров";
  resetBtn.style.cursor = "pointer";
  resetBtn.onclick = () => {
    pullExamplesFromJSON = false;
    examples = words.map(() => "");
    alert("Примеры больше не подтягиваются из JSON!");
  };

  settingsWindow.appendChild(resetBtn);
  settingsLi.appendChild(settingsWindow);
  menu.appendChild(settingsLi);

  // логика показа/скрытия окна
  settingsBtn.addEventListener("click", () => {
    const isShown = settingsWindow.style.display === "block";
    // скрываем все другие окна настроек
    document.querySelectorAll("#menuDropdown > li > div").forEach(div => div.style.display = "none");
    settingsWindow.style.display = isShown ? "none" : "block";
  });
}
function addSettingsMenu() {
  const menu = document.getElementById("menuDropdown");

  const settingsLi = document.createElement("li");
  settingsLi.classList.add("menu__nav-item");

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "⚙ Настройки";
  settingsBtn.classList.add("level-btn");
  settingsLi.appendChild(settingsBtn);

  const settingsWindow = document.createElement("div");
  settingsWindow.id = "settingsWindow";
  settingsWindow.style.display = "none";
  settingsWindow.style.padding = "10px";
  settingsWindow.style.marginTop = "5px";
  settingsWindow.style.backgroundColor = "#3a3a3a";
  settingsWindow.style.borderRadius = "5px";

  // Кнопка сброса примеров
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Сброс примеров";
  resetBtn.style.cursor = "pointer";
  resetBtn.onclick = () => {
    pullExamplesFromJSON = false;
    examples = words.map(() => "");
    alert("Примеры больше не подтягиваются из JSON!");
  };
  settingsWindow.appendChild(resetBtn);

  // Кнопка перехода по темам
  const goToThemesBtn = document.createElement("button");
  goToThemesBtn.textContent = "Перейти к темам";
  goToThemesBtn.style.cursor = "pointer";
  goToThemesBtn.style.marginTop = "5px";
  goToThemesBtn.onclick = () => {
    // Скрываем все страницы и показываем главную страницу с меню
    hideAllPages();
    document.getElementById("page0").classList.remove("hidden");
    document.getElementById("menuDropdown").classList.add("show");
  };
  settingsWindow.appendChild(goToThemesBtn);

  settingsLi.appendChild(settingsWindow);
  menu.appendChild(settingsLi);

  // Логика показа/скрытия окна настроек
  settingsBtn.addEventListener("click", () => {
    const isShown = settingsWindow.style.display === "block";
    document.querySelectorAll("#menuDropdown > li > div").forEach(div => div.style.display = "none");
    settingsWindow.style.display = isShown ? "none" : "block";
  });
}
function addSettingsMenu() {
  const menu = document.getElementById("menuDropdown");

  const settingsLi = document.createElement("li");
  settingsLi.classList.add("menu__nav-item");

  const settingsBtn = document.createElement("button");
  settingsBtn.textContent = "⚙ Настройки";
  settingsBtn.classList.add("level-btn");
  settingsLi.appendChild(settingsBtn);

  const settingsWindow = document.createElement("div");
  settingsWindow.id = "settingsWindow";
  settingsWindow.style.display = "none";
  settingsWindow.style.position = "relative"; // обязательно
  settingsWindow.style.zIndex = "10"; // поверх меню
  settingsWindow.style.padding = "10px";
  settingsWindow.style.marginTop = "5px";
  settingsWindow.style.backgroundColor = "#3a3a3a";
  settingsWindow.style.borderRadius = "5px";

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Сброс примеров";
  resetBtn.style.display = "block";
  resetBtn.style.width = "100%";
  resetBtn.style.marginBottom = "5px";
  resetBtn.onclick = () => {
    pullExamplesFromJSON = false;
    examples = words.map(() => "");
    alert("Примеры больше не подтягиваются из JSON!");
  };
  settingsWindow.appendChild(resetBtn);

  const goToThemesBtn = document.createElement("button");
  goToThemesBtn.textContent = "Перейти к темам";
  goToThemesBtn.style.display = "block";
  goToThemesBtn.style.width = "100%";
  goToThemesBtn.onclick = () => {
    hideAllPages();
    document.getElementById("page0").classList.remove("hidden");
    document.getElementById("menuDropdown").classList.add("show");
  };
  settingsWindow.appendChild(goToThemesBtn);

  settingsLi.appendChild(settingsWindow);
  menu.appendChild(settingsLi);

  settingsBtn.addEventListener("click", () => {
    const isShown = settingsWindow.style.display === "block";
    document.querySelectorAll("#menuDropdown > li > div").forEach(div => div.style.display = "none");
    settingsWindow.style.display = isShown ? "none" : "block";
  });
}


