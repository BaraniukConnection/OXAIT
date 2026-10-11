import * as THREE from 'three';
import { Game, deriveStats, HOUND } from './game.js';
import { TANK_TYPES, buildTank } from './models.js';
import { HUD, fmtTime } from './hud.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const sound = new Sound();
const hud = new HUD();
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const input = { keys: {}, dx: 0, dy: 0, mx: 0, my: 0, free: true, fire: false, sight: false, wheel: 0, sens: parseFloat(store.get('hh-sens', '1')) };
let state = 'menu';
let selected = store.get('hh-tank', 'bastion');
if (!TANK_TYPES[selected]) selected = 'bastion';
let game = null;
const canLock = 'requestPointerLock' in HTMLCanvasElement.prototype;
let freeHinted = false;
let scores = {};

// ---------------------------------------------------------------- menu backdrop

let demo = new Game({ demo: true, sound });
let demoAngle = 0;

// ---------------------------------------------------------------- garage

class Garage {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1e23);
    this.scene.fog = new THREE.Fog(0x1a1e23, 30, 70);
    this.camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight(0xd6e4ff, 0x3a3328, 1.4));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
    key.position.set(8, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    const rim = new THREE.DirectionalLight(0xffb060, 1.6);
    rim.position.set(-10, 5, -8);
    this.scene.add(key, rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a2f35 }));
    floor.receiveShadow = true;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.8, 0.3, 12), new THREE.MeshLambertMaterial({ color: 0x3b424a, flatShading: true }));
    plat.position.y = 0.15;
    plat.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.5, 6.75, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
    ring.position.y = 0.31;
    this.scene.add(floor, plat, ring);
    this.holder = new THREE.Group();
    this.holder.position.y = 0.3;
    this.scene.add(this.holder);
    this.models = {};
    this.t = 0;
  }

  show(key) {
    if (!this.models[key]) this.models[key] = buildTank(key).root;
    this.holder.clear();
    this.holder.add(this.models[key]);
  }

  update(dt) {
    this.t += dt;
    this.holder.rotation.y = this.t * 0.35 + 0.6;
    const portrait = innerWidth < innerHeight;
    const d = portrait ? 34 : 26;
    this.camera.position.set(d * 0.55, 3.4, d * 0.85);
    this.camera.lookAt(0, portrait ? -3.4 : -2.3, 0);
  }
}
const garage = new Garage();

// ---------------------------------------------------------------- screens

const screens = ['menu', 'select', 'hud', 'pause', 'end'];
function show(...ids) {
  for (const s of screens) $(s).classList.toggle('hidden', !ids.includes(s));
}

function setState(s) {
  state = s;
  document.body.classList.toggle('playing', s === 'playing');
  if (s === 'menu') show('menu');
  else if (s === 'select') { show('select'); garage.show(selected); renderCards(); }
  else if (s === 'playing') show('hud');
  else if (s === 'paused') show('hud', 'pause');
  else if (s === 'end') show('end');
  if (s !== 'playing') {
    sound.setEngine(false);
    input.sight = false;
  }
}

