// Terrain (forest valleys + mountain ranges), water, forests, clouds, sky and collision queries.
import * as THREE from 'three';
import { makeNoise2D, fbm, ridged, mulberry32 } from './noise.js';

export const WORLD = 14000;          // map edge length (m)
export const HALF = WORLD / 2;
export const CELLS = 220;
export const CELL = WORLD / CELLS;
export const WATER = 22;
export const CEILING = 3000;
const WALL_START = 0.84;              // fraction of HALF where the border mountains begin

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class World {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.seed = seed;
    const n1 = makeNoise2D(seed), n2 = makeNoise2D(seed + 1), n3 = makeNoise2D(seed + 2), n4 = makeNoise2D(seed + 3);
    this.forestNoise = makeNoise2D(seed + 4);
    this.tintNoise = makeNoise2D(seed + 5);
    this.rawHeight = (x, z) => {
      let h = fbm(n1, x * 0.00042, z * 0.00042, 4) * 150 + 95;
      const mask = smooth(-0.12, 0.32, fbm(n2, x * 0.00016 + 10, z * 0.00016 - 7, 3));
      const r = ridged(n3, x * 0.0003, z * 0.0003, 5);
      h += mask * Math.pow(r, 1.5) * 1650;
      const lake = fbm(n4, x * 0.00055, z * 0.00055, 2);
      if (lake > 0.18) h -= (lake - 0.18) * 650 * (1 - mask);
      const e = Math.max(Math.abs(x), Math.abs(z)) / HALF;
      if (e > WALL_START) h += Math.pow((e - WALL_START) / (1 - WALL_START), 1.7) * 3700 * (0.85 + 0.15 * r);
      return h;
    };
    const N = CELLS + 1;
    this.heights = new Float32Array(N * N);
    let maxH = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const h = this.rawHeight(-HALF + i * CELL, -HALF + j * CELL);
      this.heights[j * N + i] = h;
      if (h > maxH) maxH = h;
    }
    this.maxH = maxH;
    this.buildSky();
    this.buildTerrain();
    this.buildWater();
    this.buildTrees();
    this.buildClouds();
    this.buildLights();
  }

  // Exact height of the rendered (triangulated) terrain surface.
  terrainHeight(x, z) {
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    const N = CELLS + 1;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= CELLS || j >= CELLS) return 5000;
    const u = fx - i, v = fz - j;
    const H = this.heights;
    const h00 = H[j * N + i], h10 = H[j * N + i + 1], h01 = H[(j + 1) * N + i], h11 = H[(j + 1) * N + i + 1];
    if (u > v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
    return h00 + (h11 - h01) * u + (h01 - h00) * v;
  }

  // Solid surface (terrain or water).
  groundHeight(x, z) {
    return Math.max(WATER, this.terrainHeight(x, z));
  }

  // Is the straight line between a and b clear of terrain?
  lineOfSight(a, b, steps = 14) {
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
      if (y < this.terrainHeight(x, z)) return false;
    }
    return true;
  }

  edgeFactor(x, z) {
    return Math.max(Math.abs(x), Math.abs(z)) / HALF;
  }

  // ---- tree collision via spatial hash ----
  treeHit(p, radius) {
    const ci = Math.floor((p.x + HALF) / this.treeCell), cj = Math.floor((p.z + HALF) / this.treeCell);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const list = this.treeGrid.get((cj + dj) * 10000 + (ci + di));
      if (!list) continue;
      for (const t of list) {
        if (p.y > t.top + radius || p.y < t.y - radius) continue;
        const dx = p.x - t.x, dz = p.z - t.z;
        const rr = t.r + radius;
        if (dx * dx + dz * dz < rr * rr) return t;
      }
    }
    return null;
  }

  // ---------- builders ----------

  buildSky() {
    const g = new THREE.SphereGeometry(30000, 24, 12);
    const top = new THREE.Color(0x3d7fd1), mid = new THREE.Color(0x9cc8ee), hor = new THREE.Color(0xc9dcea);
    const col = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 30000;
      const c = y > 0.25 ? mid.clone().lerp(top, Math.min(1, (y - 0.25) / 0.6)) : hor.clone().lerp(mid, Math.max(0, y / 0.25));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(900, 1), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
    this.sunDir = new THREE.Vector3(0.45, 0.62, -0.64).normalize();
    sun.position.copy(this.sunDir).multiplyScalar(26000);
    this.sky.add(sun);
    this.scene.fog = new THREE.Fog(0xc9dcea, 2500, 13500);
    this.scene.background = new THREE.Color(0xc9dcea);
  }

  buildTerrain() {
    const N = CELLS + 1, H = this.heights;
    const pos = new Float32Array(CELLS * CELLS * 18);
    const col = new Float32Array(CELLS * CELLS * 18);
    const rng = mulberry32(this.seed + 9);
    const c = new THREE.Color();
    const sand = new THREE.Color(0xd6c38d), grass1 = new THREE.Color(0x6ea044), grass2 = new THREE.Color(0x87b04b),
      forest = new THREE.Color(0x3f7533), rock1 = new THREE.Color(0x857b6e), rock2 = new THREE.Color(0x6d665f),
      snow = new THREE.Color(0xf1f4f7), dirt = new THREE.Color(0x8d8455);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
    let o = 0;
    const face = (x0, z0, y0, x1, z1, y1, x2, z2, y2) => {
      a.set(x1 - x0, y1 - y0, z1 - z0);
      b.set(x2 - x0, y2 - y0, z2 - z0);
      n.crossVectors(b, a).normalize();
      if (n.y < 0) n.negate();
      const cx = (x0 + x1 + x2) / 3, cz = (z0 + z1 + z2) / 3, h = (y0 + y1 + y2) / 3;
      const tint = this.tintNoise(cx * 0.002, cz * 0.002);
      const snowLine = 1150 + tint * 220, rockLine = 620 + tint * 160;
      if (h < WATER + 7) c.copy(sand);
      else if (h > snowLine && n.y > 0.5) c.copy(snow);
      else if (n.y < 0.7 || h > rockLine) c.copy(rock1).lerp(rock2, rng());
      else if (this.forestAt(cx, cz) > 0 && h < 560) c.copy(forest).lerp(grass1, rng() * 0.25);
      else if (n.y < 0.82) c.copy(dirt).lerp(grass1, 0.5 + rng() * 0.3);
      else c.copy(grass1).lerp(grass2, 0.5 + tint * 0.8);
      const j = 0.94 + rng() * 0.1;
      for (const [x, y, z] of [[x0, y0, z0], [x1, y1, z1], [x2, y2, z2]]) {
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        col[o] = c.r * j; col[o + 1] = c.g * j; col[o + 2] = c.b * j;
        o += 3;
      }
    };
    for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
      const x0 = -HALF + i * CELL, z0 = -HALF + j * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      const h00 = H[j * N + i], h10 = H[j * N + i + 1], h01 = H[(j + 1) * N + i], h11 = H[(j + 1) * N + i + 1];
      // split along (0,0)-(1,1) diagonal to match terrainHeight(); wound counter-clockwise from above
      face(x0, z0, h00, x1, z1, h11, x1, z0, h10);
      face(x0, z0, h00, x0, z1, h01, x1, z1, h11);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    this.terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  forestAt(x, z) {
    return fbm(this.forestNoise, x * 0.0009, z * 0.0009, 3) + 0.08;
  }

  buildWater() {
    const g = new THREE.PlaneGeometry(WORLD, WORLD, 70, 70);
    g.rotateX(-Math.PI / 2);
    this.waterGeo = g;
    this.waterBase = Float32Array.from(g.attributes.position.array);
    this.water = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0x2f7fb3, roughness: 0.25, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.88,
    }));
    this.water.position.y = WATER;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
  }

  buildTrees() {
    const rng = mulberry32(this.seed + 77);
    const trees = [];
    const MAX = 9000;
    for (let tries = 0; tries < 90000 && trees.length < MAX; tries++) {
      const x = (rng() * 2 - 1) * HALF * WALL_START, z = (rng() * 2 - 1) * HALF * WALL_START;
      const f = this.forestAt(x, z);
      if (f < 0 && rng() > 0.04) continue;
      const y = this.terrainHeight(x, z);
      if (y < WATER + 6 || y > 600) continue;
      // slope check
      const sx = this.terrainHeight(x + 8, z) - y, sz = this.terrainHeight(x, z + 8) - y;
      if (Math.abs(sx) > 6 || Math.abs(sz) > 6) continue;
      const pine = y > 250 ? rng() < 0.85 : rng() < 0.45;
      const s = 0.75 + rng() * 0.75;
      trees.push({ x, y: y - 0.5, z, s, pine, h: (pine ? 26 : 19) * s, r: (pine ? 4.2 : 5.2) * s, rot: rng() * Math.PI });
    }
    this.trees = trees;
    // spatial hash for collisions
    this.treeCell = 60;
    this.treeGrid = new Map();
    for (const t of trees) {
      t.top = t.y + t.h;
      t.r *= 0.8; // collide a little inside the crown silhouette
      const key = Math.floor((t.z + HALF) / this.treeCell) * 10000 + Math.floor((t.x + HALF) / this.treeCell);
      if (!this.treeGrid.has(key)) this.treeGrid.set(key, []);
      this.treeGrid.get(key).push(t);
    }

    const trunkG = new THREE.CylinderGeometry(0.5, 0.8, 6, 5); trunkG.translate(0, 3, 0);
    const pineG = mergeGeos([
      (() => { const g = new THREE.ConeGeometry(5.2, 13, 7); g.translate(0, 10, 0); return g; })(),
      (() => { const g = new THREE.ConeGeometry(3.8, 10, 7); g.translate(0, 17, 0); return g; })(),
      (() => { const g = new THREE.ConeGeometry(2.4, 7, 6); g.translate(0, 22.5, 0); return g; })(),
    ]);
    const leafG = new THREE.IcosahedronGeometry(6.2, 0); leafG.scale(1, 1.15, 1); leafG.translate(0, 12, 0);
    const mat = new THREE.MeshLambertMaterial({ flatShading: true });
    const pines = trees.filter((t) => t.pine), leafs = trees.filter((t) => !t.pine);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x6b4a2f, flatShading: true }), trees.length);
    const pineM = new THREE.InstancedMesh(pineG, mat, pines.length);
    const leafM = new THREE.InstancedMesh(leafG, mat, leafs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      m4.compose(p.set(t.x, t.y, t.z), q, sc.setScalar(t.s));
      trunks.setMatrixAt(i, m4);
    });
    pines.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      m4.compose(p.set(t.x, t.y, t.z), q, sc.setScalar(t.s));
      pineM.setMatrixAt(i, m4);
      pineM.setColorAt(i, c.setHSL(0.31 + rng() * 0.05, 0.45 + rng() * 0.15, 0.2 + rng() * 0.08));
    });
    leafs.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      m4.compose(p.set(t.x, t.y, t.z), q, sc.setScalar(t.s));
      leafM.setMatrixAt(i, m4);
      const autumn = rng() < 0.12;
      leafM.setColorAt(i, autumn ? c.setHSL(0.07 + rng() * 0.05, 0.65, 0.42) : c.setHSL(0.22 + rng() * 0.08, 0.5, 0.3 + rng() * 0.1));
    });
    for (const m of [trunks, pineM, leafM]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  buildClouds() {
    const rng = mulberry32(this.seed + 99);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.9, emissive: 0xc4cedb, emissiveIntensity: 0.55 });
    const geo = new THREE.IcosahedronGeometry(1, 0);
    this.clouds = new THREE.Group();
    for (let i = 0; i < 70; i++) {
      const cl = new THREE.Group();
      const n = 3 + Math.floor(rng() * 5);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(geo, mat);
        const s = 90 + rng() * 140;
        m.scale.set(s * (1.2 + rng() * 0.6), s * 0.6, s);
        m.position.set((k - n / 2) * 110 + rng() * 60, rng() * 50, rng() * 120 - 60);
        m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        cl.add(m);
      }
      cl.position.set((rng() * 2 - 1) * HALF * 1.1, 1900 + rng() * 900, (rng() * 2 - 1) * HALF * 1.1);
      cl.rotation.y = rng() * Math.PI;
      this.clouds.add(cl);
    }
    this.scene.add(this.clouds);
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x4b5e3a, 1.05));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 260;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 10, far: 5000 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.6;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  // keep the shadow frustum, sky dome and fog around the camera / player
  update(dt, t, focus, camera) {
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 2000);
    this.sun.target.position.copy(focus);
    this.sky.position.copy(camera.position);
    // gentle waves (only the vertices near the camera matter visually, but the grid is coarse enough to do all)
    const p = this.waterGeo.attributes.position, base = this.waterBase;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      p.array[i * 3 + 1] = Math.sin(x * 0.012 + t * 1.1) * 1.6 + Math.cos(z * 0.015 + t * 0.8) * 1.4;
    }
    p.needsUpdate = true;
    for (const c of this.clouds.children) {
      c.position.x += dt * 6;
      if (c.position.x > HALF * 1.15) c.position.x = -HALF * 1.15;
    }
  }
}

function mergeGeos(list) {
  const arrs = list.map((g) => (g.index ? g.toNonIndexed() : g).attributes.position.array);
  const out = new Float32Array(arrs.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}
