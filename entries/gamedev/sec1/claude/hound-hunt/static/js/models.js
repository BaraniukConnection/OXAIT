// Low-poly tank models, built from primitives and extruded outlines.
// Convention: tank forward = local +Z, left = +X, up = +Y.
import * as THREE from 'three';

const matCache = new Map();
export function lam(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    matCache.set(color, m);
  }
  return m;
}

const WRECK_MATS = [lam(0x221f1c), lam(0x2f2a25), lam(0x3b342c)];

function add(geo, color, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d, color, parent, x, y, z) => add(new THREE.BoxGeometry(w, h, d), color, parent, x, y, z);

// Top-view outline [[fwd, lat], ...] extruded upward by h (base at y = 0).
function prismTop(pts, h, bevel = 0.06) {
  const shape = new THREE.Shape(pts.map(([f, l]) => new THREE.Vector2(f, l)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 1, curveSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

// Side profile [[fwd, up], ...] extruded across width w (centered on x = 0).
function prismSide(pts, w, bevel = 0.05) {
  const shape = new THREE.Shape(pts.map(([f, u]) => new THREE.Vector2(f, u)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: w - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 1, curveSegments: 1,
  });
  g.rotateY(-Math.PI / 2);
  g.translate(w / 2 - bevel, 0, 0);
  return g;
}

// Cylinder along +Z starting at z0.
function tube(r0, r1, len, z0, seg = 8) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0 + len / 2);
  return g;
}

function wheelGeo(r, w) {
  const g = new THREE.CylinderGeometry(r, r, w, 10);
  g.rotateZ(Math.PI / 2);
  return g;
}

// Plate group laid on the glacis slope, children placed in plate-local XZ.
function glacisPlate(o, body) {
  const zf = o.L / 2 + 0.15, zb = o.L / 2 - o.glacis;
  const g = new THREE.Group();
  g.position.set(0, (0.98 + o.top) / 2, (zf + zb) / 2);
  g.rotation.x = Math.atan2(o.top - 0.98, zf - zb);
  body.add(g);
  return g;
}

function chassis(o, c) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const { L, W, top, glacis } = o;
  const tw = 0.64, tx = W / 2 - tw / 2;

  const trackProf = [[-L / 2, 0.16], [L / 2 - 0.3, 0.16], [L / 2 + 0.2, 0.62], [L / 2 - 0.1, 0.98],
    [-L / 2 + 0.15, 0.98], [-L / 2 - 0.25, 0.62]];
  for (const s of [-1, 1]) add(prismSide(trackProf, tw, 0.03), c.track, body, s * tx, 0, 0);

  const wheels = [];
  const wg = wheelGeo(o.wr, 0.2);
  for (const s of [-1, 1]) {
    for (let i = 0; i < o.wheels; i++) {
      const z = -L / 2 + 0.75 + i * (L - 1.5) / (o.wheels - 1);
      const w = add(wg, c.wheel, body, s * (W / 2 + 0.04), o.wr + 0.13, z);
      w.castShadow = false;
      w.userData.side = s;
      w.userData.r = o.wr;
      wheels.push(w);
    }
    const sg = wheelGeo(0.32, 0.22);
    for (const z of [-L / 2 - 0.02, L / 2 - 0.1]) {
      const w = add(sg, c.dark, body, s * (W / 2 + 0.05), 0.64, z);
      w.userData.side = s;
      w.userData.r = 0.32;
      wheels.push(w);
    }
  }

  // lower hull between the tracks, upper hull over them
  add(prismSide([[-L / 2 + 0.1, 0.42], [L / 2 - 0.5, 0.42], [L / 2 + 0.05, 1.0], [-L / 2, 1.0]], W - 2 * tw + 0.04), c.body, body);
  add(prismSide([[-L / 2 - 0.05, 0.98], [L / 2 + 0.15, 0.98], [L / 2 - glacis, top], [-L / 2 + 0.12, top],
    [-L / 2 - 0.05, top - 0.18]], W + 0.08, 0.04), c.body, body);

  // engine deck grilles
  box(W * 0.55, 0.06, L * 0.2, c.dark, body, 0, top + 0.02, -L / 2 + L * 0.14);
  box(W * 0.55, 0.06, L * 0.1, c.dark, body, 0, top + 0.02, -L / 2 + L * 0.32);
  // side skirts
  if (o.soviet) {
    const n = 6, segL = (L * 0.8) / n;
    for (const s of [-1, 1]) {
      for (let i = 0; i < n; i++) box(0.06, 0.42, segL - 0.07, 0x2b2b27, body, s * (W / 2 + 0.14), 0.8, -L * 0.36 + segL * (i + 0.5));
    }
  } else {
    for (const s of [-1, 1]) box(0.08, 0.42, L * 0.78, c.body, body, s * (W / 2 + 0.14), 0.8, L * 0.06);
  }
  // headlights + rear lights
  for (const s of [-1, 1]) {
    box(0.22, 0.16, 0.14, 0x1e1e1e, body, s * (W / 2 - 0.3), 1.08, L / 2 + 0.05);
    box(0.18, 0.12, 0.06, 0x7a1d18, body, s * (W / 2 - 0.3), top - 0.1, -L / 2 - 0.06);
  }

  const turret = new THREE.Group();
  turret.position.set(0, top, o.tz);
  body.add(turret);
  const gun = new THREE.Group();
  turret.add(gun);
  const recoil = new THREE.Group();
  gun.add(recoil);
  const muzzle = new THREE.Object3D();
  recoil.add(muzzle);

  return { root, body, turret, gun, recoil, muzzle, wheels, dims: { L, W, top, tz: o.tz } };
}