const bars = (n) => `<span class="seg">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

function renderCards() {
  const wrap = $('tank-cards');
  wrap.innerHTML = '';
  for (const [key, t] of Object.entries(TANK_TYPES)) {
    const s = deriveStats(key);
    const best = scores[key];
    const kills = Math.ceil(HOUND.hp / s.damage);
    const card = document.createElement('button');
    card.className = `card${key === selected ? ' sel' : ''}`;
    card.innerHTML = `
      <div class="card-head"><h3>${t.name}</h3><span class="look">${t.look}</span></div>
      <div class="role">${t.role}</div>
      <div class="stat"><span>Speed</span>${bars(t.speed)}</div>
      <div class="stat"><span>Armor</span>${bars(t.armor)}</div>
      <div class="stat"><span>Power</span>${bars(t.power)}</div>
      <ul class="nums">
        <li><b>${Math.round(s.maxSpeed * 3.6)}</b> km/h</li>
        <li><b>${Math.round(100 / s.dmgTaken)}</b> eff. HP</li>
        <li><b>${s.damage}</b> dmg · ${kills} hits/hound</li>
      </ul>
      <p class="desc">${t.desc}</p>
      <div class="best">${best ? `Best ${fmtTime(best.time)} · ${best.accuracy}% acc` : 'No record yet'}</div>`;
    card.onclick = () => { if (selected === key) deploy(); else select(key); };
    wrap.appendChild(card);
  }
}

function select(key) {
  selected = key;
  store.set('hh-tank', key);
  sound.ui();
  garage.show(key);
  renderCards();
}

// Pointer lock gives classic mouse-look. When the browser refuses it (embedded views,
// some Linux setups, cooldown right after Esc) the game falls back to free-cursor aim.
function lock() {
  if (!canLock || document.pointerLockElement === canvas) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* retried on next click */ }
}

function deploy() {
  sound.init();
  sound.ui();
  if (game) game.dispose();
  game = new Game({ tankKey: selected, sound, hud });
  game.onEnd = endGame;
  game.camera.aspect = viewW / viewH;
  hud.setup(game);
  hud.message('Find and destroy every Hound. Stay out of their rings!', 'good');
  freeHinted = false;
  setState('playing');
  lock();
}

function pause() {
  if (state !== 'playing') return;
  setState('paused');
}

function resume() {
  setState('playing');
  lock();
}

function quitToMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  if (game) { game.dispose(); game = null; }
  setState('menu');
}

async function endGame(result) {
  if (document.pointerLockElement) document.exitPointerLock();
  const s = game.stats, P = game.player;
  const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
  $('end-title').textContent = result === 'win' ? 'MISSION COMPLETE' : 'TANK DESTROYED';
  $('end-sub').textContent = result === 'win' ? 'Every hound in the city has been put down.' : `${game.total - s.kills} hounds are still out there.`;
  $('end').dataset.result = result;
  $('end-stats').innerHTML = [
    ['Time', fmtTime(game.finishTime)], ['Hounds', `${s.kills} / ${game.total}`], ['Shots', s.shots],
    ['Hits', s.hits], ['Accuracy', `${acc}%`], ['Hull left', Math.ceil(P.hp)],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end-record').textContent = '';
  setState('end');
  if (result === 'win') {
    try {
      const r = await fetch('/api/scores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tank: selected, time: game.finishTime, accuracy: acc, hp: Math.ceil(P.hp) }),
      }).then((x) => x.json());
      scores = r.scores || scores;
      $('end-record').textContent = r.newRecord ? `NEW RECORD for ${TANK_TYPES[selected].name}!` : `Record: ${fmtTime(scores[selected].time)}`;
    } catch { /* server without API: no records */ }
  }
}

// ---------------------------------------------------------------- input

addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    $('mute').textContent = sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON';
  }
  if (state === 'select') {
    const keys = Object.keys(TANK_TYPES), i = keys.indexOf(selected);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') select(keys[(i + 1) % keys.length]);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') select(keys[(i + keys.length - 1) % keys.length]);
    if (e.code === 'Enter' || e.code === 'Space') deploy();
    if (e.code === 'Escape') setState('menu');
    return;
  }
  if (state === 'playing') {
    input.keys[e.code] = true;
    if (e.code === 'Escape' || e.code === 'KeyP') pause();
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  } else if (state === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) resume();
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
addEventListener('blur', () => { input.keys = {}; input.sight = false; });

canvas.addEventListener('mousedown', (e) => {
  if (state !== 'playing') return;
  lock();
  if (e.button === 0) input.fire = true;
  if (e.button === 2) input.sight = true;
});
addEventListener('mouseup', (e) => { if (e.button === 2) input.sight = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (state !== 'playing') return;
  if (document.pointerLockElement === canvas) {
    input.dx += e.movementX;
    input.dy += e.movementY;
  } else {
    const r = canvas.getBoundingClientRect();
    input.mx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    input.my = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
  }
});
// cursor left the window: stop edge-turning
document.documentElement.addEventListener('mouseleave', () => { input.mx = 0; input.my = 0; });
addEventListener('wheel', (e) => { if (state === 'playing') input.wheel += Math.sign(e.deltaY); }, { passive: true });

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing') pause();
});

// keep the drawing buffer and cameras matched to the canvas size
let viewW = 0, viewH = 0;
function fitView() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h || (w === viewW && h === viewH)) return;
  viewW = w; viewH = h;
  renderer.setSize(w, h, false);
  for (const cam of [demo.camera, garage.camera, game?.camera]) {
    if (!cam) continue;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
}

// ---------------------------------------------------------------- buttons

$('btn-start').onclick = () => { sound.init(); sound.ui(); setState('select'); };
$('btn-controls').onclick = () => { sound.init(); sound.ui(); $('controls').classList.toggle('hidden'); };
$('btn-back').onclick = () => { sound.ui(); setState('menu'); };
$('btn-deploy').onclick = deploy;
$('btn-resume').onclick = resume;
$('btn-restart').onclick = deploy;
$('btn-quit').onclick = quitToMenu;
$('btn-again').onclick = deploy;
$('btn-change').onclick = () => { if (game) { game.dispose(); game = null; } setState('select'); };
$('btn-menu').onclick = quitToMenu;
$('mute').onclick = () => { sound.init(); $('mute').textContent = sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON'; };
$('mute').textContent = sound.muted ? 'SOUND OFF' : 'SOUND ON';
const sens = $('sens');
sens.value = input.sens;
sens.oninput = () => { input.sens = parseFloat(sens.value); store.set('hh-sens', sens.value); };

fetch('/api/scores').then((r) => r.json()).then((s) => { scores = s; if (state === 'select') renderCards(); }).catch(() => {});

// ---------------------------------------------------------------- loop

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fitView();

  if (state === 'menu') {
    demo.update(dt, input);
    demoAngle += dt * 0.04;
    demo.camera.position.set(Math.sin(demoAngle) * 330, 150, Math.cos(demoAngle) * 330);
    demo.camera.lookAt(0, 0, 0);
    renderer.render(demo.scene, demo.camera);
  } else if (state === 'select') {
    garage.update(dt);
    renderer.render(garage.scene, garage.camera);
  } else if (game) {
    if (state === 'playing' || state === 'end') {
      input.free = document.pointerLockElement !== canvas;
      game.update(dt, input);
      if (state === 'playing') {
        hud.update(game, input);
        if (input.free && !freeHinted && game.time > 1.5) {
          freeHinted = true;
          hud.message('Free aim: point with the cursor, push it to the screen edge to turn', 'warn');
        }
      }
    }
    renderer.render(game.scene, game.camera);
  }
}
requestAnimationFrame(frame);
$('loading').remove();

// handy for debugging from the console
window.hh = { get game() { return game; }, input, deploy, select };
