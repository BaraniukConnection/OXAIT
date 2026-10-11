// Boot, menus, hangar, camera, input and the main loop.
import * as THREE from 'three';
import { World, HALF } from './world.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import { buildAircraft } from './models.js';
import { PLANES, WEAPONS, DIFFICULTY } from './data.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem('rogue.' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rogue.' + k, v); } catch { /* private mode */ } },
};

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 40000);
const hud = new Hud($('hud'));
const audio = new Audio();
let world, effects;

// ---------- settings ----------
const settings = {
  difficulty: store.get('difficulty', 'normal'),
  invert: store.get('invert', '0') === '1',
  plane: Math.min(PLANES.length - 1, Math.max(0, parseInt(store.get('plane', '0'), 10) || 0)),
};
if (!DIFFICULTY[settings.difficulty]) settings.difficulty = 'normal';

let state = 'loading';
let game = null;
let T = 0;
const keys = {};
let camMode = 0;
const CAM_MODES = ['CHASE', 'FAR', 'NOSE'];
const camQuat = new THREE.Quaternion();
const camPos = new THREE.Vector3();
let scores = {};

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
}

// ---------- boot ----------
setTimeout(() => {
  world = new World(scene, 1337);
  effects = new Effects(scene);
  buildPreview();
  setupMenus();
  state = 'title';
  show('title');
  requestAnimationFrame(frame);
}, 30);

// ---------- hangar preview ----------
const preview = { models: {}, pos: new THREE.Vector3(), group: new THREE.Group() };
function buildPreview() {
  // a scenic spot: low valley floor with mountains a few km away, plane hovering well above it
  let best = { s: -Infinity, x: 0, z: 0, h: 0 };
  for (let i = 0; i < 300; i++) {
    const a = i * 2.39996, r = Math.sqrt(i / 300) * HALF * 0.55;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = world.groundHeight(x, z);
    let ring = 0, near = 0;
    for (let k = 0; k < 12; k++) {
      const b = (k / 12) * Math.PI * 2;
      ring += world.groundHeight(x + Math.cos(b) * 3000, z + Math.sin(b) * 3000);
      near = Math.max(near, world.groundHeight(x + Math.cos(b) * 600, z + Math.sin(b) * 600));
    }
    const s = ring / 12 - h * 2 - near;
    if (s > best.s) best = { s, x, z, h: Math.max(h, near) };
  }
  preview.pos.set(best.x, best.h + 260, best.z);
  for (const p of PLANES) {
    const m = buildAircraft(p.id);
    m.group.visible = false;
    m.flames.forEach((f) => { f.scale.z = 0.7; f.material.opacity = 0.55; });
    preview.models[p.id] = m;
    preview.group.add(m.group);
  }
  preview.group.position.copy(preview.pos);
  preview.group.visible = false;
  scene.add(preview.group);
}

function setPreview(i) {
  settings.plane = (i + PLANES.length) % PLANES.length;
  store.set('plane', settings.plane);
  const def = PLANES[settings.plane];
  for (const id in preview.models) preview.models[id].group.visible = id === def.id;
  $('h-name').textContent = def.name;
  $('h-type').textContent = `${def.type} · ${def.based}`;
  const pips = (n) => [1, 2, 3, 4].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('');
  $('h-speed').innerHTML = pips(def.speed);
  $('h-agil').innerHTML = pips(def.agility);
  $('h-blurb').textContent = def.blurb;
  const sp = WEAPONS[def.special];
  $('h-sp-name').textContent = sp.name;
  $('h-sp-full').textContent = `${sp.full} · ${sp.ammo}`;
  $('h-sp-desc').textContent = sp.desc;
  const best = scores[def.id];
  $('h-best').textContent = best ? `BEST TIME ${fmtTime(best.time)} · ${best.kills} kills · ${best.difficulty || ''}` : '';
  for (const b of $('h-tabs').children) b.classList.toggle('on', +b.dataset.i === settings.plane);
}

const fmtTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

