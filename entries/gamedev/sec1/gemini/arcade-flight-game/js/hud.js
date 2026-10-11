// Fighter Jet Heads-Up Display (HUD) & Tactical Radar
// Artificial horizon, speed/alt tapes, weapon status, radar lock circle, 3D target boxes

class FlightHUD {
    constructor() {
        this.canvas = document.getElementById('hud-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.radarCanvas = document.getElementById('radar-canvas');
        this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.warningTimer = 0;
    }

    resize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
        if (this.radarCanvas) {
            this.radarCanvas.width = 240;
            this.radarCanvas.height = 240;
        }
    }

    render(player, camera, terrain, enemies, weaponSystem) {
        if (!this.ctx || !player || !player.mesh) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        // 1. Artificial Horizon & Pitch Ladder
        this.renderHorizon(ctx, cx, cy, player);

        // 2. Flight Path Marker & Center Crosshair
        this.renderCrosshair(ctx, cx, cy);

        // 3. Airspeed (Left) & Altitude (Right) Tapes
        this.renderFlightTapes(ctx, cx, cy, player, terrain);

        // 4. Radar Lock Circle (prominent for Vulture, useful for all)
        this.renderRadarLockCircle(ctx, cx, cy, weaponSystem);

        // 5. 3D In-World Target Brackets around Rogues
        this.renderTargetBrackets(ctx, camera, enemies, weaponSystem, w, h);

        // 6. Warnings (Terrain Pull Up, Missile Incoming)
        this.renderWarnings(ctx, cx, cy, player, terrain, weaponSystem);

        // 7. Tactical Radar / Minimap
        this.renderTacticalRadar(player, enemies, terrain);
    }

    renderHorizon(ctx, cx, cy, player) {
        ctx.save();
        ctx.translate(cx, cy);

        // Calculate pitch and roll from mesh quaternion
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.mesh.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(player.mesh.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(player.mesh.quaternion);

        // Roll angle (bank)
        const roll = Math.atan2(right.y, up.y);
        // Pitch angle
        const pitch = Math.asin(Math.max(-1, Math.min(1, forward.y)));

        ctx.rotate(-roll);

        ctx.strokeStyle = '#00ff88';
        ctx.fillStyle = '#00ff88';
        ctx.lineWidth = 1.5;
        ctx.font = '11px monospace';

        const pitchOffset = pitch * (cy * 1.6);

        // Pitch ladder lines (-60 to +60 degrees in 10 deg steps)
        const stepPx = (cy * 1.6) * (10 * Math.PI / 180);

        for (let deg = -60; deg <= 60; deg += 10) {
            if (deg === 0) {
                // Horizon center line
                ctx.beginPath();
                ctx.moveTo(-130, pitchOffset);
                ctx.lineTo(-30, pitchOffset);
                ctx.moveTo(30, pitchOffset);
                ctx.lineTo(130, pitchOffset);
                ctx.stroke();
            } else {
                const y = pitchOffset - (deg / 10) * stepPx;
                if (Math.abs(y) < cy * 0.7) {
                    const lineLen = 45;
                    ctx.beginPath();
                    // Ladder bars with notch
                    ctx.moveTo(-lineLen, y);
                    ctx.lineTo(-15, y);
                    ctx.moveTo(15, y);
                    ctx.lineTo(lineLen, y);

                    // Downward or upward tick
                    const tick = deg > 0 ? 5 : -5;
                    ctx.moveTo(-lineLen, y);
                    ctx.lineTo(-lineLen, y + tick);
                    ctx.moveTo(lineLen, y);
                    ctx.lineTo(lineLen, y + tick);

                    ctx.stroke();
                    ctx.fillText(deg.toString(), lineLen + 6, y + 4);
                    ctx.fillText(deg.toString(), -lineLen - 24, y + 4);
                }
            }
        }

        ctx.restore();
    }

    renderCrosshair(ctx, cx, cy) {
        ctx.save();
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;

        // Boresight cross
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy);
        ctx.lineTo(cx - 5, cy);
        ctx.moveTo(cx + 5, cy);
        ctx.lineTo(cx + 15, cy);
        ctx.moveTo(cx, cy - 15);
        ctx.lineTo(cx, cy - 5);
        ctx.moveTo(cx, cy + 5);
        ctx.lineTo(cx, cy + 15);
        ctx.stroke();

        // Flight Path Marker ring
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    renderFlightTapes(ctx, cx, cy, player, terrain) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
        ctx.fillStyle = '#00ff88';
        ctx.lineWidth = 1.5;
        ctx.font = '13px monospace';

        // Speed (Knots / m/s) on the left
        const speedKts = Math.round(player.speed * 1.94384);
        const tapeXLeft = cx - 240;

        ctx.strokeRect(tapeXLeft - 40, cy - 100, 70, 200);
        ctx.fillStyle = 'rgba(0, 30, 20, 0.4)';
        ctx.fillRect(tapeXLeft - 40, cy - 100, 70, 200);

        ctx.fillStyle = '#00ff88';
        ctx.fillText("SPD", tapeXLeft - 22, cy - 110);
        ctx.font = 'bold 18px monospace';
        ctx.fillText(speedKts.toString(), tapeXLeft - 30, cy + 6);
        ctx.font = '11px monospace';
        ctx.fillText("KTS", tapeXLeft + 8, cy + 6);

        // Speed increments
        ctx.font = '10px monospace';
        for (let s = -2; s <= 2; s++) {
            if (s !== 0) {
                const spdVal = Math.round(speedKts + s * 30);
                const sy = cy - s * 35;
                ctx.fillText(spdVal.toString(), tapeXLeft - 30, sy + 3);
            }
        }

        // Altitude on the right
        const altMeters = Math.round(player.mesh.position.y);
        const tapeXRight = cx + 240;

        ctx.strokeRect(tapeXRight - 30, cy - 100, 70, 200);
        ctx.fillStyle = 'rgba(0, 30, 20, 0.4)';
        ctx.fillRect(tapeXRight - 30, cy - 100, 70, 200);

        ctx.fillStyle = '#00ff88';
        ctx.fillText("ALT", tapeXRight - 12, cy - 110);
        ctx.font = 'bold 18px monospace';
        ctx.fillText(altMeters.toString(), tapeXRight - 22, cy + 6);
        ctx.font = '11px monospace';
        ctx.fillText("M", tapeXRight + 24, cy + 6);

        // Ground clearance
        const groundY = Math.round(terrain.getTerrainHeight(player.mesh.position.x, player.mesh.position.z));
        const clearance = Math.max(0, altMeters - groundY);
        ctx.fillText(`RALT ${clearance}M`, tapeXRight - 28, cy + 125);

        // G-Force readout
        ctx.font = '12px monospace';
        ctx.fillText(`G: ${player.gForce.toFixed(1)}`, cx - 235, cy + 125);

        ctx.restore();
    }

