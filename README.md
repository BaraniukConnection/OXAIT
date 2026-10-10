# OXAIT — народний бенчмарк

Турнір шести ШІ-моделей: шість етапів, кваліфікаційні раунди й секції, таблиця лідерів зліва і живе прев'ю робіт справа — ігри можна запустити прямо на сторінці.

Статичний сайт без збірки: HTML + CSS + JS. Оформлення — Oxygen Theme (темна тема, токени в `assets/css/oxygen-tokens.css`).

## Структура

```
index.html                 вхід (вибір мови UA/EN) і арена
data.js                    ← усі дані турніру: учасники, етапи, бали, роботи
assets/css/app.css         стилі арени
assets/js/app.js           логіка й маршрутизація
assets/img/                постер, іконка
entries/                   роботи учасників (ігри, застосунки, моделі, зображення)
entries/_template/         зразок роботи-гри
```

## Етапи

| # | Етап | Раунди |
|---|------|--------|
| 01 | Геймдев | Q/1 · sec-1 |
| 02 | Розробка ПЗ | Q/2 · sec-2 |
| 03 | 3D-моделювання | Q/3 · sec-3 |
| 04 | Аналітика | sec-4 |
| 05 | Тексти | sec-5 |
| 06 | Генерація зображень | sec-6 |

Учасники: Claude Opus 5.5, ChatGPT 6 Astra, Gemini 3.x Flash, Grok 4.7 Build, Z.AI GLM 5.3, Qwen 3.8 MAX.

## Як додати результат

1. Поклади роботу в `entries/<етап>/<раунд>/<учасник>/`, наприклад `entries/gamedev/q1/claude/index.html`.
2. Додай запис у `data.js` → `results`:

```js
"gamedev/q1": {
  order: ["claude", "chatgpt", "gemini", "grok", "glm", "qwen"],   // порядок у таблиці
  entries: {
    claude: {
      pills: [[8, 9, 7], [null, null, null], [null, null, null]],   // 3 етапи × 3 таблетки; null = порожня
      output: { type: "iframe", src: "entries/gamedev/q1/claude/index.html" },
      note: { uk: "Коментар журі", en: "Jury note" }
    }
  }
}
```

Типи `output`: `iframe` (гра / застосунок, запускається кнопкою «Грати»), `image` (одне або масив зображень — галерея), `video`, `model` (`.glb`/`.gltf`, крутиться мишкою), `text` (`{ uk, en }`).

Числа в таблетках сумуються в колонку «Бали». Назви трьох груп таблеток — `groups` у `data.js` (можна перевизначити для окремого раунду).

## Посилання

Кожен стан має свою адресу: `#/uk/gamedev/q1/claude` — мова, етап, раунд, учасник. Посилання з мовою пропускає екран вибору мови.

## Локальний запуск

```bash
python3 -m http.server 8765
```

і відкрий <http://localhost:8765>.

## GitHub Pages

1. Створи репозиторій `OXAIT` на GitHub і запуш гілку `main`.
2. Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, папка `/ (root)`.
3. Сайт буде на `https://<username>.github.io/OXAIT/`.
