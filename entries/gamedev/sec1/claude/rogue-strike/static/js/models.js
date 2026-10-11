// Low-poly aircraft models built from code. Model space: forward = -Z, up = +Y, right = +X, 1 unit = 1 m.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const _c = new THREE.Color();

// ---------- geometry helpers ----------

function finalize(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

// Midpoint subdivision of a non-indexed triangle soup (keeps facets flat, gives the camo "pixels").
function subdivide(geo, levels = 1) {
  let p = geo.attributes.position.array;
  for (let l = 0; l < levels; l++) {
    const out = new Float32Array(p.length * 4);
    let o = 0;
    for (let i = 0; i < p.length; i += 9) {
      const a = [p[i], p[i + 1], p[i + 2]], b = [p[i + 3], p[i + 4], p[i + 5]], c = [p[i + 6], p[i + 7], p[i + 8]];
      const ab = a.map((v, k) => (v + b[k]) / 2), bc = b.map((v, k) => (v + c[k]) / 2), ca = c.map((v, k) => (v + a[k]) / 2);
      for (const t of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) for (const v of t) { out[o++] = v[0]; out[o++] = v[1]; out[o++] = v[2]; }
    }
    p = out;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

// Colour every triangle from a palette (random pick + slight brightness jitter) -> faceted low-poly look.
function paint(geo, palette, rng, jitter = 0.05) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let t = 0; t < n; t += 3) {
    _c.setHex(palette[Math.floor(rng() * palette.length)]);
    const j = 1 + (rng() * 2 - 1) * jitter;
    for (let k = 0; k < 3; k++) {
      col[(t + k) * 3] = _c.r * j;
      col[(t + k) * 3 + 1] = _c.g * j;
      col[(t + k) * 3 + 2] = _c.b * j;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Lofted body through cross-sections {z, w, h, x?, y?}. ex < 1 makes the section boxier (0 = box).
function loft(secs, sides = 8, rot = Math.PI / 8, ex = 1) {
  const rings = secs.map((s) => {
    const pts = [];
    for (let k = 0; k < sides; k++) {
      const a = rot + (k / sides) * Math.PI * 2;
      const sx = Math.sin(a), cy = Math.cos(a);
      const fx = Math.abs(sx) < 1e-6 ? 0 : Math.sign(sx) * Math.pow(Math.abs(sx), ex);
      const fy = Math.abs(cy) < 1e-6 ? 0 : Math.sign(cy) * Math.pow(Math.abs(cy), ex);
      pts.push([fx * s.w / 2 + (s.x || 0), fy * s.h / 2 + (s.y || 0), s.z]);
    }
    return pts;
  });
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const isPt = (s) => s.w === 0 && s.h === 0;
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1], aP = isPt(secs[i]), bP = isPt(secs[i + 1]);
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      if (!aP) tri(A[k], B[k], A[k2]);
      if (!bP) tri(A[k2], B[k], B[k2]);
    }
  }
  const cap = (R, s, front) => {
    const c = [s.x || 0, s.y || 0, s.z];
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      if (front) tri(c, R[k], R[k2]); else tri(c, R[k2], R[k]);
    }
  };
  if (!isPt(secs[0])) cap(rings[0], secs[0], true);
  const last = secs.length - 1;
  if (!isPt(secs[last])) cap(rings[last], secs[last], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Mirror a right-side outline ([x,z] from root leading edge -> tip -> root trailing edge) into a full planform.
const mirror = (right) => [...right, ...right.slice().reverse().map(([x, z]) => [-x, z])];

// Horizontal plate (wings, stabilisers) from an [x,z] outline.
function plate(pts, thick, y = 0) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, y + thick / 2, 0);
  return finalize(g);
}

// Vertical plate (fins) from a [z,y] outline, centred on x = 0.
function vplate(pts, thick) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(thick / 2, 0, 0);
  return finalize(g);
}

function cylZ(r0, r1, len, seg = 10, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  g.rotateX(Math.PI / 2); // +Y (r1, the exit) -> +Z (back)
  return finalize(g);
}

// ---------- materials ----------

const bodyMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.62, metalness: 0.18 });
const glassMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.12, metalness: 0.75, emissive: hex, emissiveIntensity: 0.08 });
const darkMat = () => new THREE.MeshStandardMaterial({ color: 0x1c1d20, flatShading: true, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
const flatMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.55, metalness: 0.1 });

