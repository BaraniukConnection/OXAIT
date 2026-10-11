import * as THREE from 'three';
import { buildRoom, animateRoom, ROOM } from './room.js';
import { buildCase, buildWeapon } from './models.js';
import { makeGlowSprite, makeDustSprite } from './textures.js';
import { store, api, fmt, RARITY_COLORS } from './store.js';
import { warmThumbs } from './thumbs.js';
import { sfx } from './audio.js';
import * as UI from './ui.js';

const { $ } = UI;

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a09);
scene.fog = new THREE.FogExp2(0x0d0c0a, 0.055);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.02, 60);
const HOME = new THREE.Vector3(0, 1.62, 1.1);
camera.position.copy(HOME);

const refs = buildRoom(scene);

// ---------------------------------------------------------------- tweens
const tweens = [];
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(dur, fn, easing = ease) {
  return new Promise(resolve => tweens.push({ t: 0, dur, fn, easing, resolve }));
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- camera control
const view = { yaw: 0, pitch: -0.05, tYaw: 0, tPitch: -0.05, mode: 'intro' };
const VIEWS = { left: [Math.PI / 2 - 0.05, -0.2], front: [0, 0.02], right: [-Math.PI / 2 + 0.18, -0.12] };
const tmpQ = new THREE.Quaternion();
const eul = new THREE.Euler(0, 0, 0, 'YXZ');

function freeQuat(yaw, pitch, out = new THREE.Quaternion()) {
  eul.set(pitch, yaw, 0);
  return out.setFromEuler(eul);
}

function lookQuat(from, to) {
  const m = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

async function flyTo(pos, quat, dur = 900) {
  const p0 = camera.position.clone(), q0 = camera.quaternion.clone();
  view.mode = 'flying';
  await tween(dur, t => {
    camera.position.lerpVectors(p0, pos, t);
    camera.quaternion.slerpQuaternions(q0, quat, t);
  });
}

async function goHome(dir) {
  if (dir) [view.tYaw, view.tPitch] = VIEWS[dir];
  view.yaw = view.tYaw; view.pitch = view.tPitch;
  await flyTo(HOME, freeQuat(view.yaw, view.pitch), 850);
  view.mode = 'free';
}

function turn(dir) {
  if (view.mode === 'monitor') closeMonitor(dir);
  else if (view.mode === 'showcase') goHome(dir);
  else if (view.mode === 'free') {
    if (dir === 'front') return enterShowcase();
    [view.tYaw, view.tPitch] = VIEWS[dir];
    // turn the short way round
    while (view.tYaw - view.yaw > Math.PI) view.tYaw -= Math.PI * 2;
    while (view.tYaw - view.yaw < -Math.PI) view.tYaw += Math.PI * 2;
  }
}

// drag to look
let drag = null;
function setPointer(e) {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerPx = [e.clientX, e.clientY];
}
renderer.domElement.addEventListener('pointerdown', e => {
  setPointer(e);
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
  sfx.unlock();
});
addEventListener('pointerup', e => {
  if (drag && drag.moved < 5 && e.target === renderer.domElement) { setPointer(e); onClick(e); }
  drag = null;
});
addEventListener('pointermove', e => {
  setPointer(e);
  if (drag && view.mode === 'free') {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    view.tYaw += dx * 0.0042;
    view.tPitch = THREE.MathUtils.clamp(view.tPitch + dy * 0.0035, -1.0, 0.8);
  }
});

addEventListener('keydown', e => {
  if (view.mode === 'intro') return;
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft') turn('left');
  else if (k === 'd' || k === 'arrowright') turn('right');
  else if (k === 'w' || k === 'arrowup') turn('front');
  else if (k === 's' || k === 'arrowdown') { if (view.mode === 'showcase') goHome('front'); }
  else if (k === 'escape') {
    if (!$('#modal').classList.contains('hidden')) $('#modal').classList.add('hidden');
    else if (view.mode === 'monitor') closeMonitor();
    else if (view.mode === 'showcase') goHome('front');
  } else if (k === 'm') toggleMute();
});

// ---------------------------------------------------------------- hover / click
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-9, -9);
let pointerPx = [0, 0];
let hovered = null;
const interactables = [];

function tagInteractive(obj, data) {
  obj.traverse(o => { if (o.isMesh) { o.userData.hit = data; interactables.push(o); } });
}
function untag(obj) {
  obj.traverse(o => {
    const i = interactables.indexOf(o);
    if (i >= 0) interactables.splice(i, 1);
  });
}
// free GPU resources of one-off meshes (labels, plaques, hit boxes)
function disposeOwned(obj) {
  obj.traverse(o => {
    if (!o.userData.owned) return;
    o.geometry?.dispose();
    o.material?.map?.dispose();
    o.material?.dispose();
  });
}
const owned = o => ((o.userData.owned = true), o);
tagInteractive(refs.monitor.group, { type: 'monitor' });

function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactables, false)[0];
  return hit && hit.distance < 7 ? hit.object.userData.hit : null;
}