    renderRadarLockCircle(ctx, cx, cy, weaponSystem) {
        // Vulture has dedicated Radar Guided Missile circle, but active for missile aiming
        const isVulture = (weaponSystem.planeType === 'Vulture');
        const radius = Math.min(cx, cy) * 0.38;

        ctx.save();
        ctx.setLineDash(isVulture ? [8, 6] : [4, 8]);
        ctx.lineWidth = isVulture ? 2.5 : 1.2;

        if (isVulture) {
            ctx.strokeStyle = weaponSystem.isInsideRadarCircle ? '#00ffff' : 'rgba(0, 255, 255, 0.4)';
            ctx.fillStyle = weaponSystem.isInsideRadarCircle ? '#00ffff' : 'rgba(0, 255, 255, 0.6)';
        } else {
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
            ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (isVulture) {
            ctx.setLineDash([]);
            ctx.font = '10px monospace';
            const label = weaponSystem.isInsideRadarCircle ? "RADAR LOCK OPTIMAL [MAX AGILITY]" : "RADAR LOCK CIRCLE";
            ctx.fillText(label, cx - ctx.measureText(label).width / 2, cy - radius - 10);
        }

        ctx.restore();
    }

    renderTargetBrackets(ctx, camera, enemies, weaponSystem, w, h) {
        if (!enemies || enemies.length === 0) return;

        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();
        projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        ctx.save();
        ctx.font = 'bold 11px monospace';

        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const enemyPos = enemy.mesh.position;
            if (!frustum.containsPoint(enemyPos)) continue;

            // Project to screen 2D coordinates
            const screenVec = enemyPos.clone().project(camera);
            if (screenVec.z > 1.0) continue; // Behind camera

            const sx = (screenVec.x * 0.5 + 0.5) * w;
            const sy = (-(screenVec.y * 0.5) + 0.5) * h;

            const dist = Math.round(camera.position.distanceTo(enemyPos));
            const isCurrentLock = (weaponSystem.lockedTarget === enemy);
            const isSolidLock = (isCurrentLock && weaponSystem.isLocked);
            const isAcquiring = (isCurrentLock && !weaponSystem.isLocked);

            // Multilock target highlight for Falcon
            const isMultiTarget = weaponSystem.multilockTargets.includes(enemy);

            const boxColor = isSolidLock ? '#ff3333' : (isAcquiring || isMultiTarget ? '#ffd700' : 'rgba(255, 80, 80, 0.7)');
            ctx.strokeStyle = boxColor;
            ctx.fillStyle = boxColor;
            ctx.lineWidth = isSolidLock ? 2.5 : 1.5;

            const boxSize = isSolidLock ? 38 : 28;

            // Diamond / brackets around target
            if (isSolidLock) {
                // Red locked diamond with corner brackets
                ctx.beginPath();
                ctx.moveTo(sx, sy - boxSize);
                ctx.lineTo(sx + boxSize, sy);
                ctx.lineTo(sx, sy + boxSize);
                ctx.lineTo(sx - boxSize, sy);
                ctx.closePath();
                ctx.stroke();

                ctx.fillText("LOCK", sx + boxSize + 6, sy - 5);
            } else {
                // Corner brackets
                const b = boxSize;
                const c = 8;
                ctx.beginPath();
                // Top left
                ctx.moveTo(sx - b, sy - b + c); ctx.lineTo(sx - b, sy - b); ctx.lineTo(sx - b + c, sy - b);
                // Top right
                ctx.moveTo(sx + b - c, sy - b); ctx.lineTo(sx + b, sy - b); ctx.lineTo(sx + b, sy - b + c);
                // Bottom left
                ctx.moveTo(sx - b, sy + b - c); ctx.lineTo(sx - b, sy + b); ctx.lineTo(sx - b + c, sy + b);
                // Bottom right
                ctx.moveTo(sx + b - c, sy + b); ctx.lineTo(sx + b, sy + b); ctx.lineTo(sx + b, sy + b - c);
                ctx.stroke();

                if (isAcquiring) {
                    ctx.fillText("TRACKING...", sx + b + 6, sy - 5);
                }
            }

            // Target Name & Distance
            ctx.fillText(`${enemy.name.toUpperCase()} [${dist}M]`, sx - 45, sy + boxSize + 16);

            // Health bar above target
            const hpRatio = Math.max(0, enemy.health / enemy.maxHealth);
            const barW = 50;
            ctx.strokeRect(sx - barW / 2, sy - boxSize - 12, barW, 5);
            ctx.fillStyle = (hpRatio > 0.4) ? '#ff3b30' : '#ff9500';
            ctx.fillRect(sx - barW / 2 + 1, sy - boxSize - 11, (barW - 2) * hpRatio, 3);
        }

        ctx.restore();
    }