function gunParts(t, g, c) {
  t.gun.position.set(0, g.gy, g.gz);
  box(g.mantlet[0], g.mantlet[1], g.mantlet[2], c.body, t.gun, 0, 0, 0);
  add(tube(g.r * 1.18, g.r, g.len, 0.2), c.barrel, t.recoil);
  for (const [z, l] of g.sleeves || []) add(tube(g.r * 1.38, g.r * 1.38, l, z), c.barrel, t.recoil);
  if (g.evac) add(tube(g.evac[2], g.evac[2], g.evac[1], g.evac[0], 10), c.barrel, t.recoil);
  if (g.ref) box(0.12, 0.12, 0.2, c.dark, t.recoil, 0, g.r + 0.06, g.len - 0.1);
  t.muzzle.position.set(0, 0, g.len + 0.2);
  Object.assign(t.dims, { gy: g.gy, gz: g.gz, gl: g.len + 0.2 });
}

// ---------------------------------------------------------------- types

function liberator(c) {
  const o = { L: 7.9, W: 3.66, top: 1.72, glacis: 1.5, wheels: 7, wr: 0.34, tz: -0.4 };
  const t = chassis(o, c), T = t.turret;
  add(prismTop([[2.3, -1.05], [2.3, 1.05], [1.2, 1.85], [-2.5, 1.8], [-3.2, 1.5], [-3.2, -1.5], [-2.5, -1.8], [1.2, -1.85]], 0.9), c.body, T);
  box(3.0, 0.4, 0.7, c.dark, T, 0, 0.55, -3.5); // bustle rack
  add(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 8), c.body, T, -0.8, 1.04, -0.8);
  box(0.55, 0.36, 0.7, c.dark, T, -0.8, 1.36, -0.8); // remote weapon station
  add(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8), c.body, T, 0.85, 0.95, -0.7);
  box(0.36, 0.5, 0.36, c.dark, T, 0.8, 1.12, 0.25); // panoramic sight
  box(0.6, 0.32, 0.6, c.body, T, -1.0, 1.0, 1.3); // gunner sight
  for (const s of [-1, 1]) box(0.35, 0.25, 0.45, c.dark, T, s * 1.78, 0.68, 1.0);
  gunParts(t, { gy: 0.45, gz: 2.25, len: 5.3, r: 0.105, mantlet: [1.2, 0.72, 0.6], evac: [2.0, 0.6, 0.155], sleeves: [[0.8, 1.0], [3.3, 1.1]] }, c);
  Object.assign(t.dims, { tw: 1.9, tz0: -3.5, tz1: 2.4, th: 0.95 });
  return t;
}