function hoverText(h) {
  if (h.type === 'monitor') return `<b>PC — ARMS//NET</b><div class="tt-sub">Buy cases · sell skins on the market</div>`;
  if (h.type === 'case') {
    const c = store.cases[h.caseId], n = store.state.cases[h.caseId] || 0;
    return n ? `<b>${c.name} ×${n}</b><div class="tt-sub">Click to open one</div>`
      : `<b>${c.name}</b><div class="tt-sub">None owned — buy on the PC (D)</div>`;
  }
  if (h.type === 'showcase') {
    const sk = store.skins[h.item.skin];
    return `<b style="color:${RARITY_COLORS[sk.rarity]}">${sk.name}</b><div class="tt-sub">${h.item.wear} · ${fmt(store.itemValue(h.item))}</div>`;
  }
  return '';
}

function updateHover() {
  if (drag?.moved > 5 || (view.mode !== 'free' && view.mode !== 'showcase')) {
    hovered = null;
    UI.tooltip(null);
    renderer.domElement.style.cursor = drag?.moved > 5 ? 'grabbing' : 'default';
    return;
  }
  const h = pick();
  if (h?.type !== hovered?.type || h?.caseId !== hovered?.caseId || h?.item !== hovered?.item) {
    if (h && h.type !== 'showcase') sfx.hover();
  }
  hovered = h;
  renderer.domElement.style.cursor = h ? 'pointer' : 'grab';
  UI.tooltip(h ? hoverText(h) : null, pointerPx[0], pointerPx[1]);
}

function onClick() {
  if (view.mode === 'monitor') return closeMonitor();
  if (view.mode !== 'free' && view.mode !== 'showcase') return;
  const h = pick();
  if (!h) return;
  sfx.click();
  if (h.type === 'monitor') openMonitor();
  else if (h.type === 'case') {
    if ((store.state.cases[h.caseId] || 0) > 0) openCase(h.caseId);
    else { UI.toast(`No ${store.cases[h.caseId].name}s — buy some on the PC to your right.`); }
  }
}

// ---------------------------------------------------------------- monitor
function monitorFrame() {
  const s = refs.monitor.screen;
  s.updateWorldMatrix(true, false);
  const center = new THREE.Vector3().setFromMatrixPosition(s.matrixWorld);
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(s.matrixWorld);
  return { center, normal };
}