function flameMeshes(r, len) {
  const outerG = new THREE.ConeGeometry(r, len, 9, 1, true);
  outerG.translate(0, len / 2, 0);
  outerG.rotateX(Math.PI / 2);
  const innerG = new THREE.ConeGeometry(r * 0.55, len * 0.55, 7, 1, true);
  innerG.translate(0, len * 0.275, 0);
  innerG.rotateX(Math.PI / 2);
  const outer = new THREE.Mesh(outerG, new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const inner = new THREE.Mesh(innerG, new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  outer.add(inner);
  outer.renderOrder = 5;
  return outer;
}

// ---------- the builder ----------

class Builder {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.group = new THREE.Group();
    this.mat = bodyMat();
    this.flames = [];
    this.pylons = [];
  }
  add(geo, palette, { sub = 0, jitter = 0.05, mat = null, pos = null, rotZ = 0 } = {}) {
    let g = sub ? subdivide(geo, sub) : geo;
    if (!mat) paint(g, palette, this.rng, jitter);
    const m = new THREE.Mesh(g, mat || this.mat);
    if (pos) m.position.set(...pos);
    m.rotation.z = rotZ;
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  // matching pair of vertical fins at +-x, canted outward
  fins(pts, thick, x, y, cant, palette, opts = {}) {
    const g = vplate(pts, thick);
    const r = this.add(g, palette, { ...opts, pos: [x, y, 0], rotZ: -cant });
    const l = this.add(g.clone(), palette, { ...opts, pos: [-x, y, 0], rotZ: cant });
    return [r, l];
  }
  nozzle(x, y, z, r, len = 1.1) {
    this.add(cylZ(r * 1.08, r, len, 10, true), null, { mat: darkMat(), pos: [x, y, z] });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 10), new THREE.MeshBasicMaterial({ color: 0xff8a3a }));
    disc.rotation.y = Math.PI;
    disc.position.set(x, y, z - len * 0.2);
    this.group.add(disc);
    const f = flameMeshes(r * 0.85, r * 7);
    f.position.set(x, y, z + len / 2);
    this.group.add(f);
    this.flames.push(f);
  }
  intakeFace(x, y, z, w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0b0c0e }));
    m.position.set(x, y, z - 0.02);
    m.rotation.y = Math.PI;
    this.group.add(m);
  }
  pylon(x, y, z) {
    this.pylons.push(new THREE.Vector3(x, y, z));
  }
  done(extra) {
    return { group: this.group, flames: this.flames, pylons: this.pylons, ...extra };
  }
}

// Ukrainian flag patch that straddles a fin (fin-local coordinates)
function flagPatch(fin, z, y, thick, len = 1.4, h = 0.9) {
  const blue = new THREE.Mesh(new THREE.BoxGeometry(thick + 0.05, h / 2, len), flatMat(0x0057b7));
  const yellow = new THREE.Mesh(new THREE.BoxGeometry(thick + 0.05, h / 2, len), flatMat(0xffd500));
  blue.position.set(0, y + h / 4, z);
  yellow.position.set(0, y - h / 4, z);
  fin.add(blue, yellow);
}

function roundel(group, x, y, z, thick, r = 0.75) {
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick + 0.04, 12), flatMat(0x0057b7));
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, thick + 0.06, 10), flatMat(0xffd500));
  outer.position.set(x, y, z);
  inner.position.set(x, y, z);
  group.add(outer, inner);
}

// ---------- aircraft ----------

