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
      total: "Total",
      fullscreen: "Full Screen", newTab: "Open in New Tab", reload: "Restart", close: "Close",
      stage: "Stage"
    }
  };

  const state = { lang: null, stage: D.stages[0].id, round: D.stages[0].rounds[0].id, pick: null };
  let t = I18N.uk;
  const L = v => (v && typeof v === "object") ? (v[state.lang] ?? v.uk ?? v.en) : v;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = iso => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };

  const avatar = p => `<span class="avatar" style="--c:${p.color}" aria-hidden="true">${esc(p.mono)}</span>`;
  const stageOf = id => D.stages.find(s => s.id === id);
  const roundOf = () => stageOf(state.stage).rounds.find(r => r.id === state.round);

  // Дані раунду з усіма значеннями за замовчуванням
  function roundData() {
    const r = D.results[`${state.stage}/${state.round}`] || {};
    const order = (r.order || []).filter(id => byId[id]);
    D.participants.forEach(p => order.includes(p.id) || order.push(p.id));
    const entries = order.map(id => {
      const e = (r.entries || {})[id] || {};
      const pills = [0, 1, 2].map(g => [0, 1, 2].map(i => e.pills?.[g]?.[i] ?? null));
      const nums = pills.flat().filter(v => typeof v === "number");
      return { p: byId[id], pills, total: nums.length ? nums.reduce((a, b) => a + b, 0) : null, output: e.output || null, note: e.note || null };
    });
    return { entries, groups: r.groups || D.groups };
  }

  /* ───── Маршрут ───── */

  function readHash() {
    const [lang, stage, round, pick] = location.hash.replace(/^#\/?/, "").split("/");
    if (!I18N[lang]) return false;
    state.lang = lang;
    const s = stageOf(stage) || D.stages[0];
    state.stage = s.id;
    state.round = (s.rounds.find(r => r.id === round) || s.rounds[0]).id;
    state.pick = byId[pick] ? pick : null;
    return true;
  }
  const writeHash = () => {
    const h = `#/${[state.lang, state.stage, state.round, state.pick].filter(Boolean).join("/")}`;
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
    $("#round-meta").innerHTML = `<span>${esc(L(s.title))} · ${esc(r.code)}</span><span class="sep"></span><span>${t.participants(D.participants.length)}</span>`;
    renderBoard();
    renderPreview();
    writeHash();
  }

  function pillsHTML(pills, delayIndex) {
    let p = 0;
    return `<div class="pills">${pills.map(g => `<span class="pill-group">${g.map(v => {
      const filled = v !== null && v !== "";
      return `<span class="pill${filled ? " is-filled" : ""}" style="--p:${p++};--i:${delayIndex}">${filled ? esc(v) : ""}</span>`;
    }).join("")}</span>`).join("")}</div>`;
  }

  function renderBoard() {
    const { entries, groups } = roundData();
    $("#board-cols").innerHTML = `<span>${t.colRank}</span><span>${t.colModel}</span><span>${t.colScore}</span>`;
    $("#board").innerHTML = entries.map((e, i) => `
      <li>
        <button class="row ox-focus${i === 0 ? " top-1" : ""}" data-pick="${e.p.id}" aria-selected="${e.p.id === state.pick}" style="--c:${e.p.color};--i:${i}"
          title="${esc(groups.map(L).join(" · "))}">
          <span class="row-rank">${i + 1}</span>
          ${avatar(e.p)}
          <span class="row-name"><b>${esc(e.p.name)}</b><small>${esc(e.p.vendor)}</small></span>
          <span class="row-score${e.total === null ? " is-empty" : ""}">${e.total ?? "—"}</span>
          ${pillsHTML(e.pills, i)}
        </button>
      </li>`).join("");
  }

  function markSelection() {
    document.querySelectorAll(".row").forEach(b => b.setAttribute("aria-selected", b.dataset.pick === state.pick));
  }

  /* ───── Прев'ю ───── */

  function renderPreview() {
    const pv = $("#preview"), s = stageOf(state.stage), r = roundOf();
    const { entries, groups } = roundData();
    const idx = entries.findIndex(e => e.p.id === state.pick);

    if (idx < 0) {
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
          <div class="pv-mini">${entries.map((e, i) => `<button class="ox-focus" data-pick="${e.p.id}" style="--c:${e.p.color};--i:${i}">${avatar(e.p)}${esc(e.p.name)}</button>`).join("")}</div>
        </div>`;
      return;
    }

    const e = entries[idx], o = e.output;
    const href = o && (o.type === "iframe" || o.type === "video" || o.type === "model") ? o.src : null;
    pv.innerHTML = `
      <div class="pv" style="--c:${e.p.color}">
        <div class="pv-head">
          ${avatar(e.p)}
          <div class="pv-title"><h2>${esc(e.p.name)}</h2>
            <p><span class="tag">${t.rank(idx + 1)}</span><span class="tag tag-accent">${esc(r.code)}</span>${esc(e.p.vendor)}</p></div>
          ${o ? `<button class="icon-btn ox-focus" data-act="fs" title="${t.fullscreen}" aria-label="${t.fullscreen}"><span class="ox-icon">fullscreen</span></button>` : ""}
          ${href ? `<a class="icon-btn ox-focus" href="${esc(href)}" target="_blank" rel="noopener" title="${t.newTab}" aria-label="${t.newTab}"><span class="ox-icon">open_in_new</span></a>` : ""}
          <button class="icon-btn ox-focus" data-act="close" title="${t.close}" aria-label="${t.close}"><span class="ox-icon">close</span></button>
        </div>
        <div class="pv-stage" id="pv-stage">${outputHTML(e, s)}</div>
        <div class="pv-score">
          ${e.pills.map((g, gi) => `<div class="score-group"><span class="micro">${esc(L(groups[gi]))}</span>${pillsHTML([g], 0)}</div>`).join("")}
          <div class="score-total"><span class="micro">${t.total}</span><b>${e.total ?? "—"}</b></div>
        </div>
        ${e.note ? `<p class="pv-note">${esc(L(e.note))}</p>` : ""}
      </div>`;
    if (o?.type === "image") wireGallery(o);
    if (o?.type === "model") loadModelViewer();
  }

  function outputHTML(e, s) {
    const o = e.output;
    if (!o) return `
      <div class="empty" style="--c:${e.p.color}"><div class="empty-inner">
        ${avatar(e.p)}
        <h3><span class="ox-icon">hourglass_empty</span>${t.awaiting}</h3>
        <p>${(t.outputWill[s.id] || t.outputWill.gamedev)(esc(e.p.name))}</p>
      </div></div>`;
    switch (o.type) {
      case "iframe": return `
        <div class="launch" style="--c:${e.p.color}"><div>
          <button class="btn btn-primary ox-focus" data-act="play"><span class="ox-icon">play_arrow</span>${t.play[s.id] || t.play.other}</button>
          <p>${t.playHint}</p>
        </div></div>`;
      case "video": return `<video src="${esc(o.src)}" ${o.poster ? `poster="${esc(o.poster)}"` : ""} controls playsinline preload="metadata"></video>`;
      case "model": return `<model-viewer src="${esc(o.src)}" ${o.poster ? `poster="${esc(o.poster)}"` : ""} camera-controls auto-rotate shadow-intensity="1" alt="${esc(e.p.name)}"></model-viewer>`;
      case "image": {
        const list = [].concat(o.src);
        return `<div class="gallery"><div class="gallery-main"><img src="${esc(list[0])}" alt="${esc(e.p.name)}"></div>${list.length > 1
          ? `<div class="gallery-thumbs">${list.map((src, i) => `<button class="ox-focus${i ? "" : " is-on"}" data-src="${esc(src)}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}</div>`;
      }
      case "text": return `<div class="reader"><article>${String(L(o) || "").split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join("")}</article></div>`;
      default: return "";
    }
  }

  function wireGallery() {
    const stage = $("#pv-stage");
    stage.addEventListener("click", ev => {
      const b = ev.target.closest("[data-src]"); if (!b) return;
      stage.querySelectorAll("[data-src]").forEach(x => x.classList.toggle("is-on", x === b));
      const img = $(".gallery-main img", stage);
      img.replaceWith(Object.assign(img.cloneNode(), { src: b.dataset.src }));
    });
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
    const e = roundData().entries.find(x => x.p.id === state.pick);
    const stage = $("#pv-stage");
    stage.innerHTML = `<iframe src="${esc(e.output.src)}" title="${esc(e.p.name)}" allow="fullscreen; gamepad; autoplay; pointer-lock" allowfullscreen></iframe>`;
    $("iframe", stage).focus();
  }

  /* ───── Події ───── */

  app.addEventListener("click", ev => {
    const st = ev.target.closest("[data-stage]");
    if (st && st.dataset.stage !== state.stage) {
      state.stage = st.dataset.stage; state.round = stageOf(state.stage).rounds[0].id; state.pick = null;
      document.querySelectorAll(".stage").forEach(b => b.setAttribute("aria-selected", b === st));
      moveIndicator(); renderRound(); return;
    }
    const rd = ev.target.closest("[data-round]");
    if (rd && rd.dataset.round !== state.round) { state.round = rd.dataset.round; state.pick = null; renderRound(); return; }

    const pk = ev.target.closest("[data-pick]");
    if (pk) {
      state.pick = pk.dataset.pick === state.pick && pk.classList.contains("row") ? null : pk.dataset.pick;
      markSelection(); renderPreview(); writeHash();
      if (state.pick && matchMedia("(max-width: 960px)").matches) $("#preview").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (act === "close") { state.pick = null; markSelection(); renderPreview(); writeHash(); }
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
      state.stage = D.stages[0].id; state.round = D.stages[0].rounds[0].id; state.pick = null;
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
