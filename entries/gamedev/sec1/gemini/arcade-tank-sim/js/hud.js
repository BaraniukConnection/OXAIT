/**
 * Tactical HUD & Minimap Interface Engine
 * Arcade Tank Simulator
 * Handles:
 *  - 2D Canvas Tactical Minimap (with player, Hounds, and detection circles)
 *  - Dynamic Turret Traverse Crosshair & Reload Indicator
 *  - Gunner Sniper Optic Overlay (RMB) with mil-dots and rangefinder
 *  - Health, Speedometer, Objective Counter, and Floating Damage Numbers
 */

class HUD {
    constructor() {
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

        // HUD Elements
        this.hpFill = document.getElementById('hp-fill');
        this.hpText = document.getElementById('hp-text');
        this.speedText = document.getElementById('speed-value');
        this.gearText = document.getElementById('gear-value');
        this.reloadFill = document.getElementById('reload-fill');
        this.reloadText = document.getElementById('reload-text');
        this.targetsText = document.getElementById('targets-count');
        this.totalTargetsText = document.getElementById('targets-total');
        this.tankNameDisplay = document.getElementById('hud-tank-name');
        this.warningBanner = document.getElementById('hud-warning');
        this.sniperOverlay = document.getElementById('sniper-sight-overlay');
        this.rangeText = document.getElementById('sniper-range-text');
        this.compassText = document.getElementById('sniper-compass-text');
        this.hitMarker = document.getElementById('hit-marker');

        // Aim cursor elements
        this.cursorEl = document.getElementById('aim-cursor');
        this.gunAimEl = document.getElementById('gun-aim-cursor');

        // Floating damage numbers list
        this.damageNumbers = [];

        // Hit marker timer
        this.hitMarkerTimer = 0;
    }

    init(tankDef, totalHounds) {
        if (this.tankNameDisplay) {
            this.tankNameDisplay.textContent = tankDef.name.toUpperCase();
        }
        if (this.totalTargetsText) {
            this.totalTargetsText.textContent = totalHounds;
        }
        this.updateTargetsRemaining(totalHounds, totalHounds);
    }

    updateTargetsRemaining(remaining, total) {
        if (this.targetsText) {
            this.targetsText.textContent = remaining;
        }
    }

    updatePlayerStatus(currentHp, maxHp, speedKmH, isReverse, reloadFraction, isReloading) {
        // 1. HP Bar
        const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
        if (this.hpFill) {
            this.hpFill.style.width = `${hpPct}%`;
            if (hpPct > 50) {
                this.hpFill.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
            } else if (hpPct > 25) {
                this.hpFill.style.background = 'linear-gradient(90deg, #eab308, #facc15)';
            } else {
                this.hpFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
            }
        }
        if (this.hpText) {
            this.hpText.textContent = `${Math.ceil(currentHp)} / ${maxHp}`;
        }

        // 2. Speedometer
        if (this.speedText) {
            this.speedText.textContent = Math.abs(Math.round(speedKmH));
        }
        if (this.gearText) {
            if (Math.abs(speedKmH) < 0.5) {
                this.gearText.textContent = 'N';
            } else if (isReverse) {
                this.gearText.textContent = 'R';
            } else {
                this.gearText.textContent = 'D';
            }
        }

        // 3. Reload status
        if (this.reloadFill) {
            this.reloadFill.style.width = `${reloadFraction * 100}%`;
        }
        if (this.reloadText) {
            this.reloadText.textContent = isReloading ? 'RELOADING...' : 'READY TO FIRE';
            this.reloadText.style.color = isReloading ? '#f59e0b' : '#22c55e';
        }
    }

    setWarning(active, enemyCount = 1) {
        if (!this.warningBanner) return;
        if (active) {
            this.warningBanner.classList.remove('hidden');
            this.warningBanner.textContent = `⚠️ WARNING: TARGET ACQUIRED BY ${enemyCount} HOUND${enemyCount > 1 ? 'S' : ''}!`;
        } else {
            this.warningBanner.classList.add('hidden');
        }
    }

    setSightMode(isSniper, distanceMeters = 0, headingDeg = 0) {
        if (!this.sniperOverlay) return;
        if (isSniper) {
            this.sniperOverlay.classList.remove('hidden');
            if (this.rangeText) {
                this.rangeText.textContent = `RNG: ${Math.round(distanceMeters)}m`;
            }
            if (this.compassText) {
                const compassDirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                const idx = Math.round(((headingDeg % 360) + 360) % 360 / 45) % 8;
                this.compassText.textContent = `${Math.round(headingDeg)}° ${compassDirs[idx]}`;
            }
        } else {
            this.sniperOverlay.classList.add('hidden');
        }
    }

