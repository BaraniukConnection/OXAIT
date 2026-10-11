// DOM UI: HUD, PC monitor app (shop / market / inventory / stats), reel, reveal card.
import { store, api, fmt, RARITY_COLORS } from './store.js';
import { skinThumb, caseThumb } from './thumbs.js';
import { sfx } from './audio.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };
const pct = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

// ---------------------------------------------------------------- toasts / tooltip
export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = 0; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

export function tooltip(html, x, y) {
  const t = $('#tooltip');
  if (!html) return t.classList.add('hidden');
  t.innerHTML = html;
  t.classList.remove('hidden');
  t.style.left = Math.min(x, innerWidth - 300) + 'px';
  t.style.top = Math.min(y, innerHeight - 80) + 'px';
}

// ---------------------------------------------------------------- thumbnails (lazy)
function thumbImg(skin, float = 0.03) {
  return `<img data-thumb="${skin.id}" data-f="${float}" src="${BLANK}" alt="">`;
}
function fillThumbs(root) {
  const imgs = $$('img[data-thumb]', root);
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < imgs.length && performance.now() - t0 < 14) {
      const im = imgs[i++];
      im.src = skinThumb(store.skins[im.dataset.thumb], +im.dataset.f);
      im.removeAttribute('data-thumb');
    }
    if (i < imgs.length) requestAnimationFrame(step);
  };
  step();
}

// ---------------------------------------------------------------- sparkline
function spark(canvas, data, { color, fill = true } = {}) {
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth || 100, h = canvas.clientHeight || 24;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  if (!data || data.length < 2) return;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const up = data[data.length - 1] >= data[0];
  const col = color || (up ? '#3fd17a' : '#ff5468');
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w, y = h - 2 - ((v - min) / rng) * (h - 4);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
  if (fill) {
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.fill();
  }
}

function bigChart(canvas, data, label) {
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const pad = { l: 60, r: 10, t: 10, b: 20 };
  const min = Math.min(...data) * 0.98, max = Math.max(...data) * 1.02;
  const X = i => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min || 1)) * (h - pad.t - pad.b);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#8a93a3'; ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let k = 0; k <= 4; k++) {
    const v = min + (max - min) * k / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillText(fmt(v), 4, y + 4);
  }
  ctx.fillText(label, pad.l, h - 4);
  const up = data[data.length - 1] >= data[0], col = up ? '#3fd17a' : '#ff5468';
  ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(X(data.length - 1), h - pad.b); ctx.lineTo(X(0), h - pad.b); ctx.closePath();
  const g = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  g.addColorStop(0, col + '44'); g.addColorStop(1, col + '00');
  ctx.fillStyle = g; ctx.fill();
}

// ---------------------------------------------------------------- HUD
export function updateHUD() {
  const s = store.state;
  if (!s) return;
  $('#hudBalance').textContent = fmt(s.balance);
  $('#hudInv').textContent = fmt(s.inventoryValue || 0);
  $('#hudInvCount').textContent = `${s.inventory.length} skins`;
  $('#hudCases').textContent = Object.values(s.cases).reduce((a, b) => a + b, 0);
  $('#osBalance').textContent = fmt(s.balance);
}

// ---------------------------------------------------------------- monitor app
const ui = {
  tab: 'shop',
  qty: {},
  market: { view: 'mine', type: 'all', rarity: 'all', sort: 'value', q: '' },
  selected: new Set(),
  open: false,
};