    renderWarnings(ctx, cx, cy, player, terrain, weaponSystem) {
        const altMeters = player.mesh.position.y;
        const groundY = terrain.getTerrainHeight(player.mesh.position.x, player.mesh.position.z);
        const clearance = altMeters - groundY;

        ctx.save();
        ctx.font = 'bold 24px monospace';

        // 1. Terrain Pull Up Alarm (if clearance < 55m and heading downward)
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.mesh.quaternion);
        if (clearance < 60 && (forward.y < -0.05 || clearance < 30)) {
            const blink = (Date.now() % 400 > 200);
            if (blink) {
                ctx.fillStyle = '#ff2222';
                const txt = "PULL UP! TERRAIN";
                ctx.fillText(txt, cx - ctx.measureText(txt).width / 2, cy + 90);
            }
            if (window.soundEngine) window.soundEngine.setWarningAlarm(true, true);
        } else {
            // Check incoming enemy missiles
            let incomingMissile = false;
            if (weaponSystem && weaponSystem.missiles) {
                for (const m of weaponSystem.missiles) {
                    if (m.isEnemy && m.mesh.position.distanceTo(player.mesh.position) < 600) {
                        incomingMissile = true;
                        break;
                    }
                }
            }

            if (incomingMissile) {
                const blink = (Date.now() % 300 > 150);
                if (blink) {
                    ctx.fillStyle = '#ff0033';
                    const txt = "WARNING: MISSILE INCOMING";
                    ctx.fillText(txt, cx - ctx.measureText(txt).width / 2, cy - 120);
                }
                if (window.soundEngine) window.soundEngine.setWarningAlarm(true, true);
            } else {
                if (window.soundEngine) window.soundEngine.setWarningAlarm(false);
            }
        }

