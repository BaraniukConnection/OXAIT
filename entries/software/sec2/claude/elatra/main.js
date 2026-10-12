import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

/* =====================================================================
   Elatra E-Alpha — procedural 3D phone driven by scroll position.
   Phone local axes: +z = display, -z = back (modules), +y = top.
   Seen from the back (rotY = π), local +x appears on the LEFT of screen.
   ===================================================================== */

// ---------------- dimensions ----------------
const W = 3.2, H = 6.6, D = 0.34;           // chassis
const MW = 2.9, MD = 0.13;                  // module width / depth
const SLOT_H = [1.95, 2.75, 1.4];           // camera / compute / audio
const SLOT_Y = [2.145, -0.275, -2.42];
const Z_SEAT = -D / 2 - MD / 2 + 0.01;
const TOP = -MD / 2;                        // module outer face (local)
const PI = Math.PI;

// ---------------- renderer / scene ----------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.85;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0, 18);

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x0b0b0e, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 8, 10); scene.add(key);
const rim = new THREE.DirectionalLight(0x9fd8ff, 2.6); rim.position.set(-8, 3, -6); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xffffff, 1.4); rim2.position.set(8, -2, -8); scene.add(rim2);

// ---------------- procedural textures ----------------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const noiseTex = canvasTex(256, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, false);
noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
noiseTex.repeat.set(3, 3);

const grilleTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3a3b40'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#050506';
  const step = 16;
  for (let y = 0; y < h; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) {
    g.beginPath(); g.arc(x + 4, y + 8, 5, 0, PI * 2); g.fill();
  }
});
grilleTex.wrapS = grilleTex.wrapT = THREE.RepeatWrapping;
grilleTex.repeat.set(2.4, 2);

// ---------------- materials ----------------
const M = {
  frame: new THREE.MeshPhysicalMaterial({ color: 0x3a3c40, metalness: 1, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2 }),
  frontGlass: new THREE.MeshPhysicalMaterial({ color: 0x020203, metalness: 0, roughness: 0.05, clearcoat: 1 }),
  backplate: new THREE.MeshStandardMaterial({ color: 0x1b1c20, metalness: 0.6, roughness: 0.55 }),
  module: new THREE.MeshPhysicalMaterial({ color: 0x141416, metalness: 0.25, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.6, bumpMap: noiseTex, bumpScale: 0.6 }),
  moduleInset: new THREE.MeshPhysicalMaterial({ color: 0x18181b, metalness: 0.2, roughness: 0.5, bumpMap: noiseTex, bumpScale: 0.3 }),
  island: new THREE.MeshPhysicalMaterial({ color: 0x3a3b40, metalness: 0.95, roughness: 0.26, clearcoat: 0.6 }),
  islandPro: new THREE.MeshPhysicalMaterial({ color: 0x6d7077, metalness: 1, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  lensRing: new THREE.MeshStandardMaterial({ color: 0x9a9da4, metalness: 1, roughness: 0.16 }),
  darkRing: new THREE.MeshStandardMaterial({ color: 0x1d1e22, metalness: 0.9, roughness: 0.3 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x030406, metalness: 0, roughness: 0.04, clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.6 }),
  lensCore: new THREE.MeshPhysicalMaterial({ color: 0x0b1626, metalness: 0.4, roughness: 0.1, clearcoat: 1, iridescence: 1 }),
  flash: new THREE.MeshStandardMaterial({ color: 0xf3e6c4, emissive: 0x6a5a30, emissiveIntensity: 0.6, roughness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a74a, metalness: 1, roughness: 0.28 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0.3, roughness: 0.6 }),
  chip: new THREE.MeshStandardMaterial({ color: 0x2a2b30, metalness: 0.7, roughness: 0.35 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6cc8ff, emissiveIntensity: 2.2 }),
  grille: new THREE.MeshStandardMaterial({ map: grilleTex, bumpMap: grilleTex, bumpScale: 2, metalness: 0.7, roughness: 0.45 }),
  port: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 }),
};