// THUNDER - Eurofighter Typhoon style: canard delta, chin intake, single fin, twin engines.
function buildThunder() {
  const b = new Builder(11);
  const grey = [0xa9b2ba, 0xa2abb3, 0xb2bac1];
  const dark = [0x4e555c, 0x575e66];
  b.add(loft([
    { z: -8, w: 0, h: 0, y: 0.1 }, { z: -7.3, w: 0.45, h: 0.45, y: 0.1 }, { z: -6, w: 0.9, h: 0.95, y: 0.15 },
    { z: -4.5, w: 1.15, h: 1.25, y: 0.25 }, { z: -2.5, w: 1.3, h: 1.35, y: 0.3 }, { z: 0, w: 1.6, h: 1.3, y: 0.35 },
    { z: 3, w: 2.2, h: 1.3, y: 0.3 }, { z: 6, w: 2.1, h: 1.15, y: 0.25 }, { z: 7.4, w: 1.9, h: 1.0, y: 0.25 },
  ]), grey, { sub: 1, jitter: 0.03 });
  // radome
  b.add(loft([{ z: -8.02, w: 0, h: 0, y: 0.1 }, { z: -7.25, w: 0.47, h: 0.47, y: 0.1 }, { z: -6.9, w: 0.62, h: 0.64, y: 0.11 }]), dark);
  // chin intake
  b.add(loft([
    { z: -3, w: 1.5, h: 0.95, y: -0.55 }, { z: 0, w: 1.7, h: 1.0, y: -0.55 }, { z: 4, w: 1.9, h: 0.9, y: -0.4 }, { z: 6.5, w: 1.6, h: 0.6, y: -0.2 },
  ], 8, Math.PI / 8, 0.35), grey, { sub: 1, jitter: 0.03 });
  b.intakeFace(0, -0.55, -3, 1.3, 0.75);
  b.add(loft([
    { z: -5.6, w: 0, h: 0, y: 0.75 }, { z: -4.9, w: 0.7, h: 0.75, y: 0.8 }, { z: -3.6, w: 0.8, h: 0.85, y: 0.85 },
    { z: -2.2, w: 0.55, h: 0.5, y: 0.8 }, { z: -1.2, w: 0.2, h: 0.2, y: 0.7 },
  ]), null, { mat: glassMat(0x24364a) });
  b.add(plate(mirror([[0.7, -0.8], [1.6, 0.6], [5.4, 4.9], [5.5, 5.6], [1.0, 6.5], [0.7, 6.5]]), 0.22, -0.1), grey, { sub: 2, jitter: 0.03 });
  b.add(plate(mirror([[0.6, -3.6], [2.4, -2.4], [2.4, -1.9], [0.6, -2.4]]), 0.1, 0.0), grey, { sub: 1, jitter: 0.03 });
  b.add(vplate([[3.2, 0], [6.0, 3.1], [7.0, 3.1], [7.3, 0]], 0.14), grey, { sub: 2, jitter: 0.03, pos: [0, 0.8, 0] });
  // tail flash stripe
  b.add(vplate([[5.4, 2.3], [6.25, 3.1], [7.0, 3.1], [7.1, 2.3]], 0.17), [0x1d3f8f], { pos: [0, 0.8, 0] });
  b.nozzle(0.55, 0.2, 7.9, 0.45);
  b.nozzle(-0.55, 0.2, 7.9, 0.45);
  b.pylon(2.6, -0.45, 2.6); b.pylon(-2.6, -0.45, 2.6); b.pylon(3.7, -0.45, 3.7); b.pylon(-3.7, -0.45, 3.7);
  return b.done({ length: 16, span: 11, gun: new THREE.Vector3(0.6, 0.2, -3) });
}

