// Procedural low-poly city: grid of blocks (buildings, parks, plazas, parking,
// ruins) separated by roads. Also owns collision + raycast queries.
import * as THREE from 'three';

export const CFG = { blocks: 8, block: 56, road: 18 };
CFG.size = CFG.blocks * CFG.block + (CFG.blocks + 1) * CFG.road;
CFG.half = CFG.size / 2;
CFG.limit = CFG.half + 22;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [0xd8c8a8, 0xc9b49a, 0xb7a58c, 0xa8b2ba, 0xc6a283, 0xe1d6c2, 0x9ea7a1, 0xc79173,
  0x8e9aa6, 0xcfb38d, 0xb0957a, 0xd4bfa0, 0xbfc6c9, 0xa98f86];
const CAR_COLORS = [0xb83a2e, 0x2e5fa8, 0xe2e2dc, 0x2b2b2b, 0xd8b23a, 0x6d7a80, 0x3e7d4a, 0x8a3e74, 0xc9c3b4];
const TREE_COLORS = [0x5d8a3c, 0x4f7d35, 0x6b9845, 0x46703a, 0x7aa04c];

export const roadCenter = (i) => -CFG.half + CFG.road / 2 + i * (CFG.block + CFG.road);
const blockMin = (i) => -CFG.half + CFG.road + i * (CFG.block + CFG.road);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// Slab test. o/d are {x,y,z}; returns entry distance or Infinity.
export function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; } else {
    let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx;
    if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) { if (oy < b.minY || oy > b.maxY) return Infinity; } else {
    let t1 = (b.minY - oy) / dy, t2 = (b.maxY - oy) / dy;
    if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; } else {
    let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz;
    if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

function buildingMaterial() {
  const m = new THREE.MeshLambertMaterial({ flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTop;\nvarying float vTop;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
          wn = mat3(instanceMatrix) * wn;
        #endif
        wp4 = modelMatrix * wp4;
        vWPos = wp4.xyz; vWNrm = normalize(mat3(modelMatrix) * wn); vTop = aTop;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTop;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (abs(vWNrm.y) < 0.5) {
          float u = abs(vWNrm.x) > 0.5 ? vWPos.z : vWPos.x;
          float fu = fract(u / 3.4);
          float fy = fract(vWPos.y / 3.5);
          float win = step(0.28, fu) * step(fu, 0.78) * step(0.32, fy) * step(fy, 0.8)
                    * step(3.2, vWPos.y) * step(vWPos.y, vTop - 1.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.21, 0.27), win * 0.82);
          diffuseColor.rgb *= 1.0 - 0.22 * step(vWPos.y, 3.0);
        }`);
  };
  return m;
}

export class City {
  constructor(seed) {
    this.R = mulberry32(seed);
    this.group = new THREE.Group();
    this.colliders = [];
    this.blocks = [];
    this.trees = [];
    this.cars = [];
    this.falling = [];
    this._build();
  }

  // ------------------------------------------------------------ generation
  _build() {
    const R = this.R, B = CFG.block;
    const blds = [], roofs = [], slabs = [], marks = [], rubble = [];
    const addB = (x, z, w, d, h, color, collide = true) => {
      blds.push({ x, z, w, d, h, color });
      if (collide) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minY: 0, maxY: h, minZ: z - d / 2, maxZ: z + d / 2 });
    };
    const slab = (x, z, w, d, h, color) => slabs.push({ x, z, w, d, h, color });
    const pick = (a) => a[(R() * a.length) | 0];

    for (let i = 0; i < CFG.blocks; i++) {
      for (let j = 0; j < CFG.blocks; j++) {
        const x0 = blockMin(i), z0 = blockMin(j), cx = x0 + B / 2, cz = z0 + B / 2;
        const r = R();
        let type = r < 0.56 ? 'build' : r < 0.7 ? 'park' : r < 0.8 ? 'plaza' : r < 0.9 ? 'parking' : 'ruins';
        if ((i === 3 || i === 4) && (j === 3 || j === 4) && R() < 0.5) type = 'plaza';
        this.blocks.push({ i, j, x0, z0, x1: x0 + B, z1: z0 + B, type });
        slab(cx, cz, B, B, 0.15, 0x9c988f);

        if (type === 'build') {
          const cols = 2 + (R() < 0.4 ? 1 : 0), rows = 2 + (R() < 0.4 ? 1 : 0);
          const inner = B - 6, lw = inner / cols, ld = inner / rows;
          for (let a = 0; a < cols; a++) {
            for (let b = 0; b < rows; b++) {
              if (R() < 0.1) continue;
              const gap = 1.5 + R() * 3.5;
              const w = lw - gap, d = ld - gap;
              const x = x0 + 3 + lw * (a + 0.5), z = z0 + 3 + ld * (b + 0.5);
              let h = 9 + R() * R() * 34;
              if (R() < 0.07) h = 48 + R() * 30;
              addB(x, z, w, d, h, pick(PALETTE));
              const n = (R() * 3.5) | 0;
              for (let k = 0; k < n; k++) {
                const rw = 2 + R() * 3, rd = 2 + R() * 3;
                roofs.push({ x: x + (R() - 0.5) * (w - rw - 1), z: z + (R() - 0.5) * (d - rd - 1), w: rw, d: rd, h: 1 + R() * 1.6, y: h, color: pick([0x8d8d88, 0x77746e, 0xa19d94]) });
              }
            }
          }
        } else if (type === 'park') {
          slab(cx, cz, B - 4, B - 4, 0.2, 0x6e9b4c);
          slab(cx, cz, 3, B - 4, 0.22, 0xc4b89f);
          slab(cx, cz, B - 4, 3, 0.22, 0xc4b89f);
          if (R() < 0.6) {
            const f = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 1.0, 10), this._mat(0xb9b2a6));
            f.position.set(cx, 0.5, cz);
            const w = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.2, 10), this._mat(0x4f86a8));
            w.position.set(cx, 0.95, cz);
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 3, 8), this._mat(0xb9b2a6));
            p.position.set(cx, 1.5, cz);
            for (const o of [f, w, p]) { o.castShadow = o.receiveShadow = true; this.group.add(o); }
            this.colliders.push({ minX: cx - 3.8, maxX: cx + 3.8, minY: 0, maxY: 1.2, minZ: cz - 3.8, maxZ: cz + 3.8 });
          }
          const n = 14 + ((R() * 12) | 0);
          for (let k = 0; k < n; k++) {
            const x = x0 + 4 + R() * (B - 8), z = z0 + 4 + R() * (B - 8);
            if (Math.abs(x - cx) < 3 || Math.abs(z - cz) < 3 || Math.hypot(x - cx, z - cz) < 7) continue;
            this._tree(x, z, 0.8 + R() * 0.6);
          }
        } else if (type === 'plaza') {
          slab(cx, cz, B - 4, B - 4, 0.19, 0xc1b7a4);
          addB(cx, cz, 6, 6, 1.6, 0xa39c90);
          addB(cx, cz, 2, 2, 9.5, 0x9a948a, false);
          roofs.push({ x: cx, z: cz, w: 1.2, d: 2.4, h: 2.2, y: 9.5, color: 0x5f6e5c });
          this.colliders[this.colliders.length - 1].maxY = 11.7;
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const px = cx + sx * 17, pz = cz + sz * 17;
            slab(px, pz, 4, 4, 0.7, 0x8e8478);
            this._tree(px, pz, 0.9);
          }
        } else if (type === 'parking') {
          slab(cx, cz, B - 4, B - 4, 0.18, 0x55575c);
          for (const row of [-1, 1]) {
            for (let k = 0; k < 9; k++) {
              const x = x0 + 6 + k * 5.2, z = cz + row * 12;
              marks.push({ x: x - 2.6, z, w: 0.15, d: 5.5, y: 0.19 });
              if (R() < 0.7) this._car(x, z, row > 0 ? 0 : Math.PI);
            }
          }
          marks.push({ x: cx, z: cz, w: B - 8, d: 0.2, y: 0.19 });
        } else {
          slab(cx, cz, B - 4, B - 4, 0.18, 0x8b857b);
          const shellH = 6 + R() * 7;
          if (R() < 0.65) {
            const s = 18 + R() * 6, t = 1;
            const open = (R() * 4) | 0;
            const walls = [[0, -s / 2, s, t], [0, s / 2, s, t], [-s / 2, 0, t, s], [s / 2, 0, t, s]];
            walls.forEach(([dx, dz, w, d], k) => {
              if (k === open) {
                // split wall leaving a breach in the middle
                const half = (w > d ? w : d) / 2 - 3;
                for (const sgn of [-1, 1]) {
                  if (w > d) addB(cx + dx + sgn * (3 + half / 2), cz + dz, half, d, shellH * (0.5 + R() * 0.5), 0x8f877b);
                  else addB(cx + dx, cz + dz + sgn * (3 + half / 2), w, half, shellH * (0.5 + R() * 0.5), 0x8f877b);
                }
              } else addB(cx + dx, cz + dz, w, d, shellH * (0.6 + R() * 0.4), 0x9a9184);
            });
          }
          const nw = 3 + ((R() * 4) | 0);
          for (let k = 0; k < nw; k++) {
            const horiz = R() < 0.5, len = 6 + R() * 12;
            const x = x0 + 8 + R() * (B - 16), z = z0 + 8 + R() * (B - 16);
            if (Math.abs(x - cx) < 13 && Math.abs(z - cz) < 13) continue;
            addB(x, z, horiz ? len : 1, horiz ? 1 : len, 2 + R() * 3, 0x8a8277);
          }
          for (let k = 0; k < 14; k++) {
            rubble.push({ x: x0 + 4 + R() * (B - 8), z: z0 + 4 + R() * (B - 8), s: 0.6 + R() * 1.4, color: pick([0x77716a, 0x8a8277, 0x6a645d]) });
          }
        }

        // street trees on block edges (not on parks, they have their own)
        if (type !== 'park') {
          for (let k = 0; k < 4; k++) {
            for (let u = 6; u < B - 4; u += 11) {
              if (R() > 0.45) continue;
              const e = 1.7;
              const x = k < 2 ? x0 + u : (k === 2 ? x0 + e : x0 + B - e);
              const z = k < 2 ? (k === 0 ? z0 + e : z0 + B - e) : z0 + u;
              if (!this._insideCollider(x, z, 1.2)) this._tree(x, z, 0.75 + R() * 0.4);
            }
          }
        }
      }
    }

    // street-parked cars
    for (let r = 0; r <= CFG.blocks; r++) {
      const rc = roadCenter(r);
      for (let u = -CFG.half + 4; u < CFG.half - 4; u += 7) {
        if (this._nearIntersection(u, 6)) continue;
        for (const side of [-1, 1]) {
          if (R() < 0.1) this._car(rc + side * (CFG.road / 2 - 1.8), u, R() < 0.5 ? 0 : Math.PI);
          if (R() < 0.1) this._car(u, rc + side * (CFG.road / 2 - 1.8), Math.PI / 2 + (R() < 0.5 ? 0 : Math.PI));
        }
      }
    }

    // lane dashes + crosswalks
    for (let r = 0; r <= CFG.blocks; r++) {
      const rc = roadCenter(r);
      for (let u = -CFG.half; u < CFG.half; u += 9) {
        if (this._nearIntersection(u + 2, CFG.road / 2 + 1)) continue;
        marks.push({ x: rc, z: u + 2, w: 0.28, d: 4, y: 0.02 });
        marks.push({ x: u + 2, z: rc, w: 4, d: 0.28, y: 0.02 });
      }
      for (let k = 0; k <= CFG.blocks; k++) {
        const kc = roadCenter(k);
        for (const sgn of [-1, 1]) {
          const off = kc + sgn * (CFG.road / 2 + 2.2);
          if (Math.abs(off) > CFG.half - 2) continue;
          for (let s = -3; s <= 3; s++) {
            marks.push({ x: rc + s * 2.3, z: off, w: 1.1, d: 3, y: 0.02 });
            marks.push({ x: off, z: rc + s * 2.3, w: 3, d: 1.1, y: 0.02 });
          }
        }
      }
    }

    this._instBuildings(blds);
    this._instBoxes(roofs, this._mat(0xffffff), true, (o) => o.y + o.h / 2, true);
    this._instBoxes(slabs, this._mat(0xffffff), false, (o) => o.h / 2, true);
    this._instBoxes(marks.map((o) => ({ ...o, h: 0.04, color: 0xe9e3cc })), this._mat(0xffffff), false, (o) => o.y, false);
    this._instRubble(rubble);
    this._instTrees();
    this._instCars();
    this._ground();
  }

  _mat(color) { return new THREE.MeshLambertMaterial({ color, flatShading: true }); }

  _nearIntersection(u, r) {
    for (let k = 0; k <= CFG.blocks; k++) if (Math.abs(u - roadCenter(k)) < r) return true;
    return false;
  }

  _insideCollider(x, z, r) {
    for (const c of this.colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    }
    return false;
  }

  _tree(x, z, s) {
    this.trees.push({ x, z, s, rot: this.R() * 6.28, fall: 0, ax: 1, az: 0, down: false, removed: false, color: TREE_COLORS[(this.R() * TREE_COLORS.length) | 0] });
  }

  _car(x, z, yaw) {
    this.cars.push({ x, z, yaw, crushed: false, removed: false, color: CAR_COLORS[(this.R() * CAR_COLORS.length) | 0] });
  }

  _instBuildings(list) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const tops = new Float32Array(list.length);
    const mesh = new THREE.InstancedMesh(geo, buildingMaterial(), list.length);
    list.forEach((b, i) => {
      _m.compose(_p.set(b.x, 0, b.z), _q.identity(), _s.set(b.w, b.h, b.d));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(b.color));
      tops[i] = b.h;
    });
    geo.setAttribute('aTop', new THREE.InstancedBufferAttribute(tops, 1));
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  _instBoxes(list, mat, cast, yOf, receive) {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
    list.forEach((b, i) => {
      _m.compose(_p.set(b.x, yOf(b), b.z), _q.identity(), _s.set(b.w, b.h, b.d));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(b.color));
    });
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    this.group.add(mesh);
  }

  _instRubble(list) {
    const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), this._mat(0xffffff), list.length);
    list.forEach((b, i) => {
      _q.setFromAxisAngle(UP, this.R() * 6);
      _m.compose(_p.set(b.x, 0.1, b.z), _q, _s.set(b.s * 1.4, b.s * 0.55, b.s));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(b.color));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  _instTrees() {
    const trunk = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 5);
    trunk.translate(0, 1.2, 0);
    const crown = new THREE.IcosahedronGeometry(1.9, 0);
    crown.scale(1, 1.15, 1);
    crown.translate(0, 3.6, 0);
    const n = this.trees.length;
    this.trunkMesh = new THREE.InstancedMesh(trunk, this._mat(0x6b4f36), n);
    this.crownMesh = new THREE.InstancedMesh(crown, this._mat(0xffffff), n);
    for (const m of [this.trunkMesh, this.crownMesh]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
    this.trees.forEach((t, i) => { this.crownMesh.setColorAt(i, _c.set(t.color)); this._treeMatrix(i); });
  }

  _treeMatrix(i) {
    const t = this.trees[i];
    if (t.removed) { _m.makeScale(0, 0, 0); } else {
      _q.setFromAxisAngle(UP, t.rot);
      _q2.setFromAxisAngle(_ax.set(t.ax, 0, t.az), t.fall);
      _q2.multiply(_q);
      _m.compose(_p.set(t.x, 0.15, t.z), _q2, _s.setScalar(t.s));
    }
    this.trunkMesh.setMatrixAt(i, _m);
    this.crownMesh.setMatrixAt(i, _m);
    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.crownMesh.instanceMatrix.needsUpdate = true;
  }

  _instCars() {
    const body = new THREE.BoxGeometry(1.9, 0.75, 4.3);
    body.translate(0, 0.6, 0);
    const cabin = new THREE.BoxGeometry(1.65, 0.62, 2.2);
    cabin.translate(0, 1.28, -0.25);
    const n = Math.max(1, this.cars.length);
    this.carBody = new THREE.InstancedMesh(body, this._mat(0xffffff), n);
    this.carCabin = new THREE.InstancedMesh(cabin, this._mat(0xffffff), n);
    for (const m of [this.carBody, this.carCabin]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
    this.cars.forEach((c, i) => {
      this.carBody.setColorAt(i, _c.set(c.color));
      this.carCabin.setColorAt(i, _c.set(c.color).multiplyScalar(0.55));
      this._carMatrix(i);
    });
    if (!this.cars.length) { _m.makeScale(0, 0, 0); this.carBody.setMatrixAt(0, _m); this.carCabin.setMatrixAt(0, _m); }
  }

  _carMatrix(i) {
    const c = this.cars[i];
    if (c.removed) _m.makeScale(0, 0, 0);
    else _m.compose(_p.set(c.x, 0, c.z), _q.setFromAxisAngle(UP, c.yaw), _s.set(c.crushed ? 1.12 : 1, c.crushed ? 0.32 : 1, c.crushed ? 1.05 : 1));
    this.carBody.setMatrixAt(i, _m);
    this.carCabin.setMatrixAt(i, _m);
    this.carBody.instanceMatrix.needsUpdate = true;
    this.carCabin.instanceMatrix.needsUpdate = true;
  }

  _ground() {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), this._mat(0x7f9b5b));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.03;
    grass.receiveShadow = true;
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(CFG.size, CFG.size), this._mat(0x4a4d52));
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    this.group.add(grass, asphalt);

    const R = this.R;
    // jersey barriers marking the play area
    const bars = [];
    const L = CFG.limit + 2;
    for (let u = -L; u < L; u += 4.2) {
      bars.push({ x: u, z: -L, yaw: 0 }, { x: u, z: L, yaw: 0 }, { x: -L, z: u, yaw: Math.PI / 2 }, { x: L, z: u, yaw: Math.PI / 2 });
    }
    const bg = new THREE.CylinderGeometry(0.25, 0.6, 1, 4, 1);
    bg.rotateY(Math.PI / 4);
    bg.scale(1, 1, 5.6);
    bg.translate(0, 0.5, 0);
    const bm = new THREE.InstancedMesh(bg, this._mat(0xb7b2a8), bars.length);
    bars.forEach((b, i) => { _m.compose(_p.set(b.x, 0, b.z), _q.setFromAxisAngle(UP, b.yaw + Math.PI / 2), _s.set(1, 1, 0.7)); bm.setMatrixAt(i, _m); });
    bm.castShadow = bm.receiveShadow = true;
    this.group.add(bm);

    // outskirts: trees, hills, clouds
    const far = [];
    for (let k = 0; k < 160; k++) {
      const a = R() * Math.PI * 2, d = CFG.limit + 15 + R() * 260;
      far.push({ x: Math.cos(a) * d, z: Math.sin(a) * d });
    }
    const fc = new THREE.ConeGeometry(2.2, 7, 6);
    fc.translate(0, 4.5, 0);
    const fm = new THREE.InstancedMesh(fc, this._mat(0xffffff), far.length);
    far.forEach((f, i) => {
      const s = 0.8 + R() * 0.9;
      _m.compose(_p.set(f.x, 0, f.z), _q.identity(), _s.set(s, s * (0.9 + R() * 0.5), s));
      fm.setMatrixAt(i, _m);
      fm.setColorAt(i, _c.set(TREE_COLORS[(R() * TREE_COLORS.length) | 0]).multiplyScalar(0.85));
    });
    fm.castShadow = true;
    this.group.add(fm);

    const hills = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this._mat(0xffffff), 46);
    for (let k = 0; k < 46; k++) {
      const a = (k / 46) * Math.PI * 2 + R() * 0.1, d = 760 + R() * 380, r = 70 + R() * 120;
      _m.compose(_p.set(Math.cos(a) * d, -r * 0.15, Math.sin(a) * d), _q.setFromAxisAngle(UP, R() * 6), _s.set(r, r * (0.35 + R() * 0.35), r));
      hills.setMatrixAt(k, _m);
      hills.setColorAt(k, _c.set(R() < 0.6 ? 0x6f8f52 : 0x8a9a5e));
    }
    this.group.add(hills);

    const cl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x8090a0, fog: false }), 90);
    let ci = 0;
    for (let k = 0; k < 22; k++) {
      const a = R() * 6.28, d = 200 + R() * 900, y = 230 + R() * 120;
      const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
      for (let n = 0; n < 4 && ci < 90; n++, ci++) {
        const r = 18 + R() * 22;
        _m.compose(_p.set(bx + (R() - 0.5) * 60, y + R() * 10, bz + (R() - 0.5) * 40), _q.setFromAxisAngle(UP, R() * 6), _s.set(r * 1.5, r * 0.55, r));
        cl.setMatrixAt(ci, _m);
      }
    }
    cl.count = ci;
    this.group.add(cl);

    // sky dome
    const sky = new THREE.SphereGeometry(2200, 24, 12);
    const col = [], top = new THREE.Color(0x4d8fd6), hor = new THREE.Color(0xd3e4ee);
    const pos = sky.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = Math.max(0, pos.getY(i) / 2200);
      _c.copy(hor).lerp(top, Math.pow(k, 0.6));
      col.push(_c.r, _c.g, _c.b);
    }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.group.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  }

  // ------------------------------------------------------------ queries

  // Nearest hit along a normalized ray against buildings and the ground.
  raycast(o, d, maxT) {
    let best = maxT, kind = null;
    if (d.y < -1e-6) {
      const t = -o.y / d.y;
      if (t >= 0 && t < best) { best = t; kind = 'ground'; }
    }
    for (const c of this.colliders) {
      const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, c, best);
      if (t < best) { best = t; kind = 'building'; }
    }
    return { t: kind ? best : Infinity, kind };
  }

  blocked(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    for (const c of this.colliders) {
      if (rayBox(a.x, a.y, a.z, dx / len, dy / len, dz / len, c, len) < len) return true;
    }
    return false;
  }

  // Push a circle (p.x, p.z, radius r) out of every collider. Returns true if it touched.
  resolveCircle(p, r) {
    let hit = false;
    for (const c of this.colliders) {
      if (c.maxY < 0.5) continue;
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX)), cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * (r - d);
        p.z += (dz / d) * (r - d);
      } else {
        const l = p.x - c.minX, rr = c.maxX - p.x, b = p.z - c.minZ, f = c.maxZ - p.z, m = Math.min(l, rr, b, f);
        if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === b) p.z = c.minZ - r; else p.z = c.maxZ + r;
      }
    }
    const L = CFG.limit;
    if (Math.abs(p.x) > L || Math.abs(p.z) > L) {
      p.x = Math.max(-L, Math.min(L, p.x));
      p.z = Math.max(-L, Math.min(L, p.z));
      hit = true;
    }
    return hit;
  }

  isClear(x, z, r) {
    if (Math.abs(x) > CFG.half - r || Math.abs(z) > CFG.half - r) return false;
    return !this._insideCollider(x, z, r);
  }

  randomSpot(kind) {
    const R = this.R;
    for (let n = 0; n < 200; n++) {
      if (kind === 'open') {
        const open = this.blocks.filter((b) => b.type !== 'build');
        if (!open.length) break;
        const b = open[(R() * open.length) | 0];
        const x = b.x0 + 7 + R() * (CFG.block - 14), z = b.z0 + 7 + R() * (CFG.block - 14);
        if (this.isClear(x, z, 5.5)) return { x, z, yaw: ((R() * 4) | 0) * Math.PI / 2 + (R() - 0.5) * 0.8 };
      } else {
        const rc = roadCenter((R() * (CFG.blocks + 1)) | 0) + (R() < 0.5 ? -3.5 : 3.5);
        const u = (R() - 0.5) * (CFG.size - 30);
        const vertical = R() < 0.5;
        const x = vertical ? rc : u, z = vertical ? u : rc;
        if (this.isClear(x, z, 5)) {
          const yaw = (vertical ? 0 : Math.PI / 2) + (R() < 0.5 ? 0 : Math.PI);
          return { x, z, yaw };
        }
      }
    }
    return { x: roadCenter(0), z: 0, yaw: 0 };
  }

  clearAround(x, z, r) {
    this.trees.forEach((t, i) => { if (Math.hypot(t.x - x, t.z - z) < r) { t.removed = true; this._treeMatrix(i); } });
    this.cars.forEach((c, i) => { if (Math.hypot(c.x - x, c.z - z) < r) { c.removed = true; this._carMatrix(i); } });
  }

  // Tank driving over scenery. Returns number of cars crushed this call.
  crush(x, z, r, dirX, dirZ) {
    let cars = 0;
    for (let i = 0; i < this.trees.length; i++) {
      const t = this.trees[i];
      if (t.down || t.removed) continue;
      if (Math.abs(t.x - x) < r + 0.5 && Math.abs(t.z - z) < r + 0.5 && Math.hypot(t.x - x, t.z - z) < r + 0.4) {
        t.down = true;
        const l = Math.hypot(dirX, dirZ) || 1;
        t.ax = dirZ / l; t.az = -dirX / l;
        this.falling.push(i);
      }
    }
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (c.crushed || c.removed) continue;
      if (Math.hypot(c.x - x, c.z - z) < r + 1.2) {
        c.crushed = true;
        this.carBody.setColorAt(i, _c.set(c.color).multiplyScalar(0.5));
        this.carBody.instanceColor.needsUpdate = true;
        this._carMatrix(i);
        cars++;
      }
    }
    return cars;
  }

  update(dt) {
    for (let k = this.falling.length - 1; k >= 0; k--) {
      const i = this.falling[k], t = this.trees[i];
      t.fall = Math.min(1.45, t.fall + dt * (1 + t.fall * 3));
      this._treeMatrix(i);
      if (t.fall >= 1.45) this.falling.splice(k, 1);
    }
  }
}