// ---------------- geometry helpers ----------------
function rrShape(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// rounded slab centred on origin, thickness along z
function slab(w, h, d, r, b = 0.025) {
  const depth = Math.max(0.002, d - 2 * b);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, Math.max(0.005, r - b)),
    { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 18 });
  g.translate(0, 0, -depth / 2);
  return g;
}
// flat rounded rect with 0..1 UVs
function shapePlane(w, h, r) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 24);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}
function mk(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
}
// cylinder facing ±z
function disc(r, d, mat, seg = 48) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, seg), mat);
  m.rotation.x = PI / 2; return m;
}
// text decal that faces -z (readable from the back)
function decal(text, w, h, { font = '600 120px Montserrat', opacity = 0.5, color = '#ffffff', spacing = 0 } = {}) {
  const cw = 1024, ch = Math.round(1024 * h / w);
  const tex = canvasTex(cw, ch, (g) => {
    g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    g.fillText(text, cw / 2, ch / 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity, metalness: 0.6, roughness: 0.35, depthWrite: false }));
  m.rotation.y = PI;
  return m;
}

function lens(r, { accent = false } = {}) {
  const g = new THREE.Group();
  g.add(disc(r, 0.09, M.lensRing));
  g.add(disc(r * 0.84, 0.093, M.darkRing));
  g.add(disc(r * 0.72, 0.096, M.glass));
  g.add(disc(r * 0.34, 0.099, M.lensCore, 32));
  const glint = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, r * 0.018, 8, 48), M.lensRing);
  glint.position.z = -0.05; g.add(glint);
  if (accent) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.07, 0.014, 8, 64), M.accent);
    ring.position.z = -0.03; g.add(ring);
  }
  return g;
}