// VULTURE - Saab Gripen style: small canard delta, side intakes, single engine.
function buildVulture() {
  const b = new Builder(23);
  const grey = [0x7f8890, 0x78818a, 0x868f97];
  const dark = [0x3f454b, 0x464c53];
  b.add(loft([
    { z: -7, w: 0, h: 0, y: 0.05 }, { z: -6.2, w: 0.4, h: 0.4, y: 0.05 }, { z: -5, w: 0.8, h: 0.85, y: 0.1 },
    { z: -3.5, w: 1.0, h: 1.15, y: 0.25 }, { z: -1.5, w: 1.1, h: 1.25, y: 0.3 }, { z: 1.5, w: 1.35, h: 1.25, y: 0.25 },
    { z: 4.5, w: 1.2, h: 1.05, y: 0.2 }, { z: 6.4, w: 0.95, h: 0.9, y: 0.2 },
  ]), grey, { sub: 1, jitter: 0.03 });
  b.add(loft([{ z: -7.02, w: 0, h: 0, y: 0.05 }, { z: -6.2, w: 0.42, h: 0.42, y: 0.05 }, { z: -5.9, w: 0.55, h: 0.56, y: 0.06 }]), dark);
  for (const sx of [1, -1]) {
    b.add(loft([
      { z: -2.6, w: 0.5, h: 0.85, x: 0.8 * sx, y: 0.15 }, { z: -1, w: 0.62, h: 0.95, x: 0.82 * sx, y: 0.15 },
      { z: 2, w: 0.45, h: 0.8, x: 0.75 * sx, y: 0.15 }, { z: 3.6, w: 0.1, h: 0.4, x: 0.6 * sx, y: 0.15 },
    ], 6, Math.PI / 6, 0.6), grey, { sub: 1, jitter: 0.03 });
    b.intakeFace(0.8 * sx, 0.15, -2.6, 0.38, 0.7);
  }
  b.add(loft([
    { z: -4.6, w: 0, h: 0, y: 0.7 }, { z: -4, w: 0.62, h: 0.7, y: 0.75 }, { z: -2.8, w: 0.7, h: 0.8, y: 0.8 },
    { z: -1.5, w: 0.5, h: 0.5, y: 0.75 }, { z: -0.4, w: 0.2, h: 0.2, y: 0.6 },
  ]), null, { mat: glassMat(0x2a3440) });
  b.add(plate(mirror([[0.6, -0.2], [1.6, 0.6], [4.2, 4.2], [4.25, 4.9], [0.6, 5.4]]), 0.18, -0.05), grey, { sub: 2, jitter: 0.03 });
  b.add(plate(mirror([[1.0, -2.0], [2.6, -0.7], [2.6, -0.25], [1.0, -0.6]]), 0.1, 0.32), grey, { sub: 1, jitter: 0.03 });
  b.add(vplate([[2.4, 0], [5.0, 2.8], [5.9, 2.8], [6.3, 0]], 0.13), grey, { sub: 2, jitter: 0.03, pos: [0, 0.6, 0] });
  // vulture marking: dark tail tip + wing tips
  b.add(vplate([[4.45, 2.2], [5.0, 2.8], [5.9, 2.8], [6.0, 2.2]], 0.16), [0x2b2f34], { pos: [0, 0.6, 0] });
  b.nozzle(0, 0.2, 6.9, 0.5);
  b.pylon(2.2, -0.35, 2.6); b.pylon(-2.2, -0.35, 2.6); b.pylon(3.2, -0.35, 3.5); b.pylon(-3.2, -0.35, 3.5);
  return b.done({ length: 14, span: 8.4, gun: new THREE.Vector3(0.6, 0.0, -2) });
}

