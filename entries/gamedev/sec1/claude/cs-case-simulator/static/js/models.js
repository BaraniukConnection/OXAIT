// Procedural 3D models: weapons (built from side-profile parts), cases, props.
import * as THREE from 'three';
import { skinTexture, caseLabelTexture } from './textures.js';

// Weapon blueprints. Units: ~100 = full weapon length. x = butt -> muzzle, y = up.
// part: { p: [[x,y]...], d: thickness, m: material } or { c: [x,y], len, r, m } (cylinder along +x)
// materials: s = skin, k = dark polymer, m = metal, g = glass/translucent
const BLUEPRINTS = {
  ak47: { len: 0.88, parts: [
    { p: [[0, 6], [0, 20], [25, 24], [27, 24], [27, 16], [5, 6]], d: 5, m: 's' },
    { p: [[26, 15], [26, 27], [60, 27], [62, 25], [62, 15]], d: 6, m: 's' },
    { p: [[34, 15], [30, 2], [36, 1], [40, 15]], d: 4.5, m: 'k' },
    { p: [[44, 15], [46, 2], [52, -9], [58, -7], [54, 4], [53, 15]], d: 4.5, m: 's' },
    { p: [[62, 16], [62, 25], [78, 24], [78, 17]], d: 6.5, m: 's' },
    { c: [62, 27], len: 18, r: 1.4, m: 'm' },
    { c: [78, 20.5], len: 21, r: 1.3, m: 'm' },
    { p: [[89, 21], [90, 28], [92, 28], [92, 21]], d: 2, m: 'k' },
    { c: [98, 20.5], len: 4, r: 1.9, m: 'k' },
    { p: [[38, 13], [39, 9], [46, 9], [46, 13]], d: 1.5, m: 'k' },
  ] },
  m4a1: { len: 0.84, parts: [
    { p: [[0, 7], [0, 23], [4, 23], [20, 21], [20, 15], [4, 9]], d: 5, m: 's' },
    { c: [18, 18], len: 10, r: 2.4, m: 'k' },
    { p: [[26, 14], [26, 27], [58, 27], [58, 14]], d: 6, m: 's' },
    { p: [[28, 27], [28, 30], [57, 30], [57, 27]], d: 4, m: 'k' },
    { p: [[32, 14], [28, 1], [34, 0], [38, 14]], d: 4.5, m: 'k' },
    { p: [[42, 14], [42, -3], [50, -5], [50, 14]], d: 4.5, m: 's' },
    { p: [[58, 15], [58, 27], [82, 27], [82, 15]], d: 6.5, m: 's' },
    { c: [82, 21], len: 14, r: 1.2, m: 'm' },
    { p: [[79, 27], [79, 33], [82, 33], [82, 27]], d: 2, m: 'k' },
    { c: [95, 21], len: 6, r: 1.8, m: 'k' },
  ] },
  deagle: { len: 0.27, parts: [
    { p: [[18, 30], [18, 43], [98, 43], [100, 39], [100, 30]], d: 9, m: 's' },
    { p: [[20, 22], [20, 30], [92, 30], [92, 24], [70, 23]], d: 8.5, m: 's' },
    { p: [[20, 28], [6, -20], [30, -24], [42, 22]], d: 9.5, m: 'k' },
    { p: [[40, 22], [42, 10], [62, 10], [64, 23], [59, 23], [57, 14], [46, 14], [45, 22]], d: 4, m: 'k' },
    { c: [100, 36], len: 2, r: 3.2, m: 'm' },
    { p: [[22, 43], [22, 47], [28, 47], [28, 43]], d: 3, m: 'k' },
    { p: [[90, 43], [90, 47], [94, 47], [94, 43]], d: 2, m: 'k' },
  ] },
  glock: { len: 0.2, parts: [
    { p: [[16, 30], [16, 42], [100, 42], [100, 30]], d: 9, m: 's' },
    { p: [[18, 21], [18, 30], [98, 30], [98, 25], [62, 22]], d: 8.5, m: 'k' },
    { p: [[18, 28], [4, -24], [30, -27], [40, 21]], d: 9.5, m: 'k' },
    { p: [[38, 21], [40, 9], [62, 9], [64, 22], [59, 22], [57, 13], [45, 13], [44, 21]], d: 4, m: 'k' },
    { c: [100, 36], len: 1, r: 2.5, m: 'm' },
  ] },
  mp5: { len: 0.68, parts: [
    { p: [[0, 6], [0, 24], [4, 24], [4, 6]], d: 5, m: 'k' },
    { c: [4, 20], len: 20, r: 1, m: 'm' },
    { c: [4, 10], len: 20, r: 1, m: 'm' },
    { p: [[22, 14], [22, 28], [66, 28], [66, 14]], d: 6, m: 's' },
    { p: [[28, 28], [28, 32], [35, 32], [35, 28]], d: 4, m: 'k' },
    { p: [[30, 14], [26, 0], [33, -1], [37, 14]], d: 4.5, m: 'k' },
    { p: [[46, 14], [47, 0], [53, -14], [58, -12], [54, 2], [53, 14]], d: 4.5, m: 's' },
    { p: [[66, 12], [66, 26], [86, 25], [88, 22], [88, 14]], d: 7.5, m: 's' },
    { c: [88, 20], len: 8, r: 1.6, m: 'k' },
    { p: [[82, 26], [82, 32], [88, 32], [88, 26]], d: 3, m: 'k' },
  ] },
  p90: { len: 0.5, parts: [
    { p: [[0, 4], [0, 24], [10, 30], [70, 30], [85, 26], [85, 12], [70, 10], [62, 2], [48, 2], [44, 10], [30, 10], [24, 4]], d: 9, m: 's' },
    { p: [[12, 30], [12, 36], [74, 36], [74, 30]], d: 7, m: 'g' },
    { p: [[30, 36], [30, 41], [52, 41], [52, 36]], d: 4, m: 'k' },
    { c: [85, 19], len: 13, r: 1.6, m: 'm' },
    { p: [[50, 10], [52, -2], [58, -2], [58, 10]], d: 6, m: 'k' },
  ] },
  benelli: { len: 1.0, parts: [
    { p: [[0, 6], [0, 22], [26, 22], [26, 17], [6, 6]], d: 5, m: 's' },
    { p: [[26, 17], [22, 4], [30, 3], [33, 17]], d: 4.5, m: 'k' },
    { p: [[26, 17], [26, 28], [52, 28], [52, 17]], d: 6, m: 's' },
    { p: [[44, 28], [44, 32], [49, 32], [49, 28]], d: 3, m: 'k' },
    { p: [[52, 15], [52, 23], [74, 23], [74, 15]], d: 6.5, m: 's' },
    { c: [52, 18.5], len: 40, r: 2.2, m: 'k' },
    { c: [52, 24.8], len: 47, r: 1.6, m: 'm' },
    { p: [[34, 17], [35, 12], [44, 12], [44, 17]], d: 1.5, m: 'k' },
  ] },
  nova: { len: 1.0, parts: [
    { p: [[0, 6], [0, 22], [6, 23], [30, 23], [30, 17], [8, 6]], d: 5, m: 's' },
    { p: [[30, 15], [30, 27], [54, 27], [54, 15]], d: 6, m: 's' },
    { p: [[58, 13], [58, 22], [76, 22], [76, 13]], d: 7, m: 'k' },
    { c: [54, 17.5], len: 34, r: 2.1, m: 's' },
    { c: [54, 24], len: 46, r: 1.5, m: 'm' },
    { p: [[34, 15], [35, 10], [44, 10], [44, 15]], d: 1.5, m: 'k' },
    { p: [[97, 25], [97, 28], [99, 28], [99, 25]], d: 1.5, m: 'm' },
  ] },
  m249: { len: 1.04, parts: [
    { p: [[0, 6], [0, 22], [20, 22], [20, 17], [6, 8]], d: 5, m: 's' },
    { p: [[20, 12], [20, 30], [56, 30], [58, 26], [58, 12]], d: 7, m: 's' },
    { p: [[24, 30], [24, 34], [52, 34], [52, 30]], d: 6, m: 'k' },
    { p: [[28, 12], [28, -10], [48, -10], [48, 12]], d: 9, m: 's' },
    { p: [[50, 12], [47, -2], [54, -3], [57, 12]], d: 4.5, m: 'k' },
    { p: [[58, 14], [58, 26], [72, 26], [72, 14]], d: 6.5, m: 'k' },
    { p: [[60, 26], [60, 32], [68, 32], [68, 26]], d: 2.5, m: 'k' },
    { c: [72, 20], len: 26, r: 1.7, m: 'm' },
    { p: [[80, 18], [77, 2], [79, 2], [82, 18]], d: 1.5, m: 'm' },
    { c: [97, 20], len: 4, r: 2.2, m: 'k' },
  ] },
  negev: { len: 1.0, parts: [
    { p: [[0, 8], [0, 22], [22, 22], [22, 16], [8, 8]], d: 5, m: 's' },
    { p: [[22, 13], [22, 28], [60, 28], [60, 13]], d: 7, m: 's' },
    { p: [[24, 28], [24, 31], [78, 31], [78, 28]], d: 4, m: 'k' },
    { p: [[30, 13], [30, -8], [50, -8], [52, 13]], d: 8.5, m: 'k' },
    { p: [[52, 13], [49, 0], [56, -1], [58, 13]], d: 4.5, m: 'k' },
    { p: [[60, 14], [60, 27], [80, 26], [80, 15]], d: 7, m: 's' },
    { c: [80, 20], len: 18, r: 1.6, m: 'm' },
    { p: [[84, 18], [81, 2], [83, 2], [86, 18]], d: 1.5, m: 'm' },
    { c: [97, 20], len: 4, r: 2.1, m: 'k' },
  ] },
};