// ---------------- screen texture ----------------
const SCR_W = W - 0.22, SCR_H = H - 0.22;
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 1024; screenCanvas.height = Math.round(1024 * SCR_H / SCR_W);
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
const logoImg = new Image(); logoImg.src = 'assets/logo-mark.png';

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function drawScreen() {
  const g = screenCanvas.getContext('2d'), w = screenCanvas.width, h = screenCanvas.height;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#9aa0aa'); bg.addColorStop(0.4, '#545862'); bg.addColorStop(1, '#16171b');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // diagonal wallpaper split (as in product shot)
  const dg = g.createLinearGradient(0, h * 0.35, w, h);
  dg.addColorStop(0, '#2b2e35'); dg.addColorStop(1, '#0d0e11');
  g.fillStyle = dg; g.beginPath();
  g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.33); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath();
  g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.33); g.lineTo(w, h * 0.345); g.lineTo(0, h * 0.515); g.fill();

  // status bar
  g.fillStyle = '#fff'; g.font = '600 40px Inter, sans-serif'; g.textBaseline = 'middle';
  g.fillText('11:30', 70, 78);
  g.fillStyle = '#000'; g.beginPath(); g.arc(w / 2, 78, 26, 0, PI * 2); g.fill();
  g.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) g.fillRect(w - 250 + i * 14, 92 - i * 9 - 10, 9, 10 + i * 9);
  rr(g, w - 160, 62, 70, 32, 8); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
  rr(g, w - 155, 67, 48, 22, 4); g.fill(); g.fillRect(w - 88, 71, 5, 14);

  // clock widget
  g.textAlign = 'center';
  g.font = '200 250px Inter, sans-serif'; g.fillText('11:30', w / 2, h * 0.15);
  g.font = '400 44px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillText('Monday, 12 October', w / 2, h * 0.225);

  // module status widget
  const cy = h * 0.27;
  rr(g, 70, cy, w - 140, 260, 48); g.fillStyle = 'rgba(15,16,20,0.55)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; g.stroke();
  if (logoImg.complete && logoImg.naturalWidth) g.drawImage(logoImg, 115, cy + 45, 125, 125 * logoImg.naturalHeight / logoImg.naturalWidth);
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '700 54px Montserrat, sans-serif';
  g.fillText('E-ALPHA', 285, cy + 80);
  g.font = '400 36px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('3 modules connected', 285, cy + 140);
  ['#9fd8ff', '#9fd8ff', '#9fd8ff'].forEach((c, i) => {
    rr(g, 285 + i * 120, cy + 185, 100, 14, 7); g.fillStyle = c; g.fill();
  });
  g.font = '600 40px Inter, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'right';
  g.fillText('87%', w - 120, cy + 80);

  // search pill
  const sy = h * 0.62;
  rr(g, 70, sy, w - 140, 120, 60); g.fillStyle = 'rgba(240,242,246,0.92)'; g.fill();
  g.fillStyle = '#6b6f78'; g.textAlign = 'left'; g.font = '400 40px Inter, sans-serif';
  g.fillText('Search', 140, sy + 62);
  g.beginPath(); g.arc(w - 150, sy + 60, 18, 0, PI * 2); g.strokeStyle = '#6b6f78'; g.lineWidth = 5; g.stroke();

  // app icons
  const icon = (x, y, c1, c2, label, glyph) => {
    const s = 160, gr = g.createLinearGradient(x, y, x, y + s);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    rr(g, x, y, s, s, 44); g.fillStyle = gr; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 10;
    const cx = x + s / 2, cyy = y + s / 2;
    if (glyph === 'circle') { g.beginPath(); g.arc(cx, cyy, 36, 0, PI * 2); g.stroke(); }
    if (glyph === 'dot') { g.beginPath(); g.arc(cx, cyy, 30, 0, PI * 2); g.fill(); }
    if (glyph === 'square') { rr(g, cx - 34, cyy - 34, 68, 68, 14); g.stroke(); }
    if (glyph === 'tri') { g.beginPath(); g.moveTo(cx - 26, cyy - 36); g.lineTo(cx + 34, cyy); g.lineTo(cx - 26, cyy + 36); g.fill(); }
    if (glyph === 'cube') { g.beginPath(); g.moveTo(cx, cyy - 40); g.lineTo(cx + 36, cyy - 18); g.lineTo(cx + 36, cyy + 24); g.lineTo(cx, cyy + 44); g.lineTo(cx - 36, cyy + 24); g.lineTo(cx - 36, cyy - 18); g.closePath(); g.stroke(); }
    if (glyph === 'lens') { g.fillStyle = '#0b0c10'; g.beginPath(); g.arc(cx, cyy, 44, 0, PI * 2); g.fill(); g.strokeStyle = '#8a8d93'; g.lineWidth = 8; g.stroke(); }
    if (label) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.textAlign = 'center'; g.font = '400 32px Inter, sans-serif'; g.fillText(label, cx, y + s + 40); }
  };
  const cols = [70 + 0, 70 + (w - 140 - 160) / 3, 70 + 2 * (w - 140 - 160) / 3, w - 70 - 160];
  const ay = h * 0.69;
  icon(cols[0], ay, '#ff7a7a', '#d3394a', 'Music', 'tri');
  icon(cols[1], ay, '#8ab4ff', '#4e5fe0', 'Modules', 'cube');
  icon(cols[2], ay, '#55e39a', '#1a9e66', 'Store', 'square');
  icon(cols[3], ay, '#ffd36b', '#ee8f12', 'Photos', 'circle');
  const dy = h * 0.855;
  icon(cols[0], dy, '#5ad06c', '#2e9e48', null, 'dot');
  icon(cols[1], dy, '#6aa0ff', '#3355dd', null, 'square');
  icon(cols[2], dy, '#f4f4f6', '#c8cad0', null, 'circle');
  icon(cols[3], dy, '#3b3d44', '#1e2025', null, 'lens');
  g.fillStyle = 'rgba(255,255,255,0.8)'; rr(g, w / 2 - 130, h - 40, 260, 10, 5); g.fill();
  screenTex.needsUpdate = true;
}
drawScreen();
logoImg.onload = drawScreen;
document.fonts?.ready.then(drawScreen);

// ---------------- chassis ----------------
const stage = new THREE.Group();     // layout (position/scale)
const phone = new THREE.Group();     // story rotation
stage.add(phone); scene.add(stage);