// FALCON - Su-27 style in Ukrainian digital camo: wide lifting body, separated nacelles, twin fins.
function buildFalcon() {
  const b = new Builder(37);
  const camo = [0x9eb1c1, 0x8ea2b4, 0x7389a0, 0x5d7590, 0xb0c0cc, 0x6a8199];
  const radome = [0xd8dde0, 0xcfd5d9];
  b.add(loft([
    { z: -11, w: 0, h: 0, y: 0.1 }, { z: -10, w: 0.55, h: 0.55, y: 0.05 }, { z: -8.4, w: 1.15, h: 1.15, y: 0.05 },
    { z: -6.4, w: 1.45, h: 1.5, y: 0.15 }, { z: -4.6, w: 1.7, h: 1.65, y: 0.25 }, { z: -2.5, w: 2.2, h: 1.5, y: 0.2 },
    { z: 1, w: 2.4, h: 1.1, y: 0.15 }, { z: 5, w: 2.0, h: 0.9, y: 0.1 }, { z: 8, w: 1.3, h: 0.7, y: 0.15 },
    { z: 10.5, w: 0.7, h: 0.5, y: 0.2 }, { z: 11.6, w: 0.3, h: 0.3, y: 0.2 },
  ], 8, Math.PI / 8, 0.8), camo, { sub: 2, jitter: 0.02 });
  b.add(loft([{ z: -11.03, w: 0, h: 0, y: 0.1 }, { z: -10, w: 0.57, h: 0.57, y: 0.05 }, { z: -9.3, w: 0.85, h: 0.86, y: 0.05 }]), radome);
  // spine hump
  b.add(loft([
    { z: -4, w: 0.6, h: 0.5, y: 0.7 }, { z: -1, w: 1.0, h: 0.9, y: 0.75 }, { z: 3, w: 0.9, h: 0.7, y: 0.6 }, { z: 6, w: 0.3, h: 0.2, y: 0.4 },
  ]), camo, { sub: 2, jitter: 0.02 });
  b.add(loft([
    { z: -7.6, w: 0, h: 0, y: 0.75 }, { z: -6.8, w: 0.75, h: 0.85, y: 0.85 }, { z: -5.3, w: 0.85, h: 1.0, y: 0.95 },
    { z: -3.6, w: 0.6, h: 0.65, y: 0.85 }, { z: -1.6, w: 0.2, h: 0.2, y: 0.6 },
  ]), null, { mat: glassMat(0x2b3c52) });
  for (const sx of [1, -1]) {
    b.add(loft([
      { z: -4.2, w: 1.15, h: 1.2, x: 1.35 * sx, y: -0.75 }, { z: -1, w: 1.3, h: 1.25, x: 1.35 * sx, y: -0.7 },
      { z: 3, w: 1.4, h: 1.25, x: 1.35 * sx, y: -0.6 }, { z: 7, w: 1.3, h: 1.15, x: 1.35 * sx, y: -0.45 },
      { z: 9.3, w: 1.15, h: 1.05, x: 1.35 * sx, y: -0.4 },
    ], 8, Math.PI / 8, 0.45), camo, { sub: 2, jitter: 0.02 });
    b.intakeFace(1.35 * sx, -0.75, -4.2, 1.0, 1.0);
    b.nozzle(1.35 * sx, -0.4, 9.85, 0.52);
  }
  const wing = mirror([[0.6, -7.0], [1.6, -4.5], [2.7, -1.2], [7.3, 4.0], [7.35, 5.6], [3.0, 6.6], [0.6, 6.6]]);
  b.add(plate(wing, 0.25, 0), camo, { sub: 3, jitter: 0.02 });
  b.add(plate(mirror([[2.0, 6.8], [5.9, 9.6], [5.9, 10.6], [2.0, 10.6]]), 0.14, -0.35), camo, { sub: 2, jitter: 0.02 });
  const [fr, fl] = b.fins([[5.2, 0], [8.2, 3.9], [9.6, 3.9], [10.0, 0]], 0.15, 2.0, 0.05, 0.02, camo, { sub: 2, jitter: 0.02 });
  flagPatch(fr, 8.6, 2.6, 0.15);
  flagPatch(fl, 8.6, 2.6, 0.15);
  roundel(b.group, 5.2, 0, 3.4, 0.25);
  roundel(b.group, -5.2, 0, 3.4, 0.25);
  b.pylon(3.8, -0.35, 2.2); b.pylon(-3.8, -0.35, 2.2); b.pylon(5.4, -0.35, 3.6); b.pylon(-5.4, -0.35, 3.6);
  return b.done({ length: 22, span: 14.7, gun: new THREE.Vector3(1.2, 0.3, -3) });
}

