let lessonsDB = {};

// Загружаем JSON с сервера
fetch('lessons.json') // путь к твоему JSON
  .then(res => res.json())
  .then(data => {
    lessonsDB = data;
    generateLevelsMenu(Object.keys(lessonsDB));
  })
  .catch(err => console.error("Ошибка загрузки JSON:", err));

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

// Показ/скрытие уроков
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
    li.onclick = () => loadLesson(level, lessonKey);
    ul.appendChild(li);
  }

  button.parentNode.appendChild(ul);
}

// Загрузка урока
function loadLesson(level, lessonKey) {
  const lesson = lessonsDB[level][lessonKey];
  if (!lesson) return console.error("Урок не найден:", level, lessonKey);

  const container = document.getElementById("lessonContent");
  container.innerHTML = `
    <h2>${lesson.title}</h2>
    <h3>Слова и перевод:</h3>
    <ul>
      ${lesson.english.map((word,i) => `<li>${word} [${lesson.transcriptions[i]}] — ${lesson.translated[i]}</li>`).join('')}
    </ul>
    <h3>Примеры:</h3>
    <ul>
      ${lesson.example.map(ex => `<li>${ex}</li>`).join('')}
    </ul>
  `;
}