phone.add(mk(slab(W, H, D, 0.46, 0.08), M.frame));
phone.add(mk(shapePlane(W - 0.08, H - 0.08, 0.42), M.frontGlass, 0, 0, D / 2 + 0.002));
phone.add(mk(shapePlane(SCR_W, SCR_H, 0.36),
  new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.95, roughness: 0.12 }),
  0, 0, D / 2 + 0.004));

const back = mk(shapePlane(W - 0.18, H - 0.18, 0.38), M.backplate, 0, 0, -D / 2 - 0.004);
back.rotation.y = PI; phone.add(back);

{ // raised rim around the module bay
  const ring = rrShape(W - 0.01, H - 0.01, 0.45);
  ring.holes.push(rrShape(W - 0.17, H - 0.17, 0.38));
  const g = new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
  phone.add(mk(g, M.frame, 0, 0, -D / 2 - 0.11));
}

{ // pogo-pin pads + PCB details under each slot (visible when exploded)
  const pinGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.03, 12); pinGeo.rotateX(PI / 2);
  const pins = new THREE.InstancedMesh(pinGeo, M.gold, 36);
  const m4 = new THREE.Matrix4(); let n = 0;
  SLOT_Y.forEach((y, k) => {
    const py = y - SLOT_H[k] / 2 + 0.32;
    phone.add(mk(slab(0.95, 0.3, 0.03, 0.06, 0.008), M.pad, 0, py, -D / 2 - 0.012));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
      m4.makeTranslation(-0.3 + c * 0.12, py - 0.055 + r * 0.11, -D / 2 - 0.03);
      pins.setMatrixAt(n++, m4);
    }
  });
  phone.add(pins);
  [[0.75, 2.4, 0.9, 0.7], [-0.7, 2.1, 0.6, 0.5], [0.6, -0.1, 1.1, 1.1], [-0.65, -0.6, 0.7, 1.4], [0, -2.25, 1.6, 0.45]]
    .forEach(([x, y, w, h]) => phone.add(mk(slab(w, h, 0.03, 0.05, 0.008), M.chip, x, y, -D / 2 - 0.012)));
}

// side buttons, USB-C, mic
phone.add(mk(slab(0.07, 0.62, 0.12, 0.03, 0.015), M.frame, -W / 2 - 0.015, 1.45, 0));
phone.add(mk(slab(0.07, 0.42, 0.12, 0.03, 0.015), M.frame, -W / 2 - 0.015, 0.75, 0));
phone.add(mk(slab(0.07, 0.42, 0.12, 0.03, 0.015), M.frame, W / 2 + 0.015, 1.1, 0));
{
  const usb = mk(slab(0.5, 0.12, 0.05, 0.05, 0.01), M.port, 0, -H / 2 + 0.01, 0);
  usb.rotation.x = PI / 2; phone.add(usb);
  [-0.6, 0.6].forEach((x) => { const h = disc(0.03, 0.05, M.port, 12); h.rotation.x = 0; h.position.set(x, -H / 2 + 0.005, 0); phone.add(h); });
}

// ---------------- modules ----------------
function baseModule(slot) {
  const g = new THREE.Group();
  g.add(mk(slab(MW, SLOT_H[slot], MD, 0.2, 0.03), M.module));
  return g;
}

function stdCamera() {
  const g = baseModule(0);
  g.add(mk(slab(1.5, 1.78, 0.1, 0.34, 0.03), M.island, 0.62, 0, TOP - 0.04));
  [0.56, 0, -0.56].forEach((y) => { const l = lens(0.235); l.position.set(0.92, y, TOP - 0.12); g.add(l); });
  const f = disc(0.09, 0.04, M.flash, 24); f.position.set(0.32, 0.5, TOP - 0.1); g.add(f);
  const s = disc(0.05, 0.04, M.darkRing, 16); s.position.set(0.32, 0.12, TOP - 0.1); g.add(s);
  const d = decal('50 MP', 0.6, 0.15, { font: '600 120px Montserrat', opacity: 0.35 }); d.position.set(0.32, -0.55, TOP - 0.095); g.add(d);
  return g;
}