async function loadScores() {
  try {
    const r = await fetch('/api/scores');
    if (r.ok) scores = await r.json();
  } catch { scores = {}; }
  if (state === 'hangar') setPreview(settings.plane);
}

// ---------- menus ----------
function setupMenus() {
  const seg = (id, val, cb) => {
    const el = $(id);
    const sync = (v) => { for (const b of el.children) b.classList.toggle('on', b.dataset.v === v); };
    sync(val);
    el.addEventListener('click', (e) => {
      const v = e.target.dataset?.v;
      if (!v) return;
      sync(v);
      cb(v);
      audio.click();
    });
  };
  seg('diff', settings.difficulty, (v) => { settings.difficulty = v; store.set('difficulty', v); });
  seg('pitchmode', settings.invert ? 'invert' : 'normal', (v) => { settings.invert = v === 'invert'; store.set('invert', settings.invert ? '1' : '0'); });

  $('btn-start').onclick = () => { audio.init(); goHangar(); };
  PLANES.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.dataset.i = i;
    b.onclick = () => { setPreview(i); audio.click(); };
    $('h-tabs').appendChild(b);
  });
  $('h-prev').onclick = () => { setPreview(settings.plane - 1); audio.click(); };
  $('h-next').onclick = () => { setPreview(settings.plane + 1); audio.click(); };
  $('h-back').onclick = () => goTitle();
  $('h-go').onclick = () => startMission();
  $('p-resume').onclick = () => resume();
  $('p-restart').onclick = () => startMission();
  $('p-hangar').onclick = () => goHangar();
  $('p-menu').onclick = () => goTitle();
  $('e-retry').onclick = () => startMission();
  $('e-hangar').onclick = () => goHangar();
  $('e-menu').onclick = () => goTitle();
}

function endGame() {
  if (game) { game.dispose(); game = null; }
  audio.engine(0, 0, false);
  audio.beeper('none', 0);
}

function goTitle() {
  endGame();
  preview.group.visible = false;
  state = 'title';
  show('title');
}

function goHangar() {
  audio.init();
  endGame();
  state = 'hangar';
  preview.group.visible = true;
  setPreview(settings.plane);
  show('hangar');
  loadScores();
}

function startMission() {
  audio.init();
  endGame();
  preview.group.visible = false;
  game = new Game({ scene, world, effects, audio, planeDef: PLANES[settings.plane], difficulty: settings.difficulty });
  const p = game.player;
  camQuat.copy(p.quat);
  camPos.copy(p.pos);
  game.msg(`DESTROY ALL ${game.total} ROGUES`, '#ffe27a', 4);
  game.msg('RED CIRCLES ON RADAR = ROGUE AIRSPACE', '#9dffb0', 4);
  state = 'play';
  show(null);
  $('gl').focus?.();
}

function pause() {
  if (state !== 'play') return;
  state = 'pause';
  show('pause');
  audio.engine(0, 0, false);
  audio.beeper('none', 0);
}
function resume() {
  if (state !== 'pause') return;
  state = 'play';
  show(null);
}

async function showEnd() {
  state = 'end';
  const g = game, s = g.stats, won = g.state === 'won';
  $('e-title').textContent = won ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED';
  $('e-title').className = 'result ' + (won ? 'win' : 'lose');
  $('e-reason').textContent = won ? `All Rogues destroyed · ${g.cfg.label}` : (g.failReason || 'Aircraft lost');
  const acc = s.shots ? Math.round((s.gunHits / s.shots) * 100) : 0;
  const rows = [
    ['AIRCRAFT', g.player.def.name], ['TIME', fmtTime(g.missionTime)],
    ['ROGUES DOWN', `${s.kills} / ${g.total}`], ['ARMOR LEFT', `${Math.max(0, Math.round(g.player.hp))}%`],
    ['GUN ACCURACY', `${acc}%`], ['MISSILE HITS', `${s.missileHits} / ${s.missiles}`],
  ];
  $('e-stats').innerHTML = rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  $('e-record').textContent = '';
  show('end');
  audio.engine(0, 0, false);
  audio.beeper('none', 0);
  if (won) {
    try {
      const r = await fetch('/api/scores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plane: g.player.def.id, time: g.missionTime, kills: s.kills, accuracy: acc, difficulty: g.cfg.label }),
      });
      const j = await r.json();
      scores = j.scores || scores;
      if (j.newRecord) $('e-record').textContent = `NEW BEST TIME FOR ${g.player.def.name}!`;
    } catch { /* offline / static hosting: no score board */ }
  }
}

