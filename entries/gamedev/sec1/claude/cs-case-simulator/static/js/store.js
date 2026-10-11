// Client-side game store: catalog, player state, live market. Server is authoritative.
const listeners = {};

export const store = {
  catalog: null,
  skins: {},      // id -> skin
  cases: {},      // id -> case def
  state: null,    // balance, cases, inventory, stats
  market: null,   // prices, history, factors, news

  on(evt, fn) { (listeners[evt] ||= []).push(fn); },
  emit(evt, data) { (listeners[evt] || []).forEach(fn => fn(data)); },

  price(skinId) { return this.market?.prices[skinId] ?? this.skins[skinId].basePrice; },
  wearMult(wear) { return this.catalog.wears.find(w => w.name === wear)?.mult ?? 1; },
  itemValue(item) { return Math.round(this.price(item.skin) * this.wearMult(item.wear) * 100) / 100; },
  change(skinId, span = 15) {
    const h = this.market?.history[skinId];
    if (!h || h.length < 2) return 0;
    const old = h[Math.max(0, h.length - 1 - span)];
    return (h[h.length - 1] - old) / old;
  },
};

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function setState(s) {
  store.state = s;
  store.emit('state', s);
}

export const api = {
  async init() {
    const [catalog, state, market] = await Promise.all([
      call('GET', '/api/catalog'), call('GET', '/api/state'), call('GET', '/api/market'),
    ]);
    store.catalog = catalog;
    catalog.skins.forEach(s => (store.skins[s.id] = s));
    catalog.cases.forEach(c => (store.cases[c.id] = c));
    store.market = market;
    setState(state);
  },
  async refreshMarket() {
    store.market = await call('GET', '/api/market');
    store.emit('market', store.market);
    // values of inventory items depend on market prices
    store.state.inventory.forEach(i => (i.value = store.itemValue(i)));
    store.state.inventoryValue = store.state.inventory.reduce((a, i) => a + i.value, 0);
    store.emit('values');
  },
  async buy(caseId, qty) {
    const r = await call('POST', '/api/buy', { case: caseId, qty });
    setState(r.state);
    return r;
  },
  async open(caseId) {
    const r = await call('POST', '/api/open', { case: caseId });
    store.pendingState = r.state; // applied after the reveal so the drop isn't spoiled
    store.state.cases = r.state.cases;
    store.emit('cases');
    return r;
  },
  commitPending() {
    if (store.pendingState) { setState(store.pendingState); store.pendingState = null; }
  },
  async sell(uids) {
    const r = await call('POST', '/api/sell', { uids });
    setState(r.state);
    return r;
  },
  async reset() {
    const r = await call('POST', '/api/reset');
    setState(r.state);
  },
};

export const RARITY_COLORS = {
  common: '#b0c3d9',
  rare: '#4b69ff',
  epic: '#a35cff',
  legendary: '#e4ae39',
};

export const fmt = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
