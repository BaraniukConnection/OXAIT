/**
 * CS:GO Case Simulator - Main Application Controller
 * Connects Three.js 3D Viewport, Camera Navigation, Economy REST API, and Audio
 */

class AppController {
    constructor() {
        this.state = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.warehouse = null;

        // Current 3D weapon displayed on center inspection turntable
        this.currentWeaponMesh = null;
        this.inspecting = false;
        this.inspectAnimProgress = 0;
        this.isInspectAnimActive = false;

        // Camera stations
        this.stations = {
            'station-room': {
                pos: new THREE.Vector3(0, 2.5, 7.5),
                target: new THREE.Vector3(0, 0.5, 0),
            },
            'station-left': { // Workbench to the left
                pos: new THREE.Vector3(-4.5, 1.2, 0.8),
                target: new THREE.Vector3(-6.8, 0.2, 0.5),
            },
            'station-right': { // PC Monitor to the right
                pos: new THREE.Vector3(4.5, 1.2, 0.7),
                target: new THREE.Vector3(6.8, 0.8, 0.5),
            },
            'station-inspect': { // Center weapon turntable
                pos: new THREE.Vector3(0, 0.8, 3.2),
                target: new THREE.Vector3(0, 0.2, 0),
            },
        };

        this.currentStationKey = 'station-room';
        this.cameraLerp = {
            active: false,
            startPos: new THREE.Vector3(),
            targetPos: new THREE.Vector3(),
            startLook: new THREE.Vector3(),
            targetLook: new THREE.Vector3(),
            currentLook: new THREE.Vector3(0, 0.5, 0),
            startTime: 0,
            duration: 1200,
        };

        // Pointer controls for inspection turntable
        this.isDragging = false;
        this.prevMousePos = { x: 0, y: 0 };
        this.weaponRotation = { x: 0, y: 0.3 };

        this.init();
    }

    async init() {
        this.initThree();
        this.warehouse = new WarehouseEnvironment(this.scene);
        this.bindEvents();
        this.bindMouseOrbit();
        await this.fetchState();

        // Default default weapon on the turntable (AK-47 Hyper Hazard)
        const sampleSkin = this.state.all_skins['Ak47_p4_v1'] || Object.values(this.state.all_skins)[0];
        this.setTurntableWeapon('Ak47', sampleSkin);

        // Start animation loop
        this.lastTime = performance.now();
        this.animate();

        // Start ambient sound on first user interaction
        const startAudio = () => {
            window.soundEngine.startAmbient();
            window.removeEventListener('click', startAudio);
        };
        window.addEventListener('click', startAudio);
    }