function monitorRect() {
  const { width: SW, height: SH } = refs.monitor;
  const s = refs.monitor.screen;
  const pts = [[-SW / 2, SH / 2], [SW / 2, SH / 2], [SW / 2, -SH / 2], [-SW / 2, -SH / 2]]
    .map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(s.matrixWorld).project(camera))
    .map(v => [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

async function openMonitor() {
  if (view.mode !== 'free') return;
  UI.tooltip(null);
  const { center, normal } = monitorFrame();
  const { width: SW, height: SH } = refs.monitor;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max((SH * 1.04) / (2 * tanH), (SW * 1.04) / (2 * tanH * camera.aspect));
  const pos = center.clone().addScaledVector(normal, d);
  // camera looks straight at the screen; up = world up
  const q = lookQuat(pos, center);
  await flyTo(pos, q, 900);
  view.mode = 'monitor';
  document.body.classList.add('at-monitor');
  UI.showMonitor(monitorRect());
}

async function closeMonitor(dir = 'right') {
  UI.hideMonitor();
  document.body.classList.remove('at-monitor');
  await goHome(dir);
}

$('#monitorClose').addEventListener('click', () => closeMonitor());

// screen texture shown while not using the PC
function drawScreen() {
  const c = refs.monitor.screenCanvas, ctx = c.getContext('2d'), W = c.width, H = c.height;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0f1724'); g.addColorStop(1, '#1a0f1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, W, 70);
  ctx.font = 'bold 44px Impact, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('ARMS', 30, 50);
  ctx.fillStyle = '#e4ae39'; ctx.fillText('//', 130, 50); ctx.fillStyle = '#fff'; ctx.fillText('NET', 168, 50);
  if (store.state) {
    ctx.font = '30px sans-serif'; ctx.fillStyle = '#8a93a3'; ctx.textAlign = 'right';
    ctx.fillText('Balance ', W - 230, 48);
    ctx.fillStyle = '#e4ae39'; ctx.font = 'bold 34px sans-serif'; ctx.fillText(fmt(store.state.balance), W - 30, 48);
    ctx.textAlign = 'left';
  }
  // market index tiles
  if (store.market) {
    const entries = Object.entries(store.catalog.types);
    entries.forEach(([k, label], i) => {
      const x = 30 + i * 246, y = 110, w = 230, h = 170;
      ctx.fillStyle = '#14171c'; ctx.fillRect(x, y, w, h);
      const hist = store.market.index[k] || [1];
      const ch = (hist[hist.length - 1] - hist[0]) / hist[0];
      ctx.fillStyle = '#8a93a3'; ctx.font = '24px sans-serif'; ctx.fillText(label.toUpperCase(), x + 14, y + 36);
      ctx.fillStyle = ch >= 0 ? '#3fd17a' : '#ff5468'; ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`${ch >= 0 ? '▲' : '▼'} ${(ch * 100).toFixed(1)}%`, x + 14, y + 80);
      const min = Math.min(...hist), max = Math.max(...hist);
      ctx.beginPath();
      hist.forEach((v, j) => {
        const px = x + 10 + (j / Math.max(1, hist.length - 1)) * (w - 20), py = y + h - 12 - ((v - min) / (max - min || 1)) * 60;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.lineWidth = 3; ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
    });
    ctx.font = '26px sans-serif';
    (store.market.news || []).slice(0, 5).forEach((n, i) => {
      ctx.fillStyle = n.kind === 'up' ? '#3fd17a' : n.kind === 'down' ? '#ff5468' : '#e4ae39';
      ctx.fillText((n.kind === 'up' ? '▲ ' : n.kind === 'down' ? '▼ ' : '★ ') + n.text, 40, 340 + i * 44);
    });
  }
  // call to action
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
  ctx.fillStyle = `rgba(228,174,57,${pulse})`;
  ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('▶ CLICK TO OPEN CASE SHOP & MARKET', W / 2, H - 80);
  ctx.textAlign = 'left';
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  refs.monitor.screenTex.needsUpdate = true;
}

// ---------------------------------------------------------------- case rack
const slotModels = new Map();
const labelCache = new Map();

function countSprite(caseDef, n) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,10,12,0.8)'; ctx.fillRect(0, 0, 256, 72);
  ctx.fillStyle = caseDef.color; ctx.fillRect(0, 0, 6, 72);
  ctx.fillStyle = n ? '#fff' : '#777'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(caseDef.name.replace(' Case', ''), 18, 30);
  ctx.fillStyle = n ? '#e4ae39' : '#666'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(n ? `× ${n}` : 'empty', 18, 62);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return sp;
}

function refreshRack() {
  const counts = store.state.cases;
  for (const slot of refs.caseSlots) {
    const n = counts[slot.caseId] || 0;
    const key = slot.caseId;
    if (labelCache.get(key) === n) continue;
    labelCache.set(key, n);
    const old = slotModels.get(key);
    if (old) { untag(old); disposeOwned(old); slot.anchor.remove(old); }
    const g = new THREE.Group();
    const def = store.cases[slot.caseId];
    const shown = Math.min(n, 3);
    for (let i = 0; i < shown; i++) {
      const m = buildCase(def);
      m.rotation.y = Math.PI / 2 + (i % 2 ? 0.05 : -0.03);
      m.position.y = i * 0.152;
      m.traverse(o => { o.castShadow = true; });
      g.add(m);
    }
    // invisible hit box so empty slots are clickable too
    const hit = owned(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.46, 0.56), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
    hit.position.y = 0.23;
    g.add(hit);
    if (!shown) {
      const ghost = owned(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.5), new THREE.MeshBasicMaterial({ color: def.color, wireframe: true, transparent: true, opacity: 0.25 })));
      ghost.position.y = 0.07;
      g.add(ghost);
    }
    const label = owned(countSprite(def, n));
    label.position.set(0.215, -0.07, 0);
    label.rotation.y = Math.PI / 2;
    g.add(label);
    tagInteractive(g, { type: 'case', caseId: slot.caseId });
    slot.anchor.add(g);
    slotModels.set(key, g);
  }
}

