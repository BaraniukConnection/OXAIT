// 2D canvas HUD drawn over the 3D view.
import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { HALF } from './world.js';

const GREEN = '#86ffaa', RED = '#ff4d4d', AMBER = '#ffd36b', WHITE = '#e8f4ff';
const _v = new THREE.Vector3(), _c = new THREE.Vector3();

export class Hud {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.dpr = dpr;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.cv.width = this.W * dpr;
    this.cv.height = this.H * dpr;
    this.cv.style.width = this.W + 'px';
    this.cv.style.height = this.H + 'px';
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  }

  // world -> screen; returns null when behind the camera
  project(p, cam) {
    _c.copy(p).applyMatrix4(cam.matrixWorldInverse);
    if (_c.z > -1) return null;
    _v.copy(p).project(cam);
    return { x: (_v.x * 0.5 + 0.5) * this.W, y: (-_v.y * 0.5 + 0.5) * this.H };
  }

  text(t, x, y, { color = GREEN, size = 14, align = 'left', weight = 600, base = 'alphabetic' } = {}) {
    const c = this.ctx;
    c.font = `${weight} ${size}px "Bahnschrift", "DIN Alternate", "Roboto Condensed", "Arial Narrow", sans-serif`;
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = base;
    c.fillText(t, x, y);
  }

  draw(game, cam, opts) {
    this.clear();
    const c = this.ctx, p = game.player, W = this.W, H = this.H;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.lineWidth = 1.6;
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = 3;

    if (game.hitFlash > 0) {
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,30,20,${game.hitFlash * 0.7})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }

    const fwd = p.fwd(new THREE.Vector3());
    const bore = this.project(_v.copy(p.pos).addScaledVector(fwd, 1500), cam) || { x: W / 2, y: H / 2 };

    if (p.alive) {
      this.pitchLadder(p, cam, fwd);
      this.boresight(bore);
      this.weaponReticle(game, cam, bore);
    }
    this.targets(game, cam);
    this.leftRight(game);
    this.compass(p, fwd);
    this.topLeft(game);
    this.weaponsPanel(game);
    this.radar(game, fwd);
    this.warnings(game);
    this.messages(game);
    if (opts.paused) this.text('PAUSED', W / 2, H * 0.3, { size: 36, align: 'center', color: WHITE });
  }

  boresight(b) {
    const c = this.ctx;
    c.strokeStyle = GREEN;
    c.beginPath();
    c.moveTo(b.x - 22, b.y); c.lineTo(b.x - 9, b.y); c.lineTo(b.x - 5, b.y + 6); c.lineTo(b.x, b.y);
    c.lineTo(b.x + 5, b.y + 6); c.lineTo(b.x + 9, b.y); c.lineTo(b.x + 22, b.y);
    c.stroke();
  }

  pitchLadder(p, cam, fwd) {
    const c = this.ctx;
    const hdg = new THREE.Vector3(fwd.x, 0, fwd.z);
    if (hdg.lengthSq() < 1e-6) return;
    hdg.normalize();
    const side = new THREE.Vector3(-hdg.z, 0, hdg.x);
    const pitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1)) * 180 / Math.PI;
    c.strokeStyle = 'rgba(134,255,170,0.75)';
    c.lineWidth = 1.3;
    for (let a = -80; a <= 80; a += 10) {
      if (Math.abs(a - pitch) > 28) continue;
      const r = a * Math.PI / 180;
      const dir = hdg.clone().multiplyScalar(Math.cos(r)).addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(r));
      const base = p.pos.clone().addScaledVector(dir, 1000);
      const span = a === 0 ? 420 : 150, gap = a === 0 ? 60 : 50;
      const pts = [-span, -gap, gap, span].map((s) => this.project(base.clone().addScaledVector(side, s), cam));
      if (pts.some((q) => !q)) continue;
      c.setLineDash(a < 0 ? [6, 5] : []);
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y); c.lineTo(pts[1].x, pts[1].y);
      c.moveTo(pts[2].x, pts[2].y); c.lineTo(pts[3].x, pts[3].y);
      c.stroke();
      if (a !== 0) {
        this.text(String(Math.abs(a)), pts[3].x + 6, pts[3].y + 4, { size: 11, color: 'rgba(134,255,170,0.8)' });
        this.text(String(Math.abs(a)), pts[0].x - 6, pts[0].y + 4, { size: 11, color: 'rgba(134,255,170,0.8)', align: 'right' });
      }
    }
    c.setLineDash([]);
    c.lineWidth = 1.6;
  }

  weaponReticle(game, cam, b) {
    const c = this.ctx, p = game.player, w = p.weapon;
    if (w === 'gun') {
      const t = game.gunTarget;
      if (t) {
        const d = t.pos.distanceTo(p.pos);
        const tt = d / (WEAPONS.gun.speed + p.speed);
        const aim = this.project(t.pos.clone().addScaledVector(t.vel, tt), cam);
        if (aim) {
          c.strokeStyle = d < 1000 ? RED : GREEN;
          c.beginPath(); c.arc(aim.x, aim.y, 14, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.arc(aim.x, aim.y, 2, 0, Math.PI * 2); c.stroke();
          // range arc
          c.beginPath(); c.arc(aim.x, aim.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - d / 1600)); c.stroke();
        }
      }
      return;
    }
    const spec = WEAPONS[w];
    const fov = cam.fov * Math.PI / 180;
    const r = Math.tan(spec.cone) / Math.tan(fov / 2) * (this.H / 2);
    c.strokeStyle = game.lock.locked ? 'rgba(255,90,90,0.8)' : 'rgba(134,255,170,0.55)';
    c.setLineDash(spec.needsCircle ? [] : [10, 8]);
    c.beginPath(); c.arc(b.x, b.y, r, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
  }

  targets(game, cam) {
    const c = this.ctx, p = game.player, L = game.lock, W = this.W, H = this.H;
    const blink = Math.floor(game.time * 6) % 2 === 0;
    const spec = WEAPONS[p.weapon];
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const s = this.project(e.pos, cam);
      const isT = e === game.target;
      const locked = (spec && spec.multi) ? L.multi.includes(e) : (L.locked && L.target === e);
      const seeking = !locked && L.target === e && !spec?.multi;
      const d = e.pos.distanceTo(p.pos);
      if (s && s.x > -20 && s.x < W + 20 && s.y > -20 && s.y < H + 20) {
        let size = 13;
        if (seeking && spec) size = 13 + 26 * (1 - Math.min(1, L.progress / spec.lockTime));
        c.strokeStyle = locked ? RED : isT ? '#ff8b6b' : 'rgba(255,110,90,0.85)';
        c.lineWidth = locked ? 2.4 : 1.6;
        if (locked && !blink) c.strokeStyle = '#ffffff';
        c.strokeRect(s.x - size, s.y - size, size * 2, size * 2);
        if (isT) {
          c.beginPath();
          c.moveTo(s.x, s.y - size - 9); c.lineTo(s.x + 6, s.y - size - 3); c.lineTo(s.x - 6, s.y - size - 3); c.closePath();
          c.fillStyle = '#ff8b6b'; c.fill();
        }
        c.lineWidth = 1.6;
        if (!(isT || locked || seeking || d < 4000)) continue;
        this.text(e.name, s.x + size + 5, s.y - 3, { size: 12, color: locked ? RED : '#ff9b85' });
        this.text(d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m', s.x + size + 5, s.y + 11, { size: 11, color: '#ffb8a8' });
        if (locked) this.text('LOCK', s.x, s.y + size + 14, { size: 12, align: 'center', color: RED });
      } else if (isT) {
        // off-screen arrow toward the current target
        _c.copy(e.pos).applyMatrix4(cam.matrixWorldInverse);
        let ang = Math.atan2(-_c.y, _c.x);
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
        const ax = cx + Math.cos(ang) * R, ay = cy + Math.sin(ang) * R;
        c.save();
        c.translate(ax, ay);
        c.rotate(ang);
        c.fillStyle = '#ff8b6b';
        c.beginPath(); c.moveTo(16, 0); c.lineTo(-6, -10); c.lineTo(-6, 10); c.closePath(); c.fill();
        c.restore();
        this.text(`${e.name} ${(d / 1000).toFixed(1)}km`, ax, ay + 24, { size: 12, align: 'center', color: '#ff9b85' });
      }
    }
  }

  leftRight(game) {
    const c = this.ctx, p = game.player, W = this.W, H = this.H;
    const cy = H / 2;
    const lx = W / 2 - Math.min(330, W * 0.3), rx = W / 2 + Math.min(330, W * 0.3);
    c.strokeStyle = GREEN;
    // speed
    c.strokeRect(lx - 70, cy - 16, 80, 30);
    this.text('SPEED', lx - 30, cy - 22, { size: 11, align: 'center' });
    this.text(String(Math.round(p.speed * 3.6)), lx + 4, cy + 7, { size: 20, align: 'right' });
    this.text('km/h', lx - 30, cy + 30, { size: 10, align: 'center' });
    // altitude
    c.strokeRect(rx - 10, cy - 16, 80, 30);
    this.text('ALT', rx + 30, cy - 22, { size: 11, align: 'center' });
    this.text(String(Math.round(p.pos.y)), rx + 64, cy + 7, { size: 20, align: 'right' });
    const agl = Math.round(p.pos.y - game.world.groundHeight(p.pos.x, p.pos.z));
    this.text(`R ${agl}`, rx + 30, cy + 30, { size: 10, align: 'center', color: agl < 150 ? AMBER : GREEN });
    // throttle bar
    const bx = lx - 92, by = cy - 60, bh = 120;
    c.strokeRect(bx, by, 10, bh);
    c.fillStyle = p.throttle > 0.85 ? '#ffae4d' : GREEN;
    c.fillRect(bx + 2, by + bh - (bh - 4) * p.throttle - 2, 6, (bh - 4) * p.throttle);
    this.text('THR', bx + 5, by + bh + 14, { size: 10, align: 'center' });
    if (p.throttle > 0.85) this.text('A/B', bx + 5, by - 6, { size: 10, align: 'center', color: '#ffae4d' });
    this.text(`G ${p.gLoad.toFixed(1)}`, lx - 30, cy + 46, { size: 11, align: 'center' });
  }

  compass(p, fwd) {
    const c = this.ctx, W = this.W;
    let hdg = Math.atan2(fwd.x, -fwd.z) * 180 / Math.PI;
    if (hdg < 0) hdg += 360;
    const cx = W / 2, y = 34, span = 120, w = 340;
    c.save();
    c.beginPath(); c.rect(cx - w / 2, 0, w, 60); c.clip();
    c.strokeStyle = GREEN;
    for (let a = Math.ceil((hdg - span / 2) / 5) * 5; a <= hdg + span / 2; a += 5) {
      const x = cx + (a - hdg) / span * w;
      const n = ((a % 360) + 360) % 360;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - (n % 15 === 0 ? 9 : 4)); c.stroke();
      if (n % 45 === 0) {
        const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[n];
        this.text(lab, x, y - 13, { size: 12, align: 'center' });
      }
    }
    c.restore();
    c.strokeStyle = GREEN;
    c.strokeRect(cx - 22, y + 4, 44, 20);
    this.text(String(Math.round(hdg)).padStart(3, '0'), cx, y + 19, { size: 14, align: 'center' });
  }

  topLeft(game) {
    const left = game.enemies.filter((e) => e.alive).length;
    const t = game.missionTime;
    this.text('TARGETS', 22, 30, { size: 12, color: '#ffb8a8' });
    this.text(`${game.total - left} / ${game.total}`, 22, 52, { size: 22, color: RED });
    this.text('TIME', 120, 30, { size: 12 });
    this.text(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`, 120, 52, { size: 22 });
    this.text(`DIFFICULTY ${game.cfg.label}`, 22, 72, { size: 11, color: 'rgba(134,255,170,0.7)' });
  }

  weaponsPanel(game) {
    const c = this.ctx, p = game.player, W = this.W, H = this.H;
    // armor
    const hp = Math.max(0, p.hp);
    this.text('ARMOR', 22, H - 58, { size: 12 });
    c.strokeStyle = GREEN;
    c.strokeRect(22, H - 50, 160, 12);
    c.fillStyle = hp > 60 ? GREEN : hp > 30 ? AMBER : RED;
    c.fillRect(24, H - 48, 156 * hp / 100, 8);
    this.text(`${Math.round(hp)}%`, 190, H - 39, { size: 13, color: c.fillStyle });
    this.text(`${p.def.name}`, 22, H - 18, { size: 13, color: WHITE });

    // weapons list, bottom centre
    const ws = p.weapons;
    const bw = 116, gap = 8, x0 = W / 2 - (ws.length * bw + (ws.length - 1) * gap) / 2, y = H - 64;
    ws.forEach((w, i) => {
      const spec = WEAPONS[w];
      const sel = i === p.wi;
      const x = x0 + i * (bw + gap);
      c.fillStyle = sel ? 'rgba(134,255,170,0.18)' : 'rgba(0,0,0,0.25)';
      c.fillRect(x, y, bw, 46);
      c.strokeStyle = sel ? GREEN : 'rgba(134,255,170,0.35)';
      c.strokeRect(x, y, bw, 46);
      this.text(spec.name, x + 10, y + 19, { size: 15, color: sel ? GREEN : 'rgba(134,255,170,0.6)' });
      const ammo = p.ammo[w];
      this.text(ammo === Infinity ? '∞' : String(ammo), x + bw - 10, y + 19, { size: 15, align: 'right', color: ammo === 0 ? RED : sel ? WHITE : 'rgba(232,244,255,0.6)' });
      // rail reload pips
      const rails = p.rails[w];
      if (rails) {
        rails.forEach((t, k) => {
          const ready = t <= 0;
          const px = x + 10 + k * 18;
          c.fillStyle = ready ? (sel ? GREEN : 'rgba(134,255,170,0.5)') : 'rgba(255,211,107,0.8)';
          const frac = ready ? 1 : 1 - t / spec.reload;
          c.fillRect(px, y + 30, 14 * frac, 6);
          c.strokeStyle = 'rgba(134,255,170,0.5)';
          c.strokeRect(px, y + 30, 14, 6);
        });
      } else {
        this.text('HOLD SPACE', x + 10, y + 38, { size: 10, color: 'rgba(134,255,170,0.6)' });
      }
    });
    this.text('C: SWITCH WEAPON', W / 2, H - 8, { size: 10, align: 'center', color: 'rgba(134,255,170,0.55)' });
    const spec = WEAPONS[p.weapon];
    if (spec.multi) this.text(`LOCKS ${game.lock.multi.length}/${spec.multi}`, W / 2, y - 10, { size: 13, align: 'center', color: game.lock.multi.length ? RED : GREEN });
    else if (spec.needsCircle && game.missiles.some((m) => m.owner === 'player' && m.alive && m.target)) {
      this.text('KEEP TARGET IN CIRCLE', W / 2, y - 10, { size: 13, align: 'center', color: AMBER });
    }
  }

  radar(game, fwd) {
    const c = this.ctx, p = game.player, W = this.W, H = this.H;
    const R = Math.min(105, W * 0.12), cx = W - R - 22, cy = H - R - 22;
    const range = 6000, k = R / range;
    const hdg = Math.atan2(fwd.x, -fwd.z);
    c.save();
    c.fillStyle = 'rgba(5,20,12,0.55)';
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(134,255,170,0.6)';
    c.stroke();
    c.beginPath(); c.arc(cx, cy, R / 2, 0, Math.PI * 2); c.strokeStyle = 'rgba(134,255,170,0.2)'; c.stroke();
    c.clip();
    // heading-up transform: world (dx, dz) -> screen
    const cs = Math.cos(hdg), sn = Math.sin(hdg);
    const toS = (x, z) => {
      const dx = x - p.pos.x, dz = z - p.pos.z;
      const rx = dx * cs + dz * sn, ry = -dx * sn + dz * cs; // rotate so heading points up
      return [cx + rx * k, cy + ry * k];
    };
    // map border
    c.strokeStyle = 'rgba(255,211,107,0.6)';
    c.beginPath();
    [[-HALF * 0.84, -HALF * 0.84], [HALF * 0.84, -HALF * 0.84], [HALF * 0.84, HALF * 0.84], [-HALF * 0.84, HALF * 0.84]].forEach(([x, z], i) => {
      const [sx, sy] = toS(x, z);
      i ? c.lineTo(sx, sy) : c.moveTo(sx, sy);
    });
    c.closePath(); c.stroke();
    // enemy zones + enemies
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const [zx, zy] = toS(e.center.x, e.center.z);
      c.strokeStyle = 'rgba(255,77,77,0.35)';
      c.fillStyle = 'rgba(255,77,77,0.07)';
      c.beginPath(); c.arc(zx, zy, e.radius * k, 0, Math.PI * 2); c.fill(); c.stroke();
      const [ex, ey] = toS(e.pos.x, e.pos.z);
      const ea = Math.atan2(e.dir.x, -e.dir.z) - hdg;
      c.save();
      c.translate(ex, ey); c.rotate(ea);
      c.fillStyle = e === game.target ? '#ffffff' : RED;
      c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(-4, 4); c.closePath(); c.fill();
      c.restore();
    }
    for (const m of game.missiles) {
      const [mx, my] = toS(m.pos.x, m.pos.z);
      c.fillStyle = m.owner === 'enemy' ? '#ffffff' : AMBER;
      c.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    c.restore();
    // player
    c.fillStyle = GREEN;
    c.beginPath(); c.moveTo(cx, cy - 7); c.lineTo(cx + 5, cy + 5); c.lineTo(cx, cy + 2); c.lineTo(cx - 5, cy + 5); c.closePath(); c.fill();
    this.text(`${range / 1000} km`, cx + R - 4, cy + R - 2, { size: 10, align: 'right', color: 'rgba(134,255,170,0.7)' });
  }

  warnings(game) {
    const W = this.W, H = this.H, wn = game.warning;
    const blink = Math.floor(game.time * 4) % 2 === 0;
    const list = [];
    if (wn.missile) list.push(['MISSILE ALERT', RED, true]);
    else if (wn.locked) list.push(['WARNING: ENEMY LOCK', AMBER, true]);
    if (wn.pullUp) list.push(['PULL UP', RED, true]);
    if (wn.stall) list.push(['STALL', AMBER, true]);
    if (wn.area) list.push(['LEAVING COMBAT AREA', AMBER, false]);
    if (wn.ceiling) list.push(['ALTITUDE LIMIT', AMBER, false]);
    list.forEach(([t, col, bl], i) => {
      if (bl && !blink) return;
      const y = H * 0.66 + i * 30;
      this.ctx.strokeStyle = col;
      this.ctx.strokeRect(W / 2 - 130, y - 21, 260, 28);
      this.text(t, W / 2, y, { size: 18, align: 'center', color: col, weight: 700 });
    });
  }

  messages(game) {
    const W = this.W, H = this.H;
    game.messages.forEach((m, i) => {
      const a = Math.min(1, m.t / 0.4, (m.dur - m.t) / 0.15 + 0.2);
      this.ctx.globalAlpha = Math.max(0, a);
      this.text(m.text, W / 2, H * 0.22 + i * 28, { size: 20, align: 'center', color: m.color, weight: 700 });
    });
    this.ctx.globalAlpha = 1;
  }
}

