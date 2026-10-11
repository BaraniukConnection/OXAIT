/**
 * Procedural Skin Texture & Material Generator
 * Generates dynamic Canvas textures for all 5 skin patterns, 2 color variants, and 2 unique geometric designs
 */

class SkinTextureGenerator {
    constructor() {
        this.cache = {};
    }

    getMaterial(skin) {
        if (!skin) {
            return new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.5 });
        }

        const cacheKey = skin.id;
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Draw skin design based on pattern & geometric design
        this.renderSkinTexture(ctx, skin);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        let metalness = 0.35;
        let roughness = 0.45;

        if (skin.pattern === 'Royal Damascus') {
            metalness = 0.85;
            roughness = 0.22;
        } else if (skin.pattern === 'Cyber Net') {
            metalness = 0.55;
            roughness = 0.32;
        } else if (skin.pattern === 'Poly-Tech') {
            metalness = 0.20;
            roughness = 0.38;
        } else if (skin.pattern === 'Dragon Inferno') {
            metalness = 0.40;
            roughness = 0.35;
        }

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: roughness,
            metalness: metalness,
        });

        this.cache[cacheKey] = material;
        return material;
    }

    renderSkinTexture(ctx, skin) {
        const w = 1024;
        const h = 1024;
        const pCol = skin.primary_color || '#222222';
        const sCol = skin.secondary_color || '#888888';
        const aCol = skin.accent_color || '#ffffff';
        const geom = skin.geom_design || '';

        // Base fill
        ctx.fillStyle = pCol;
        ctx.fillRect(0, 0, w, h);

        // Subtle gun metal noise / brushed metal background
        this.addBrushedTexture(ctx, w, h);

        // Pattern specific procedural rendering
        if (skin.pattern === 'Digital Grid') {
            if (geom.includes('Hexagonal')) {
                this.drawHexGrid(ctx, w, h, sCol, aCol);
            } else {
                this.drawSplinterShards(ctx, w, h, sCol, aCol);
            }
        } else if (skin.pattern === 'Cyber Net') {
            if (geom.includes('Circuit')) {
                this.drawCircuitTraces(ctx, w, h, sCol, aCol);
            } else {
                this.drawChevronGlitch(ctx, w, h, sCol, aCol);
            }
        } else if (skin.pattern === 'Dragon Inferno') {
            this.drawDragonInferno(ctx, w, h, sCol, aCol);
        } else if (skin.pattern === 'Poly-Tech') {
            this.drawPolyTechAsiimov(ctx, w, h, sCol, aCol);
        } else if (skin.pattern === 'Royal Damascus') {
            this.drawRoyalDamascus(ctx, w, h, sCol, aCol);
        }

        // Overlay gun technical serial & weapon branding decals
        this.addTacticalMarkings(ctx, w, h, skin);
    }

    addBrushedTexture(ctx, w, h) {
        ctx.save();
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 120; i++) {
            const y = Math.random() * h;
            ctx.fillRect(0, y, w, Math.random() * 3 + 1);
        }
        ctx.restore();
    }

    // Pattern 1 - Design A: Hexagonal Grid (Urban Ghost)
    drawHexGrid(ctx, w, h, sCol, aCol) {
        const hexRadius = 42;
        const dx = hexRadius * 1.732;
        const dy = hexRadius * 1.5;

        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = sCol;

        for (let y = -20; y < h + 50; y += dy) {
            const row = Math.floor(y / dy);
            const xOffset = (row % 2 === 0) ? 0 : dx / 2;
            for (let x = -20; x < w + 50; x += dx) {
                const cx = x + xOffset;
                const cy = y;

                // Randomly highlight select hexagons with camo shades
                const rand = (Math.sin(cx * 0.02) + Math.cos(cy * 0.02) + 2) / 4;
                if (rand > 0.65) {
                    ctx.fillStyle = aCol;
                    ctx.globalAlpha = 0.28;
                    this.drawHexPath(ctx, cx, cy, hexRadius - 4);
                    ctx.fill();
                } else if (rand > 0.4) {
                    ctx.fillStyle = sCol;
                    ctx.globalAlpha = 0.18;
                    this.drawHexPath(ctx, cx, cy, hexRadius - 4);
                    ctx.fill();
                }

                ctx.globalAlpha = 0.45;
                ctx.strokeStyle = sCol;
                this.drawHexPath(ctx, cx, cy, hexRadius);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    drawHexPath(ctx, x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const hx = x + r * Math.cos(angle);
            const hy = y + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
    }

    // Pattern 1 - Design B: Splinter Shards (Tundra Splinter)
    drawSplinterShards(ctx, w, h, sCol, aCol) {
        ctx.save();
        const numShards = 45;
        for (let i = 0; i < numShards; i++) {
            ctx.beginPath();
            const sx = Math.random() * w;
            const sy = Math.random() * h;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (Math.random() - 0.5) * 320, sy + (Math.random() - 0.5) * 320);
            ctx.lineTo(sx + (Math.random() - 0.5) * 280, sy + (Math.random() - 0.5) * 280);
            ctx.closePath();

            ctx.fillStyle = (i % 2 === 0) ? sCol : aCol;
            ctx.globalAlpha = 0.25 + (Math.random() * 0.4);
            ctx.fill();
            ctx.strokeStyle = '#111111';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    }

    // Pattern 2 - Design A: Circuit Traces (Neon Pulse)
    drawCircuitTraces(ctx, w, h, sCol, aCol) {
        ctx.save();
        ctx.strokeStyle = sCol;
        ctx.lineWidth = 4;
        ctx.shadowColor = sCol;
        ctx.shadowBlur = 12;

        for (let i = 0; i < 35; i++) {
            let cx = Math.random() * w;
            let cy = Math.random() * h;
            ctx.beginPath();
            ctx.moveTo(cx, cy);

            const steps = Math.floor(Math.random() * 4) + 2;
            for (let s = 0; s < steps; s++) {
                const dir = Math.floor(Math.random() * 4);
                const len = 60 + Math.random() * 120;
                if (dir === 0) cx += len;
                else if (dir === 1) cx -= len;
                else if (dir === 2) cy += len;
                else cy -= len;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();

            // Circuit node pin
            ctx.fillStyle = aCol;
            ctx.beginPath();
            ctx.arc(cx, cy, 7, 0, Math.PI * 2);
            ctx.fill();
        }

        // Cyber holographic stripes
        ctx.fillStyle = aCol;
        ctx.globalAlpha = 0.2;
        for (let y = 80; y < h; y += 180) {
            ctx.fillRect(0, y, w, 22);
        }
        ctx.restore();
    }

    // Pattern 2 - Design B: Chevron Glitch (Acid Matrix)
    drawChevronGlitch(ctx, w, h, sCol, aCol) {
        ctx.save();
        ctx.lineWidth = 14;
        ctx.strokeStyle = sCol;

        for (let y = -100; y < h + 200; y += 75) {
            ctx.beginPath();
            for (let x = -50; x < w + 100; x += 100) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + 50, y + 45);
                ctx.lineTo(x + 100, y);
            }
            ctx.stroke();
        }

        // Glitch slice bands
        ctx.fillStyle = aCol;
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < 18; i++) {
            const gy = Math.random() * h;
            const gw = 120 + Math.random() * 400;
            const gx = Math.random() * (w - gw);
            ctx.fillRect(gx, gy, gw, 16);
        }
        ctx.restore();
    }

    // Pattern 3: Dragon Inferno / Solar Flare
    drawDragonInferno(ctx, w, h, sCol, aCol) {
        ctx.save();
        // Flame gradients
        const grad = ctx.createLinearGradient(0, h, w, 0);
        grad.addColorStop(0, '#2a0303');
        grad.addColorStop(0.4, sCol);
        grad.addColorStop(0.85, aCol);
        grad.addColorStop(1, '#ffffff');

        // Scale layers
        ctx.fillStyle = grad;
        const rows = 16;
        const cols = 20;
        const cellW = w / cols;
        const cellH = h / rows;

        for (let r = 0; r < rows; r++) {
            const offset = (r % 2 === 0) ? 0 : cellW / 2;
            for (let c = 0; c < cols; c++) {
                const x = c * cellW + offset;
                const y = r * cellH;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.quadraticCurveTo(x + cellW / 2, y + cellH * 1.5, x + cellW, y);
                ctx.closePath();
                ctx.globalAlpha = 0.4 + (Math.sin(r * 0.4 + c * 0.3) + 1) * 0.25;
                ctx.fill();
                ctx.strokeStyle = '#150000';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Geometric flame tongues
        ctx.fillStyle = aCol;
        ctx.globalAlpha = 0.65;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            const bx = Math.random() * w;
            ctx.moveTo(bx, h);
            ctx.lineTo(bx - 40, h - 350 - Math.random() * 250);
            ctx.lineTo(bx + 15, h - 500 - Math.random() * 300);
            ctx.lineTo(bx + 60, h);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    // Pattern 4: Poly-Tech / Hyper Hazard (Asiimov Style)
    drawPolyTechAsiimov(ctx, w, h, sCol, aCol) {
        ctx.save();
        // Clean white / light ceramic base
        ctx.fillStyle = '#f4f4f7';
        ctx.fillRect(0, 0, w, h);

        // Bold asymmetric hazard orange diagonal blocks
        ctx.fillStyle = sCol; // Hazard Orange
        ctx.beginPath();
        ctx.moveTo(0, 180);
        ctx.lineTo(600, 0);
        ctx.lineTo(750, 0);
        ctx.lineTo(0, 420);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(w, 400);
        ctx.lineTo(w - 500, h);
        ctx.lineTo(w - 280, h);
        ctx.lineTo(w, 560);
        ctx.closePath();
        ctx.fill();

        // Technical deep onyx stripes
        ctx.fillStyle = aCol; // Onyx
        ctx.beginPath();
        ctx.moveTo(100, 0);
        ctx.lineTo(450, 0);
        ctx.lineTo(0, 260);
        ctx.lineTo(0, 180);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(w - 40, 120);
        ctx.lineTo(w, 120);
        ctx.lineTo(w, 800);
        ctx.lineTo(w - 180, 800);
        ctx.closePath();
        ctx.fill();

        // High-tech crosshairs and hazard stripes
        ctx.strokeStyle = aCol;
        ctx.lineWidth = 5;
        for (let i = 0; i < 6; i++) {
            ctx.strokeRect(700 + i * 25, 450, 12, 60);
        }

        // Diagonal hazard bar
        ctx.fillStyle = sCol;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            const bx = 150 + i * 45;
            ctx.moveTo(bx, 750);
            ctx.lineTo(bx + 25, 750);
            ctx.lineTo(bx - 10, 820);
            ctx.lineTo(bx - 35, 820);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    // Pattern 5: Royal Damascus / Imperial Obsidian
    drawRoyalDamascus(ctx, w, h, sCol, aCol) {
        ctx.save();
        // Dark metallic obsidian base
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, w, h);

        // Folded steel wave contours
        ctx.strokeStyle = '#1e2433';
        ctx.lineWidth = 3;
        for (let y = 0; y < h; y += 12) {
            ctx.beginPath();
            for (let x = 0; x < w; x += 20) {
                const waveY = y + Math.sin(x * 0.02 + y * 0.04) * 16 + Math.cos(x * 0.04) * 8;
                if (x === 0) ctx.moveTo(x, waveY);
                else ctx.lineTo(x, waveY);
            }
            ctx.stroke();
        }

        // Pure Gold Guilloche filigree & ornate geometric borders
        ctx.strokeStyle = sCol; // Gold
        ctx.lineWidth = 4;
        ctx.shadowColor = sCol;
        ctx.shadowBlur = 8;

        // Circular Guilloche rosettes
        const rosettes = [
            { x: 300, y: 300, r: 140 },
            { x: 750, y: 400, r: 180 },
            { x: 450, y: 750, r: 160 },
        ];

        rosettes.forEach(ros => {
            const petals = 12;
            for (let p = 0; p < petals; p++) {
                const angle = (Math.PI * 2 / petals) * p;
                ctx.beginPath();
                ctx.ellipse(
                    ros.x + Math.cos(angle) * (ros.r * 0.4),
                    ros.y + Math.sin(angle) * (ros.r * 0.4),
                    ros.r * 0.5,
                    ros.r * 0.25,
                    angle,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(ros.x, ros.y, ros.r * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Ornate border bands
        ctx.strokeRect(60, 60, w - 120, h - 120);
        ctx.strokeRect(80, 80, w - 160, h - 160);
        ctx.restore();
    }

    addTacticalMarkings(ctx, w, h, skin) {
        ctx.save();
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.55;

        // Weapon name & telemetry
        ctx.fillText(`CS:GO SPEC // ${skin.weapon_label.toUpperCase()}`, 120, 110);
        ctx.fillText(`DESIGN: ${skin.name.toUpperCase()} // PATTERN 0${skin.id.slice(-2)}`, 120, 140);
        ctx.fillText(`RARITY: ${skin.rarity.toUpperCase()}`, 120, 170);

        // Barcode
        const barX = 120;
        const barY = 200;
        for (let i = 0; i < 40; i++) {
            const bw = Math.random() > 0.5 ? 4 : 2;
            ctx.fillRect(barX + i * 6, barY, bw, 32);
        }
        ctx.fillText('SN: 489-0294-X', barX, barY + 52);
        ctx.restore();
    }
}

window.skinTextureGenerator = new SkinTextureGenerator();