// SHADOW - F-22 style: chined diamond nose, caret intakes, diamond wing, canted fins, 2D nozzles.
function buildShadow() {
  const b = new Builder(41);
  const grey = [0x6f757b, 0x686e74, 0x767c82];
  const edge = [0x55595e, 0x5b6065];
  const chine = [6, Math.PI / 2, 1];
  b.add(loft([
    { z: -9.5, w: 0, h: 0, y: 0 }, { z: -8.5, w: 0.8, h: 0.45, y: 0 }, { z: -6.8, w: 1.7, h: 0.95, y: 0.05 },
    { z: -4.8, w: 2.2, h: 1.2, y: 0.15 }, { z: -2.5, w: 2.7, h: 1.3, y: 0.15 }, { z: 1, w: 3.4, h: 1.25, y: 0.1 },
    { z: 5, w: 3.4, h: 1.1, y: 0.05 }, { z: 7.6, w: 2.8, h: 0.9, y: 0.05 }, { z: 8.8, w: 2.4, h: 0.6, y: 0.05 },
  ], ...chine), grey, { sub: 1, jitter: 0.03 });
  for (const sx of [1, -1]) {
    b.add(loft([
      { z: -3.6, w: 0.9, h: 1.05, x: 1.75 * sx, y: -0.15 }, { z: -1, w: 1.1, h: 1.15, x: 1.75 * sx, y: -0.1 },
      { z: 3, w: 0.95, h: 1.0, x: 1.7 * sx, y: -0.05 }, { z: 5, w: 0.3, h: 0.4, x: 1.5 * sx, y: 0 },
    ], 4, Math.PI / 4, 0), grey, { sub: 1, jitter: 0.03 });
    b.intakeFace(1.75 * sx, -0.15, -3.6, 0.8, 0.95);
  }
  b.add(loft([
    { z: -6.6, w: 0, h: 0, y: 0.6 }, { z: -5.6, w: 0.8, h: 0.9, y: 0.7 }, { z: -4.0, w: 0.85, h: 1.0, y: 0.75 },
    { z: -2.4, w: 0.55, h: 0.55, y: 0.7 }, { z: -1.0, w: 0.15, h: 0.15, y: 0.55 },
  ]), null, { mat: glassMat(0x8a6a28) });
  b.add(plate(mirror([[1.4, -1.8], [6.8, 3.4], [6.8, 4.4], [1.4, 6.2]]), 0.22, 0), grey, { sub: 2, jitter: 0.03 });
  b.add(plate(mirror([[1.4, 6.4], [5.0, 8.6], [5.0, 9.4], [1.6, 9.6]]), 0.14, -0.05), grey, { sub: 1, jitter: 0.03 });
  b.fins([[3.6, 0], [6.4, 2.9], [7.6, 2.9], [8.1, 0]], 0.14, 1.6, 0.5, 0.49, grey, { sub: 2, jitter: 0.03 });
  // 2D thrust-vectoring nozzles
  for (const sx of [1, -1]) {
    b.add(new THREE.BoxGeometry(1.1, 0.6, 1.0).toNonIndexed(), edge, { pos: [0.75 * sx, 0.05, 9.25] });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), new THREE.MeshBasicMaterial({ color: 0xff8a3a }));
    disc.position.set(0.75 * sx, 0.05, 9.76);
    b.group.add(disc);
    const f = flameMeshes(0.38, 3.2);
    f.scale.set(1.4, 0.6, 1);
    f.position.set(0.75 * sx, 0.05, 9.75);
    b.group.add(f);
    b.flames.push(f);
  }
  b.pylon(0.9, -0.75, 0.5); b.pylon(-0.9, -0.75, 0.5); b.pylon(1.6, -0.7, 1.5); b.pylon(-1.6, -0.7, 1.5);
  return b.done({ length: 19, span: 13.6, gun: new THREE.Vector3(1.4, 0.4, -2), internalBay: true });
}

