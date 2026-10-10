# OXAIT — народний бенчмарк

Турнір шести ШІ-моделей: шість етапів, кваліфікаційні раунди й секції, таблиця лідерів зліва і живе прев'ю робіт справа — ігри можна запустити прямо на сторінці.

Статичний сайт без збірки: HTML + CSS + JS. Оформлення — неонова «геймерська» арена на базі розмірів Oxygen Theme (`assets/css/oxygen-tokens.css`): HUD-рамки, підсвітка, сітка-підлога, сканлайни.

## Структура

```
index.html                 вхід (вибір мови UA/EN) і арена
data.js                    ← усі дані турніру: учасники, етапи, бали, роботи
assets/css/app.css         стилі арени
assets/js/app.js           логіка й маршрутизація
assets/img/                постер, іконка
entries/                   роботи учасників (генерується tools/sync_entries.py)
tools/sync_entries.py      синхронізація робіт з HDD
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

## Як додати роботи

Роботи зберігаються на HDD у `HDDWork/OXAIT/<раунд>/<учасник>/`:

```
OXAIT/
  Q1/
    Claude/   snake3D.html  tetris.html
    ChatGPT/  Snake3D.html  tetris.html
    ...
```

- раунд: `Q1`, `SEC1`, `Q2`, `SEC2`, `Q3`, `SEC3`, `SEC4`, `SEC5`, `SEC6`
- учасник: `Claude`, `ChatGPT`, `Gemini`, `Grok`, `GLM`, `QWEN`
- проєкт: `.html`-гра, папка з `index.html`, зображення, відео, `.glb`/`.gltf`, `.md`/`.txt`

Потім:

```bash
python3 tools/sync_entries.py
```

Скрипт копіює все в `entries/<етап>/<раунд>/<учасник>/` і складає `entries/manifest.js`. Назва проєкту береться з `<title>` гри (або з імені файлу). Якщо в учасника кілька проєктів, у прев'ю з'являється екран вибору «Варіант A / B / …».

## Як додати бали

`data.js` → `results`:

```js
"gamedev/q1": {
  order: ["claude", "chatgpt", "gemini", "grok", "glm", "qwen"],   // порядок при рівних балах
  entries: {
    claude: {
      pills: [[true, true, null], [true, true, true], [null, null, null]],   // 3 етапи × 3 таблетки
      // status: "out",                                                     // вибув — червоний рядок унизу
      note: { uk: "Коментар журі", en: "Jury note" }
    }
  }
}
```

Таблетка: `null` — порожня (ще не оцінено), `true` — заповнена (1 бал), `false` — оцінено на 0 (червона), число — заповнена з цифрою. Бали сумуються, таблиця сортується за ними (рівні бали ділять місце), вибулі (`status: "out"`) — внизу червоним. Назви трьох груп таблеток — `groups` у `data.js` (можна перевизначити для окремого раунду). У групи раунду можна додати `match` — регулярний вираз по імені файлу чи назві проєкту; тоді проєкти розкладаються по етапах і йдуть у їхньому порядку (A — етап I, B — етап II…), а на картках видно етап. Група без `match` забирає все, що не підійшло до інших:

```js
groups: [
  { uk: "Етап I · Snake 3D", en: "Stage I · Snake 3D", match: "snake" },
  { uk: "Етап II · Тетріс",  en: "Stage II · Tetris",  match: "tetris" },
  { uk: "Етап III · Платформер", en: "Stage III · Platformer" }
]
```

Проєкт можна додати й вручну, без скрипта: `outputs: [{ type: "iframe", title: "...", src: "entries/..." }]` (типи: `iframe`, `image`, `video`, `model`, `text`).

## Посилання

Кожен стан має свою адресу: `#/uk/gamedev/q1/claude/tetris` — мова, етап, раунд, учасник, проєкт. Посилання з мовою пропускає екран вибору мови.

## Локальний запуск

```bash
python3 -m http.server 8765
```

і відкрий <http://localhost:8765>.

## GitHub Pages

1. Створи репозиторій `OXAIT` на GitHub і запуш гілку `main`.
2. Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, папка `/ (root)`.
3. Сайт буде на `https://<username>.github.io/OXAIT/`.
