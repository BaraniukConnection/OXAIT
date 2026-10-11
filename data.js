/*
 * OXAIT — дані турніру. Єдиний файл, який треба редагувати, щоб оновити сайт.
 *
 * participants  — шість учасників (порядок тут не важливий).
 * stages        — шість етапів; у кожного свої раунди (Q/N — кваліфікація, sec-N — секція).
 * results       — по ключу "<stage>/<round>":
 *     order     — порядок при рівних балах (таблиця сортується за сумою, вибулі — внизу).
 *     entries   — для кожного учасника:
 *         pills  — три групи по три таблетки; null = порожня (ще не оцінено), true = заповнена (1 бал),
 *                  false = оцінено, 0 балів (червона),
 *                  число — заповнена з цифрою (додається до суми), інший текст просто показується.
 *         status — "out", якщо учасник вибув (рядок червоний і йде вниз таблиці).
 *         outputs — проєкти, додані вручну (зазвичай не потрібно — їх знаходить tools/sync_entries.py):
 *                  [{ type: "iframe" | "image" | "video" | "model" | "text", title: "...", src: "entries/..." }]
 *         note   — короткий коментар журі (рядок або { uk, en }).
 */
window.OXAIT = {
  updated: "2026-10-11",

  participants: [
    { id: "claude",  name: "Claude Opus 5.5",   vendor: "Anthropic", mono: "C",  color: "#e2805c" },
    { id: "chatgpt", name: "ChatGPT 6 Astra",   vendor: "OpenAI",    mono: "G",  color: "#1fb58a" },
    { id: "gemini",  name: "Gemini 3.x Flash",  vendor: "Google",    mono: "Ge", color: "#5b8cff" },
    { id: "grok",    name: "Grok 4.7 Build",    vendor: "xAI",       mono: "X",  color: "#c9d1db" },
    { id: "glm",     name: "Z.AI GLM 5.3",      vendor: "Z.ai",      mono: "Z",  color: "#b8f20c" },
    { id: "qwen",    name: "Qwen 3.8 MAX",      vendor: "Alibaba",   mono: "Q",  color: "#a675ff" }
  ],

  stages: [
    {
      id: "gamedev", icon: "sports_esports",
      title: { uk: "Геймдев", en: "Game Dev" },
      rounds: [
        { id: "q1",   code: "Q/1",   title: { uk: "Кваліфікаційний раунд", en: "Qualification Round" }, cover: "assets/img/poster-q1.webp" },
        { id: "sec1", code: "sec-1", title: { uk: "Перша секція",          en: "Section One" }, cover: "assets/img/poster-sec1.webp" }
      ]
    },
    {
      id: "software", icon: "terminal",
      title: { uk: "Розробка ПЗ", en: "Software Dev" },
      rounds: [
        { id: "q2",   code: "Q/2",   title: { uk: "Кваліфікаційний раунд", en: "Qualification Round" } },
        { id: "sec2", code: "sec-2", title: { uk: "Друга секція",          en: "Section Two" } }
      ]
    },
    {
      id: "modeling", icon: "deployed_code",
      title: { uk: "3D-моделювання", en: "3D Modeling" },
      rounds: [
        { id: "q3",   code: "Q/3",   title: { uk: "Кваліфікаційний раунд", en: "Qualification Round" } },
        { id: "sec3", code: "sec-3", title: { uk: "Третя секція",          en: "Section Three" } }
      ]
    },
    {
      id: "analysis", icon: "query_stats",
      title: { uk: "Аналітика", en: "Analysis" },
      rounds: [
        { id: "sec4", code: "sec-4", title: { uk: "Четверта секція", en: "Section Four" } }
      ]
    },
    {
      id: "writing", icon: "edit_note",
      title: { uk: "Тексти", en: "Writing" },
      rounds: [
        { id: "sec5", code: "sec-5", title: { uk: "П'ята секція", en: "Section Five" } }
      ]
    },
    {
      id: "imagegen", icon: "palette",
      title: { uk: "Генерація зображень", en: "Image Gen" },
      rounds: [
        { id: "sec6", code: "sec-6", title: { uk: "Шоста секція", en: "Section Six" } }
      ]
    }
  ],

  // Назви трьох груп таблеток (етапи всередині раунду). Можна перевизначити в results[...].groups;
  // там же поле match (regex) прив'язує проєкти до етапу — вони йдуть у порядку етапів.
  groups: [
    { uk: "Етап I",   en: "Stage I" },
    { uk: "Етап II",  en: "Stage II" },
    { uk: "Етап III", en: "Stage III" }
  ],

  results: {
    "gamedev/q1": {
      order: ["claude", "chatgpt", "gemini", "grok", "glm", "qwen"],
      // Завдання раунду: match (regex по імені файлу / назві) розкладає проєкти по етапах
      groups: [
        { uk: "Етап I · Snake 3D",    en: "Stage I · Snake 3D",    match: "snake" },
        { uk: "Етап II · Тетріс",     en: "Stage II · Tetris",     match: "tetris" },
        { uk: "Етап III · Платформер", en: "Stage III · Platformer" }
      ],
      entries: {
        claude:  { pills: [[true, true, null], [true, true, true], [true, true, true]] },
        chatgpt: { pills: [[true, true, true], [true, true, true], [true, true, true]] },
        gemini:  { pills: [[true, true, null], [true, true, true], [true, false, false]] },
        grok:    { status: "out" },
        glm:     { pills: [[null, null, null], [true, true, true], [false, false, false]],
                   note: { uk: "Етап III: проєкт не запускається — 0 балів.", en: "Stage III: the project is not playable — 0 points." } },
        qwen:    { pills: [[true, true, true], [true, true, true], [false, false, false]],
                   note: { uk: "Етап III: проєкт не запускається — 0 балів.", en: "Stage III: the project is not playable — 0 points." } }
      }
    },
    "gamedev/sec1": {
      order: ["claude", "chatgpt", "gemini", "qwen", "grok", "glm"],
      groups: [
        { uk: "Етап I · Кейс-симулятор", en: "Stage I · Case Simulator", match: "case|vault" },
        { uk: "Етап II · Танки",          en: "Stage II · Tanks",         match: "tank|hound|iron|armor" },
        { uk: "Етап III",                 en: "Stage III" }
      ],
      entries: {
        claude:  { pills: [[true, true, true], [true, true, true], [null, null, null]] },
        chatgpt: { pills: [[true, true, false], [true, true, true], [null, null, null]] },
        gemini:  { pills: [[true, false, false], [true, true, false], [null, null, null]] },
        qwen:    { pills: [[false, false, false], [null, null, null], [null, null, null]] },
        grok:    { status: "out" },
        glm:     { status: "out" }
      }
    }
  }
};
