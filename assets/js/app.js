/* OXAIT — арена. Маршрут: #/<lang>/<stage>/<round>/<participant?> */
(() => {
  const D = window.OXAIT;
  const $ = (s, el = document) => el.querySelector(s);
  const byId = Object.fromEntries(D.participants.map(p => [p.id, p]));

  const I18N = {
    uk: {
      tagline: "Народний бенчмарк",
      leaderboard: "Таблиця лідерів",
      colRank: "#", colModel: "Учасник", colScore: "Бали",
      participants: n => `${n} учасників`,
      updated: d => `Оновлено ${d}`,
      stagesShort: n => n === 1 ? "1 раунд" : `${n} раунди`,
      pickHint: "Оберіть учасника в таблиці, щоб побачити його роботу.",
      roundLead: "Шість моделей отримують однакове завдання. Результати з'являться тут, щойно журі їх оцінить.",
      awaiting: "Результат ще не подано",
      outputWill: {
        gamedev: n => `Тут з'явиться гра від ${n} — її можна буде запустити просто в браузері.`,
        software: n => `Тут з'явиться застосунок від ${n} — з живим демо.`,
        modeling: n => `Тут з'явиться 3D-модель від ${n}, яку можна крутити.`,
        analysis: n => `Тут з'явиться аналітичний звіт від ${n}.`,
        writing: n => `Тут з'явиться текст від ${n}.`,
        imagegen: n => `Тут з'являться зображення від ${n}.`
      },
      play: { gamedev: "Грати", software: "Запустити", other: "Відкрити" },
      playHint: "Запуститься прямо тут. Повноекранний режим — кнопка вгорі.",
      rank: n => `Місце ${n}`,
      out: "Вибув",
      outText: n => `${n} вибуває з цього раунду.`,
      live: "Наживо",
      choose: "Оберіть проєкт",
      variant: "Варіант",
      back: "До вибору проєктів",
      projects: n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "проєкт" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "проєкти" : "проєктів"}`,
      kb: "КБ",
      pyHint: "Сервер на Python запускається прямо в браузері (Pyodide) — перший запуск триває кілька секунд.",
      total: "Разом",
      fullscreen: "На весь екран", newTab: "Відкрити в новій вкладці", reload: "Перезапустити", close: "Закрити",
      stage: "Етап"
    },
    en: {
      tagline: "The people's benchmark",
      leaderboard: "Leaderboard",
      colRank: "#", colModel: "Participant", colScore: "Score",
      participants: n => `${n} participants`,
      updated: d => `Updated ${d}`,
      stagesShort: n => n === 1 ? "1 round" : `${n} rounds`,
      pickHint: "Pick a participant in the table to see their work.",
      roundLead: "Six models get the same task. Results appear here as soon as the jury scores them.",
      awaiting: "No submission yet",
      outputWill: {
        gamedev: n => `The game built by ${n} will appear here — playable right in your browser.`,
        software: n => `The app built by ${n} will appear here, with a live demo.`,
        modeling: n => `The 3D model by ${n} will appear here, ready to orbit.`,
        analysis: n => `The analysis report by ${n} will appear here.`,
        writing: n => `The text by ${n} will appear here.`,
        imagegen: n => `The images by ${n} will appear here.`
      },
      play: { gamedev: "Play", software: "Launch", other: "Open" },
      playHint: "Runs right here. Use the button above for full screen.",
      rank: n => `Rank ${n}`,
      out: "Eliminated",
      outText: n => `${n} is out of this round.`,
      live: "Live",
      choose: "Choose a project",
      variant: "Variant",
      back: "Back to Projects",
      projects: n => `${n} project${n === 1 ? "" : "s"}`,
      kb: "KB",
      pyHint: "The Python server runs right in your browser (Pyodide) — the first start takes a few seconds.",
      total: "Total",
      fullscreen: "Full Screen", newTab: "Open in New Tab", reload: "Restart", close: "Close",
      stage: "Stage"
    }
  };

  const state = { lang: null, stage: D.stages[0].id, round: D.stages[0].rounds[0].id, pick: null, variant: null };
  const M = window.OXAIT_ENTRIES || {};
  let t = I18N.uk;
  const L = v => (v && typeof v === "object") ? (v[state.lang] ?? v.uk ?? v.en) : v;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = iso => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };

  const avatar = p => `<span class="avatar" style="--c:${p.color}" aria-hidden="true">${esc(p.mono)}</span>`;
  const stageOf = id => D.stages.find(s => s.id === id);
  const roundOf = () => stageOf(state.stage).rounds.find(r => r.id === state.round);

  // Дані раунду з усіма значеннями за замовчуванням
  function roundData(key = `${state.stage}/${state.round}`) {
    const r = D.results[key] || {};
    const order = (r.order || []).filter(id => byId[id]);
    D.participants.forEach(p => order.includes(p.id) || order.push(p.id));
    const groups = r.groups || D.groups;
    // Етап проєкту: перша група, чий match підходить до файлу чи назви; інакше — група без match
    const byStage = groups.some(g => g.match);
    const stageOfProject = o => {
      const hay = `${o.src} ${o.title}`, i = groups.findIndex(g => g.match && new RegExp(g.match, "i").test(hay));
      return i >= 0 ? i : groups.findIndex(g => !g.match);
    };
    const entries = order.map(id => {
      const e = (r.entries || {})[id] || {};
      const pills = [0, 1, 2].map(g => [0, 1, 2].map(i => e.pills?.[g]?.[i] ?? null));
      const nums = pills.flat().map(v => v === true ? 1 : v).filter(v => typeof v === "number");
      // Проєкти: з entries/manifest.js (tools/sync_entries.py) + вручну з data.js
      const projects = [...(M[key]?.[id] || []), ...(e.outputs || []), ...(e.output ? [e.output] : [])]
        .map((o, i) => ({ ...o, id: o.id || String(i + 1), title: o.title || `${i + 1}` }))
        .map(o => ({ ...o, group: byStage ? stageOfProject(o) : null }))
        .sort((a, b) => (a.group ?? 0) - (b.group ?? 0));
      return { p: byId[id], pills, total: pills.flat().some(v => v !== null && v !== "") ? nums.reduce((a, b) => a + b, 0) : null, out: e.status === "out", projects, note: e.note || null };
    });
    // Більше балів — вище, вибулі — внизу; при рівності лишається порядок з order
    entries.sort((a, b) => (a.out - b.out) || ((b.total ?? -1) - (a.total ?? -1)));
    entries.forEach((e, i) => {
      const prev = entries[i - 1];
      e.rank = e.out ? null : (prev && !prev.out && e.total !== null && prev.total === e.total ? prev.rank : i + 1);
    });
    return { entries, groups, live: entries.some(e => e.total !== null || e.out) };
  }

  /* ───── Маршрут ───── */

  function readHash() {
    const [lang, stage, round, pick, variant] = location.hash.replace(/^#\/?/, "").split("/");
    if (!I18N[lang]) return false;
    state.lang = lang;
    const s = stageOf(stage) || D.stages[0];
    state.stage = s.id;
    state.round = (s.rounds.find(r => r.id === round) || s.rounds[0]).id;
    state.pick = byId[pick] ? pick : null;
    state.variant = state.pick && variant ? decodeURIComponent(variant) : null;
    return true;
  }
  const writeHash = () => {
    const h = `#/${[state.lang, state.stage, state.round, state.pick, state.pick && state.variant && encodeURIComponent(state.variant)].filter(Boolean).join("/")}`;
    if (location.hash !== h) history.replaceState(null, "", h);
  };

  /* ───── Вхід ───── */

  const gate = $("#gate"), app = $("#app");
  try { const last = localStorage.getItem("oxait.lang"); if (last) $(`.lang-card[data-lang="${last}"]`)?.classList.add("is-last"); } catch {}

  $("#gate-roster").innerHTML = D.participants.map((p, i) =>
    `<li style="animation-delay:${860 + i * 60}ms">${avatar(p)}${esc(p.name)}</li>`).join("");

  function enter(lang) {
    try { localStorage.setItem("oxait.lang", lang); } catch {}
    state.lang = lang;
    gate.classList.add("is-leaving");
    setTimeout(() => { gate.hidden = true; showApp(); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380);
  }
  gate.addEventListener("click", e => { const b = e.target.closest("[data-lang]"); if (b) enter(b.dataset.lang); });

  // Підсвітка під курсором
  document.addEventListener("pointermove", e => {
    const el = e.target.closest?.(".lang-card, .stage");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  /* ───── Арена ───── */

  function showApp() {
    app.hidden = false;
    renderAll();
  }

  function applyLang() {
    t = I18N[state.lang];
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t[el.dataset.i18n]);
    document.querySelectorAll("[data-set-lang]").forEach(b => {
      b.classList.toggle("is-on", b.dataset.setLang === state.lang);
      b.setAttribute("aria-pressed", b.dataset.setLang === state.lang);
    });
    $("#updated").textContent = t.updated(fmtDate(D.updated));
  }

  function renderAll() {
    applyLang();
    renderStages();
    renderRound();
  }

  function renderStages() {
    const nav = $("#stages");
    nav.innerHTML = `<span class="stage-ind" aria-hidden="true"></span>` + D.stages.map((s, i) => `
      <button class="stage ox-focus" role="tab" data-stage="${s.id}" aria-selected="${s.id === state.stage}" style="animation-delay:${i * 40}ms">
        <span class="ox-icon">${s.icon}</span>
        <span class="stage-title"><span class="stage-num">${String(i + 1).padStart(2, "0")}</span>${esc(L(s.title))}</span>
        <span class="stage-sub">${s.rounds.map(r => esc(r.code)).join(" · ")}</span>
      </button>`).join("");
    requestAnimationFrame(() => moveIndicator(false));
  }

  function moveIndicator(animate = true) {
    const nav = $("#stages"), ind = $(".stage-ind", nav), cur = $(`.stage[aria-selected="true"]`, nav);
    if (!ind || !cur) return;
    if (!animate) ind.style.transition = "none";
    ind.style.width = `${cur.offsetWidth}px`;
    ind.style.transform = `translateX(${cur.offsetLeft}px)`;
    if (!animate) { ind.offsetWidth; ind.style.transition = ""; }
    if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2, behavior: animate ? "smooth" : "auto" });
  }

  function renderRound() {
    const s = stageOf(state.stage), r = roundOf();
    $("#rounds").innerHTML = s.rounds.map((x, i) => `
      <button class="chip ox-focus" role="tab" data-round="${x.id}" aria-selected="${x.id === state.round}" style="animation-delay:${i * 50}ms">
        <span class="chip-code">${esc(x.code)}</span>${esc(L(x.title))}
      </button>`).join("");
    $("#round-meta").innerHTML = `<span>${esc(L(s.title))} · ${esc(r.code)}</span><span class="sep"></span><span>${t.participants(D.participants.length)}</span>${roundData().live ? `<span class="sep"></span><span class="live">${t.live}</span>` : ""}`;
    const isArticle = r.type === "article";
    $(".arena").hidden = isArticle;
    $("#report").hidden = !isArticle;
    if (isArticle) { state.pick = null; state.variant = null; renderReport(s, r); }
    else { renderBoard(); renderPreview(); }
    writeHash();
  }

  /* ───── Висновки (стаття) ───── */

  let revealer;
  function renderReport(s, r) {
    // Підсумки учасника в інших раундах цього етапу
    const rounds = s.rounds.filter(x => x.type !== "article");
    const standings = rounds.map(x => ({ x, entries: roundData(`${s.id}/${x.id}`).entries }));
    const chips = id => standings.map(({ x, entries }) => {
      const e = entries.find(y => y.p.id === id);
      if (!e) return "";
      const val = e.out ? t.out : e.total ?? "—";
      return `<span class="rchip${e.out ? " is-out" : ""}"><b>${esc(x.code)}</b>${esc(val)}</span>`;
    }).join("");

    const blocks = r.article.map((b, i) => {
      const paras = [].concat(L(b.text) || []).map(p => `<p>${esc(p)}</p>`).join("");
      if (!b.who) return `<div class="rblock rblock-intro" style="--i:${i}">${paras}</div>`;
      const ps = b.who.map(id => byId[id]).filter(Boolean);
      return `
        <section class="rblock rcard" style="--c:${ps[0].color};--c2:${(ps[1] || ps[0]).color};--i:${i}">
          <header class="rcard-head">
            <span class="rcard-avatars">${ps.map(avatar).join("")}</span>
            <div class="rcard-who">
              <h3>${ps.map(p => esc(p.name)).join(" · ")}</h3>
              <div class="rcard-chips">${ps.map(p => `<span class="rcard-line">${ps.length > 1 ? `<i>${esc(p.mono)}</i>` : ""}${chips(p.id)}</span>`).join("")}</div>
            </div>
          </header>
          ${paras}
        </section>`;
    }).join("");

    $("#report").innerHTML = `
      <div class="report-grid">
        <figure class="report-figure hud">
          <img src="${esc(r.image)}" alt="${esc(L(r.title))}">
          <figcaption><span class="overline">OXAIT · ${esc(L(s.title))}</span><h2>${esc(L(r.title))}</h2></figcaption>
        </figure>
        <div class="report-body">${blocks}</div>
      </div>`;

    // Блоки проявляються, коли доходять до екрана
    revealer?.disconnect();
    const items = document.querySelectorAll("#report .rblock");
    if (!("IntersectionObserver" in window)) return items.forEach(el => el.classList.add("is-in"));
    revealer = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); revealer.unobserve(en.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    items.forEach(el => revealer.observe(el));
  }

  function pillsHTML(pills, delayIndex) {
    let p = 0;
    return `<div class="pills">${pills.map(g => `<span class="pill-group">${g.map(v => {
      const filled = v !== null && v !== "" && v !== false;
      return `<span class="pill${filled ? " is-filled" : v === false ? " is-miss" : ""}" style="--p:${p++};--i:${delayIndex}">${filled && v !== true ? `<i>${esc(v)}</i>` : ""}</span>`;
    }).join("")}</span>`).join("")}</div>`;
  }

  function renderBoard() {
    const { entries, groups } = roundData();
    $("#board-cols").innerHTML = `<span>${t.colRank}</span><span>${t.colModel}</span><span>${t.colScore}</span>`;
    $("#board").innerHTML = entries.map((e, i) => `
      <li>
        <button class="row ox-focus${e.rank === 1 ? " top-1" : ""}${e.out ? " is-out" : ""}" data-pick="${e.p.id}" aria-selected="${e.p.id === state.pick}" style="--c:${tint(e)};--i:${i}"
          title="${esc(groups.map(L).join(" · "))}">
          <span class="row-rank">${e.out ? "✕" : String(e.rank).padStart(2, "0")}</span>
          ${avatar(e.p)}
          <span class="row-name"><b>${esc(e.p.name)}</b><small>${esc(e.p.vendor)}${e.projects.length ? ` · <span class="proj-count">${t.projects(e.projects.length)}</span>` : ""}</small></span>
          ${e.out ? `<span class="row-score"><span class="badge-out">${t.out}</span></span>`
            : `<span class="row-score${e.total === null ? " is-empty" : ""}"${e.total !== null ? ` data-v="${e.total}"` : ""}>${e.total ?? "—"}</span>`}
          ${pillsHTML(e.pills, i)}
        </button>
      </li>`).join("");
    countUp(document.querySelectorAll("#board [data-v]"));
  }

  const tint = e => e.out ? "var(--danger)" : e.p.color;

  // Бали «набігають» від нуля
  function countUp(els) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    els.forEach((el, i) => {
      const to = +el.dataset.v, start = performance.now() + 300 + i * 60, dur = 700;
      if (!Number.isInteger(to)) return;
      el.textContent = "0";
      const tick = now => {
        const k = Math.min(1, Math.max(0, (now - start) / dur));
        el.textContent = Math.round(to * (1 - (1 - k) ** 3));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function markSelection() {
    document.querySelectorAll(".row").forEach(b => b.setAttribute("aria-selected", b.dataset.pick === state.pick));
  }

  /* ───── Прев'ю ───── */

  const TYPE_ICON = { image: "image", video: "movie", model: "view_in_ar", text: "description" };
  const projIcon = (o, s) => TYPE_ICON[o.type] || (s.id === "software" ? "terminal" : "sports_esports");
  const letter = i => String.fromCharCode(65 + i);
  const fmtSize = b => b ? `${Math.max(1, Math.round(b / 1024))} ${t.kb}` : "";
  const extOf = o => (String(o.src || "").split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1] || o.type).toUpperCase();

  const current = () => roundData().entries.find(e => e.p.id === state.pick);
  function currentProject(e) {
    if (e.projects.length === 1) return e.projects[0];
    return e.projects.find(o => o.id === state.variant) || null;
  }

  function renderPreview() {
    const pv = $("#preview"), s = stageOf(state.stage), r = roundOf();
    const { entries, groups } = roundData();
    const e = entries.find(x => x.p.id === state.pick);

    pv.style.setProperty("--hud", e ? tint(e) : "var(--cyan)");
    if (!e) {
      const cover = r.cover
        ? `<div class="cover-img" style="background-image:url('${esc(r.cover)}')"></div>`
        : `<div class="cover-gen"></div><div class="cover-code" aria-hidden="true">${esc(r.code)}</div>`;
      pv.innerHTML = `
        <div class="pv">
          <div class="pv-head">
            <span class="avatar" style="--c:var(--accent)" aria-hidden="true"><span class="ox-icon">${s.icon}</span></span>
            <div class="pv-title"><h2>${esc(L(r.title))}</h2><p><span class="tag tag-accent">${esc(r.code)}</span>${esc(L(s.title))}</p></div>
          </div>
          <div class="pv-stage"><div class="cover">${cover}
            <div class="cover-body"><p class="overline">OXAIT · ${esc(r.code)}</p><h3>${esc(L(s.title))}</h3><p>${t.roundLead}</p></div>
          </div></div>
          <p class="pv-hint"><span class="ox-icon">touch_app</span>${t.pickHint}</p>
          <div class="pv-mini">${entries.map((x, i) => `<button class="ox-focus${x.out ? " is-out" : ""}" data-pick="${x.p.id}" style="--c:${tint(x)};--i:${i}">${avatar(x.p)}${esc(x.p.name)}</button>`).join("")}</div>
        </div>`;
      return;
    }

    pv.innerHTML = `
      <div class="pv" style="--c:${tint(e)}">
        <div class="pv-head">
          ${avatar(e.p)}
          <div class="pv-title"><h2>${esc(e.p.name)}</h2>
            <p>${e.out ? `<span class="tag tag-out">${t.out}</span>` : `<span class="tag">${t.rank(e.rank)}</span>`}<span class="tag tag-accent">${esc(r.code)}</span>${esc(e.p.vendor)}</p></div>
          <div class="pv-actions" id="pv-actions"></div>
          <button class="icon-btn ox-focus" data-act="close" title="${t.close}" aria-label="${t.close}"><span class="ox-icon">close</span></button>
        </div>
        <div class="variants" id="pv-variants"></div>
        <div class="pv-stage" id="pv-stage"></div>
        <div class="pv-score">
          ${e.pills.map((g, gi) => `<div class="score-group"><span class="micro">${esc(L(groups[gi]))}</span>${pillsHTML([g], 0)}</div>`).join("")}
          <div class="score-total"><span class="micro">${t.total}</span><b>${e.total ?? "—"}</b></div>
        </div>
        ${e.note ? `<p class="pv-note">${esc(L(e.note))}</p>` : ""}
      </div>`;
    renderStage();
  }

  // Сцена прев'ю: вибір варіанта або сам проєкт
  function renderStage() {
    const e = current(); if (!e) return;
    const s = stageOf(state.stage), o = currentProject(e), many = e.projects.length > 1;
    const stage = $("#pv-stage");

    $("#pv-actions").innerHTML = o ? `
      ${many ? `<button class="icon-btn ox-focus" data-act="back" title="${t.back}" aria-label="${t.back}"><span class="ox-icon">arrow_back</span></button>` : ""}
      <button class="icon-btn ox-focus" data-act="fs" title="${t.fullscreen}" aria-label="${t.fullscreen}"><span class="ox-icon">fullscreen</span></button>
      ${o.src && o.type !== "text" && o.type !== "image" ? `<a class="icon-btn ox-focus" href="${esc(o.src)}" target="_blank" rel="noopener" title="${t.newTab}" aria-label="${t.newTab}"><span class="ox-icon">open_in_new</span></a>` : ""}` : "";

    $("#pv-variants").innerHTML = many && o ? e.projects.map((x, i) => `
      <button class="variant ox-focus" data-variant="${esc(x.id)}" aria-pressed="${x === o}">
        <span class="variant-letter">${letter(i)}</span>${esc(x.title)}
      </button>`).join("") : "";

    if (!e.projects.length) { stage.innerHTML = emptyHTML(e, s); return; }
    if (!o) { stage.innerHTML = pickerHTML(e, s); return; }
    // Обраний з кількох варіантів — запускаємо одразу; єдиний проєкт — через кнопку
    stage.innerHTML = o.type === "iframe" && many ? frameHTML(o, e) : outputHTML(o, e, s);
    if (o.type === "image") wireGallery();
    if (o.type === "model") loadModelViewer();
  }

  function emptyHTML(e, s) {
    return `
      <div class="empty${e.out ? " is-out" : ""}" style="--c:${tint(e)}"><div class="empty-inner">
        ${avatar(e.p)}
        <h3><span class="ox-icon">${e.out ? "close" : "hourglass_empty"}</span>${e.out ? t.out : t.awaiting}</h3>
        <p>${e.out ? t.outText(esc(e.p.name)) : (t.outputWill[s.id] || t.outputWill.gamedev)(esc(e.p.name))}</p>
      </div></div>`;
  }

  function pickerHTML(e, s) {
    return `
      <div class="picker" style="--c:${tint(e)}">
        <p class="overline picker-ask">${t.choose}</p>
        <div class="picker-grid" style="--n:${Math.min(e.projects.length, 3)}">
          ${e.projects.map((o, i) => `
          <button class="pcard ox-focus" data-variant="${esc(o.id)}" style="--i:${i}">
            <span class="pcard-letter" aria-hidden="true">${letter(i)}</span>
            <span class="pcard-top"><span class="ox-icon">${projIcon(o, s)}</span>${o.group != null && o.group >= 0 ? esc(L(roundData().groups[o.group])) : `${t.variant} ${letter(i)}`}</span>
            <span class="pcard-title">${esc(o.title)}</span>
            <span class="pcard-meta">${[o.python ? "PYTHON" : extOf(o), fmtSize(o.size)].filter(Boolean).join(" · ")}</span>
            <span class="pcard-go">${o.type === "iframe" ? (t.play[s.id] || t.play.other) : t.play.other}<span class="ox-icon">play_arrow</span></span>
          </button>`).join("")}
        </div>
      </div>`;
  }

  const frameHTML = (o, e) => `<iframe src="${esc(o.src)}" title="${esc(o.title || e.p.name)}" allow="fullscreen; gamepad; autoplay; pointer-lock" allowfullscreen></iframe>`;

  function outputHTML(o, e, s) {
    switch (o.type) {
      case "iframe": return `
        <div class="launch" style="--c:${e.p.color}"><div>
          <span class="btn-wrap"><button class="btn btn-primary ox-focus" data-act="play"><span class="ox-icon">play_arrow</span>${t.play[s.id] || t.play.other}</button></span>
          <p>${o.title ? `<b class="launch-title">${esc(o.title)}</b>` : ""}${o.python ? `<span class="py-badge">Python</span> ${t.pyHint}` : t.playHint}</p>
        </div></div>`;
      case "video": return `<video src="${esc(o.src)}" ${o.poster ? `poster="${esc(o.poster)}"` : ""} controls playsinline preload="metadata"></video>`;
      case "model": return `<model-viewer src="${esc(o.src)}" ${o.poster ? `poster="${esc(o.poster)}"` : ""} camera-controls auto-rotate shadow-intensity="1" alt="${esc(o.title)}"></model-viewer>`;
      case "image": {
        const list = [].concat(o.src);
        return `<div class="gallery"><div class="gallery-main"><img src="${esc(list[0])}" alt="${esc(o.title)}"></div>${list.length > 1
          ? `<div class="gallery-thumbs">${list.map((src, i) => `<button class="ox-focus${i ? "" : " is-on"}" data-src="${esc(src)}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}</div>`;
      }
      case "text": return `<div class="reader"><article>${String(o.text ?? L(o) ?? "").split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join("")}</article></div>`;
      default: return "";
    }
  }

  function wireGallery() {
    const stage = $("#pv-stage");
    stage.onclick = ev => {
      const b = ev.target.closest("[data-src]"); if (!b) return;
      stage.querySelectorAll("[data-src]").forEach(x => x.classList.toggle("is-on", x === b));
      const img = $(".gallery-main img", stage);
      img.replaceWith(Object.assign(img.cloneNode(), { src: b.dataset.src }));
    };
  }

  let mvLoaded = false;
  function loadModelViewer() {
    if (mvLoaded) return; mvLoaded = true;
    const sc = document.createElement("script");
    sc.type = "module";
    sc.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4/dist/model-viewer.min.js";
    document.head.append(sc);
  }

  function play() {
    const e = current(), o = e && currentProject(e);
    if (!o) return;
    const stage = $("#pv-stage");
    stage.innerHTML = frameHTML(o, e);
    $("iframe", stage).focus();
  }

  /* ───── Події ───── */

  app.addEventListener("click", ev => {
    const st = ev.target.closest("[data-stage]");
    if (st && st.dataset.stage !== state.stage) {
      state.stage = st.dataset.stage; state.round = stageOf(state.stage).rounds[0].id; state.pick = null; state.variant = null;
      document.querySelectorAll(".stage").forEach(b => b.setAttribute("aria-selected", b === st));
      moveIndicator(); renderRound(); return;
    }
    const rd = ev.target.closest("[data-round]");
    if (rd && rd.dataset.round !== state.round) { state.round = rd.dataset.round; state.pick = null; state.variant = null; renderRound(); return; }

    const vr = ev.target.closest("[data-variant]");
    if (vr) { state.variant = vr.dataset.variant; renderStage(); writeHash(); $("#pv-stage iframe")?.focus(); return; }

    const pk = ev.target.closest("[data-pick]");
    if (pk) {
      state.pick = pk.dataset.pick === state.pick && pk.classList.contains("row") ? null : pk.dataset.pick;
      state.variant = null;
      markSelection(); renderPreview(); writeHash();
      if (state.pick && matchMedia("(max-width: 960px)").matches) $("#preview").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (act === "close") { state.pick = null; state.variant = null; markSelection(); renderPreview(); writeHash(); }
    if (act === "back") { state.variant = null; renderStage(); writeHash(); }
    if (act === "play") play();
    if (act === "fs") $("#pv-stage")?.requestFullscreen?.();

    const sl = ev.target.closest("[data-set-lang]");
    if (sl && sl.dataset.setLang !== state.lang) {
      state.lang = sl.dataset.setLang;
      try { localStorage.setItem("oxait.lang", state.lang); } catch {}
      renderAll();
    }
    if (ev.target.closest("#brand")) {
      ev.preventDefault();
      state.stage = D.stages[0].id; state.round = D.stages[0].rounds[0].id; state.pick = null; state.variant = null;
      renderStages(); renderRound();
    }
  });

  // Стрілки ↑/↓ по таблиці
  $("#board").addEventListener("keydown", ev => {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const rows = [...document.querySelectorAll(".row")], i = rows.indexOf(document.activeElement);
    if (i < 0) return;
    ev.preventDefault();
    rows[(i + (ev.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length].focus();
  });

  addEventListener("resize", () => moveIndicator(false));
  addEventListener("hashchange", () => { if (readHash() && !app.hidden) { applyLang(); renderStages(); renderRound(); } });

  // Старт: якщо мова вже в посиланні — одразу на арену
  if (readHash()) { gate.hidden = true; showApp(); }
})();
