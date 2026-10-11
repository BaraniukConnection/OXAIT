// Low-poly particles: fire, smoke, debris, sparks - instanced so thousands stay cheap.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

class Pool {
  constructor(scene, geo, mat, cap, { shadow = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    this.cap = cap;
    this.items = [];
    for (let i = 0; i < cap; i++) {
      this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
    }
    this.next = 0;
    scene.add(this.mesh);
  }
  spawn(p) {
    // ring buffer: oldest particle is recycled when full
    const idx = this.next;
    this.next = (this.next + 1) % this.cap;
    p.idx = idx;
    p.age = 0;
    this.items[idx] = p;
    this.mesh.setColorAt(idx, p.c0);
  }
  update(dt) {
    const mesh = this.mesh;
    for (let i = 0; i < this.cap; i++) {
      const p = this.items[i];
      if (!p) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
        this.items[i] = null;
        continue;
      }
      if (p.grav) p.vel.y -= p.grav * dt;
      if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      // pop: grow to size1 during the first 15% of life, then shrink by `shrink`; else linear size0 -> size1
      const s = p.pop
        ? (t < 0.15 ? p.size0 + (p.size1 - p.size0) * (t / 0.15) : p.size1 * (1 - ((t - 0.15) / 0.85) * (p.shrink ?? 1)))
        : p.size0 + (p.size1 - p.size0) * t;
      _e.set(p.rx + p.age * p.spin, p.ry + p.age * p.spin * 0.7, 0);
      _q.setFromEuler(_e);
      _m.compose(p.pos, _q, _s.setScalar(Math.max(0.0001, s)));
      mesh.setMatrixAt(i, _m);
      if (p.c1) mesh.setColorAt(i, _c.copy(p.c0).lerp(p.c1, Math.min(1, t * 1.6)));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const tet = new THREE.TetrahedronGeometry(1, 0);
    this.fire = new Pool(scene, ico, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }), 1800);
    this.smoke = new Pool(scene, ico, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), 2600);
    this.debris = new Pool(scene, tet, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), 500, { shadow: true });
    this.flash = new THREE.PointLight(0xffaa55, 0, 900, 2);
    scene.add(this.flash);
    this.flashT = 0;
    this.rand = Math.random;
  }

  rv(scale) {
    const r = this.rand;
    return new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).multiplyScalar(scale);
  }

  // big fireball for aircraft/missile kills; scale 1 = fighter
  explosion(pos, scale = 1, vel = null) {
    const r = this.rand;
    const base = vel ? vel.clone().multiplyScalar(0.25) : new THREE.Vector3();
    for (let i = 0; i < 26 * scale + 6; i++) {
      this.fire.spawn({
        pos: pos.clone().add(this.rv(6 * scale)), vel: this.rv(60 * scale).add(base), drag: 2.2,
        life: 0.6 + r() * 0.7, size0: 2, size1: (9 + r() * 10) * scale, pop: true, shrink: 1,
        c0: new THREE.Color().setHSL(0.1 + r() * 0.05, 1, 0.65), c1: new THREE.Color(0x7a1d06),
        rx: r() * 6, ry: r() * 6, spin: 2,
      });
    }
    for (let i = 0; i < 20 * scale + 4; i++) {
      const g = 0.18 + r() * 0.15;
      this.smoke.spawn({
        pos: pos.clone().add(this.rv(8 * scale)), vel: this.rv(30 * scale).add(base).add(new THREE.Vector3(0, 8, 0)), drag: 1.2,
        life: 2.2 + r() * 2, size0: 4, size1: (12 + r() * 12) * scale, pop: true, shrink: 0.9,
        c0: new THREE.Color(g, g, g), c1: new THREE.Color(0.5, 0.5, 0.52),
        rx: r() * 6, ry: r() * 6, spin: 0.4,
      });
    }
    for (let i = 0; i < 14 * scale; i++) {
      this.debris.spawn({
        pos: pos.clone(), vel: this.rv(90 * scale).add(base), grav: 30, drag: 0.4,
        life: 2.5 + r() * 2, size0: 0.8 + r() * 1.4, size1: 0.8 + r() * 1.4, shrink: 0.2,
        c0: new THREE.Color().setHSL(0, 0, 0.12 + r() * 0.2), c1: null,
        rx: r() * 6, ry: r() * 6, spin: 6 + r() * 6,
      });
    }
    this.flash.position.copy(pos);
    this.flash.intensity = 2e5 * scale;
    this.flashT = 0.35;
  }

  // small puff of missile exhaust
  trail(pos, color = 0xdedede, size = 1.6, life = 1.8) {
    const r = this.rand;
    this.smoke.spawn({
      pos: pos.clone(), vel: this.rv(2), drag: 0.5, life: life * (0.8 + r() * 0.4), size0: size * 0.4, size1: size * (1.6 + r()),
      pop: true, shrink: 1, c0: new THREE.Color(color), c1: new THREE.Color(0xf3f3f3), rx: r() * 6, ry: r() * 6, spin: 0.3,
    });
  }

  // black smoke + fire from a damaged / falling aircraft
  burn(pos, vel, heavy = 1) {
    const r = this.rand;
    this.fire.spawn({
      pos: pos.clone().add(this.rv(1.5)), vel: vel.clone().multiplyScalar(0.1).add(this.rv(5)), drag: 1.5,
      life: 0.35 + r() * 0.3, size0: 1, size1: 3.5 * heavy, pop: true, shrink: 1,
      c0: new THREE.Color(0xffb347), c1: new THREE.Color(0xa1250a), rx: r() * 6, ry: r() * 6, spin: 2,
    });
    const g = 0.1 + r() * 0.12;
    this.smoke.spawn({
      pos: pos.clone().add(this.rv(1.5)), vel: vel.clone().multiplyScalar(0.05).add(this.rv(3)), drag: 0.6,
      life: 2.5 + r() * 1.5, size0: 1.5, size1: 6 * heavy + r() * 4, pop: true, shrink: 0.8,
      c0: new THREE.Color(g, g, g), c1: new THREE.Color(0.35, 0.35, 0.36), rx: r() * 6, ry: r() * 6, spin: 0.3,
    });
  }

  sparks(pos, n = 6) {
    const r = this.rand;
    for (let i = 0; i < n; i++) {
      this.fire.spawn({
        pos: pos.clone(), vel: this.rv(40), drag: 3, life: 0.25 + r() * 0.2, size0: 0.6, size1: 1.4, pop: true, shrink: 1,
        c0: new THREE.Color(0xfff1a8), c1: new THREE.Color(0xff6a00), rx: 0, ry: 0, spin: 4,
      });
    }
  }

  // dust / splash when bullets or debris hit the ground
  impact(pos, water = false) {
    const r = this.rand;
    for (let i = 0; i < 5; i++) {
      this.smoke.spawn({
        pos: pos.clone(), vel: this.rv(6).add(new THREE.Vector3(0, 10 + r() * 10, 0)), grav: 12, drag: 1,
        life: 0.8 + r() * 0.6, size0: 1, size1: 3 + r() * 2, pop: true, shrink: 1,
        c0: new THREE.Color(water ? 0xe8f4ff : 0x9a8a6a), c1: new THREE.Color(water ? 0xffffff : 0xb9ab8a), rx: r() * 6, ry: r() * 6, spin: 1,
      });
    }
  }

  update(dt) {
    this.fire.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity *= Math.max(0, 1 - dt * 8);
      if (this.flashT <= 0) this.flash.intensity = 0;
    }
  }
}