function proCamera() {
  const g = baseModule(0);
  g.add(mk(slab(2.72, 1.8, 0.14, 0.42, 0.04), M.islandPro, 0, 0, TOP - 0.06));
  const z = TOP - 0.16;
  const main = lens(0.42, { accent: true }); main.position.set(0.74, 0.38, z - 0.01); g.add(main);
  const uw = lens(0.28); uw.position.set(-0.02, 0.48, z); g.add(uw);
  // periscope (square)
  const peri = new THREE.Group();
  peri.add(mk(slab(0.66, 0.66, 0.09, 0.12, 0.02), M.lensRing));
  peri.add(mk(slab(0.52, 0.52, 0.095, 0.08, 0.015), M.darkRing));
  peri.add(mk(slab(0.42, 0.42, 0.1, 0.06, 0.015), M.glass));
  peri.add(mk(slab(0.16, 0.16, 0.104, 0.03, 0.01), M.lensCore));
  peri.position.set(0.74, -0.5, z); g.add(peri);
  const f = disc(0.1, 0.05, M.flash, 24); f.position.set(-0.02, -0.25, z + 0.01); g.add(f);
  const l = disc(0.06, 0.05, M.darkRing, 16); l.position.set(-0.02, -0.58, z + 0.01); g.add(l);
  const d1 = decal('ELATRA OPTICS', 0.95, 0.14, { font: '700 110px Montserrat', opacity: 0.75, spacing: 18 });
  d1.position.set(-0.78, 0.25, TOP - 0.135); g.add(d1);
  const d2 = decal('200MP · 5× PERISCOPE', 0.95, 0.1, { font: '500 80px Inter', opacity: 0.55 });
  d2.position.set(-0.78, 0.05, TOP - 0.135); g.add(d2);
  return g;
}

function stdBattery() {
  const g = baseModule(1);
  g.add(mk(slab(2.62, 2.48, 0.02, 0.15, 0.008), M.moduleInset, 0, 0, TOP - 0.008));
  const d = decal('E-Alpha', 0.9, 0.2, { font: '500 150px Montserrat', opacity: 0.4 });
  d.rotation.z = PI / 2; d.position.set(-1.12, -0.6, TOP - 0.022); g.add(d);
  return g;
}

function perfModule() {
  const g = baseModule(1);
  for (let i = 0; i < 14; i++) g.add(mk(slab(1.42, 0.07, 0.11, 0.03, 0.012), M.island, 0.56, -1.11 + i * 0.171, TOP - 0.05));
  const fan = new THREE.Group(); fan.position.set(-0.8, 0.05, TOP);
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 64, 1, true), M.frame);
  housing.material = M.frame.clone(); housing.material.side = THREE.DoubleSide;
  housing.rotation.x = PI / 2; housing.position.z = -0.06; fan.add(housing);
  const floor = disc(0.59, 0.01, M.pad, 48); floor.position.z = -0.005; fan.add(floor);
  const blades = new THREE.Group(); blades.position.z = -0.06;
  for (let i = 0; i < 11; i++) {
    const p = new THREE.Group(); p.rotation.z = (i / 11) * PI * 2;
    const b = mk(new THREE.BoxGeometry(0.36, 0.11, 0.015), M.chip, 0.33, 0, 0); b.rotation.x = 0.55; b.rotation.z = 0.25;
    p.add(b); blades.add(p);
  }
  const hub = disc(0.16, 0.08, M.lensRing, 32); blades.add(hub);
  const hubCap = decal('E', 0.2, 0.2, { font: '800 700px Montserrat', opacity: 0.8, color: '#111' });
  hubCap.position.z = -0.045; blades.add(hubCap);
  fan.add(blades);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.016, 8, 72), M.accent); ring.position.z = -0.12; fan.add(ring);
  g.add(fan);
  g.userData.spin = blades;
  const d = decal('OVERCLOCKED · 3.7 GHz', 1.2, 0.12, { font: '600 76px Inter', opacity: 0.6 });
  d.position.set(-0.8, -0.95, TOP - 0.004); g.add(d);
  return g;
}

function stdSpeaker() {
  const g = baseModule(2);
  g.add(mk(slab(1.6, 0.07, 0.03, 0.035, 0.01), M.pad, 0, -0.4, TOP - 0.01));
  const d = decal('ELATRA', 0.8, 0.14, { font: '700 110px Montserrat', opacity: 0.25, spacing: 30 });
  d.position.set(0, 0.15, TOP - 0.003); g.add(d);
  return g;
}