// ---------- input ----------
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code) && (state === 'play' || state === 'hangar')) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (state === 'play' && game) {
    if (e.code === 'Space') game.trigger();
    else if (e.code === 'KeyC') game.switchWeapon();
    else if (e.code === 'KeyV') { camMode = (camMode + 1) % CAM_MODES.length; game.msg(`CAMERA: ${CAM_MODES[camMode]}`, '#9dffb0', 1.2); }
    else if (e.code === 'KeyI') {
      settings.invert = !settings.invert;
      store.set('invert', settings.invert ? '1' : '0');
      game.msg(settings.invert ? 'PITCH: ↑ = NOSE UP' : 'PITCH: ↓ = NOSE UP', '#9dffb0', 1.5);
    } else if (e.code === 'KeyP' || e.code === 'Escape') pause();
  } else if (state === 'pause') {
    if (e.code === 'KeyP' || e.code === 'Escape') resume();
  } else if (state === 'hangar') {
    if (e.code === 'ArrowLeft') setPreview(settings.plane - 1);
    else if (e.code === 'ArrowRight') setPreview(settings.plane + 1);
    else if (e.code === 'Enter') startMission();
    else if (e.code === 'Escape') goTitle();
  } else if (state === 'title') {
    if (e.code === 'Enter') { audio.init(); goHangar(); }
  } else if (state === 'end') {
    if (e.code === 'Enter') startMission();
  }
  if (e.code === 'KeyM') { audio.setMuted(!audio.muted); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; pause(); });
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  hud.resize();
});

// ---------- cameras ----------
const _f = new THREE.Vector3(), _up = new THREE.Vector3(), _off = new THREE.Vector3(), _look = new THREE.Vector3();

function titleCamera(dt) {
  const a = T * 0.028;
  const R = HALF * 0.5;
  const x = Math.cos(a) * R, z = Math.sin(a) * R;
  const ahead = 900;
  const nx = Math.cos(a + ahead / R) * R, nz = Math.sin(a + ahead / R) * R;
  let gh = 0;
  for (let k = 0; k <= 4; k++) gh = Math.max(gh, world.groundHeight(x + (nx - x) * k / 2, z + (nz - z) * k / 2));
  const y = gh + 380;
  camPos.set(x, camPos.y ? camPos.y + (y - camPos.y) * Math.min(1, dt * 0.6) : y, z);
  camPos.y = Math.max(camPos.y, world.groundHeight(x, z) + 60);
  camera.position.copy(camPos);
  camera.up.set(0, 1, 0);
  camera.lookAt(nx, camPos.y - 160, nz);
  camera.fov = 60;
  camera.updateProjectionMatrix();
  return camera.position;
}

function hangarCamera(dt) {
  const def = PLANES[settings.plane];
  const m = preview.models[def.id];
  const L = m.length;
  preview.group.position.set(preview.pos.x, preview.pos.y + Math.sin(T * 0.8) * 1.2, preview.pos.z);
  m.group.rotation.set(Math.sin(T * 0.6) * 0.03, 0, Math.sin(T * 0.45) * 0.12);
  m.flames.forEach((f) => { f.scale.z = 0.6 + Math.random() * 0.15; });
  const a = T * 0.22 + 0.9;
  const d = L * 1.45 + 6;
  // keep the aircraft on the right half of the screen, info panel on the left
  camera.position.set(preview.pos.x + Math.sin(a) * d, preview.pos.y + L * 0.32 + 2, preview.pos.z + Math.cos(a) * d);
  camera.up.set(0, 1, 0);
  _look.set(-Math.cos(a), 0, Math.sin(a)).multiplyScalar(L * (window.innerWidth > 760 ? 0.36 : 0)).add(preview.pos);
  camera.lookAt(_look);
  camera.fov = 50;
  camera.updateProjectionMatrix();
  return preview.pos;
}

