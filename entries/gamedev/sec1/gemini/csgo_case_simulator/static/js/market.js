/**
 * CS:GO Dynamic Skin Market, Case Shop & Inventory Manager
 */

class MarketManager {
    constructor() {
        this.marketData = null;
        this.selectedCategory = 'All';
        this.searchQuery = '';
        this.pollTimer = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.startMarketPolling();
    }

    bindEvents() {
        // Tab switching in PC Shop window
        document.querySelectorAll('.pc-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pc-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.pc-tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.dataset.tab;
                const pane = document.getElementById(targetId);
                if (pane) pane.classList.add('active');
                window.soundEngine.playClick();
            });
        });

        // Market Category Filter Buttons
        document.querySelectorAll('.market-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.market-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedCategory = btn.dataset.category;
                this.renderMarketGrid();
                window.soundEngine.playClick();
            });
        });

        // Search Input
        const searchInput = document.getElementById('market-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderMarketGrid();
            });
        }

        // Quick Sell Commons
        const sellCommonsBtn = document.getElementById('sell-commons-btn');
        if (sellCommonsBtn) {
            sellCommonsBtn.addEventListener('click', () => {
                window.app.sellAllCommon();
            });
        }

        // Add funds buttons
        document.querySelectorAll('.btn-add-funds').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseFloat(btn.dataset.amount || 500);
                window.app.addFunds(amount);
            });
        });
    }

    startMarketPolling() {
        this.fetchMarketData();
        this.pollTimer = setInterval(() => {
            this.fetchMarketData();
        }, 4500);
    }

    async fetchMarketData() {
        try {
            const resp = await fetch('/api/market');
            if (resp.ok) {
                this.marketData = await resp.json();
                this.updateTicker();
                this.renderMarketGrid();
                if (window.app && window.app.state) {
                    this.renderInventory();
                }
                return;
            }
        } catch (e) {
            // Standalone client market simulation
        }

        this.simulateLocalMarketTick();
        this.updateTicker();
        this.renderMarketGrid();
        if (window.app && window.app.state) {
            this.renderInventory();
        }
    }

    simulateLocalMarketTick() {
        if (!this.marketData) {
            const prices = {};
            const allSkins = window.CSGO_CONFIG ? window.CSGO_CONFIG.ALL_SKINS : {};
            Object.entries(allSkins).forEach(([id, s]) => {
                prices[id] = {
                    price: s.base_price,
                    change_pct: 0.0,
                    history: [s.base_price],
                    rarity: s.rarity,
                    weapon: s.weapon_label,
                    name: s.full_name,
                    category: s.category,
                };
            });
            this.marketData = {
                prices: prices,
                events: [{
                    title: "MARKET OPEN",
                    desc: "Live CS:GO Dynamic Skin Market initialized.",
                    multiplier: 1.0,
                    time: new Date().toLocaleTimeString()
                }],
            };
        }

        // Random market fluctuation tick
        const prices = this.marketData.prices;
        const allSkins = window.CSGO_CONFIG ? window.CSGO_CONFIG.ALL_SKINS : {};

        // 10% chance of random market breaking event
        if (Math.random() < 0.12) {
            const events = [
                { title: "AK-47 Surge", desc: "Pro player clutch in Major finals with AK-47!", target: "Ak47", mult: 1.18 },
                { title: "M4A1 Nerf Rumor", desc: "Meta shift cools M4A1 prices slightly.", target: "M4A1", mult: 0.91 },
                { title: "Collector Buyout", desc: "Whale swept the Legendary market!", target: "Legendary", mult: 1.25 },
                { title: "Deagle Hype", desc: "One-deag montage trending on socials!", target: "Desert Eagle", mult: 1.15 },
                { title: "Gold Rush", desc: "Imperial Obsidian skins seeing crazy collector demand!", target: "Imperial Obsidian", mult: 1.28 }
            ];
            const ev = events[Math.floor(Math.random() * events.length)];
            Object.entries(allSkins).forEach(([id, s]) => {
                if (ev.target === s.weapon || ev.target === s.rarity || s.name.includes(ev.target)) {
                    if (prices[id]) {
                        prices[id].price = Math.round(prices[id].price * ev.mult * 100) / 100;
                    }
                }
            });
            this.marketData.events.unshift({
                title: ev.title,
                desc: ev.desc,
                multiplier: ev.mult,
                time: new Date().toLocaleTimeString(),
            });
            if (this.marketData.events.length > 6) this.marketData.events.pop();
        }

        Object.entries(allSkins).forEach(([id, s]) => {
            const pData = prices[id];
            if (!pData) return;
            const vol = s.rarity === 'Legendary' ? 0.05 : (s.rarity === 'Epic' ? 0.035 : 0.02);
            const drift = (Math.random() - 0.49) * vol;
            pData.price = Math.max(1.0, Math.round(pData.price * (1 + drift) * 100) / 100);
            pData.history.push(pData.price);
            if (pData.history.length > 25) pData.history.shift();
            const first = pData.history[0];
            pData.change_pct = Math.round(((pData.price - first) / first) * 1000) / 10;
        });
    }

    updateTicker() {
        if (!this.marketData) return;
        const tickerBar = document.getElementById('market-ticker-content');
        if (!tickerBar) return;

        const prices = this.marketData.prices;
        const events = this.marketData.events || [];

        // Build top movers & events
        let html = '';
        if (events.length > 0) {
            const latestEv = events[0];
            html += `<span class="ticker-event">🚨 [MARKET NEWS: ${latestEv.title}] ${latestEv.desc}</span>`;
        }

        const items = Object.entries(prices);
        // Sort by highest absolute percentage change
        items.sort((a, b) => Math.abs(b[1].change_pct) - Math.abs(a[1].change_pct));

        items.slice(0, 10).forEach(([skinId, pData]) => {
            const isPos = pData.change_pct >= 0;
            const sign = isPos ? '▲ +' : '▼ ';
            const colorClass = isPos ? 'pos' : 'neg';
            html += `
                <span class="ticker-item">
                    <span class="ticker-name">${pData.name}</span>
                    <span class="ticker-price">$${pData.price.toFixed(2)}</span>
                    <span class="ticker-pct ${colorClass}">${sign}${pData.change_pct.toFixed(1)}%</span>
                </span>
            `;
        });

        tickerBar.innerHTML = html;
    }

    renderMarketGrid() {
        if (!this.marketData) return;
        const grid = document.getElementById('market-grid');
        if (!grid) return;

        const prices = this.marketData.prices;
        const allSkins = window.app && window.app.state ? window.app.state.all_skins : {};

        let filtered = Object.entries(prices).filter(([id, data]) => {
            const skin = allSkins[id];
            if (!skin) return true;

            // Category filter
            if (this.selectedCategory !== 'All') {
                if (this.selectedCategory === 'Legendary') {
                    if (skin.rarity !== 'Legendary') return false;
                } else if (skin.category !== this.selectedCategory) {
                    return false;
                }
            }

            // Search query
            if (this.searchQuery) {
                const text = `${skin.weapon_label} ${skin.name} ${skin.rarity} ${skin.pattern}`.toLowerCase();
                if (!text.includes(this.searchQuery)) return false;
            }

            return true;
        });

        grid.innerHTML = '';
        filtered.forEach(([skinId, data]) => {
            const skin = allSkins[skinId];
            if (!skin) return;

            const isPos = data.change_pct >= 0;
            const sign = isPos ? '+' : '';
            const changeColor = isPos ? '#2ed573' : '#ff4757';
            const rarityColor = window.rouletteController.getRarityColor(skin.rarity);

            const card = document.createElement('div');
            card.className = 'market-skin-card';
            card.style.borderLeftColor = rarityColor;

            card.innerHTML = `
                <div class="mcard-header">
                    <div class="mcard-weapon">${skin.weapon_label}</div>
                    <div class="mcard-rarity" style="color: ${rarityColor}">${skin.rarity}</div>
                </div>
                <div class="mcard-title" style="color: ${skin.accent_color || '#ffffff'}">${skin.name}</div>
                <div class="mcard-pattern">${skin.pattern} // ${skin.geom_design}</div>
                
                <div class="mcard-sparkline-box">
                    <canvas class="sparkline-canvas" width="160" height="38" data-skin="${skinId}"></canvas>
                </div>

                <div class="mcard-footer">
                    <div class="mcard-price">$${data.price.toFixed(2)}</div>
                    <div class="mcard-pct" style="color: ${changeColor}">${sign}${data.change_pct.toFixed(1)}%</div>
                </div>
            `;

            // Draw sparkline
            const canvas = card.querySelector('.sparkline-canvas');
            this.drawSparkline(canvas, data.history, isPos ? '#2ed573' : '#ff4757');

            grid.appendChild(card);
        });
    }

    drawSparkline(canvas, history, color) {
        if (!canvas || !history || history.length < 2) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = max - min || 1;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        history.forEach((val, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - 4 - ((val - min) / range) * (h - 8);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Subtle gradient fill under line
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = `${color}22`;
        ctx.fill();
    }

    renderShop(state) {
        const catalog = state.cases_catalog;
        const casesOwned = state.cases_owned;
        const container = document.getElementById('shop-case-grid');
        if (!container) return;

        container.innerHTML = '';
        Object.entries(catalog).forEach(([caseId, c]) => {
            const owned = casesOwned[caseId] || 0;
            const isLegendary = caseId === 'legendary_case';

            const card = document.createElement('div');
            card.className = `shop-case-card ${isLegendary ? 'legendary-case-glow' : ''}`;
            card.innerHTML = `
                <div class="case-card-header">
                    <div class="case-card-name">${c.name}</div>
                    <div class="case-card-price">$${c.price}</div>
                </div>
                <div class="case-card-preview">
                    <div class="case-box-graphic" style="background: radial-gradient(circle, ${c.icon_color}44 0%, transparent 70%);">
                        <span class="case-3d-tag">3D CRATE</span>
                    </div>
                </div>
                <div class="case-card-weapons">
                    Weapons: <strong>${c.weapons.join(', ')}</strong>
                </div>
                <div class="case-card-desc">${c.description}</div>
                <div class="case-card-inventory">
                    Owned: <span class="owned-count-badge">${owned}</span>
                </div>
                <div class="case-card-actions">
                    <button class="btn btn-buy" data-case="${caseId}" data-qty="1">Buy 1x ($${c.price})</button>
                    <button class="btn btn-buy-5x" data-case="${caseId}" data-qty="5">5x ($${c.price * 5})</button>
                </div>
            `;

            // Bind buy buttons
            card.querySelectorAll('.btn-buy, .btn-buy-5x').forEach(b => {
                b.addEventListener('click', (e) => {
                    const qty = parseInt(b.dataset.qty, 10);
                    window.app.buyCase(caseId, qty);
                });
            });

            container.appendChild(card);
        });
    }

    renderInventory() {
        const state = window.app ? window.app.state : null;
        if (!state) return;

        const inventory = state.inventory || [];
        const container = document.getElementById('inventory-grid');
        const emptyMsg = document.getElementById('inventory-empty');
        const countSpan = document.getElementById('inv-total-count');
        const valSpan = document.getElementById('inv-total-value');

        if (countSpan) countSpan.textContent = inventory.length;

        let totalValue = 0;
        inventory.forEach(i => totalValue += (i.current_value || 0));
        if (valSpan) valSpan.textContent = `$${totalValue.toFixed(2)}`;

        if (!container) return;

        if (inventory.length === 0) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.classList.remove('hidden');
            return;
        }

        if (emptyMsg) emptyMsg.classList.add('hidden');
        container.innerHTML = '';

        inventory.forEach(item => {
            const skin = item.skin_info;
            if (!skin) return;

            const rarityCol = window.rouletteController.getRarityColor(skin.rarity);
            const livePrice = item.current_value;
            const diff = livePrice - item.unboxed_price;
            const diffSign = diff >= 0 ? '+' : '';
            const diffCol = diff >= 0 ? '#2ed573' : '#ff4757';

            const card = document.createElement('div');
            card.className = 'inventory-card';
            card.style.borderColor = rarityCol;

            card.innerHTML = `
                <div class="inv-card-header">
                    <span class="inv-weapon">${skin.weapon_label}</span>
                    <span class="inv-rarity" style="color: ${rarityCol}">${skin.rarity}</span>
                </div>
                <div class="inv-skin-name" style="color: ${skin.accent_color || '#ffffff'}">${skin.name}</div>
                <div class="inv-condition">${item.condition} <small>(${item.float_value.toFixed(3)})</small></div>
                
                <div class="inv-price-info">
                    <div class="inv-current-val">$${livePrice.toFixed(2)}</div>
                    <div class="inv-profit" style="color: ${diffCol}">${diffSign}$${diff.toFixed(2)}</div>
                </div>

                <div class="inv-actions">
                    <button class="btn btn-inv-inspect" title="Inspect in 3D Turntable">Inspect 3D</button>
                    <button class="btn btn-inv-sell" title="Sell instantly for dynamic market price">Sell ($${livePrice.toFixed(2)})</button>
                </div>
            `;

            card.querySelector('.btn-inv-inspect').addEventListener('click', () => {
                window.app.inspectWeapon(skin, item.condition);
            });

            card.querySelector('.btn-inv-sell').addEventListener('click', () => {
                window.app.sellItem(item.id);
            });

            container.appendChild(card);
        });
    }
}

window.marketManager = new MarketManager();