function audioModule() {
  const g = baseModule(2);
  [0.7, -0.7].forEach((x) => {
    g.add(mk(slab(1.28, 1.06, 0.06, 0.24, 0.02), M.lensRing, x, 0, TOP - 0.025));
    g.add(mk(slab(1.16, 0.94, 0.08, 0.2, 0.02), M.grille, x, 0, TOP - 0.035));
  });
  g.add(mk(slab(0.035, 0.6, 0.06, 0.017, 0.008), M.accent, 0, 0, TOP - 0.03));
  return g;
}

const slots = [
  { std: stdCamera(), up: proCamera(), swap: [2.65, 3.5],
    names: [['Standard Camera', 'Triple lens · 50 MP'], ['High-Performance Camera', 'Large sensor · 5× periscope']] },
  { std: stdBattery(), up: perfModule(), swap: [3.65, 4.5],
    names: [['Processor / Battery', 'Snapdragon 8 Gen 3 · 5000 mAh'], ['Performance Boost', 'Overclocked SoC · active cooling']] },
  { std: stdSpeaker(), up: audioModule(), swap: [4.65, 5.5],
    names: [['Speaker / I/O', 'Mono speaker · USB-C'], ['Dynamic Audio', 'Front-firing stereo speakers']] },
];
slots.forEach((s) => phone.add(s.std, s.up));

// ---------------- labels (HTML overlay) ----------------
const labelsEl = document.getElementById('labels');
slots.forEach((s) => {
  const el = document.createElement('div'); el.className = 'label';
  el.innerHTML = '<i></i><em></em><div><b></b><span></span></div>';
  labelsEl.appendChild(el);
  s.el = el; s.title = el.querySelector('b'); s.sub = el.querySelector('span'); s.shown = -1;
});
const railItems = [...document.querySelectorAll('#rail li')];
const panels = [...document.querySelectorAll('.step .panel')];
const stepsEl = document.querySelector('.steps');
const storyEl = document.getElementById('story');

// ---------------- timeline helpers ----------------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lin = (s, a, b) => clamp((s - a) / (b - a));
const w = (s, a, b) => ease(lin(s, a, b));

// ---------------- layout ----------------
const layout = { x: 0, y: 0, s: 1, wide: true };
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix();
  const visH = 2 * camera.position.z * Math.tan((camera.fov * PI) / 360), visW = visH * camera.aspect;
  layout.wide = camera.aspect > 1.05;
  if (layout.wide) { layout.x = visW * 0.17; layout.y = 0; layout.s = Math.min(1, visW / 13); }
  else { layout.x = 0; layout.y = visH * 0.2; layout.s = Math.min(0.75, visW / 7, visH / 15); }
}
window.addEventListener('resize', resize);
resize();

// ---------------- scroll state ----------------
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = panels.length;
let sTarget = 0, sCur = -1;
function readScroll() {
  const r = stepsEl.getBoundingClientRect(), stepH = r.height / N;
  sTarget = clamp((window.innerHeight * 0.5 - r.top) / stepH, 0, N);
}
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ---------------- per-frame update ----------------
const v3 = new THREE.Vector3();
const EXPLODE = [[0, 0.45, -1.8], [0, 0, -1.25], [0, -0.45, -0.75]];