    triggerHitMarker() {
        if (!this.hitMarker) return;
        this.hitMarker.classList.remove('hidden');
        this.hitMarkerTimer = 0.22; // display for 220ms
    }

    spawnDamageNumber(screenX, screenY, amount, isCritical = false) {
        const el = document.createElement('div');
        el.className = 'damage-number';
        el.textContent = `-${amount}`;
        if (isCritical) {
            el.textContent = `-${amount} CRIT!`;
            el.style.color = '#ff3333';
            el.style.fontSize = '24px';
        }
        el.style.left = `${screenX}px`;
        el.style.top = `${screenY}px`;
        document.body.appendChild(el);

        this.damageNumbers.push({
            el: el,
            y: screenY,
            opacity: 1.0,
            life: 0.85
        });
    }

    update(dt) {
        // Update hit marker timer
        if (this.hitMarkerTimer > 0) {
            this.hitMarkerTimer -= dt;
            if (this.hitMarkerTimer <= 0 && this.hitMarker) {
                this.hitMarker.classList.add('hidden');
            }
        }

        // Update floating damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.life -= dt;
            dn.y -= dt * 45; // float upward
            dn.opacity = Math.max(0, dn.life / 0.85);

            dn.el.style.top = `${dn.y}px`;
            dn.el.style.opacity = dn.opacity;

            if (dn.life <= 0) {
                if (dn.el.parentNode) dn.el.parentNode.removeChild(dn.el);
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    /**
     * Render 2D Tactical Minimap
     */
    drawMinimap(cityMap, playerTank, hounds) {
        if (!this.minimapCtx || !this.minimapCanvas) return;
        const ctx = this.minimapCtx;
        const width = this.minimapCanvas.width;
        const height = this.minimapCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Minimap scale: mapSize (e.g. 360m) to canvas (e.g. 180px)
        const scale = width / cityMap.mapSize;
        const cx = width / 2;
        const cy = height / 2;

        const toMapX = (worldX) => cx + worldX * scale;
        const toMapY = (worldZ) => cy + worldZ * scale;

        // 1. Background grid
        ctx.fillStyle = '#14181c';
        ctx.fillRect(0, 0, width, height);

        // 2. City Buildings Colliders
        ctx.fillStyle = '#2f3844';
        for (let i = 0; i < cityMap.colliders.length; i++) {
            const c = cityMap.colliders[i];
            const x = toMapX(c.minX);
            const y = toMapY(c.minZ);
            const w = (c.maxX - c.minX) * scale;
            const h = (c.maxZ - c.minZ) * scale;
            ctx.fillRect(x, y, Math.max(w, 1.5), Math.max(h, 1.5));
        }

        // 3. Hound Detection Circles & Markers
        for (let i = 0; i < hounds.length; i++) {
            const hound = hounds[i];
            if (hound.isDestroyed) continue;

            const hx = toMapX(hound.root.position.x);
            const hy = toMapY(hound.root.position.z);
            const rPx = hound.def.mechanics.detectionRadius * scale;

            // View circle perimeter
            ctx.beginPath();
            ctx.arc(hx, hy, rPx, 0, Math.PI * 2);
            ctx.strokeStyle = hound.isAttacking ? 'rgba(239, 68, 68, 0.65)' : 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Soft circle fill if alert
            if (hound.isAttacking) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                ctx.fill();
            }

            // Hound red diamond marker
            ctx.save();
            ctx.translate(hx, hy);
            ctx.fillStyle = hound.isAttacking ? '#ff2222' : '#e11d48';
            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.lineTo(4, 0);
            ctx.lineTo(0, 4);
            ctx.lineTo(-4, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 4. Player Tank Marker (Friendly Green with orientation arrow)
        if (playerTank && !playerTank.isDestroyed) {
            const px = toMapX(playerTank.root.position.x);
            const py = toMapY(playerTank.root.position.z);

            ctx.save();
            ctx.translate(px, py);

            // Hull heading rotation
            ctx.rotate(playerTank.root.rotation.y);

            // Tank hull icon
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(0, 6);
            ctx.lineTo(4, -4);
            ctx.lineTo(0, -2);
            ctx.lineTo(-4, -4);
            ctx.closePath();
            ctx.fill();

            // Turret aim line
            ctx.rotate(playerTank.turret.rotation.y);
            ctx.strokeStyle = '#86efac';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 10);
            ctx.stroke();

            ctx.restore();
        }

        // 5. Radar border ring
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);
    }
}

window.HUD = HUD;
