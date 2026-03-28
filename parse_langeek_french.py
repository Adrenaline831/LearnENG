#!/usr/bin/env python3
"""Парсер французской лексики LanGeek (A1-B2) с выводом в JSON и TXT.

Требования:
  pip install playwright
  playwright install chromium

Запуск:
  python parse_langeek_french.py
"""

from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

BASE_URL = "https://langeek.co/fr-EN/vocab/level-based"
DEFAULT_LEVELS = ("A1", "A2", "B1", "B2")


@dataclass
class LessonData:
    title: str
    words: list[str]


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def unique_preserve(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        key = item.lower()
        if not item or key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def extract_level_links(page, levels: tuple[str, ...]) -> dict[str, str]:
    """Берёт ссылки на страницы уровней A1..B2 с главной страницы level-based."""
    level_links: dict[str, str] = {}

    anchors = page.locator('a[href*="/vocab/category/"]').all()
    for anchor in anchors:
        href = anchor.get_attribute("href") or ""
        text = normalize_space(anchor.inner_text())
        for level in levels:
            upper_text = text.upper()
            if upper_text.startswith(level) or f" {level}" in upper_text:
                level_links[level] = href

    if len(level_links) < len(levels):
        # Фолбэк: ищем по шаблону /niveau-a1, /niveau-a2, ...
        html = page.content()
        for level in levels:
            if level in level_links:
                continue
            m = re.search(rf'(/fr-EN/vocab/category/\d+/niveau-{level.lower()})', html, flags=re.IGNORECASE)
            if m:
                level_links[level] = m.group(1)

    missing = [lvl for lvl in levels if lvl not in level_links]
    if missing:
        raise RuntimeError(f"Не удалось найти ссылки для уровней: {', '.join(missing)}")

    resolved = {}
    for level, href in level_links.items():
        resolved[level] = href if href.startswith("http") else f"https://langeek.co{href}"
    return resolved


def extract_lessons_on_level_page(page) -> list[tuple[str, str]]:
    """Возвращает список (название_урока, url_урока_learn)."""
    lessons: list[tuple[str, str]] = []

    # Основной путь: берем все learn-ссылки и пытаемся вытащить заголовок из их карточек
    learn_links = page.locator('a[href*="/vocab/subcategory/"][href*="/learn"]').all()
    for idx, link in enumerate(learn_links, start=1):
        href = link.get_attribute("href") or ""
        if not href:
            continue

        card = link.locator("xpath=ancestor::*[self::section or self::article or self::div][1]")
        title_raw = ""
        heading = card.locator("h1, h2, h3, h4").first
        if heading.count() > 0:
            title_raw = normalize_space(heading.inner_text())

        if not title_raw:
            # Фолбэк: ищем ближайший заголовок вверх по DOM
            title_raw = normalize_space(link.evaluate(
                """
                (el) => {
                  let node = el;
                  while (node) {
                    let prev = node.previousElementSibling;
                    while (prev) {
                      if (prev.matches && prev.matches('h1,h2,h3,h4')) {
                        return (prev.innerText || '').trim();
                      }
                      const nested = prev.querySelector ? prev.querySelector('h1,h2,h3,h4') : null;
                      if (nested) return (nested.innerText || '').trim();
                      prev = prev.previousElementSibling;
                    }
                    node = node.parentElement;
                  }
                  return '';
                }
                """
            ))

        title = re.sub(r"^\d+\.\s*", "", title_raw).strip() if title_raw else f"Lesson {idx}"
        full_url = href if href.startswith("http") else f"https://langeek.co{href}"
        lessons.append((title, full_url))

    if lessons:
        deduped: list[tuple[str, str]] = []
        seen_urls: set[str] = set()
        for title, url in lessons:
            if url in seen_urls:
                continue
            seen_urls.add(url)
            deduped.append((title, url))
        return deduped

    # Фолбэк: регулярка по html (сопоставляем h3 + ближайший learn-link)
    html = page.content()
    block_matches = re.findall(
        r"<h3[^>]*>\s*\d+\.\s*(.*?)</h3>.*?<a[^>]+href=\"([^\"]*/vocab/subcategory/\d+/learn[^\"]*)\"",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    for raw_title, href in block_matches:
        title = normalize_space(re.sub(r"<[^>]+>", "", raw_title))
        href = href if href.startswith("http") else f"https://langeek.co{href}"
        lessons.append((title, href))

    if lessons:
        pairs = unique_preserve([f"{t}||{u}" for t, u in lessons])
        return [tuple(item.split("||", 1)) for item in pairs]

    # Последний фолбэк: хотя бы URLs без заголовков
    urls = re.findall(r"(https://langeek\.co/fr-EN/vocab/subcategory/\d+/learn|/fr-EN/vocab/subcategory/\d+/learn)", html)
    for i, href in enumerate(unique_preserve(urls), start=1):
        href = href if href.startswith("http") else f"https://langeek.co{href}"
        lessons.append((f"Lesson {i}", href))

    return lessons


def _extract_words_from_html(html: str) -> list[str]:
    patterns = [
        r'"word"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"',
        r'"targetWord"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"',
        r'"lemma"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"',
        r'"headword"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"',
    ]
    candidates: list[str] = []
    for pattern in patterns:
        for match in re.findall(pattern, html):
            text = bytes(match, "utf-8").decode("unicode_escape")
            text = normalize_space(text)
            if not text:
                continue
            if len(text) > 60:
                continue
            if re.search(r"[\d{}<>]", text):
                continue
            if not re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ]", text):
                continue
            candidates.append(text)

    return unique_preserve(candidates)


def _extract_words_from_dom(page) -> list[str]:
    js = """
() => {
  const selectors = [
    '[data-testid*="word"]',
    '[class*="word"]',
    '.vocab-word',
    '.word-title',
    'li',
    'td',
    'span',
    'p'
  ];
  const out = [];
  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    for (const n of nodes) {
      const t = (n.innerText || '').trim();
      if (!t) continue;
      out.push(t);
    }
  }
  return out;
}
"""
    raw = page.evaluate(js)
    words: list[str] = []
    for item in raw:
        text = normalize_space(item)
        if not text or len(text) > 40:
            continue
        # Берём короткие словоформы/фразы и отбрасываем служебный UI-текст
        if text.lower() in {
            "start", "login", "sign in", "close", "premium", "dictionary",
            "review", "flashcard", "spelling", "quiz", "daily words"
        }:
            continue
        if re.search(r"\d+\s*(word|lesson|m|h)$", text.lower()):
            continue
        if not re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ]", text):
            continue
        words.append(text)

    return unique_preserve(words)