const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.65, metalness: 0.2 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.35, metalness: 0.85 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75 });

const geoCache = new Map();
function partGeometry(part) {
  const key = JSON.stringify(part);
  if (geoCache.has(key)) return geoCache.get(key);
  let geo;
  if (part.p) {
    const shape = new THREE.Shape(part.p.map(([x, y]) => new THREE.Vector2(x, y)));
    geo = new THREE.ExtrudeGeometry(shape, { depth: part.d, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.5, bevelSegments: 2 });
    geo.translate(0, 0, -part.d / 2);
  } else {
    geo = new THREE.CylinderGeometry(part.r, part.r, part.len, 14);
    geo.rotateZ(-Math.PI / 2);
    geo.translate(part.c[0] + part.len / 2, part.c[1], 0);
    // give the cylinder planar UVs along its length so skins wrap sensibly
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i) + pos.getZ(i));
  }
  geoCache.set(key, geo);
  return geo;
}

const skinMatCache = new Map();
export function skinMaterial(skin, float = 0) {
  const key = `${skin.id}|${Math.round(float * 10)}`;
  if (skinMatCache.has(key)) return skinMatCache.get(key);
  const map = skinTexture(skin, float).clone();
  map.needsUpdate = true;
  map.repeat.set(1 / 55, 1 / 55);
  const legendary = skin.rarity === 'legendary', epic = skin.rarity === 'epic';
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: legendary ? 0.28 : epic ? 0.3 : 0.55,
    metalness: legendary ? 0.45 : epic ? 0.55 : 0.15,
  });
  if (legendary) {
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = map;
    mat.emissiveIntensity = 0.22;
  }
  skinMatCache.set(key, mat);
  return mat;
}

