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
      // Загальні висновки — окрема вкладка; на картках учасників — місця в усіх раундах
      id: "conclusions", icon: "emoji_events",
      title: { uk: "Висновки", en: "Conclusions" },
      rounds: [
        { id: "summary", code: "★", title: { uk: "Висновки", en: "Conclusions" }, type: "article",
          image: "assets/img/results-gamedev.webp",
          // Стаття: блоки тексту; who — учасники, про яких блок (аватар і колір беруться з participants)
          article: [
            { text: {
              uk: ["Ці змагання не ставлять на меті поставити позначення «Найкращий» чи «Найгірший», я особисто намагаюсь уникати таких прямих тверджень, оскільки певен що у всіх є свої сильні та слабкі сторони, і кожен може бути потрібен. Цей тест на правду підтвердив старі висновки, оновивши здебільшого результати ChatGPT."],
              en: ["These competitions are not meant to label anyone “the best” or “the worst”. I personally try to avoid such blunt statements, because I'm sure everyone has their strengths and weaknesses, and each one can be needed. This reality check confirmed my old conclusions, mostly updating ChatGPT's results."] } },
            { who: ["claude"], text: {
              uk: ["Claude утримав лідерство, хоча й тести були більше направлені на площину розробки, і це саме його територія. І здавалось найслабший результат в першому завданні першої кваліфікації, скоріше відображає підхід взаємодії з ним. А саме слідувати зазначеному завданню. Чим менший опис, тим менше буде зроблено. Змійка це чудово відобразила, інші учасники більше пророблювали аспекти, хоча про них в ТЗ не йшлось. Це не обов'язково, перевага чи недолік, це особливість яку варто розуміти. Він не підходить вам якщо ви: А - не готові платити мінімальну підписку та Б - Не маєте серйозної роботи з розробкою, чи хоча б аналізом. Він найкращий якщо вам треба спеціаліст, але він надлишковий для повсякденного користувача."],
              en: ["Claude kept the lead, although the tests leaned towards development, and that's exactly its territory. What looked like its weakest result, in the first task of the first qualification, rather reflects how you need to work with it: it follows the given task. The shorter the brief, the less gets done. The Snake showed this perfectly: the other participants worked out more aspects, even though the spec never asked for them. That isn't necessarily an advantage or a drawback; it's a trait worth understanding. It's not for you if you: A) aren't ready to pay for the minimum subscription, and B) don't do serious development work, or at least analysis. It's the best when you need a specialist, but it's overkill for the everyday user."] } },
            { who: ["chatgpt"], text: {
              uk: ["ChatGPT як раз приклад іншого підходу. Він може піти за межі описаного, та доробити, додати того що не було описано. Свої результати він також робить достойно, але не на рівні Claude. З іншого боку, це і не є його головний фокус. Якщо один це все ж спеціаліст в дорогому костюмі, то chatGPT все ж більше особистий, і він більше підходить для приватного використання, він більш лояльний, більш охоче погодиться, та має кращу варіативність для повсякденних потреб. Ваші повсякденні задачі, нагадування, і так розробка, але більш для себе як хобі. Це не погано і не добре, це факт. На безкоштовному плані ви цього не отримаєте."],
              en: ["ChatGPT is an example of the opposite approach. It can go beyond what's described and finish things off, adding what was never specified. It also delivers decent results, though not at Claude's level. Then again, that isn't its main focus. If the first one is a specialist in an expensive suit, ChatGPT is more personal: it suits private use better, it's more accommodating, more willing to agree, and offers better variety for everyday needs. Your daily tasks, reminders, and yes, development too, but more for yourself, as a hobby. That's neither good nor bad, it's a fact. You won't get this on the free plan."] } },
            { who: ["gemini"], text: {
              uk: ["Gemini. Доступний майстер на всі руки. Він може витягнути та виконати майже будь яку задачу. АЛЕ. Він показує середній, не посередній, а просто середній результат. Часто присутні жорсткі кути там і тут. Але враховуйте що він тут приймав участь як безкоштовна модель, не флагман. За ці гроші, флеш модель трималась дуже добре. Якщо ви не можете собі дозволити іншого провайдера, це чудовий варіант, але прийміть що вам треба буде витратити більше часу на роботу щоб довести результат до чогось пристойного, якщо візьметесь за нього як за робочу конячку. Я особисто його раджу друзям та сім'ї, бо він справді закриває більшість їх регулярних повсякденних запитів. Та й моїх свого часу."],
              en: ["Gemini. An affordable jack of all trades. It can pull off and complete almost any task. BUT. It delivers an average result: not mediocre, just average. Rough edges show up here and there. But keep in mind it took part as a free model, not a flagship. For the money, the Flash model held up very well. If you can't afford another provider, it's a great option, but accept that you'll have to spend more time to bring the result to something decent if you use it as a workhorse. I personally recommend it to friends and family, because it really covers most of their regular everyday requests. And it covered mine, back in the day."] } },
            { who: ["qwen", "glm"], text: {
              uk: ["Qwen та GLM, я їх об'єднаю в одну секцію, оскільки висновки однакові. Ці моделі на ваше судження, зважаючи на ваші погляди. Але давайте чесно. Проблеми через раз щоб доставити робочий білд, як невеличка лотерея, частину 3D секції точніше 2/3 sec-3 ремонтував Claude щоб воно працювало. Можуть видати хороші результати на більш простих завданнях, але при рості складності видихаються. Той же Gemini справляється краще. Не найгірші, я все ще не ставлю цей ярлик, але вони не ті на кого варто покладатися."],
              en: ["Qwen and GLM: I'll combine them into one section, since the conclusions are the same. These models are for you to judge, depending on your views. But let's be honest. Delivering a working build is hit or miss, a small lottery: Claude had to repair part of the 3D section, 2/3 of sec-3 to be precise, just to make it work. They can produce good results on simpler tasks, but run out of breath as complexity grows. That same Gemini copes better. Not the worst, I still don't hand out that label, but they're not the ones to rely on."] } },
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