function update(s, t) {
  const spin = w(s, 0.7, 1.6);
  const exAll = w(s, 1.7, 2.5) * (1 - w(s, 5.6, 6.3));
  const rebuild = w(s, 5.6, 6.45);
  const idle = 1 - 0.6 * exAll;

  phone.rotation.y = -0.45 + (3 * PI + 0.45) * spin - 0.62 * w(s, 1.7, 2.5) + 2 * PI * rebuild
    + Math.sin(t * 0.45) * 0.07 * idle + mouse.x * 0.12;
  phone.rotation.x = 0.08 - 0.08 * spin - 0.5 * w(s, 1.7, 2.5) + 0.36 * rebuild + mouse.y * 0.06;
  phone.rotation.z = -0.06 + 0.06 * spin + 0.12 * w(s, 1.7, 2.5) - 0.08 * rebuild;

  stage.position.set(layout.x * (1 - 0.1 * exAll), layout.y + Math.sin(t * 0.9) * 0.06 - 0.55 * exAll * layout.s, 0);
  stage.scale.setScalar(layout.s * (1 - 0.24 * exAll));

  slots.forEach((sl, k) => {
    const e = w(s, 1.7 + 0.1 * k, 2.4 + 0.1 * k) * (1 - w(s, 5.6 + 0.1 * (2 - k), 6.15 + 0.1 * (2 - k)));
    const [ex, ey, ez] = EXPLODE[k];
    const bx = ex * e, by = SLOT_Y[k] + ey * e, bz = Z_SEAT + ez * e;
    const q = lin(s, sl.swap[0], sl.swap[1]);
    const o = ease(clamp(q / 0.6)), i = ease(clamp((q - 0.4) / 0.6)), ii = 1 - i;

    sl.std.visible = o < 0.999;
    sl.std.position.set(bx - 4.6 * o, by + 1.6 * o, bz - 1.4 * o);
    sl.std.rotation.set(0.5 * o, -0.9 * o, -0.6 * o);
    sl.std.scale.setScalar(1 - 0.25 * o);

    sl.up.visible = i > 0.001;
    sl.up.position.set(bx, by + 6 * ii, bz - 2.4 * ii);
    sl.up.rotation.set(-0.7 * ii, 0.2 * ii, 0.4 * ii);

    // label
    const which = q < 0.5 ? 0 : 1;
    if (which !== sl.shown) { sl.shown = which; sl.title.textContent = sl.names[which][0]; sl.sub.textContent = sl.names[which][1]; }
    const vis = w(s, 2.0 + 0.1 * k, 2.5 + 0.1 * k) * (1 - w(s, 5.5, 5.8)) * (1 - Math.min(1, Math.sin(PI * q) * 1.8));
    sl.el.style.opacity = vis.toFixed(3);
    sl.el.classList.toggle('active', s > sl.swap[0] - 0.15 && s < sl.swap[1] + 0.5);
    if (vis > 0.001) {
      const m = which ? sl.up : sl.std;
      m.updateWorldMatrix(true, false);
      v3.set(-MW / 2, 0, TOP).applyMatrix4(m.matrixWorld).project(camera);
      const x = (v3.x * 0.5 + 0.5) * window.innerWidth, y = (-v3.y * 0.5 + 0.5) * window.innerHeight;
      sl.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  });

  // HUD: panels + rail
  panels.forEach((p, i) => {
    const d = s - (i + 0.5);
    p.style.opacity = clamp(1.45 - Math.abs(d) * 2.3).toFixed(3);
    p.style.transform = `translateY(${(-d * 30).toFixed(1)}px)`;
  });
  const active = clamp(Math.floor(s), 0, N - 1);
  railItems.forEach((li, i) => li.classList.toggle('on', i === active));
}

// ---------------- loop ----------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  readScroll();
  if (sCur < 0 || reduceMotion) sCur = sTarget;
  else sCur += (sTarget - sCur) * (1 - Math.exp(-dt * 7));
  mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;

  const r = storyEl.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return;   // story off-screen: skip rendering
  slots[1].up.userData.spin.rotation.z -= dt * 9;
  update(sCur, t);
  renderer.render(scene, camera);
}
renderer.compile(scene, camera);
frame();
document.getElementById('loader').classList.add('done');

// ---------------- page extras ----------------
const counters = document.querySelectorAll('[data-count]');
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (!en.isIntersecting) return;
  const el = en.target, end = +el.dataset.count, t0 = performance.now();
  const tick = (now) => { const p = clamp((now - t0) / 1400); el.textContent = Math.round(end * ease(p)); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick); io.unobserve(el);
}), { threshold: 0.6 });
counters.forEach((c) => io.observe(c));

document.getElementById('signup').addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('formNote').textContent = "You're on the list — this is a local demo, nothing was sent.";
});