// ---------------------------------------------------------------- showcase wall
let showcaseKey = '';
function refreshShowcase() {
  const inv = [...store.state.inventory].sort((a, b) => store.itemValue(b) - store.itemValue(a)).slice(0, 8);
  const key = inv.map(i => i.uid).join();
  if (key === showcaseKey) return;
  showcaseKey = key;
  const anchor = refs.showcase.anchor;
  untag(anchor);
  disposeOwned(anchor);
  anchor.clear();
  const hookMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 });
  const hookGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6);
  for (let i = 0; i < 8; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const x = -1.32 + col * 0.88, y = 2.16 - row * 0.66, z = refs.showcase.z;
    // hooks
    for (const hx of [-0.18, 0.18]) {
      const hook = owned(new THREE.Mesh(hookGeo, hookMat));
      hook.rotation.x = Math.PI / 2; hook.position.set(x + hx, y - 0.06, z - 0.05);
      anchor.add(hook);
    }
    const item = inv[i];
    const plaqueC = document.createElement('canvas'); plaqueC.width = 256; plaqueC.height = 48;
    const p = plaqueC.getContext('2d');
    p.fillStyle = '#1a1612'; p.fillRect(0, 0, 256, 48);
    if (item) {
      const sk = store.skins[item.skin];
      p.fillStyle = RARITY_COLORS[sk.rarity]; p.fillRect(0, 44, 256, 4);
      p.fillStyle = '#eee'; p.font = 'bold 17px sans-serif'; p.fillText(`${sk.weaponName} | ${sk.design}`.slice(0, 26), 8, 20);
      p.fillStyle = '#e4ae39'; p.font = '15px sans-serif'; p.fillText(`${item.wear} · ${fmt(store.itemValue(item))}`, 8, 39);
      const w = buildWeapon(sk.weapon, sk, item.float, { fit: sk.type === 'pistol' ? 0.36 : 0.74 });
      w.position.set(x, y, z);
      w.rotation.z = -0.04;
      anchor.add(w);
      tagInteractive(w, { type: 'showcase', item });
    } else {
      p.fillStyle = '#555'; p.font = '16px sans-serif'; p.fillText('— empty slot —', 70, 30);
    }
    const tex = new THREE.CanvasTexture(plaqueC); tex.colorSpace = THREE.SRGBColorSpace;
    const plaque = owned(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.079), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.3 })));
    plaque.position.set(x, y - 0.25, ROOM.minZ + 0.065);
    anchor.add(plaque);
  }
}

async function enterShowcase() {
  if (view.mode !== 'free') return;
  const pos = new THREE.Vector3(0, 1.72, ROOM.minZ + 2.3);
  await flyTo(pos, lookQuat(pos, new THREE.Vector3(0, 1.78, ROOM.minZ)), 1000);
  view.mode = 'showcase';
}

// ---------------------------------------------------------------- case opening
const fx = { weapon: null, light: null, glow: null, particles: null, caseModel: null };