// ROGUE - Su-57 style enemy: flat chined body, wide nacelles, LEVCONs, small canted all-moving fins.
function buildRogue() {
  const b = new Builder(53);
  const camo = [0x363b43, 0x424852, 0x2d3137, 0x4c535d, 0x3a3f47];
  const red = [0xa3161c, 0x8a1217];
  const chine = [6, Math.PI / 2, 1];
  b.add(loft([
    { z: -10, w: 0, h: 0, y: 0 }, { z: -9, w: 0.7, h: 0.5, y: 0 }, { z: -7, w: 1.5, h: 1.0, y: 0.05 },
    { z: -5, w: 1.9, h: 1.2, y: 0.15 }, { z: -2.5, w: 2.4, h: 1.1, y: 0.1 }, { z: 1, w: 2.6, h: 0.85, y: 0.05 },
    { z: 5, w: 2.3, h: 0.75, y: 0.05 }, { z: 8.5, w: 1.2, h: 0.5, y: 0.05 }, { z: 10.6, w: 0.4, h: 0.3, y: 0.05 },
  ], ...chine), camo, { sub: 2, jitter: 0.02 });
  b.add(loft([{ z: -10.02, w: 0, h: 0, y: 0 }, { z: -9, w: 0.72, h: 0.52, y: 0 }, { z: -8.6, w: 0.95, h: 0.66, y: 0.01 }], ...chine), red);
  for (const sx of [1, -1]) {
    b.add(loft([
      { z: -2.8, w: 1.2, h: 1.0, x: 1.75 * sx, y: -0.55 }, { z: 0, w: 1.3, h: 1.05, x: 1.75 * sx, y: -0.55 },
      { z: 5, w: 1.25, h: 0.95, x: 1.75 * sx, y: -0.5 }, { z: 8.2, w: 1.05, h: 0.85, x: 1.75 * sx, y: -0.45 },
    ], 8, Math.PI / 8, 0.4), camo, { sub: 2, jitter: 0.02 });
    b.intakeFace(1.75 * sx, -0.55, -2.8, 1.05, 0.85);
    b.nozzle(1.75 * sx, -0.45, 8.75, 0.5);
  }
  b.add(loft([
    { z: -7.2, w: 0, h: 0, y: 0.6 }, { z: -6.3, w: 0.75, h: 0.85, y: 0.65 }, { z: -4.8, w: 0.8, h: 0.95, y: 0.7 },
    { z: -3.3, w: 0.5, h: 0.5, y: 0.65 }, { z: -2, w: 0.15, h: 0.15, y: 0.5 },
  ]), null, { mat: glassMat(0x9a5a12) });
  b.add(plate(mirror([[0.8, -6.2], [2.2, -3.0], [2.6, -0.6], [7.0, 3.8], [7.0, 5.0], [3.0, 5.6], [1.0, 5.6]]), 0.22, 0), camo, { sub: 3, jitter: 0.02 });
  // red wingtips
  b.add(plate([[6.2, 3.0], [7.04, 3.8], [7.04, 5.02], [6.2, 5.1]], 0.26, 0), red);
  b.add(plate([[-6.2, 3.0], [-6.2, 5.1], [-7.04, 5.02], [-7.04, 3.8]], 0.26, 0), red);
  b.add(plate(mirror([[2.4, 6.0], [5.8, 8.6], [5.8, 9.6], [2.4, 9.4]]), 0.14, -0.2), camo, { sub: 2, jitter: 0.02 });
  const finPts = [[4.8, 0], [7.4, 2.6], [8.6, 2.6], [8.8, 0]];
  b.fins(finPts, 0.14, 2.2, 0.0, 0.35, camo, { sub: 2, jitter: 0.02 });
  b.fins([[6.6, 1.8], [7.4, 2.6], [8.6, 2.6], [8.65, 1.8]], 0.17, 2.2, 0.0, 0.35, red);
  return b.done({ length: 20, span: 14, gun: new THREE.Vector3(1.2, 0.3, -3) });
}

export function buildMissileMesh(kind = 'msl') {
  const look = {
    msl: { len: 3.4, r: 0.12, body: 0xe8e8e8, tip: 0x444444 },
    hvaa: { len: 4.2, r: 0.13, body: 0xdfe6ee, tip: 0x2c6fd6 },
    saam: { len: 3.8, r: 0.14, body: 0xe8e2d0, tip: 0x2fa84a },
    '4aam': { len: 3.2, r: 0.12, body: 0xeeeeee, tip: 0xd88a1c },
    hpaa: { len: 4.6, r: 0.2, body: 0xd2d6da, tip: 0xc4262b },
    emsl: { len: 3.4, r: 0.12, body: 0x8a8f96, tip: 0xa3161c },
  }[kind];
  const g = new THREE.Group();
  const L = look.len, r = look.r;
  const body = loft([{ z: -L / 2 + 0.6, w: r * 2, h: r * 2 }, { z: L / 2, w: r * 2, h: r * 2 }], 6, 0);
  const nose = loft([{ z: -L / 2, w: 0, h: 0 }, { z: -L / 2 + 0.6, w: r * 2, h: r * 2 }], 6, 0);
  g.add(new THREE.Mesh(body, flatMat(look.body)));
  g.add(new THREE.Mesh(nose, flatMat(look.tip)));
  const finG = plate(mirror([[r, L / 2 - 0.6], [r + 0.32, L / 2 - 0.1], [r + 0.32, L / 2], [r, L / 2]]), 0.03);
  const fm = flatMat(look.body);
  const f1 = new THREE.Mesh(finG, fm), f2 = new THREE.Mesh(finG, fm);
  f2.rotation.z = Math.PI / 2;
  g.add(f1, f2);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const BUILDERS = { thunder: buildThunder, vulture: buildVulture, falcon: buildFalcon, shadow: buildShadow, rogue: buildRogue };

export function buildAircraft(id) {
  const m = BUILDERS[id]();
  // hang a couple of visible missiles on the pylons (hidden when fired, back after reload)
  m.pylonMissiles = m.pylons.map((p) => {
    const mm = buildMissileMesh('msl');
    mm.position.copy(p);
    if (m.internalBay) mm.visible = false;
    m.group.add(mm);
    return mm;
  });
  return m;
}