function hunter(c) {
  const o = { L: 7.7, W: 3.7, top: 1.78, glacis: 1.35, wheels: 7, wr: 0.34, tz: -0.2 };
  const t = chassis(o, c), T = t.turret;
  // arrow-head spaced armour either side of the gun slot
  add(prismTop([[1.6, -1.8], [2.95, -0.55], [2.3, -0.42], [2.3, 0.42], [2.95, 0.55], [1.6, 1.8], [-2.3, 1.8],
    [-2.7, 1.5], [-2.7, -1.5], [-2.3, -1.8]], 0.95), c.body, T);
  box(2.9, 0.45, 0.55, c.dark, T, 0, 0.5, -2.95); // stowage basket
  box(0.42, 0.55, 0.42, c.dark, T, 0.85, 1.2, -0.35); // PERI
  box(0.5, 0.3, 0.3, c.dark, T, 0.85, 1.55, -0.35);
  box(0.6, 0.3, 0.75, c.body, T, -0.95, 1.08, 1.0); // EMES sight
  add(new THREE.CylinderGeometry(0.4, 0.45, 0.22, 8), c.body, T, 0.9, 1.05, -1.2);
  for (const s of [-1, 1]) box(0.3, 0.3, 0.6, c.dark, T, s * 1.85, 0.62, -1.6);
  gunParts(t, { gy: 0.5, gz: 2.3, len: 6.6, r: 0.1, mantlet: [0.75, 0.72, 0.5], sleeves: [[1.0, 1.4], [3.8, 1.5]] }, c);
  Object.assign(t.dims, { tw: 1.85, tz0: -3.2, tz1: 3.0, th: 1.0 });
  return t;
}

function royal(c) {
  const o = { L: 8.3, W: 3.5, top: 1.8, glacis: 1.2, wheels: 6, wr: 0.38, tz: -0.1 };
  const t = chassis(o, c), T = t.turret;
  add(prismSide([[2.3, 0], [2.3, 0.35], [1.3, 1.0], [-2.6, 1.0], [-2.85, 0.55], [-2.65, 0]], 3.3), c.body, T);
  for (const s of [-1, 1]) box(0.42, 0.6, 3.0, c.dark, T, s * 1.86, 0.45, -0.9); // side bins
  add(new THREE.CylinderGeometry(0.3, 0.34, 0.45, 8), c.dark, T, -0.75, 1.2, 0.4); // commander sight
  box(0.5, 0.25, 0.5, c.dark, T, -0.75, 1.52, 0.4);
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 8), c.body, T, 0.8, 1.05, -0.6);
  box(2.4, 0.35, 0.5, c.dark, T, 0, 0.5, -3.0);
  gunParts(t, { gy: 0.45, gz: 2.2, len: 5.6, r: 0.12, mantlet: [1.0, 0.75, 0.5], evac: [2.3, 0.9, 0.19], sleeves: [[0.7, 1.3], [3.4, 1.6]], ref: true }, c);
  Object.assign(t.dims, { tw: 2.05, tz0: -3.3, tz1: 2.4, th: 1.05 });
  return t;
}

function bastion(c) {
  const o = { L: 7.4, W: 3.5, top: 1.55, glacis: 2.1, wheels: 6, wr: 0.36, tz: -0.6, soviet: true };
  const t = chassis(o, c), T = t.turret, B = t.body;
  add(prismTop([[2.0, -0.5], [2.0, 0.5], [1.3, 1.55], [-1.5, 1.7], [-2.0, 1.25], [-2.0, -1.25], [-1.5, -1.7], [1.3, -1.55]], 0.78), c.body, T);
  box(2.6, 0.62, 1.2, c.body, T, 0, 0.36, -2.55); // autoloader bustle
  for (const s of [-1, 1]) {
    const era = box(1.25, 0.6, 0.45, c.era, T, s * 1.0, 0.42, 1.95); // Nozh-style ERA
    era.rotation.y = s * 0.55;
    box(1.0, 0.12, 1.0, c.era, T, s * 0.85, 0.84, 0.9);
    box(0.25, 0.25, 0.45, c.dark, T, s * 1.65, 0.55, -0.6);
  }
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.25, 8), c.body, T, -0.75, 0.9, -0.5);
  box(0.25, 0.22, 0.9, c.dark, T, -0.75, 1.15, -0.3); // MG
  box(0.5, 0.35, 0.45, c.dark, T, 0.8, 0.95, 0.8); // sight
  const plate = glacisPlate(o, B);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) box(0.72, 0.12, 0.85, c.era, plate, -1.15 + i * 0.77, 0.08, -0.45 + j * 0.9);
  gunParts(t, { gy: 0.4, gz: 2.0, len: 6.0, r: 0.11, mantlet: [0.9, 0.6, 0.5], evac: [2.6, 0.75, 0.17], sleeves: [[0.9, 1.2], [3.6, 1.4]] }, c);
  Object.assign(t.dims, { tw: 1.95, tz0: -3.2, tz1: 2.3, th: 0.85 });
  return t;
}