        ctx.restore();
    }

    renderTacticalRadar(player, enemies, terrain) {
        if (!this.radarCtx) return;
        const rctx = this.radarCtx;
        const rw = this.radarCanvas.width;
        const rh = this.radarCanvas.height;
        const rcx = rw / 2;
        const rcy = rh / 2;

        rctx.clearRect(0, 0, rw, rh);

        // Circular Radar Scope
        rctx.fillStyle = 'rgba(10, 24, 20, 0.75)';
        rctx.beginPath();
        rctx.arc(rcx, rcy, rcx - 6, 0, Math.PI * 2);
        rctx.fill();

        rctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
        rctx.lineWidth = 1.5;
        rctx.stroke();

        // Range rings (500m, 1000m, 1500m)
        const radarRange = 1600; // 1600 meters radar radius
        const scale = (rcx - 12) / radarRange;

        rctx.setLineDash([3, 4]);
        rctx.strokeStyle = 'rgba(0, 255, 136, 0.25)';
        [500, 1000, 1500].forEach(r => {
            rctx.beginPath();
            rctx.arc(rcx, rcy, r * scale, 0, Math.PI * 2);
            rctx.stroke();
        });
        rctx.setLineDash([]);

        // Crosshairs
        rctx.beginPath();
        rctx.moveTo(rcx, 10); rctx.lineTo(rcx, rh - 10);
        rctx.moveTo(10, rcy); rctx.lineTo(rw - 10, rcy);
        rctx.stroke();

        // Player heading rotation (radar is heading-up)
        const pPos = player.mesh.position;
        const pForward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.mesh.quaternion);
        const headingAngle = Math.atan2(pForward.x, -pForward.z);

        // Draw Rogue Patrol Zone Boundaries on radar
        if (terrain && terrain.zoneRings) {
            for (const z of terrain.zoneRings) {
                // Position relative to player
                const dx = z.center.x - pPos.x;
                const dz = z.center.z - pPos.z;

                // Rotate by heading so radar is heading-up
                const rx = dx * Math.cos(-headingAngle) - dz * Math.sin(-headingAngle);
                const ry = dx * Math.sin(-headingAngle) + dz * Math.cos(-headingAngle);

                const mapX = rcx + rx * scale;
                const mapY = rcy + ry * scale;
                const mapRadius = z.radius * scale;

                rctx.strokeStyle = 'rgba(255, 59, 48, 0.4)';
                rctx.lineWidth = 1.5;
                rctx.beginPath();
                rctx.arc(mapX, mapY, mapRadius, 0, Math.PI * 2);
                rctx.stroke();
            }
        }

        // Draw Enemies on radar
        if (enemies) {
            for (const e of enemies) {
                if (!e.isAlive) continue;

                const dx = e.mesh.position.x - pPos.x;
                const dz = e.mesh.position.z - pPos.z;

                const rx = dx * Math.cos(-headingAngle) - dz * Math.sin(-headingAngle);
                const ry = dx * Math.sin(-headingAngle) + dz * Math.cos(-headingAngle);

                const mapX = rcx + rx * scale;
                const mapY = rcy + ry * scale;

                // Check within radar display bounds
                if (Math.hypot(mapX - rcx, mapY - rcy) < rcx - 10) {
                    rctx.fillStyle = (e.state === 'ATTACK') ? '#ff2222' : '#ffcc00';
                    rctx.beginPath();
                    rctx.arc(mapX, mapY, 3.5, 0, Math.PI * 2);
                    rctx.fill();
                }
            }
        }

        // Player icon in center (Green triangle pointing UP)
        rctx.fillStyle = '#00ff88';
        rctx.beginPath();
        rctx.moveTo(rcx, rcy - 7);
        rctx.lineTo(rcx - 5, rcy + 6);
        rctx.lineTo(rcx, rcy + 3);
        rctx.lineTo(rcx + 5, rcy + 6);
        rctx.closePath();
        rctx.fill();

        // North indicator 'N'
        const northX = rcx + Math.sin(-headingAngle) * (rcx - 18);
        const northY = rcy - Math.cos(-headingAngle) * (rcy - 18);
        rctx.fillStyle = '#ffffff';
        rctx.font = 'bold 10px monospace';
        rctx.fillText("N", northX - 3, northY + 3);
    }
}

window.FlightHUD = FlightHUD;