/** Build a weapon mesh group. Size: real length in meters (or normalized to `fit`). */
export function buildWeapon(weaponId, skin, float = 0, { fit = null } = {}) {
  const bp = BLUEPRINTS[weaponId];
  const group = new THREE.Group();
  const inner = new THREE.Group();
  const sMat = skin ? skinMaterial(skin, float) : new THREE.MeshStandardMaterial({ color: 0x777777 });
  for (const part of bp.parts) {
    const mat = part.m === 's' ? sMat : part.m === 'm' ? metalMat : part.m === 'g' ? glassMat : darkMat;
    const mesh = new THREE.Mesh(partGeometry(part), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    inner.add(mesh);
  }
  // center & scale
  const box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.sub(c);
  const length = box.max.x - box.min.x;
  const s = (fit ?? bp.len) / length;
  group.scale.setScalar(s);
  group.add(inner);
  group.userData.weapon = weaponId;
  return group;
}

// ---------------------------------------------------------------- cases
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

const caseMatCache = new Map();
function caseMaterials(caseDef) {
  if (caseMatCache.has(caseDef.id)) return caseMatCache.get(caseDef.id);
  const col = new THREE.Color(caseDef.color);
  const body = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.55), roughness: 0.45, metalness: caseDef.legendaryOnly ? 0.8 : 0.3 });
  const label = new THREE.MeshStandardMaterial({ map: caseLabelTexture(caseDef), roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(0xffffff), emissiveIntensity: caseDef.legendaryOnly ? 0.12 : 0.04 });
  label.emissiveMap = label.map;
  const trim = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.9 });
  const m = { body, label, trim };
  caseMatCache.set(caseDef.id, m);
  return m;
}

/** Weapon case: base + hinged lid (lid pivot at back edge). Size ~0.5 x 0.14 x 0.32 m. */
export function buildCase(caseDef) {
  const W = 0.5, D = 0.32, H = 0.07;
  const mats = caseMaterials(caseDef);
  const group = new THREE.Group();
  const shape = roundedRectShape(W, D, 0.03);
  const mk = (h) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const base = new THREE.Mesh(mk(H), mats.body);
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H + 0.004, -D / 2);
  const lid = new THREE.Mesh(mk(H * 0.85), mats.body);
  lid.position.set(0, 0, D / 2);
  lid.castShadow = true;
  lidPivot.add(lid);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.82, D * 0.72), mats.label);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, H * 0.85 + 0.0095, D / 2);
  lidPivot.add(label);
  group.add(lidPivot);

  // latches + handle
  for (const x of [-W * 0.3, W * 0.3]) {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.012), mats.trim);
    latch.position.set(x, H, D / 2 + 0.012);
    group.add(latch);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 20, Math.PI), mats.trim);
  handle.position.set(0, H * 0.6, D / 2 + 0.02);
  handle.rotation.x = Math.PI / 2;
  handle.rotation.z = Math.PI;
  group.add(handle);

  // foam inserts (visible when the lid opens)
  const foamMat = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 1 });
  const foamBase = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, D * 0.88), foamMat);
  foamBase.rotation.x = -Math.PI / 2;
  foamBase.position.y = H + 0.0095;
  group.add(foamBase);
  const foamLid = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, D * 0.88), foamMat);
  foamLid.rotation.x = Math.PI / 2;
  foamLid.position.set(0, -0.0095, D / 2);
  lidPivot.add(foamLid);

  // inner glow plane (visible when the lid opens)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, D * 0.85),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = H + 0.011;
  group.add(glow);

  group.userData = { caseId: caseDef.id, lidPivot, glow };
  return group;
}