function hound(c) {
  const o = { L: 7.0, W: 3.45, top: 1.5, glacis: 2.2, wheels: 6, wr: 0.36, tz: -0.5, soviet: true };
  const t = chassis(o, c), T = t.turret, B = t.body;
  const dome = new THREE.SphereGeometry(1.75, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.5, 1.1);
  add(dome, c.body, T);
  add(new THREE.CylinderGeometry(1.62, 1.75, 0.14, 10), c.dark, T, 0, 0.04, 0);
  for (const s of [-1, 1]) {
    const era = box(1.25, 0.55, 0.5, c.era, T, s * 0.85, 0.35, 1.75); // Kontakt-5 wedges
    era.rotation.y = s * 0.6;
    box(0.04, 0.2, 2.2, 0x9b2a22, B, s * (o.W / 2 + 0.18), 0.86, 0.1); // hound stripe
  }
  add(new THREE.CylinderGeometry(0.4, 0.45, 0.28, 8), c.body, T, -0.65, 0.82, -0.3);
  box(0.22, 0.2, 1.0, c.dark, T, -0.65, 1.06, -0.1);
  box(0.4, 0.4, 0.35, 0x2b2b27, T, 0.95, 0.72, 0.85); // IR searchlight
  const snork = add(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 6), c.dark, T, 0, 0.45, -1.95);
  snork.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    const drum = add(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 8), c.dark, B, s * 0.8, o.top - 0.2, -o.L / 2 - 0.35);
    drum.rotation.z = Math.PI / 2;
  }
  const plate = glacisPlate(o, B);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) box(0.7, 0.12, 0.9, c.era, plate, -1.1 + i * 0.74, 0.08, -0.5 + j * 0.95);
  box(o.W - 1.4, 0.2, 0.06, c.dark, plate, 0, 0.12, 1.05); // splash board
  gunParts(t, { gy: 0.38, gz: 1.5, len: 6.0, r: 0.105, mantlet: [0.7, 0.5, 0.45], evac: [2.7, 0.8, 0.165], sleeves: [[0.9, 1.3], [3.8, 1.4]] }, c);
  Object.assign(t.dims, { tw: 1.8, tz0: -2.2, tz1: 2.2, th: 0.9 });
  return t;
}

// speed / armor / power are in quarters (1..3 of 4)
export const TANK_TYPES = {
  liberator: {
    name: 'Liberator', role: 'Heavy assault MBT', look: 'Abrams pattern', speed: 1, armor: 3, power: 3,
    desc: 'Slow, wide and stubborn. Soaks hits and hits back hard.', build: liberator,
    colors: { body: 0xb9a172, dark: 0x85704c, track: 0x2a2826, wheel: 0x6b5d45, barrel: 0xa48e63 },
  },
  hunter: {
    name: 'Hunter', role: 'Fast hunter-killer', look: 'Leopard 2A6 pattern', speed: 3, armor: 2, power: 2,
    desc: 'Fastest hull on the field. Flank, strike, relocate.', build: hunter,
    colors: { body: 0x56653f, dark: 0x3a4430, track: 0x262624, wheel: 0x46523a, barrel: 0x4f5c3b },
  },
  royal: {
    name: 'Royal', role: 'Long-range striker', look: 'Challenger 2 pattern', speed: 2, armor: 1, power: 3,
    desc: 'Big gun, thin skin. Hit first and never get seen.', build: royal,
    colors: { body: 0x8c8a62, dark: 0x5f5d42, track: 0x282725, wheel: 0x6a684a, barrel: 0x7f7d58 },
  },
  bastion: {
    name: 'Bastion', role: 'Balanced line MBT', look: 'BM Oplot pattern', speed: 2, armor: 2, power: 2,
    desc: 'No weakness, no gimmicks. A reliable all-rounder.', build: bastion,
    colors: { body: 0x67723f, dark: 0x495130, era: 0x5a6537, track: 0x262624, wheel: 0x4d5636, barrel: 0x5f6a3b },
  },
};

export const HOUND_TYPE = {
  name: 'Hound', build: hound,
  colors: { body: 0x4c5240, dark: 0x34382b, era: 0x434935, track: 0x232321, wheel: 0x3c4133, barrel: 0x454a39 },
};

export function buildTank(key) {
  const def = key === 'hound' ? HOUND_TYPE : TANK_TYPES[key];
  return def.build(def.colors);
}

// Swap every material to charred wreck colours.
export function wreckTank(model) {
  let i = 0;
  model.root.traverse((o) => {
    if (o.isMesh) o.material = WRECK_MATS[i++ % WRECK_MATS.length];
  });
}
