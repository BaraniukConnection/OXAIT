// Low-poly particle effects: fire, smoke, debris chunks, craters, muzzle light.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const rnd = (a, b) => a + Math.random() * (b - a);

class Pool {
  constructor(scene, max, geo, mat) {
    this.max = max;
    this.next = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.items = [];
    for (let i = 0; i < max; i++) {
      this.items.push({ t: 1, dead: true, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, drag: 0, grav: 0, bounce: false,
        c0: new THREE.Color(), c1: new THREE.Color(), q: new THREE.Quaternion() });
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, _c.set(0xffffff));
    }
    scene.add(this.mesh);
  }

  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1 = c0, drag = 0, grav = 0, bounce = false) {
    const p = this.items[this.next];
    this.next = (this.next + 1) % this.max;
    Object.assign(p, { t: 0, dead: false, life, x, y, z, vx, vy, vz, s0, s1, drag, grav, bounce });
    p.c0.set(c0);
    p.c1.set(c1);
    p.q.setFromEuler(_e.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (p.dead) continue;
      dirty = true;
      p.t += dt / p.life;
      if (p.t >= 1) { p.dead = true; this.mesh.setMatrixAt(i, ZERO); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.bounce && p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; p.vx *= 0.55; p.vz *= 0.55; }
      const fade = p.t > 0.7 ? (1 - p.t) / 0.3 : 1;
      _s.setScalar((p.s0 + (p.s1 - p.s0) * Math.sqrt(p.t)) * fade);
      _m.compose(_p.set(p.x, p.y, p.z), p.q, _s);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.copy(p.c0).lerp(p.c1, p.t));
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

export class Effects {
  constructor(scene) {
    const ico = new THREE.IcosahedronGeometry(1, 0);
    this.fire = new Pool(scene, 800, ico, new THREE.MeshBasicMaterial({ toneMapped: false }));
    this.smoke = new Pool(scene, 1600, ico, new THREE.MeshLambertMaterial({ flatShading: true }));
    this.debris = new Pool(scene, 300, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ flatShading: true }));
    this.debris.mesh.castShadow = true;

    const cg = new THREE.CircleGeometry(1, 7);
    cg.rotateX(-Math.PI / 2);
    this.decals = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0x29231d, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 160);
    for (let i = 0; i < 160; i++) this.decals.setMatrixAt(i, ZERO);
    this.decals.receiveShadow = true;
    this.decalNext = 0;
    scene.add(this.decals);

    this.light = new THREE.PointLight(0xffaa55, 0, 70, 1.4);
    scene.add(this.light);
  }

  flash(pos, k) {
    this.light.position.copy(pos);
    this.light.intensity = Math.max(this.light.intensity, 900 * k);
  }

  crater(x, z, r, y = 0.03) {
    _m.compose(_p.set(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), _s.set(r, 1, r * rnd(0.8, 1.1)));
    this.decals.setMatrixAt(this.decalNext, _m);
    this.decalNext = (this.decalNext + 1) % 160;
    this.decals.instanceMatrix.needsUpdate = true;
  }

  muzzle(pos, dir) {
    for (let i = 0; i < 14; i++) {
      const v = rnd(6, 34);
      this.fire.spawn(pos.x, pos.y, pos.z, dir.x * v + rnd(-3, 3), dir.y * v + rnd(-3, 3), dir.z * v + rnd(-3, 3),
        rnd(0.1, 0.24), rnd(0.35, 0.7), rnd(1.0, 1.9), 0xfff3b0, 0xff5a10, 7);
    }
    for (let i = 0; i < 18; i++) {
      const v = rnd(1, 16);
      this.smoke.spawn(pos.x, pos.y, pos.z, dir.x * v + rnd(-2.5, 2.5), dir.y * v + rnd(-1, 2.5), dir.z * v + rnd(-2.5, 2.5),
        rnd(1.4, 3.2), rnd(0.4, 0.8), rnd(2.0, 3.6), 0xe3ded4, 0xb9b3a9, 2.4, -0.5);
    }
    // ground blast under the muzzle
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * 6.28, v = rnd(4, 10);
      this.smoke.spawn(pos.x, 0.6, pos.z, Math.cos(a) * v, rnd(0.5, 2), Math.sin(a) * v, rnd(0.8, 1.6), 0.4, rnd(1.4, 2.4), 0xb7a888, 0xa89a7c, 2.5, 0);
    }
    this.flash(pos, 1);
  }

  explosion(pos, scale = 1) {
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * 6.28, e = rnd(-0.2, 1.2), v = rnd(3, 14) * scale;
      this.fire.spawn(pos.x, pos.y + 1, pos.z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + 2, Math.sin(a) * Math.cos(e) * v,
        rnd(0.35, 0.95), rnd(0.8, 1.5) * scale, rnd(2.2, 3.6) * scale, 0xfff0a0, 0xd0300a, 2.6, -2);
    }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, v = rnd(1, 7) * scale;
      this.smoke.spawn(pos.x, pos.y + 1.5, pos.z, Math.cos(a) * v, rnd(2, 9), Math.sin(a) * v,
        rnd(2.5, 5.5), rnd(1, 2), rnd(4, 6.5) * scale, 0x2f2b28, 0x6d665e, 1.4, -1.2);
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, v = rnd(5, 16);
      this.debris.spawn(pos.x, pos.y + 1, pos.z, Math.cos(a) * v, rnd(6, 16), Math.sin(a) * v,
        rnd(2.5, 4), rnd(0.2, 0.55), rnd(0.2, 0.55), 0x2a2622, 0x2a2622, 0.2, 22, true);
    }
    this.flash(_p.set(pos.x, pos.y + 2, pos.z), 3.5);
    this.crater(pos.x, pos.z, 5 * scale);
  }

  impact(pos, kind) {
    const { x, y, z } = pos;
    if (kind === 'metal') {
      for (let i = 0; i < 20; i++) {
        this.fire.spawn(x, y, z, rnd(-14, 14), rnd(-2, 14), rnd(-14, 14), rnd(0.2, 0.45), rnd(0.12, 0.22), 0.05, 0xffffd0, 0xff8020, 1.5, 14);
      }
      for (let i = 0; i < 8; i++) this.smoke.spawn(x, y, z, rnd(-2, 2), rnd(1, 4), rnd(-2, 2), rnd(1, 2.2), 0.4, rnd(1.4, 2.4), 0x48433e, 0x7c766e, 1.5, -0.8);
      this.flash(pos, 1.2);
      return;
    }
    const dirt = kind === 'ground';
    const c0 = dirt ? 0x7d6b52 : 0xb5afa4, c1 = dirt ? 0x9a8a70 : 0xcfc9be;
    for (let i = 0; i < 16; i++) {
      this.smoke.spawn(x, y, z, rnd(-4, 4), rnd(2, dirt ? 11 : 5), rnd(-4, 4), rnd(1.2, 2.8), rnd(0.5, 1), rnd(2, 3.6), c0, c1, 2, dirt ? 3 : -0.3);
    }
    for (let i = 0; i < 12; i++) {
      this.debris.spawn(x, y, z, rnd(-8, 8), rnd(4, 12), rnd(-8, 8), rnd(1.2, 2.4), rnd(0.12, 0.35), rnd(0.12, 0.35), dirt ? 0x5e5040 : 0x8f8a80, dirt ? 0x5e5040 : 0x8f8a80, 0.3, 22, true);
    }
    for (let i = 0; i < 6; i++) this.fire.spawn(x, y, z, rnd(-6, 6), rnd(2, 8), rnd(-6, 6), rnd(0.1, 0.2), rnd(0.4, 0.8), 1.2, 0xffe0a0, 0xff6020, 4);
    this.flash(pos, 0.8);
    if (dirt) this.crater(x, z, rnd(1.4, 2.2));
  }

  trackDust(x, z, k) {
    this.smoke.spawn(x + rnd(-0.5, 0.5), 0.4, z + rnd(-0.5, 0.5), rnd(-0.6, 0.6), rnd(0.4, 1.6) * k, rnd(-0.6, 0.6),
      rnd(0.9, 1.8), 0.4, rnd(1.4, 2.4) * k, 0xa79a7d, 0xbdb39c, 1.2, 0);
  }

  exhaust(pos) {
    this.smoke.spawn(pos.x, pos.y, pos.z, rnd(-0.4, 0.4), rnd(0.8, 1.6), rnd(-0.4, 0.4), rnd(0.5, 0.8), 0.1, rnd(0.25, 0.4), 0x6a665f, 0xa8a39a, 0.8, -0.4);
  }

  burn(pos, k) {
    if (Math.random() < k) {
      this.fire.spawn(pos.x + rnd(-0.8, 0.8), pos.y, pos.z + rnd(-0.8, 0.8), rnd(-0.5, 0.5), rnd(2, 5), rnd(-0.5, 0.5),
        rnd(0.3, 0.7), rnd(0.5, 0.9) * (0.5 + k), 0.2, 0xffd070, 0xc02a08, 0.5, -1);
    }
    if (Math.random() < 0.35 + k * 0.4) {
      this.smoke.spawn(pos.x + rnd(-0.6, 0.6), pos.y + 0.6, pos.z + rnd(-0.6, 0.6), rnd(-0.6, 0.6) + 1.2, rnd(3, 5.5), rnd(-0.6, 0.6),
        rnd(3.5, 6.5), rnd(0.7, 1.2), rnd(3, 5.5), 0x2a2724, 0x77716a, 0.35, 0);
    }
  }

  update(dt) {
    this.fire.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
    this.light.intensity *= Math.exp(-dt * 14);
  }
}