export function showMonitor(rect) {
  const el = $('#monitorUI');
  placeMonitor(rect);
  if (!ui.open) {
    el.classList.remove('hidden');
    ui.open = true;
    renderTab();
    renderTicker();
  }
}
export function placeMonitor(rect) {
  const el = $('#monitorUI');
  // on small windows the 3D screen is too tiny to use — take over most of the view
  if (rect.w < 760) rect = { x: 8, y: 8, w: innerWidth - 16, h: innerHeight - 16 };
  Object.assign(el.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
  el.style.setProperty('--os-font', Math.max(10, Math.min(16, rect.w / 82)) + 'px');
}
export function hideMonitor() {
  $('#monitorUI').classList.add('hidden');
  $('#modal').classList.add('hidden');
  ui.open = false;
}
export const monitorOpen = () => ui.open;

function setTab(tab) {
  ui.tab = tab;
  $$('.os-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
  renderTab();
}

function renderTab() {
  if (!ui.open) return;
  ({ shop: renderShop, market: renderMarket, inventory: renderInventory, stats: renderStats })[ui.tab]();
}

// ---- shop
function renderShop() {
  const p = $('[data-panel=shop]');
  const s = store.state;
  p.innerHTML = `<div class="shop-grid">${store.catalog.cases.map(c => {
    const q = ui.qty[c.id] || 1;
    const odds = Object.entries(c.odds).map(([r, v]) => `<span style="--c:${RARITY_COLORS[r]}">${store.catalog.rarities[r].label} ${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%</span>`).join('');
    const weapons = c.legendaryOnly ? 'Legendary skins from every weapon' : c.weapons.map(w => store.catalog.weapons.find(x => x.id === w).name).join(' · ');
    return `<div class="case-card ${c.legendaryOnly ? 'legendary' : ''}" style="--case-color:${c.color}">
      <div class="thumb"><img src="${caseThumb(c)}" alt=""></div>
      <div class="case-head"><h3>${esc(c.name)}</h3><span class="case-price">${fmt(c.price)}</span></div>
      <div class="case-meta">${weapons} · ${c.pool.length} skins</div>
      <div class="odds">${odds}</div>
      <div class="owned">Owned: <b>${s.cases[c.id] || 0}</b> &nbsp;<a href="#" data-contents="${c.id}" style="color:var(--accent)">View contents</a></div>
      <div class="buy-row">
        <div class="qty">${[1, 5, 10].map(n => `<button data-q="${n}" data-case="${c.id}" class="${q === n ? 'active' : ''}">×${n}</button>`).join('')}</div>
        <span class="spacer"></span>
        <button class="btn primary" data-buy="${c.id}" ${s.balance < c.price * q ? 'disabled' : ''}>Buy ${fmt(c.price * q)}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function showContents(caseId) {
  const c = store.cases[caseId];
  const skins = c.pool.map(id => store.skins[id]).sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || store.price(b.id) - store.price(a.id));
  openModal(`${esc(c.name)} — contents`, `<div class="contents-grid">${skins.map(sk => skinCard(sk)).join('')}</div>`);
}

function skinCard(sk, extra = '') {
  const c = RARITY_COLORS[sk.rarity];
  return `<div class="inv-card" style="--c:${c}" data-chart="${sk.id}">
    <div class="img">${thumbImg(sk)}</div>
    <div class="info"><div class="skin-name">${esc(sk.weaponName)}<small>${esc(sk.design)} (${esc(sk.variant)})</small></div>
    <div class="row"><span class="rar" style="--c:${c}">${sk.rarity}</span><span class="price">${fmt(store.price(sk.id))}</span></div>${extra}</div>
  </div>`;
}

function openModal(title, html, after) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-box"><header><h3>${title}</h3><button class="btn" data-close-modal>Close</button></header><div class="scroll">${html}</div></div>`;
  m.classList.remove('hidden');
  fillThumbs(m);
  after?.(m);
}

function showChart(skinId) {
  const sk = store.skins[skinId];
  const h = store.market.history[skinId] || [];
  const ch = store.change(skinId, h.length - 1);
  openModal(esc(sk.name), `
    <div style="display:flex;gap:1.2em;align-items:center;margin-bottom:1em">
      <div style="width:14em">${thumbImg(sk)}</div>
      <div><div class="rar" style="--c:${RARITY_COLORS[sk.rarity]}">${sk.rarity}</div>
        <div style="font-size:1.8em;font-weight:700;margin:.2em 0">${fmt(store.price(skinId))}</div>
        <div class="${ch >= 0 ? 'up' : 'down'}">${pct(ch)} over the last ${Math.round(h.length * store.market.tickSeconds / 60)} min</div>
        <div class="case-meta" style="margin-top:.4em">Type: ${store.catalog.types[sk.type]} · Base ${fmt(sk.basePrice)} · Wear modifies sale price (FN ×1.00 … BS ×0.55)</div>
      </div>
    </div>
    <canvas class="chart-big"></canvas>`, m => {
    $('img', m).style.width = '100%';
    bigChart($('.chart-big', m), h, 'Price history');
  });
}

// ---- market
function marketItems() {
  const f = ui.market;
  const q = f.q.toLowerCase();
  const match = sk => (f.type === 'all' || sk.type === f.type) && (f.rarity === 'all' || sk.rarity === f.rarity) && (!q || sk.name.toLowerCase().includes(q));
  if (f.view === 'mine') {
    const items = store.state.inventory.filter(i => match(store.skins[i.skin]));
    const key = { value: i => -store.itemValue(i), change: i => -store.change(i.skin), rarity: i => -RARITY_ORDER[store.skins[i.skin].rarity] * 1e6 - store.itemValue(i), newest: i => -i.ts }[f.sort] || (i => 0);
    return items.sort((a, b) => key(a) - key(b));
  }
  const skins = store.catalog.skins.filter(match);
  const key = { value: s => -store.price(s.id), change: s => -store.change(s.id), rarity: s => -RARITY_ORDER[s.rarity] * 1e6 - store.price(s.id), newest: s => 0 }[f.sort];
  return skins.sort((a, b) => key(a) - key(b));
}

function renderMarket() {
  const p = $('[data-panel=market]');
  const m = store.market, f = ui.market;
  const scroll = p.scrollTop;
  const idx = [
    ...Object.entries(store.catalog.types).map(([k, label]) => ({ k, label, v: m.factors.type[k] })),
    ...Object.entries(store.catalog.rarities).map(([k, r]) => ({ k, label: r.label, v: m.factors.rarity[k], c: RARITY_COLORS[k] })),
  ];
  const items = marketItems();
  const mine = f.view === 'mine';
  // drop selections that no longer exist
  const uids = new Set(store.state.inventory.map(i => i.uid));
  [...ui.selected].forEach(u => !uids.has(u) && ui.selected.delete(u));
  const selTotal = store.state.inventory.filter(i => ui.selected.has(i.uid)).reduce((a, i) => a + store.itemValue(i), 0);

  p.innerHTML = `
    <div class="idx-row">${idx.map(x => {
      const h = m.index[x.k] || [];
      const ch = h.length > 1 ? (h[h.length - 1] - h[0]) / h[0] : 0;
      return `<div class="idx" title="Demand index for ${x.label}"><div class="lbl" ${x.c ? `style="color:${x.c}"` : ''}>${x.label}</div>
        <div class="val ${ch >= 0 ? 'up' : 'down'}">${(x.v * 100).toFixed(0)} <small>${pct(ch)}</small></div><canvas data-idx="${x.k}"></canvas></div>`;
    }).join('')}</div>
    <div class="news">${m.news.slice(0, 6).map(n => `<div class="${n.kind === 'up' ? 'up' : n.kind === 'down' ? 'down' : ''}">${n.kind === 'drop' ? '★ ' : n.kind === 'up' ? '▲ ' : n.kind === 'down' ? '▼ ' : ''}${esc(n.text)}</div>`).join('') || '<div>Market is quiet…</div>'}</div>
    <div class="mk-tools">
      <div class="seg"><button data-mview="mine" class="${mine ? 'active' : ''}">Sell my skins (${store.state.inventory.length})</button><button data-mview="all" class="${!mine ? 'active' : ''}">Price board (${store.catalog.skins.length})</button></div>
      <select data-mf="type"><option value="all">All types</option>${Object.entries(store.catalog.types).map(([k, v]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select data-mf="rarity"><option value="all">All rarities</option>${Object.entries(store.catalog.rarities).map(([k, v]) => `<option value="${k}" ${f.rarity === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <select data-mf="sort">${['value', 'change', 'rarity', 'newest'].map(s => `<option value="${s}" ${f.sort === s ? 'selected' : ''}>Sort: ${s}</option>`).join('')}</select>
      <input type="search" placeholder="Search…" data-mf="q" value="${esc(f.q)}">
      <span class="spacer"></span>
      <span class="case-meta">Prices update every ${m.tickSeconds}s</span>
    </div>
    ${items.length ? `<table class="mk-table"><thead><tr>
      ${mine ? '<th style="width:2em"><input type="checkbox" data-selall></th>' : ''}
      <th></th><th>Skin</th><th>Rarity</th>${mine ? '<th>Wear</th>' : '<th>Type</th>'}<th>Trend</th><th>Change</th><th>${mine ? 'You get' : 'Price'}</th>${mine ? '<th></th>' : ''}
    </tr></thead><tbody>${items.map(it => {
      const sk = mine ? store.skins[it.skin] : it;
      const ch = store.change(sk.id);
      const c = RARITY_COLORS[sk.rarity];
      return `<tr class="${mine && ui.selected.has(it.uid) ? 'sel' : ''}" data-chart="${sk.id}">
        ${mine ? `<td><input type="checkbox" data-sel="${it.uid}" ${ui.selected.has(it.uid) ? 'checked' : ''}></td>` : ''}
        <td>${thumbImg(sk, mine ? it.float : 0.03)}</td>
        <td><div class="skin-name">${esc(sk.weaponName)}<small>${esc(sk.design)} (${esc(sk.variant)})</small></div></td>
        <td><span class="rar" style="--c:${c}">${sk.rarity}</span></td>
        <td>${mine ? `${it.wear}<br><small class="case-meta">${it.float.toFixed(4)}</small>` : store.catalog.types[sk.type]}</td>
        <td><canvas data-spark="${sk.id}"></canvas></td>
        <td class="${ch >= 0 ? 'up' : 'down'}">${pct(ch)}</td>
        <td class="price">${fmt(mine ? store.itemValue(it) : store.price(sk.id))}</td>
        ${mine ? `<td><button class="btn sell small" data-sell="${it.uid}">Sell</button></td>` : ''}
      </tr>`;
    }).join('')}</tbody></table>` : `<div class="empty">${mine ? 'No skins to sell yet. Buy a case in the Case Shop and open it at the workbench (left).' : 'No skins match the filter.'}</div>`}
    ${mine && store.state.inventory.length ? `<div class="sell-bar">
      <span>${ui.selected.size} selected · <b class="price">${fmt(selTotal)}</b></span>
      <span class="spacer"></span>
      <button class="btn" data-sellrarity="common">Sell all Common</button>
      <button class="btn sell" data-sellsel ${ui.selected.size ? '' : 'disabled'}>Sell selected</button>
    </div>` : ''}`;
  $$('canvas[data-idx]', p).forEach(cv => spark(cv, m.index[cv.dataset.idx]));
  $$('canvas[data-spark]', p).forEach(cv => spark(cv, m.history[cv.dataset.spark]));
  fillThumbs(p);
  p.scrollTop = scroll;
}

// ---- inventory
function renderInventory() {
  const p = $('[data-panel=inventory]');
  const inv = [...store.state.inventory].sort((a, b) => store.itemValue(b) - store.itemValue(a));
  p.innerHTML = inv.length ? `<div class="mk-tools"><b>${inv.length} skins</b> · total value <b class="price">${fmt(store.state.inventoryValue)}</b><span class="spacer"></span><span class="case-meta">Top 8 are displayed in the Hall of Drops</span></div>
    <div class="inv-grid">${inv.map(i => {
      const sk = store.skins[i.skin];
      return skinCard(sk, `<div class="case-meta">${i.wear} · ${i.float.toFixed(4)}</div>
        <div class="float-bar"><i style="left:${i.float * 100}%"></i></div>
        <div class="row"><span class="price">${fmt(store.itemValue(i))}</span><button class="btn sell small" data-sell="${i.uid}">Sell</button></div>`)
        .replace(`<span class="price">${fmt(store.price(sk.id))}</span>`, '').replace(thumbImg(sk), thumbImg(sk, i.float));
    }).join('')}</div>` : `<div class="empty">Inventory is empty. Buy cases here, then open them on the workbench to your left.</div>`;
  fillThumbs(p);
}

// ---- stats
function renderStats() {
  const p = $('[data-panel=stats]');
  const st = store.state.stats, s = store.state;
  const profit = s.balance + (s.inventoryValue || 0) - 1500;
  const best = st.best ? store.skins[st.best.skin] : null;
  p.innerHTML = `<div class="stats-grid">
      <div class="stat"><span>Cases opened</span><b>${st.opened}</b></div>
      <div class="stat"><span>Spent on cases</span><b>${fmt(st.spent)}</b></div>
      <div class="stat"><span>Earned from sales</span><b>${fmt(st.earned)}</b></div>
      <div class="stat"><span>Net worth vs start</span><b class="${profit >= 0 ? 'up' : 'down'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</b></div>
    </div>
    ${best ? `<h3>Best drop</h3><div style="max-width:16em">${skinCard(best, `<div class="case-meta">${st.best.wear} · valued ${fmt(st.best.value)} at drop</div>`)}</div>` : ''}
    <h3 style="margin-top:1.5em">Danger zone</h3>
    <p class="case-meta">Start over with $1,500. Market prices are kept.</p>
    <button class="btn danger" data-reset>Reset progress</button>`;
  fillThumbs(p);
}

function renderTicker() {
  const t = $('#ticker');
  const items = store.catalog.skins.filter(s => s.rarity !== 'common').sort(() => Math.random() - 0.5).slice(0, 25);
  t.innerHTML = items.map(s => {
    const ch = store.change(s.id);
    return `<span><span style="color:${RARITY_COLORS[s.rarity]}">${esc(s.weaponName)} | ${esc(s.design)}</span> ${fmt(store.price(s.id))} <span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${pct(ch)}</span></span>`;
  }).join('');
}

// ---------------------------------------------------------------- actions
async function doSell(uids) {
  if (!uids.length) return;
  try {
    const r = await api.sell(uids);
    uids.forEach(u => ui.selected.delete(u));
    sfx.sell();
    toast(`Sold ${r.sold} skin${r.sold > 1 ? 's' : ''} for <b>${fmt(r.earned)}</b>`, 'good');
  } catch (e) { sfx.error(); toast(e.message, 'error'); }
}

function bindMonitor() {
  const root = $('#monitorUI');
  $$('.os-tabs button').forEach(b => b.addEventListener('click', () => { sfx.click(); setTab(b.dataset.tab); }));

  root.addEventListener('click', async e => {
    const t = e.target.closest('button, a, input, tr, .inv-card');
    if (!t) return;
    const d = t.dataset;
    if (d.q) { ui.qty[d.case] = +d.q; sfx.click(); return renderShop(); }
    if (d.buy) {
      const qty = ui.qty[d.buy] || 1;
      try {
        await api.buy(d.buy, qty);
        sfx.buy();
        toast(`Bought ${qty}× ${store.cases[d.buy].name}. Open it at the workbench on your left.`, 'good');
      } catch (err) { sfx.error(); toast(err.message, 'error'); }
      return;
    }
    if (d.contents) { e.preventDefault(); return showContents(d.contents); }
    if ('closeModal' in d) return $('#modal').classList.add('hidden');
    if (d.mview) { ui.market.view = d.mview; return renderMarket(); }
    if (d.sell) { e.stopPropagation(); return doSell([d.sell]); }
    if ('sellsel' in d) return doSell([...ui.selected]);
    if (d.sellrarity) return doSell(store.state.inventory.filter(i => store.skins[i.skin].rarity === d.sellrarity).map(i => i.uid));
    if (d.sel) { t.checked ? ui.selected.add(d.sel) : ui.selected.delete(d.sel); return renderMarket(); }
    if ('selall' in d) {
      const items = marketItems();
      t.checked ? items.forEach(i => ui.selected.add(i.uid)) : ui.selected.clear();
      return renderMarket();
    }
    if ('reset' in d) {
      if (!confirm('Reset balance, cases and inventory?')) return;
      await api.reset(); ui.selected.clear(); toast('Progress reset. Fresh $1,500.', 'good');
      return;
    }
    if (d.chart && !e.target.closest('input, button')) return showChart(d.chart);
  });

  root.addEventListener('input', e => {
    const k = e.target.dataset.mf;
    if (!k) return;
    ui.market[k] = e.target.value;
    if (k === 'q') {
      clearTimeout(ui.qTimer);
      ui.qTimer = setTimeout(() => { renderMarket(); const i = $('[data-mf=q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250);
    } else renderMarket();
  });
  // keep game hotkeys from firing while typing
  root.addEventListener('keydown', e => { if (e.target.matches('input, select')) e.stopPropagation(); });
}

// ---------------------------------------------------------------- reel
export function spinReel(reelIds, win, caseName) {
  const strip = $('#reelStrip');
  $('#reelTitle').textContent = `Opening ${caseName}`;
  strip.innerHTML = reelIds.map((id, i) => {
    const sk = store.skins[id];
    return `<div class="reel-card" style="--c:${RARITY_COLORS[sk.rarity]}" data-i="${i}">
      <img src="${skinThumb(sk)}" alt=""><div class="n"><b>${esc(sk.weaponName)}</b>${esc(sk.design)}</div></div>`;
  }).join('');
  strip.style.transform = 'translateX(0)';
  $('#reel').classList.remove('hidden');
  const CARD = 166; // width + gap
  const winW = $('.reel-window').clientWidth;
  const jitter = (Math.random() - 0.5) * 130;
  const target = win * CARD + 80 + jitter - winW / 2;
  const dur = 6500;
  return new Promise(resolve => {
    const t0 = performance.now();
    let lastCard = -1;
    const frame = now => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 4.2);
      const x = target * e;
      strip.style.transform = `translateX(${-x}px)`;
      const card = Math.floor((x + winW / 2) / CARD);
      if (card !== lastCard) { lastCard = card; sfx.tick(); }
      if (t < 1) requestAnimationFrame(frame);
      else {
        strip.children[win].classList.add('win');
        setTimeout(resolve, 650);
      }
    };
    requestAnimationFrame(frame);
  });
}
export function hideReel() { $('#reel').classList.add('hidden'); }

// ---------------------------------------------------------------- reveal
export function showReveal(item, casesLeft) {
  const sk = store.skins[item.skin];
  const el = $('#reveal');
  el.style.setProperty('--c', RARITY_COLORS[sk.rarity]);
  el.innerHTML = `
    <div class="r-rarity">${sk.rarity === 'legendary' ? '★ ' : ''}${store.catalog.rarities[sk.rarity].label}</div>
    <h2>${esc(sk.weaponName)} | ${esc(sk.design)}</h2>
    <div class="r-variant">${esc(sk.variant)} variant · ${store.catalog.types[sk.type]}</div>
    <div class="r-grid">
      <div><span>Exterior</span><b>${item.wear}</b></div>
      <div><span>Float</span><b>${item.float.toFixed(5)}</b></div>
      <div class="r-value" style="grid-column:span 2"><span>Market value</span><b>${fmt(item.value)}</b></div>
    </div>
    <div class="float-bar" style="margin-bottom:16px"><i style="left:${item.float * 100}%"></i></div>
    <div class="r-actions">
      <button class="btn" data-r="keep">Keep</button>
      <button class="btn sell" data-r="sell">Sell ${fmt(item.value)}</button>
      ${casesLeft > 0 ? `<button class="btn primary" data-r="again" style="flex-basis:100%">Open another (${casesLeft} left)</button>` : ''}
    </div>`;
  el.classList.remove('hidden');
  return new Promise(resolve => {
    el.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      sfx.click();
      el.onclick = null;
      el.classList.add('hidden');
      resolve(b.dataset.r);
    };
  });
}

// ---------------------------------------------------------------- init
export function initUI() {
  bindMonitor();
  store.on('state', () => {
    updateHUD();
    if (ui.open) renderTab();
  });
  store.on('values', () => updateHUD());
  store.on('cases', () => updateHUD());
  store.on('market', () => {
    if (!ui.open) return;
    if (ui.tab === 'market') {
      // don't yank the UI while the user is typing in the search box
      if (document.activeElement?.dataset?.mf !== 'q' && !document.activeElement?.matches?.('select')) renderMarket();
    } else if (ui.tab !== 'stats') { /* prices visible in shop modal only */ }
    if (Math.random() < 0.25) renderTicker();
  });
  updateHUD();
}

export { $, $$ };
