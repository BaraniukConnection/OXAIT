// In-game HUD: counters, hull/reload bars, scope, markers, minimap, hit feedback.
import * as THREE from 'three';
import { CFG } from './world.js';
import { ZOOMS } from './game.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();
const BLOCK_COLORS = { build: '#8d8a84', park: '#5f8a45', plaza: '#b3a993', parking: '#5b5d62', ruins: '#7e776c' };

export function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'h-left', 'h-total', 'h-time', 'h-tank', 'h-hp', 'h-hpv', 'h-speed', 'h-reload', 'h-reload-t',
      'h-spotted', 'h-feed', 'crosshair', 'gunmark', 'hitmark', 'dmg-ind', 'scope', 's-zoom', 's-range', 'markers', 'vignette', 'minimap']) {
      this.el[id] = $(id);
    }
    this.mm = this.el.minimap.getContext('2d');
    this.markers = [];
  }

  setup(game) {
    const P = game.player;
    this.el['h-tank'].textContent = P.def.name.toUpperCase();
    this.el['h-total'].textContent = `/ ${game.total}`;
    this.el['h-feed'].innerHTML = '';
    this.el['dmg-ind'].innerHTML = '';
    this.el.markers.innerHTML = '';
    this.markers = game.hounds.map(() => {
      const d = document.createElement('div');
      d.className = 'marker';
      d.innerHTML = '<i></i><span></span>';
      this.el.markers.appendChild(d);
      return d;
    });
    this._drawStatic(game.city);
  }

  _drawStatic(city) {
    const S = 440, ext = CFG.limit + 8;
    const c = (this.static = document.createElement('canvas'));
    c.width = c.height = S;
    const g = c.getContext('2d');
    const k = S / (2 * ext);
    const X = (x) => (ext - x) * k, Z = (z) => (ext - z) * k;
    g.fillStyle = '#5c7044';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#3d4044';
    g.fillRect(X(CFG.half), Z(CFG.half), CFG.size * k, CFG.size * k);
    for (const b of city.blocks) {
      g.fillStyle = BLOCK_COLORS[b.type];
      g.fillRect(X(b.x1), Z(b.z1), CFG.block * k, CFG.block * k);
    }
    g.fillStyle = '#d6cfc0';
    for (const c2 of city.colliders) g.fillRect(X(c2.maxX), Z(c2.maxZ), Math.max(1, (c2.maxX - c2.minX) * k), Math.max(1, (c2.maxZ - c2.minZ) * k));
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    g.strokeRect(X(CFG.limit), Z(CFG.limit), 2 * CFG.limit * k, 2 * CFG.limit * k);
    this.mmK = k;
    this.mmExt = ext;
  }

  update(game, input) {
    const P = game.player, el = this.el, cam = game.camera;
    const W = innerWidth, H = innerHeight;
    el['h-left'].textContent = game.hounds.filter((h) => h.alive).length;
    el['h-time'].textContent = fmtTime(game.over ? game.finishTime : game.time);

    const hp = Math.max(0, P.hp / P.maxHp);
    el['h-hp'].style.width = `${hp * 100}%`;
    el['h-hp'].className = hp < 0.3 ? 'low' : hp < 0.6 ? 'mid' : '';
    el['h-hpv'].textContent = Math.ceil(P.hp);
    el['h-speed'].textContent = Math.round(Math.abs(P.speed) * 3.6);
    const rl = P.reload / P.stats.reload;
    el['h-reload'].style.width = `${(1 - rl) * 100}%`;
    el['h-reload'].className = rl > 0 ? '' : 'ready';
    el['h-reload-t'].textContent = rl > 0 ? `RELOADING ${P.reload.toFixed(1)}s` : 'READY';
    el['h-spotted'].classList.toggle('hidden', !game.spotted || !P.alive);
    el.vignette.style.opacity = P.alive ? Math.max(0, (0.45 - hp) * 1.8) : 0;

    const alive = P.alive && !game.over;
    el.scope.classList.toggle('hidden', !(game.sight && alive));
    el.crosshair.classList.toggle('hidden', (game.sight && !input.free) || !alive);
    el.crosshair.style.transform = input.free ? `translate(${input.mx * 0.5 * W}px, ${-input.my * 0.5 * H}px)` : '';
    if (game.sight) {
      el['s-zoom'].textContent = `${ZOOMS[game.zoomIdx]}×`;
      el['s-range'].textContent = `RNG ${String(Math.round(game.aimRange)).padStart(4, '0')} m`;
    }

    // where the gun actually points
    _v.copy(game.gunPoint).project(cam);
    if (alive && _v.z < 1) {
      el.gunmark.style.display = 'block';
      el.gunmark.style.transform = `translate(${(_v.x * 0.5 + 0.5) * W}px, ${(-_v.y * 0.5 + 0.5) * H}px)`;
      el.gunmark.classList.toggle('loaded', P.reload <= 0);
    } else el.gunmark.style.display = 'none';

    // hound markers (only hounds in line of sight)
    game.hounds.forEach((h, i) => {
      const m = this.markers[i];
      if (!m) return;
      if (!h.alive || !h.seenByPlayer || !alive) { m.style.display = 'none'; return; }
      _v.set(h.pos.x, h.d.top + 3.2, h.pos.z).project(cam);
      if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) { m.style.display = 'none'; return; }
      m.style.display = 'block';
      m.style.transform = `translate(${(_v.x * 0.5 + 0.5) * W}px, ${(-_v.y * 0.5 + 0.5) * H}px)`;
      m.className = `marker ${h.state}`;
      m.lastChild.textContent = `${Math.round(h.dist)} m`;
      m.firstChild.style.setProperty('--hp', `${(h.hp / h.maxHp) * 100}%`);
    });

    this._minimap(game);
  }

  _minimap(game) {
    const g = this.mm, S = this.el.minimap.width, P = game.player;
    const f = S / this.static.width, k = this.mmK * f, ext = this.mmExt;
    const X = (x) => (ext - x) * k, Z = (z) => (ext - z) * k;
    g.drawImage(this.static, 0, 0, S, S);
    for (const h of game.hounds) {
      const x = X(h.pos.x), y = Z(h.pos.z);
      if (!h.alive) {
        g.strokeStyle = '#222';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke();
        continue;
      }
      const col = h.state === 'alert' ? '255,42,42' : h.state === 'search' ? '255,122,26' : '255,176,32';
      g.fillStyle = `rgba(${col},0.14)`;
      g.strokeStyle = `rgba(${col},0.8)`;
      g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, h.vision * k, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = `rgb(${col})`;
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
    }
    // view cone + player arrow
    const px = X(P.pos.x), py = Z(P.pos.z);
    const ca = Math.atan2(-Math.cos(game.camYaw), -Math.sin(game.camYaw));
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath(); g.moveTo(px, py); g.arc(px, py, 38, ca - 0.5, ca + 0.5); g.closePath(); g.fill();
    const ha = Math.atan2(-Math.cos(P.yaw), -Math.sin(P.yaw));
    g.save();
    g.translate(px, py);
    g.rotate(ha);
    g.fillStyle = P.alive ? '#4fe3ff' : '#555';
    g.strokeStyle = '#05202a';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, 5); g.lineTo(-2, 0); g.lineTo(-5, -5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  message(text, cls = '') {
    const d = document.createElement('div');
    d.className = `feed ${cls}`;
    d.textContent = text;
    this.el['h-feed'].appendChild(d);
    setTimeout(() => d.remove(), 3200);
  }

  hitMarker(text, cls = '') {
    const h = this.el.hitmark;
    h.textContent = text;
    h.className = '';
    void h.offsetWidth;
    h.className = `show ${cls}`;
  }

  kill(left, total) {
    this.hitMarker('HOUND DESTROYED', 'kill');
    this.message(left ? `Hound destroyed — ${left} of ${total} left` : 'All hounds destroyed!', 'good');
  }

  damage(angle, text) {
    const d = document.createElement('div');
    d.className = 'dmg-arc';
    d.style.transform = `rotate(${(-angle * 180) / Math.PI}deg)`;
    this.el['dmg-ind'].appendChild(d);
    setTimeout(() => d.remove(), 1600);
    this.message(`Hit taken: ${text}`, 'warn');
  }
}