function burst(color, origin) {
  const N = 260, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) {
    pos.set([origin.x, origin.y, origin.z], i * 3);
    const a = Math.random() * Math.PI * 2, up = 0.6 + Math.random() * 1.6, sp = 0.3 + Math.random() * 1.1;
    vel.push(new THREE.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, map: makeDustSprite(), size: 0.035, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.userData = { vel, life: 0 };
  scene.add(pts);
  return pts;
}

function clearFx() {
  for (const k of ['weapon', 'light', 'glow', 'particles', 'caseModel']) {
    if (!fx[k]) continue;
    scene.remove(fx[k]);
    if (k === 'particles') fx[k].geometry.dispose();
    if (k === 'particles' || k === 'glow') { fx[k].material.map?.dispose(); fx[k].material.dispose(); }
    fx[k] = null;
  }
}

async function openCase(caseId, chained = false) {
  if (document.body.classList.contains('busy')) return;
  document.body.classList.add('busy');
  UI.tooltip(null);
  let res;
  try { res = await api.open(caseId); } catch (e) {
    sfx.error(); UI.toast(e.message, 'error');
    document.body.classList.remove('busy');
    return;
  }
  const def = store.cases[caseId];
  const spot = refs.openSpot;
  const camPos = spot.clone().add(new THREE.Vector3(0.95, 0.5, 0));
  const camLook = spot.clone().add(new THREE.Vector3(-0.05, 0.16, 0));

  // case flies from the rack to the mat while the camera moves in
  clearFx();
  const slot = refs.caseSlots.find(s => s.caseId === caseId);
  const startPos = slot.anchor.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05, 0));
  const model = buildCase(def);
  model.rotation.y = Math.PI / 2;
  model.position.copy(chained ? spot : startPos);
  model.traverse(o => { o.castShadow = true; });
  scene.add(model);
  fx.caseModel = model;
  refreshRack();

  view.mode = 'opening';
  const camFly = flyTo(camPos, lookQuat(camPos, camLook), chained ? 300 : 1000);
  if (!chained) {
    await tween(1000, t => {
      model.position.lerpVectors(startPos, spot, t);
      model.position.y += Math.sin(t * Math.PI) * 0.18;
      model.rotation.z = Math.sin(t * Math.PI) * 0.25;
    });
  }
  await camFly;

  // latches, shake, lid opens
  sfx.latch();
  await tween(450, t => { model.rotation.x = Math.sin(t * 40) * 0.02 * (1 - t); }, x => x);
  sfx.lid();
  const { lidPivot, glow } = model.userData;
  const light = new THREE.PointLight(0xfff4dd, 0, 2, 2);
  light.position.copy(spot).add(new THREE.Vector3(0.15, 0.45, 0));
  scene.add(light);
  fx.light = light;
  await tween(800, t => {
    lidPivot.rotation.x = -1.75 * t;
    glow.material.opacity = 0.4 * t;
    light.intensity = 1.2 * t;
  });

  // reel
  sfx.whoosh();
  await UI.spinReel(res.reel, res.win, def.name);
  UI.hideReel();

  // reveal the weapon
  const item = res.item, sk = store.skins[item.skin];
  const color = new THREE.Color(RARITY_COLORS[sk.rarity]);
  sfx.reveal(sk.rarity);
  light.color.copy(color);
  glow.material.color.copy(color);
  const weapon = buildWeapon(sk.weapon, sk, item.float, { fit: sk.type === 'pistol' ? 0.36 : 0.62 });
  weapon.position.copy(spot).add(new THREE.Vector3(0, 0.05, 0));
  weapon.rotation.y = Math.PI / 2;
  scene.add(weapon);
  fx.weapon = weapon;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowSprite(RARITY_COLORS[sk.rarity]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.scale.setScalar(sk.rarity === 'legendary' ? 1.3 : 0.9);
  halo.position.copy(spot).add(new THREE.Vector3(-0.15, 0.32, 0));
  scene.add(halo);
  fx.glow = halo;
  fx.particles = burst(color, spot.clone().add(new THREE.Vector3(0, 0.1, 0)));
  const intensity = { common: 1.2, rare: 2, epic: 3, legendary: 5 }[sk.rarity];
  await tween(1100, t => {
    weapon.position.y = spot.y + 0.05 + t * 0.27;
    halo.material.opacity = t * 0.8;
    light.intensity = 1.2 + intensity * t;
  });
  fx.spin = true;

  api.commitPending();
  const left = store.state.cases[caseId] || 0;
  const choice = await UI.showReveal(item, left);
  fx.spin = false;
  if (choice === 'sell') {
    try {
      const r = await api.sell([item.uid]);
      sfx.sell();
      UI.toast(`Sold for <b>${fmt(r.earned)}</b>`, 'good');
    } catch (e) { UI.toast(e.message, 'error'); }
  } else if (choice === 'keep') {
    UI.toast(`${sk.name} added to inventory`, 'good');
  }

  // close up
  await tween(500, t => {
    weapon.scale.multiplyScalar(0.92);
    halo.material.opacity *= 0.85;
    lidPivot.rotation.x = -1.75 * (1 - t);
    glow.material.opacity = 0.4 * (1 - t);
    light.intensity *= 0.9;
  });
  document.body.classList.remove('busy');
  if (choice === 'again' && (store.state.cases[caseId] || 0) > 0) {
    scene.remove(model); fx.caseModel = null;
    return openCase(caseId, true);
  }
  clearFx();
  await goHome('left');
}