function chaseCamera(dt) {
  const p = game.player, L = p.model.length;
  if (p.alive) {
    camQuat.slerp(p.quat, 1 - Math.exp(-dt * (camMode === 2 ? 30 : 5.5)));
    _up.set(0, 1, 0).applyQuaternion(camQuat);
    _f.set(0, 0, -1).applyQuaternion(camQuat);
    if (camMode === 2) {
      _off.set(0, 1.4, -L * 0.5 - 1).applyQuaternion(p.quat);
      camPos.copy(p.pos).add(_off);
      _look.copy(camPos).addScaledVector(_f, 100);
    } else {
      const dist = camMode === 0 ? L * 1.55 + 9 : L * 3 + 16;
      const h = camMode === 0 ? L * 0.34 + 1.5 : L * 0.6 + 3;
      _off.set(0, h, dist).applyQuaternion(camQuat);
      camPos.copy(p.pos).add(_off);
      _look.copy(p.pos).addScaledVector(_f, 40).addScaledVector(_up, h * 0.55);
    }
    p.obj.visible = camMode !== 2;
  } else {
    // slow orbit around the wreck
    _off.subVectors(camPos, p.pos);
    _off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.25);
    _off.setLength(Math.min(_off.length() + dt * 12, 140));
    camPos.copy(p.pos).add(_off);
    _look.copy(p.pos);
    _up.set(0, 1, 0);
  }
  const g = world.groundHeight(camPos.x, camPos.z) + 2.5;
  if (camPos.y < g) camPos.y = g;
  camera.position.copy(camPos);
  if (game.camShake > 0) camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(game.camShake * 1.5));
  camera.up.copy(_up);
  camera.lookAt(_look);
  const fov = 62 + THREE.MathUtils.clamp((p.speed - 180) / 160, 0, 1) * 10 + (p.throttle > 0.85 ? 2 : 0);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 2);
  camera.updateProjectionMatrix();
  return p.pos;
}

// debugging handle (console): __rogue.game, __rogue.cam = (camera, t) => focus
const debug = { cam: null };
window.__rogue = Object.defineProperties(debug, {
  game: { get: () => game }, preview: { get: () => preview }, world: { get: () => world }, settings: { get: () => settings },
});

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  T += dt;
  let focus;
  if (state === 'title') focus = titleCamera(dt);
  else if (state === 'hangar') focus = debug.cam ? debug.cam(camera, T) : hangarCamera(dt);
  else if (game) {
    if (state === 'play') {
      game.update(dt, keys, { invert: settings.invert });
      if (game.state !== 'playing' && game.endT > 3.2) showEnd();
    } else if (state === 'end' && game.player.alive) {
      // keep the aircraft flying straight behind the results screen
      game.player.update(dt, {}, false);
    }
    focus = chaseCamera(state === 'pause' ? 0 : dt);
  } else focus = camera.position;

  if (state !== 'pause') effects.update(dt);
  world.update(state === 'pause' ? 0 : dt, T, focus, camera);
  renderer.render(scene, camera);

  if (game && (state === 'play' || state === 'pause')) {
    hud.draw(game, camera, { paused: state === 'pause' });
    const p = game.player, wn = game.warning, L = game.lock;
    audio.engine(p.throttle, p.speed, p.alive && state === 'play');
    let beep = 'none';
    if (state === 'play' && p.alive) {
      if (wn.missile) beep = 'missile';
      else if (wn.locked || wn.pullUp) beep = 'warning';
      else if (L.locked) beep = 'locked';
      else if (L.seeking) beep = 'seeking';
    }
    audio.beeper(beep, T);
  } else {
    hud.clear();
  }
}