def extract_words_from_lesson(page, lesson_url: str) -> list[str]:
    page.goto(lesson_url, wait_until="domcontentloaded", timeout=90000)

    # Пытаемся открыть режим списка слов (если есть кнопка)
    try:
        list_icon = page.locator('img[alt*="view-list" i]').first
        if list_icon.count() > 0:
            list_icon.locator("xpath=ancestor::button[1] | ancestor::a[1]").first.click(timeout=2500)
    except PlaywrightTimeoutError:
        pass
    except Exception:
        pass

    try:
        page.wait_for_timeout(1500)
    except Exception:
        pass

    html = page.content()
    words = _extract_words_from_html(html)
    if words:
        return words

    return _extract_words_from_dom(page)


def to_json_structure(data: dict[str, list[LessonData]]) -> dict:
    output: dict[str, OrderedDict[str, dict]] = {}
    for level, lessons in data.items():
        level_block: OrderedDict[str, dict] = OrderedDict()
        for idx, lesson in enumerate(lessons, start=1):
            level_block[f"lesson_{idx}"] = {
                "title": lesson.title,
                "french": lesson.words,
            }
        output[level] = level_block
    return output


def write_txt(data: dict[str, list[LessonData]], out_path: Path) -> None:
    lines: list[str] = []
    for level, lessons in data.items():
        lines.append(level)
        for lesson in lessons:
            lines.append(f"  {lesson.title}")
            if lesson.words:
                for word in lesson.words:
                    lines.append(f"    - {word}")
            else:
                lines.append("    - (слова не найдены)")
        lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")


def parse_langeek(levels: tuple[str, ...], headless: bool = True) -> dict[str, list[LessonData]]:
    parsed: dict[str, list[LessonData]] = OrderedDict((lvl, []) for lvl in levels)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(locale="fr-FR")
        page = context.new_page()

        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=90000)
        level_links = extract_level_links(page, levels)

        for level in levels:
            page.goto(level_links[level], wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(1800)
            lessons = extract_lessons_on_level_page(page)

            for lesson_title, lesson_url in lessons:
                words = extract_words_from_lesson(page, lesson_url)
                parsed[level].append(LessonData(title=lesson_title, words=words))

        context.close()
        browser.close()

    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(description="Парсер французских слов LanGeek (A1-B2)")
    parser.add_argument("--json-output", default="french_lessons_a1_b2.json", help="Путь к JSON-файлу")
    parser.add_argument("--txt-output", default="french_lessons_a1_b2.txt", help="Путь к TXT-файлу")
    parser.add_argument("--headed", action="store_true", help="Запуск браузера с интерфейсом")
    args = parser.parse_args()

    levels = tuple(DEFAULT_LEVELS)
    parsed = parse_langeek(levels=levels, headless=not args.headed)

    json_data = to_json_structure(parsed)
    Path(args.json_output).write_text(
        json.dumps(json_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_txt(parsed, Path(args.txt_output))

    print(f"Готово: JSON -> {args.json_output}")
    print(f"Готово: TXT  -> {args.txt_output}")


if __name__ == "__main__":
    main()
