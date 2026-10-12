/*
 * OXAIT — дані турніру. Єдиний файл, який треба редагувати, щоб оновити сайт.
 *
 * participants  — шість учасників (порядок тут не важливий).
 * stages        — етапи; у кожного свої раунди (Q/N — кваліфікація, sec-N — секція).
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
  updated: "2026-10-12",

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
        { id: "sec2", code: "sec-2", title: { uk: "Друга секція", en: "Section Two" }, stages: 2, cover: "assets/img/poster-q2.webp" }
      ]
    },
    {
      id: "modeling", icon: "deployed_code",
      title: { uk: "3D-моделювання", en: "3D Modeling" },
      rounds: [
        { id: "q3",   code: "Q/3",   title: { uk: "Кваліфікаційний раунд", en: "Qualification Round" }, cover: "assets/img/poster-q3.webp" },
        { id: "sec3", code: "sec-3", title: { uk: "Третя секція",          en: "Section Three" }, cover: "assets/img/poster-sec3.webp" }
      ]
    },
    {
      // Висновки — окрема вкладка; about — етап, з якого беруться підсумки для карток учасників
      id: "conclusions", icon: "emoji_events",
      title: { uk: "Висновки", en: "Conclusions" },
      rounds: [
        { id: "stage1", code: "★", title: { uk: "Перший етап — Висновки", en: "Stage One — Conclusions" }, type: "article", about: "gamedev",
          image: "assets/img/results-gamedev.webp",
          // Стаття: блоки тексту; who — учасники, про яких блок (аватар і колір беруться з participants)
          article: [
            { text: {
              uk: ["Ці змагання не ставлять на меті поставити чітке позначення «Найкращий» чи «Найгірший», а скоріше зрозуміти сильні та слабкі сторони кожного з представників. Результати цієї секції підтверджують мої особисті старі висновки."],
              en: ["These competitions are not meant to label anyone “the best” or “the worst”, but rather to understand the strengths and weaknesses of each contender. The results of this section confirm my own long-held conclusions."] } },
            { who: ["claude"], text: {
              uk: ["Claude все ж утримав лідерство, і здавалось найслабший результат в першому тесті кваліфікації, скоріше відображає підхід взаємодії з ним. А саме слідувати зазначеному завданню. Чим менший опис, тим менше буде зроблено. Змійка це чудово відобразила, інші учасники більше пророблювали аспекти, хоча про них в ТЗ не йшлось. Це не обов'язково, перевага чи недолік, це особливість яку варто розуміти."],
              en: ["Claude kept the lead after all, and what looked like its weakest result, in the first qualification test, rather reflects how you need to work with it: it follows the given task. The shorter the brief, the less gets done. The Snake showed this perfectly: the other participants worked out more aspects, even though the spec never asked for them. That isn't necessarily an advantage or a drawback; it's a trait worth understanding."] } },
            { who: ["chatgpt"], text: {
              uk: ["ChatGPT як раз приклад іншого підходу. Він може піти за межі описаного, та доробити, додати того що не було описано. Свої результати він також робить достойно, але не на рівні Claude. З іншого боку, це і не є його головний фокус. Якщо один розрахований на роботу з кодом та іншими професійними речами, chatGPT все ж більше особистий, і він більше підходить для приватного використання, він більш лояльний, більш охоче погодиться, та має кращу варіативність для повсякденних потреб."],
              en: ["ChatGPT is an example of the opposite approach. It can go beyond what's described and finish things off, adding what was never specified. It also delivers decent results, though not at Claude's level. Then again, that isn't its main focus. Where one is built for code and other professional work, ChatGPT is more personal: it suits private use better, it's more accommodating, more willing to agree, and offers better variety for everyday needs."] } },
            { who: ["gemini"], text: {
              uk: ["Gemini. Jack of All Trades. Він справді може робити майже будь яку вашу задачу, як бачите навіть розробку. І він показує середній, не посередній, а саме середній результат. Часто присутні жорсткі кути там і тут. Але враховуйте що він тут приймав участь як безкоштовна модель, не флагман. З ним, якщо прийняти що треба буде робити більше роботи, більше пояснень, і якщо ви не можете собі дозволити іншого провайдера, це чудовий варіант, я особисто його раджу друзям та сім'ї, бо він справді закриває більшість їх запитів. Та й моїх свого часу."],
              en: ["Gemini. Jack of all trades. It really can handle almost any task you give it, even development, as you can see. And it delivers an average result: not mediocre, but genuinely average. Rough edges show up here and there. But keep in mind it took part as a free model, not a flagship. If you accept that it will take more work and more explanation, and you can't afford another provider, it's a great option. I personally recommend it to friends and family, because it really covers most of their needs. And it covered mine, back in the day."] } },
            { who: ["qwen", "glm"], text: {
              uk: ["Qwen та GLM, я їх об'єднаю в одну секцію, оскільки висновки однакові. Ці моделі на ваше судження. Часті проблеми щоб доставити робочий білд, так безкоштовні, але проти того самого Gemini вони не виграють. Можуть показати достойні результати, але якщо вийде, частіше доведеться більше кропіткої праці щоб довести до ладу."],
              en: ["Qwen and GLM: I'll combine them into one section, since the conclusions are the same. These models are for you to judge. They often struggle to deliver a working build. Yes, they're free, but against that same Gemini they don't win. They can show decent results, but if they do, more often than not it takes more painstaking work to get things into shape."] } },
            { who: ["grok"], text: {
              uk: ["Grok, вибув ще при відборі, коли витратив майже півгодини на змійку, і вперся в ліміт, на безкоштовній основі його немає для чого використовувати в плані роботи."],
              en: ["Grok dropped out back in qualification, after spending almost half an hour on the Snake and hitting its limit. On the free tier there's no point using it for work."] } }
          ] }
      ]
    }
  ],

  // Скільки груп по 3 таблетки в раунді — поле stages у раунді (за замовчуванням 3; 0 — без балів, лише перегляд).
  // Назви груп таблеток (етапи всередині раунду). Можна перевизначити в results[...].groups;
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
        { uk: "Етап III · Літаки",        en: "Stage III · Planes" }
      ],
      entries: {
        claude:  { pills: [[true, true, true], [true, true, true], [true, true, true]] },
        chatgpt: { pills: [[true, true, false], [true, true, true], [true, true, false]] },
        gemini:  { pills: [[true, false, false], [true, true, false], [true, true, false]] },
        qwen:    { pills: [[false, false, false], [false, false, false], [true, false, false]] },
        grok:    { status: "out" },
        glm:     { status: "out" }
      }
    },
    "software/sec2": {
      order: ["claude", "chatgpt", "gemini", "glm", "qwen", "grok"],
      groups: [
        { uk: "Етап I · Фінансовий менеджер", en: "Stage I · Finance Manager", match: "financ" },
        { uk: "Етап II · Сайт Elatra",        en: "Stage II · Elatra Website" }
      ],
      entries: {
        claude:  { pills: [[true, true, true], [true, true, true]] },
        chatgpt: { pills: [[true, true, true], [true, true, false]] },
        gemini:  { pills: [[true, true, true], [true, false, false]] },
        glm:     { pills: [[true, true, true], [true, true, false]] },
        qwen:    { pills: [[true, true, false], [false, false, false]] },
        grok:    { status: "out" }
      }
    },
    // Grok вибув з усіх наступних етапів
    "modeling/q3": {
      order: ["claude", "glm", "chatgpt", "gemini", "qwen", "grok"],
      groups: [
        { uk: "Етап I · Солдат", en: "Stage I · Soldier", match: "soldier" },
        { uk: "Етап II · Авто",  en: "Stage II · Car",    match: "car|vehicle" },
        { uk: "Етап III · Танк", en: "Stage III · Tank" }
      ],
      entries: {
        claude:  { pills: [[true, true, true], [true, true, true], [true, true, true]] },
        glm:     { pills: [[true, true, true], [true, true, true], [true, true, false]] },
        chatgpt: { pills: [[true, true, false], [true, true, true], [true, true, true]] },
        gemini:  { pills: [[true, false, false], [true, false, false], [true, false, false]] },
        qwen:    { pills: [[true, false, false], [true, false, false], [true, false, false]] },
        grok:    { status: "out" }
      }
    },
    "modeling/sec3": {
      order: ["claude", "chatgpt", "glm", "gemini", "qwen", "grok"],
      groups: [
        { uk: "Етап I · Літак",                 en: "Stage I · Fighter Jet",       match: "fighter|strix|kestrel" },
        { uk: "Етап II · Деталізований солдат", en: "Stage II · Detailed Soldier", match: "soldier|pmc|operator" },
        { uk: "Етап III · Гвинтівка",           en: "Stage III · Rifle" }
      ],
      entries: {
        claude:  { pills: [[true, true, true], [true, true, true], [true, true, true]] },
        chatgpt: { pills: [[true, true, false], [true, true, false], [true, true, false]] },
        // M4.html — версія, виправлена з Claude поза турніром; у заліку — власна M4-GLM
        glm:     { pills: [[true, false, false], [true, false, false], [false, false, false]], hide: ["m4"] },
        gemini:  { status: "out" },
        qwen:    { status: "out" },
        grok:    { status: "out" }
      }
    }
  }
};