// ---------------------------------------------------------------- mute / help
function toggleMute() {
  sfx.setMuted(!sfx.muted);
  $('#btnMute').textContent = sfx.muted ? '🔇' : '🔊';
}
$('#btnMute').addEventListener('click', toggleMute);
$('#btnHelp').addEventListener('click', () => UI.toast('Drag to look · A: cases · D: PC · W: Hall of Drops · Esc: back · M: mute'));
document.querySelectorAll('.hud-nav button').forEach(b => b.addEventListener('click', () => { sfx.click(); turn(b.dataset.view); }));

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let screenTimer = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt * 1000;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.easing(k));
    if (k >= 1) { tweens.splice(i, 1); tw.resolve(); }
  }

  if (view.mode === 'free' || view.mode === 'intro') {
    if (view.mode === 'intro') view.tYaw = Math.sin(t * 0.15) * 0.6;
    view.yaw += (view.tYaw - view.yaw) * Math.min(1, dt * 7);
    view.pitch += (view.tPitch - view.pitch) * Math.min(1, dt * 7);
    camera.quaternion.copy(freeQuat(view.yaw, view.pitch, tmpQ));
    camera.position.set(HOME.x, HOME.y + Math.sin(t * 1.3) * 0.004, HOME.z);
  }

  if (fx.spin && fx.weapon) fx.weapon.rotation.y += dt * 0.6;
  if (fx.particles) {
    const p = fx.particles, pos = p.geometry.attributes.position, ud = p.userData;
    ud.life += dt;
    for (let i = 0; i < pos.count; i++) {
      const v = ud.vel[i];
      v.y -= dt * 2.2;
      pos.setXYZ(i, pos.getX(i) + v.x * dt * 0.5, Math.max(refs.openSpot.y, pos.getY(i) + v.y * dt * 0.5), pos.getZ(i) + v.z * dt * 0.5);
    }
    pos.needsUpdate = true;
    p.material.opacity = Math.max(0, 1 - ud.life / 2.5);
  }
  if (fx.glow) fx.glow.material.rotation += dt * 0.2;

  animateRoom(refs, t, dt);
  updateHover();

  screenTimer -= dt;
  if (screenTimer <= 0 && view.mode !== 'monitor') { drawScreen(); screenTimer = 0.25; }
  refs.monitor.light.intensity = 1.4 + Math.sin(t * 2) * 0.1;

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (view.mode === 'monitor') {
    // re-fit the camera to the screen for the new aspect
    const { center, normal } = monitorFrame();
    const { width: SW, height: SH } = refs.monitor;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max((SH * 1.04) / (2 * tanH), (SW * 1.04) / (2 * tanH * camera.aspect));
    camera.position.copy(center).addScaledVector(normal, d);
    camera.updateMatrixWorld();
    UI.placeMonitor(monitorRect());
  }
});

// ---------------------------------------------------------------- boot
(async function boot() {
  requestAnimationFrame(loop);
  try {
    await api.init();
  } catch (e) {
    $('#enterBtn').textContent = 'Server not reachable — run: python3 server.py';
    return;
  }
  UI.initUI();
  refreshRack();
  refreshShowcase();
  drawScreen();
  store.on('state', () => { refreshRack(); refreshShowcase(); });
  store.on('cases', () => refreshRack());
  let mTick = 0;
  store.on('values', () => { if (++mTick % 4 === 0) { showcaseKey = ''; refreshShowcase(); } });
  setInterval(() => api.refreshMarket().catch(() => {}), (store.market.tickSeconds || 4) * 1000);
  warmThumbs(store.catalog.skins);

  const btn = $('#enterBtn');
  btn.disabled = false;
  btn.textContent = 'Enter the storage';
  btn.onclick = () => {
    sfx.unlock();
    sfx.startHum();
    $('#intro').classList.add('fade');
    $('#hud').classList.remove('hidden');
    view.tYaw = 0; view.tPitch = -0.05;
    view.mode = 'free';
    const nCases = Object.values(store.state.cases).reduce((a, b) => a + b, 0);
    UI.toast(nCases ? 'Your cases are on the rack to the left (A).' : 'Head to the PC on the right (D) to buy your first case.');
  };
})();