    initThree() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0c0f14);
        this.scene.fog = new THREE.FogExp2(0x0c0f14, 0.04);

        // Camera
        this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
        const initStation = this.stations[this.currentStationKey];
        this.camera.position.copy(initStation.pos);
        this.cameraLerp.currentLook.copy(initStation.target);
        this.camera.lookAt(this.cameraLerp.currentLook);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        container.appendChild(this.renderer.domElement);

        // Raycaster for clicking 3D world elements
        this.raycaster = new THREE.Raycaster();
        this.mouseVec = new THREE.Vector2();

        // Resize handler
        window.addEventListener('resize', () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
    }

    bindEvents() {
        // Station navigation buttons
        document.querySelectorAll('.nav-station-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetKey = btn.dataset.station;
                this.switchStation(targetKey);
                window.soundEngine.playClick();
            });
        });

        // Click on 3D elements in the scene (e.g. click PC monitor or Case)
        const container = document.getElementById('canvas-container');
        container.addEventListener('pointerdown', (e) => {
            if (e.target !== this.renderer.domElement) return;

            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouseVec, this.camera);
            const intersects = this.raycaster.intersectObjects(this.warehouse.clickableObjects, true);

            if (intersects.length > 0) {
                const clickedObj = intersects[0].object;
                const action = clickedObj.userData.action || (clickedObj.parent && clickedObj.parent.userData.action);
                if (action) {
                    this.switchStation(action);
                    window.soundEngine.playClick();
                }
            }
        });

        // Quick open button on the left unboxing HUD
        const openCaseBtn = document.getElementById('btn-open-case');
        if (openCaseBtn) {
            openCaseBtn.addEventListener('click', () => {
                this.handleOpenSelectedCase();
            });
        }

        // Case selector dropdown on workbench
        const caseSelect = document.getElementById('workbench-case-select');
        if (caseSelect) {
            caseSelect.addEventListener('change', (e) => {
                this.updateWorkbenchDisplay(e.target.value);
            });
        }

        // Weapon Inspect 3D Trigger ('F' key or button)
        const inspectBtn = document.getElementById('btn-inspect-trigger');
        if (inspectBtn) {
            inspectBtn.addEventListener('click', () => {
                this.triggerInspectAnimation();
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'f' || e.key === 'F') {
                this.triggerInspectAnimation();
            } else if (e.key === '1') {
                this.switchStation('station-room');
            } else if (e.key === '2') {
                this.switchStation('station-left');
            } else if (e.key === '3') {
                this.switchStation('station-right');
            } else if (e.key === '4') {
                this.switchStation('station-inspect');
            }
        });

        // Audio toggle button
        const soundToggle = document.getElementById('btn-sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                const isMuted = window.soundEngine.toggleMute();
                soundToggle.textContent = isMuted ? '🔇 Audio Off' : '🔊 Audio On';
                soundToggle.classList.toggle('muted', isMuted);
            });
        }
    }

    bindMouseOrbit() {
        const dom = this.renderer.domElement;

        dom.addEventListener('pointerdown', (e) => {
            if (e.button === 0) {
                this.isDragging = true;
                this.prevMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.prevMousePos.x;
            const dy = e.clientY - this.prevMousePos.y;

            this.weaponRotation.y += dx * 0.008;
            this.weaponRotation.x += dy * 0.008;
            // Clamp pitch
            this.weaponRotation.x = Math.max(-0.6, Math.min(0.6, this.weaponRotation.x));

            this.prevMousePos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
        });
    }

    switchStation(stationKey) {
        if (!this.stations[stationKey]) return;
        this.currentStationKey = stationKey;

        // Update active nav button
        document.querySelectorAll('.nav-station-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.station === stationKey);
        });

        // Trigger camera lerp
        this.cameraLerp.active = true;
        this.cameraLerp.startTime = performance.now();
        this.cameraLerp.startPos.copy(this.camera.position);
        this.cameraLerp.targetPos.copy(this.stations[stationKey].pos);
        this.cameraLerp.startLook.copy(this.cameraLerp.currentLook);
        this.cameraLerp.targetLook.copy(this.stations[stationKey].target);

        // Show/hide PC terminal UI overlay when focused on PC monitor
        const pcWindow = document.getElementById('pc-terminal-overlay');
        if (stationKey === 'station-right') {
            pcWindow.classList.remove('hidden');
        } else {
            pcWindow.classList.add('hidden');
        }

        // Show workbench HUD when at left station
        const benchHud = document.getElementById('workbench-hud');
        if (stationKey === 'station-left') {
            benchHud.classList.remove('hidden');
        } else {
            benchHud.classList.add('hidden');
        }
    }

    setTurntableWeapon(weaponId, skin) {
        if (this.currentWeaponMesh) {
            this.scene.remove(this.currentWeaponMesh);
        }

        this.currentWeaponMesh = window.weaponFactory.createWeapon(weaponId, skin);
        this.currentWeaponMesh.position.set(0, 0.4, 0);
        this.scene.add(this.currentWeaponMesh);

        // Update inspect badge
        const badge = document.getElementById('inspect-turntable-badge');
        if (badge && skin) {
            badge.innerHTML = `
                <div class="badge-weapon">${skin.weapon_label}</div>
                <div class="badge-skin" style="color: ${skin.accent_color || '#fff'}">${skin.name}</div>
                <div class="badge-rarity">${skin.rarity} // ${skin.pattern}</div>
            `;
        }
    }

    triggerInspectAnimation() {
        if (this.isInspectAnimActive) return;
        this.isInspectAnimActive = true;
        this.inspectAnimProgress = 0;
        window.soundEngine.playClick();
    }

    async fetchState() {
        try {
            const resp = await fetch('/api/state');
            if (resp.ok) {
                this.state = await resp.json();
                this.isUsingServer = true;
            } else {
                throw new Error('Server returned non-200');
            }
        } catch (e) {
            console.info('Using local client simulation engine (offline / standalone mode)');
            this.isUsingServer = false;
            this.state = this.getLocalState();
        }

        this.updateHUD();
        window.marketManager.renderShop(this.state);
        window.marketManager.renderInventory();
        this.updateWorkbenchDropdown();
    }

    getLocalState() {
        const stored = localStorage.getItem('csgo_sim_state');
        if (stored) {
            try { return JSON.parse(stored); } catch (e) {}
        }

        const initialCases = {};
        Object.keys(window.CSGO_CONFIG.CASES_CATALOG).forEach(cid => initialCases[cid] = 1);

        const initState = {
            profile: {
                id: 1,
                balance: 1000.0,
                cases_opened: 0,
                total_spent: 0.0,
                total_earned: 0.0,
            },
            inventory: [],
            cases_owned: initialCases,
            all_skins: window.CSGO_CONFIG.ALL_SKINS,
            cases_catalog: window.CSGO_CONFIG.CASES_CATALOG,
        };
        this.saveLocalState(initState);
        return initState;
    }

    saveLocalState(state) {
        if (!state) return;
        localStorage.setItem('csgo_sim_state', JSON.stringify(state));
    }

    updateHUD() {
        if (!this.state) return;
        const prof = this.state.profile;
        document.getElementById('hud-balance').textContent = `$${prof.balance.toFixed(2)}`;
        document.getElementById('hud-opened').textContent = prof.cases_opened;

        const pnl = prof.total_earned - prof.total_spent;
        const pnlSign = pnl >= 0 ? '+' : '';
        const pnlEl = document.getElementById('hud-pnl');
        pnlEl.textContent = `${pnlSign}$${pnl.toFixed(2)}`;
        pnlEl.className = pnl >= 0 ? 'pos' : 'neg';
    }

    updateWorkbenchDropdown() {
        const select = document.getElementById('workbench-case-select');
        if (!select || !this.state) return;

        const currentVal = select.value;
        select.innerHTML = '';

        Object.entries(this.state.cases_catalog).forEach(([cid, c]) => {
            const count = this.state.cases_owned[cid] || 0;
            const opt = document.createElement('option');
            opt.value = cid;
            opt.textContent = `${c.name} (Owned: ${count}) - $${c.price}`;
            select.appendChild(opt);
        });

        if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
            select.value = currentVal;
        }

        this.updateWorkbenchDisplay(select.value);
    }

    updateWorkbenchDisplay(caseId) {
        if (!this.state || !caseId) return;
        const c = this.state.cases_catalog[caseId];
        const owned = this.state.cases_owned[caseId] || 0;
        if (!c) return;

        document.getElementById('wb-case-name').textContent = c.name;
        document.getElementById('wb-case-price').textContent = `$${c.price}`;
        document.getElementById('wb-case-owned').textContent = owned;
        document.getElementById('wb-case-weapons').textContent = c.weapons.join(' / ');

        const openBtn = document.getElementById('btn-open-case');
        if (owned > 0) {
            openBtn.disabled = false;
            openBtn.textContent = `Open ${c.name} [ENTER]`;
            openBtn.classList.remove('btn-disabled');
        } else {
            openBtn.disabled = true;
            openBtn.textContent = `Need to Buy from PC Shop ($${c.price})`;
            openBtn.classList.add('btn-disabled');
        }

        // Change 3D case glow color to match case rarity
        this.warehouse.setCaseGlowColor(c.icon_color);
    }

    async buyCase(caseId, qty = 1) {
        window.soundEngine.playClick();
        if (this.isUsingServer) {
            try {
                const resp = await fetch('/api/buy-case', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ case_id: caseId, quantity: qty }),
                });
                const data = await resp.json();
                if (resp.ok) {
                    this.state = data.state;
                    this.updateHUD();
                    window.marketManager.renderShop(this.state);
                    this.updateWorkbenchDropdown();
                    window.soundEngine.playCash();
                    return;
                } else {
                    alert(data.error || 'Failed to buy case');
                    return;
                }
            } catch (e) {
                console.warn('Server error, falling back to local:', e);
            }
        }

        // Local Buy Fallback
        const c = this.state.cases_catalog[caseId];
        const cost = c.price * qty;
        if (this.state.profile.balance < cost) {
            alert(`Insufficient funds. Need $${cost.toFixed(2)}, you have $${this.state.profile.balance.toFixed(2)}`);
            return;
        }
        this.state.profile.balance -= cost;
        this.state.profile.total_spent += cost;
        this.state.cases_owned[caseId] = (this.state.cases_owned[caseId] || 0) + qty;
        this.saveLocalState(this.state);
        this.updateHUD();
        window.marketManager.renderShop(this.state);
        this.updateWorkbenchDropdown();
        window.soundEngine.playCash();
    }

    async handleOpenSelectedCase() {
        const select = document.getElementById('workbench-case-select');
        const caseId = select ? select.value : 'assault_case';

        if (this.isUsingServer) {
            try {
                const resp = await fetch('/api/open-case', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ case_id: caseId }),
                });
                const data = await resp.json();
                if (resp.ok) {
                    this.warehouse.animateCaseOpen(1.2);
                    window.rouletteController.startSpin(data, (result) => {
                        this.state = result.user_state;
                        this.updateHUD();
                        this.updateWorkbenchDropdown();
                        this.setTurntableWeapon(result.won_skin.weapon, result.won_skin);
                        this.warehouse.resetCase();
                    });
                    return;
                } else {
                    alert(data.error || 'Could not open case');
                    return;
                }
            } catch (e) {
                console.warn('Server error, falling back to local open:', e);
            }
        }

        // Local Case Opening Fallback
        const owned = this.state.cases_owned[caseId] || 0;
        if (owned < 1) {
            alert(`You don't own any ${this.state.cases_catalog[caseId].name}. Please buy one from the PC Shop!`);
            return;
        }

        const simResult = this.simulateLocalCaseOpen(caseId);
        this.state.cases_owned[caseId] -= 1;
        this.state.profile.cases_opened += 1;
        const newInvItem = {
            id: Date.now(),
            skin_id: simResult.won_skin.id,
            skin_info: simResult.won_skin,
            condition: simResult.condition,
            float_value: simResult.float_value,
            unboxed_price: simResult.value,
            current_value: simResult.value,
        };
        this.state.inventory.unshift(newInvItem);
        this.saveLocalState(this.state);
        simResult.inventory_id = newInvItem.id;
        simResult.user_state = this.state;

        this.warehouse.animateCaseOpen(1.2);
        window.rouletteController.startSpin(simResult, (result) => {
            this.updateHUD();
            this.updateWorkbenchDropdown();
            this.setTurntableWeapon(result.won_skin.weapon, result.won_skin);
            this.warehouse.resetCase();
        });
    }

    simulateLocalCaseOpen(caseId) {
        const caseObj = this.state.cases_catalog[caseId];
        const allSkinsList = Object.values(this.state.all_skins);
        let eligible = allSkinsList.filter(s => caseObj.weapons.includes(s.weapon));
        if (caseId === 'legendary_case') {
            eligible = allSkinsList.filter(s => s.rarity === 'Legendary');
        }

        const odds = caseObj.odds;
        const rarities = Object.keys(odds);
        const weights = Object.values(odds);
        
        let rand = Math.random();
        let cumulative = 0;
        let chosenRarity = rarities[0];
        for (let i = 0; i < rarities.length; i++) {
            cumulative += weights[i];
            if (rand <= cumulative) {
                chosenRarity = rarities[i];
                break;
            }
        }

        let candidates = eligible.filter(s => s.rarity === chosenRarity);
        if (candidates.length === 0) candidates = eligible;
        const wonSkin = candidates[Math.floor(Math.random() * candidates.length)];

        const f = Math.random();
        let cond = "Field-Tested";
        let mult = 1.0;
        if (f < 0.07) { cond = "Factory New"; mult = 1.25; }
        else if (f < 0.15) { cond = "Minimal Wear"; mult = 1.10; }
        else if (f < 0.38) { cond = "Field-Tested"; mult = 1.00; }
        else if (f < 0.45) { cond = "Well-Worn"; mult = 0.88; }
        else { cond = "Battle-Scarred"; mult = 0.75; }

        const reel = [];
        for (let i = 0; i < 48; i++) {
            if (i === 38) reel.push(wonSkin);
            else reel.push(eligible[Math.floor(Math.random() * eligible.length)]);
        }

        const liveP = (window.marketManager && window.marketManager.marketData && window.marketManager.marketData.prices[wonSkin.id]) 
            ? window.marketManager.marketData.prices[wonSkin.id].price 
            : wonSkin.base_price;

        return {
            won_skin: wonSkin,
            condition: cond,
            float_value: f,
            value: Math.round(liveP * mult * 100) / 100,
            reel: reel,
            winner_index: 38,
        };
    }

    async sellItem(inventoryId, callback) {
        if (this.isUsingServer) {
            try {
                const resp = await fetch('/api/sell', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ inventory_id: inventoryId }),
                });
                const data = await resp.json();
                if (resp.ok) {
                    this.state = data.state;
                    this.updateHUD();
                    window.marketManager.renderInventory();
                    window.soundEngine.playCash();
                    if (callback) callback();
                    return;
                }
            } catch (e) {
                console.warn('Server error, falling back to local sell:', e);
            }
        }

        // Local Sell Fallback
        const idx = this.state.inventory.findIndex(i => i.id == inventoryId);
        if (idx !== -1) {
            const item = this.state.inventory[idx];
            const payout = item.current_value || item.unboxed_price;
            this.state.profile.balance += payout;
            this.state.profile.total_earned += payout;
            this.state.inventory.splice(idx, 1);
            this.saveLocalState(this.state);
            this.updateHUD();
            window.marketManager.renderInventory();
            window.soundEngine.playCash();
            if (callback) callback();
        }
    }

    async sellAllCommon() {
        if (this.isUsingServer) {
            try {
                const resp = await fetch('/api/sell-all-common', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
                const data = await resp.json();
                if (resp.ok) {
                    this.state = data.state;
                    this.updateHUD();
                    window.marketManager.renderInventory();
                    window.soundEngine.playCash();
                    alert(`Quick sold ${data.sold_count} Common skins for $${data.total_payout.toFixed(2)}!`);
                    return;
                }
            } catch (e) {
                console.warn('Server error, falling back to local sell all:', e);
            }
        }

        // Local Sell All Common Fallback
        let sold = 0;
        let total = 0;
        this.state.inventory = this.state.inventory.filter(item => {
            const skin = item.skin_info || this.state.all_skins[item.skin_id];
            if (skin && skin.rarity === 'Common') {
                const p = item.current_value || item.unboxed_price;
                total += p;
                sold++;
                return false;
            }
            return true;
        });

        if (sold > 0) {
            this.state.profile.balance += total;
            this.state.profile.total_earned += total;
            this.saveLocalState(this.state);
            this.updateHUD();
            window.marketManager.renderInventory();
            window.soundEngine.playCash();
            alert(`Quick sold ${sold} Common skins for $${total.toFixed(2)}!`);
        } else {
            alert('No common skins in inventory.');
        }
    }

    async addFunds(amount) {
        if (this.isUsingServer) {
            try {
                const resp = await fetch('/api/add-funds', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: amount }),
                });
                const data = await resp.json();
                if (resp.ok) {
                    this.state = data.state;
                    this.updateHUD();
                    window.soundEngine.playCash();
                    return;
                }
            } catch (e) {
                console.warn('Server error, falling back to local add funds:', e);
            }
        }

        // Local Add Funds Fallback
        this.state.profile.balance += amount;
        this.saveLocalState(this.state);
        this.updateHUD();
        window.soundEngine.playCash();
    }

    inspectWeapon(skin, condition) {
        this.setTurntableWeapon(skin.weapon, skin);
        this.switchStation('station-inspect');
        this.triggerInspectAnimation();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Camera lerp transition
        if (this.cameraLerp.active) {
            const elapsed = now - this.cameraLerp.startTime;
            const progress = Math.min(1, elapsed / this.cameraLerp.duration);
            // Smooth ease in-out
            const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            this.camera.position.lerpVectors(this.cameraLerp.startPos, this.cameraLerp.targetPos, ease);
            this.cameraLerp.currentLook.lerpVectors(this.cameraLerp.startLook, this.cameraLerp.targetLook, ease);
            this.camera.lookAt(this.cameraLerp.currentLook);

            if (progress >= 1) {
                this.cameraLerp.active = false;
            }
        }

        // Weapon turntable rotation & inspect tilt animation
        if (this.currentWeaponMesh) {
            if (!this.isDragging) {
                this.weaponRotation.y += delta * 0.45; // Gentle auto-spin
            }

            // Inspect tilt animation (like pressing F in CS:GO)
            let inspectRoll = 0;
            let inspectPitch = 0;
            if (this.isInspectAnimActive) {
                this.inspectAnimProgress += delta * 1.8;
                if (this.inspectAnimProgress > Math.PI * 2) {
                    this.isInspectAnimActive = false;
                    this.inspectAnimProgress = 0;
                } else {
                    inspectRoll = Math.sin(this.inspectAnimProgress) * 0.55;
                    inspectPitch = Math.cos(this.inspectAnimProgress) * 0.25;
                }
            }

            this.currentWeaponMesh.rotation.y = this.weaponRotation.y;
            this.currentWeaponMesh.rotation.x = this.weaponRotation.x + inspectPitch;
            this.currentWeaponMesh.rotation.z = inspectRoll;
        }

        // Update warehouse dust particles
        if (this.warehouse) {
            this.warehouse.update(delta);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
