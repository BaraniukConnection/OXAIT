// Game session: city, player tank, hounds, shells, rules.
import * as THREE from 'three';
import { City, rayBox } from './world.js';
import { buildTank, wreckTank, TANK_TYPES } from './models.js';
import { Effects } from './effects.js';

export const GRAV = 9.8;
export const HOUND = { count: 8, hp: 100, vision: 150, reaction: 1.4, reload: 5.5, traverse: 0.75, elev: 0.35, shellSpeed: 360, damage: 22 };
export const ZOOMS = [3, 6, 10];

// stat quarter (1..3) -> gameplay value
const Q = {
  speed: [0, 9, 13, 17], // m/s
  turn: [0, 0.72, 0.92, 1.12], // rad/s
  armor: [0, 1.3, 1.0, 0.72], // damage taken multiplier
  power: [0, 30, 40, 52], // shell damage
  vel: [0, 430, 470, 510], // shell velocity
};

export function deriveStats(key) {
  const t = TANK_TYPES[key];
  return {
    maxSpeed: Q.speed[t.speed], turn: Q.turn[t.speed], dmgTaken: Q.armor[t.armor],
    damage: Q.power[t.power], shellSpeed: Q.vel[t.power], reload: 3.2, hp: 100, traverse: 1.35, elev: 0.6,
  };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
const approachAngle = (v, t, d) => {
  const e = wrap(t - v);
  return Math.abs(e) <= d ? wrap(v + e) : wrap(v + Math.sign(e) * d);
};
const rnd = (a, b) => a + Math.random() * (b - a);

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3();
const _eye = new THREE.Vector3(), _dir = new THREE.Vector3(), _piv = new THREE.Vector3(), _tmp = new THREE.Vector3();

export class Game {
  constructor({ tankKey = null, sound, hud = null, demo = false }) {
    this.sound = sound;
    this.hud = hud;
    this.demo = demo;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcfdfe9);
    this.scene.fog = new THREE.Fog(0xcfdfe9, 240, 1300);
    this.city = new City((Math.random() * 2 ** 31) | 0);
    this.scene.add(this.city.group);
    this.fx = new Effects(this.scene);
    this._lights();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 3000);

    this.tanks = [];
    this.hounds = [];
    this.shells = [];
    this.flying = [];
    this.time = 0;
    this.over = null;
    this.endT = 0;
    this.onEnd = null;
    this.stats = { shots: 0, hits: 0, kills: 0 };
    this.camYaw = 0;
    this.camPitch = -0.06;
    this.zoomIdx = 1;
    this.sight = false;
    this.shake = 0;
    this.orbit = 0;
    this.comp = 0;
    this.aimRange = 200;
    this.aimPoint = new THREE.Vector3();
    this.gunPoint = new THREE.Vector3();
    this.spotted = false;

    this.tracerGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.4, 5).rotateX(Math.PI / 2);
    this.tracerMats = [
      new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: 0xff5a2a, toneMapped: false }),
    ];

    this.player = null;
    if (!demo) this._spawnPlayer(tankKey);
    this._spawnHounds();
    this._followSun(0, 0);
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0xdbeaff, 0x6d6450, 1.6));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff0d8, 2.5));
    this.sunDir = new THREE.Vector3(0.45, 0.8, 0.3).normalize();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const e = this.demo ? 340 : 150, s = sun.shadow.camera;
    s.left = -e; s.right = e; s.top = e; s.bottom = -e; s.near = 10; s.far = 900;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = this.demo ? 1.2 : 0.5;
    this.scene.add(sun, sun.target);
  }

  _followSun(x, z) {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 400, this.sunDir.y * 400, z + this.sunDir.z * 400);
  }

  // ------------------------------------------------------------ spawning

  _makeTank(key, x, z, yaw) {
    const model = buildTank(key);
    const d = model.dims;
    const t = {
      key, model, d, pos: new THREE.Vector3(x, 0, z), yaw, turretYaw: 0, gunPitch: 0, speed: 0, vel: new THREE.Vector3(),
      alive: true, hp: 100, maxHp: 100, lean: 0, recoil: 0, burn: 0, reload: 0,
      hull: { minX: -d.W / 2 - 0.15, maxX: d.W / 2 + 0.15, minY: 0.15, maxY: d.top, minZ: -d.L / 2 - 0.2, maxZ: d.L / 2 + 0.2 },
      tbox: { minX: -d.tw, maxX: d.tw, minY: d.top, maxY: d.top + d.th, minZ: d.tz + d.tz0, maxZ: d.tz + d.tz1 },
    };
    this.scene.add(model.root);
    this.tanks.push(t);
    this._sync(t);
    return t;
  }

  _spawnPlayer(key) {
    const s = this.city.randomSpot('road');
    const P = (this.player = this._makeTank(key, s.x, s.z, s.yaw));
    P.isPlayer = true;
    P.def = TANK_TYPES[key];
    P.stats = deriveStats(key);
    P.hp = P.maxHp = P.stats.hp;
    this.city.clearAround(s.x, s.z, 7);
    this.camYaw = s.yaw;
  }

  _spawnHounds() {
    const P = this.player;
    let minP = HOUND.vision + 45, minH = 90;
    for (let tries = 0; this.hounds.length < HOUND.count && tries < 4000; tries++) {
      if (tries === 1500) minH = 60;
      if (tries === 2500) minP = HOUND.vision + 5;
      const s = this.city.randomSpot(Math.random() < 0.55 ? 'open' : 'road');
      if (P && Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < minP) continue;
      if (this.hounds.some((h) => Math.hypot(h.pos.x - s.x, h.pos.z - s.z) < minH)) continue;
      const h = this._makeTank('hound', s.x, s.z, s.yaw);
      Object.assign(h, {
        isHound: true, state: 'idle', canSee: false, seenByPlayer: false, losT: Math.random() * 0.2, reaction: 0,
        lastSeen: new THREE.Vector3(), lost: 0, search: 0, phase: Math.random() * 6.28, scan: rnd(-0.6, 0.6),
        vision: HOUND.vision, shots: 0, dist: 1e9, hp: HOUND.hp, maxHp: HOUND.hp,
      });
      h.turretYaw = rnd(-1, 1);
      this.city.clearAround(s.x, s.z, 6.5);
      h.ring = this._ring(h);
      this.hounds.push(h);
    }
    this.total = this.hounds.length;
  }

  _ring(h) {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.6, depthWrite: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.045, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(h.vision - 1.4, h.vision, 120).rotateX(-Math.PI / 2), ringMat);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(h.vision, 120).rotateX(-Math.PI / 2), fillMat);
    ring.renderOrder = 2;
    fill.renderOrder = 1;
    g.add(fill, ring);
    g.position.set(h.pos.x, 0.26, h.pos.z);
    this.scene.add(g);
    return { g, ring, ringMat, fillMat, state: null };
  }

  // ------------------------------------------------------------ helpers

  _gunPivot(t, out) {
    const d = t.d, wy = t.yaw + t.turretYaw;
    return out.set(
      t.pos.x + Math.sin(t.yaw) * d.tz + Math.sin(wy) * d.gz,
      d.top + d.gy,
      t.pos.z + Math.cos(t.yaw) * d.tz + Math.cos(wy) * d.gz,
    );
  }

  _gunDir(t, out, pitchOff = 0) {
    const wy = t.yaw + t.turretYaw, p = t.gunPitch + pitchOff;
    return out.set(Math.sin(wy) * Math.cos(p), Math.sin(p), Math.cos(wy) * Math.cos(p));
  }

  _tankRay(t, o, d, maxT) {
    const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
    const rx = o.x - t.pos.x, rz = o.z - t.pos.z;
    const lx = rx * c - rz * s, lz = rx * s + rz * c;
    const dx = d.x * c - d.z * s, dz = d.x * s + d.z * c;
    return Math.min(rayBox(lx, o.y, lz, dx, d.y, dz, t.hull, maxT), rayBox(lx, o.y, lz, dx, d.y, dz, t.tbox, maxT));
  }

  _sync(t) {
    const m = t.model;
    m.root.position.copy(t.pos);
    m.root.rotation.y = t.yaw;
    if (t.alive) {
      m.turret.rotation.y = t.turretYaw;
      m.gun.rotation.x = -t.gunPitch;
    }
    m.recoil.position.z = -0.75 * t.recoil;
    m.body.rotation.x = t.lean;
  }

  // ------------------------------------------------------------ main update

  update(dt, input) {
    this.time += dt;
    const P = this.player;
    if (P) {
      this._look(dt, input);
      this._drive(dt, input);
      this._updateCamera(dt, input);
      this._aimAndFire(dt, input);
    }
    this.spotted = false;
    for (const h of this.hounds) {
      this._hound(h, dt);
      if (h.alive && h.state === 'alert' && h.canSee) this.spotted = true;
    }
    this._shells(dt);
    this._flying(dt);
    for (const t of this.tanks) {
      t.recoil = Math.max(0, t.recoil - dt * 1.3);
      t.lean *= Math.exp(-dt * 3);
      if (!t.alive && t.burn > 0) {
        t.burn = Math.max(0, t.burn - dt / 50);
        this.fx.burn(_v.set(t.pos.x, t.d.top + 0.3, t.pos.z), t.burn);
      }
      this._sync(t);
    }
    this.city.update(dt);
    this.fx.update(dt);
    if (P) this._followSun(P.pos.x, P.pos.z);
    if (this.over && this.endT > 0) {
      this.endT -= dt;
      if (this.endT <= 0 && this.onEnd) this.onEnd(this.over);
    }
  }

  _look(dt, inp) {
    const P = this.player;
    const zoom = this.sight ? this.camera.fov / 70 : 1;
    const sens = (inp.sens || 1) * 0.0021 * zoom;
    this.camYaw = wrap(this.camYaw - inp.dx * sens);
    this.camPitch = clamp(this.camPitch - inp.dy * sens, -0.55, 0.3);
    inp.dx = inp.dy = 0;
    if (inp.free) {
      // free cursor: the view turns while the cursor is pushed toward a screen edge
      const edge = (v, dz) => Math.sign(v) * Math.max(0, Math.abs(v) - dz) / (1 - dz);
      const ex = edge(inp.mx, 0.5), ey = edge(inp.my, 0.6);
      const k = (inp.sens || 1) * Math.max(zoom, 0.25);
      this.camYaw = wrap(this.camYaw - ex * Math.abs(ex) * 2.4 * k * dt);
      this.camPitch = clamp(this.camPitch + ey * Math.abs(ey) * 0.9 * k * dt, -0.55, 0.3);
    }
    if (inp.wheel) {
      this.zoomIdx = clamp(this.zoomIdx + (inp.wheel < 0 ? 1 : -1), 0, ZOOMS.length - 1);
      inp.wheel = 0;
    }
    this.sight = inp.sight && P.alive && !this.over;
  }

  _drive(dt, inp) {
    const P = this.player, S = P.stats, k = inp.keys;
    let thr = 0, steer = 0;
    if (P.alive && !this.over) {
      thr = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      steer = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
    }
    const target = thr > 0 ? S.maxSpeed : thr < 0 ? -S.maxSpeed * 0.45 : 0;
    const braking = P.speed !== 0 && Math.sign(target - P.speed) !== Math.sign(P.speed);
    const prev = P.speed;
    P.speed = approach(P.speed, target, (braking ? 1.6 : 0.5) * S.maxSpeed * dt);

    const turn = S.turn * (1 - (0.3 * Math.abs(P.speed)) / S.maxSpeed);
    const dYaw = steer * turn * dt;
    P.yaw = wrap(P.yaw + dYaw);
    P.turretYaw = wrap(P.turretYaw - dYaw); // stabilised turret keeps its world heading
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    P.pos.x += fx * P.speed * dt;
    P.pos.z += fz * P.speed * dt;

    if (this._collide(P)) {
      if (Math.abs(P.speed) > 4 && !P.bumped) {
        this.sound.bump();
        this.shake = Math.max(this.shake, 0.4);
      }
      P.bumped = true;
      P.speed *= Math.pow(0.12, dt);
    } else P.bumped = false;

    P.vel.set(fx * P.speed, 0, fz * P.speed);
    const acc = (P.speed - prev) / Math.max(dt, 1e-3);
    P.lean += (clamp(-acc * 0.006, -0.05, 0.05) - P.lean) * Math.min(1, dt * 5);

    const half = P.d.W / 2;
    for (const w of P.model.wheels) w.rotation.x += ((P.speed - w.userData.side * steer * turn * half) * dt) / w.userData.r;

    if (Math.abs(P.speed) > 0.5 || steer) {
      const n = this._crush(P);
      if (n) {
        this.sound.crunch();
        P.speed *= 0.8;
        this.shake = Math.max(this.shake, 0.3);
      }
    }

    // track dust + exhaust
    const lx = Math.cos(P.yaw), lz = -Math.sin(P.yaw);
    P.dustT = (P.dustT || 0) - dt;
    if (P.dustT <= 0 && (Math.abs(P.speed) > 2.5 || steer)) {
      P.dustT = 0.07;
      const back = -P.d.L / 2, k2 = Math.min(1.2, 0.4 + Math.abs(P.speed) / 12);
      for (const s of [-1, 1]) this.fx.trackDust(P.pos.x + fx * back + lx * s * (half - 0.3), P.pos.z + fz * back + lz * s * (half - 0.3), k2);
    }
    P.exT = (P.exT || 0) - dt;
    if (P.exT <= 0 && P.alive) {
      P.exT = thr || steer ? 0.12 : 0.45;
      this.fx.exhaust(_v.set(P.pos.x - fx * (P.d.L / 2 - 0.4) + lx * 0.9, P.d.top + 0.2, P.pos.z - fz * (P.d.L / 2 - 0.4) + lz * 0.9));
    }

    P.rpm = (P.rpm || 0) + (clamp(Math.abs(P.speed) / S.maxSpeed * 0.75 + Math.abs(thr) * 0.25 + Math.abs(steer) * 0.15, 0, 1) - (P.rpm || 0)) * Math.min(1, dt * 3);
    this.sound.setEngine(P.alive && !this.over, P.rpm, Math.abs(P.speed) / S.maxSpeed);
  }

  _collide(t) {
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw);
    const r = (t.d.W / 2) * 0.95, off = t.d.L / 2 - r * 0.9;
    let hit = false;
    for (const o of [-off, 0, off]) {
      _v.set(t.pos.x + fx * o, 0, t.pos.z + fz * o);
      const bx = _v.x, bz = _v.z;
      if (this.city.resolveCircle(_v, r)) hit = true;
      for (const h of this.tanks) {
        if (h === t) continue;
        const hfx = Math.sin(h.yaw) * 1.6, hfz = Math.cos(h.yaw) * 1.6;
        for (const s of [-1, 1]) {
          const dx = _v.x - (h.pos.x + hfx * s), dz = _v.z - (h.pos.z + hfz * s), dd = Math.hypot(dx, dz), rr = r + 1.9;
          if (dd < rr && dd > 1e-4) {
            _v.x += (dx / dd) * (rr - dd);
            _v.z += (dz / dd) * (rr - dd);
            hit = true;
          }
        }
      }
      t.pos.x += _v.x - bx;
      t.pos.z += _v.z - bz;
    }
    return hit;
  }

  _crush(t) {
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw), r = t.d.W / 2, off = t.d.L / 2 - r;
    const s = t.speed >= 0 ? 1 : -1;
    let n = 0;
    for (const o of [-off, 0, off]) n += this.city.crush(t.pos.x + fx * o, t.pos.z + fz * o, r, fx * s, fz * s);
    return n;
  }

  _updateCamera(dt, inp) {
    const P = this.player, cam = this.camera;
    const cp = Math.cos(this.camPitch);
    _dir.set(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
    let fov = 70;
    P.model.root.visible = true;

    if (!P.alive || (this.over && this.endT <= 0)) {
      this.orbit += dt * 0.15;
      _piv.set(P.pos.x, 3, P.pos.z);
      _tmp.set(Math.sin(this.orbit) * 20, 9, Math.cos(this.orbit) * 20).normalize();
      const hit = this.city.raycast(_piv, _tmp, 22);
      cam.position.copy(_piv).addScaledVector(_tmp, Math.min(22, hit.t - 1));
      cam.lookAt(P.pos.x, 1.8, P.pos.z);
      cam.fov += (60 - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
      return;
    }

    if (this.sight) {
      this._gunPivot(P, _eye);
      _eye.y += 0.75;
      fov = 60 / ZOOMS[this.zoomIdx];
      P.model.root.visible = false;
    } else {
      _piv.set(P.pos.x, P.d.top + 1.9, P.pos.z);
      _eye.copy(_piv).addScaledVector(_dir, -13.5);
      _eye.y += 1.4;
      _tmp.subVectors(_eye, _piv);
      const len = _tmp.length();
      _tmp.divideScalar(len);
      const hit = this.city.raycast(_piv, _tmp, len + 0.8);
      if (hit.t < len + 0.8) _eye.copy(_piv).addScaledVector(_tmp, Math.max(1.5, hit.t - 0.8));
      _eye.y = Math.max(_eye.y, 0.7);
    }
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 18);
    if (Math.abs(cam.fov - fov) < 0.05) cam.fov = fov;
    cam.updateProjectionMatrix();

    this.shake = Math.max(0, this.shake - dt * 1.8);
    const s = this.shake * this.shake * (this.sight ? 0.15 : 0.6);
    cam.position.set(_eye.x + rnd(-s, s), _eye.y + rnd(-s, s), _eye.z + rnd(-s, s));
    cam.lookAt(_tmp.copy(cam.position).add(_dir));

    if (inp.free) {
      // aim at whatever is under the cursor
      cam.position.copy(_eye);
      cam.updateMatrixWorld();
      _tmp.set(inp.mx, inp.my, 0.5).unproject(cam).sub(_eye).normalize();
      this._aimRay(_eye, _tmp);
      cam.position.set(_eye.x + rnd(-s, s), _eye.y + rnd(-s, s), _eye.z + rnd(-s, s));
    } else this._aimRay(_eye, _dir);
  }

  _aimRay(o, d) {
    let best = 1500;
    const r = this.city.raycast(o, d, best);
    if (r.t < best) best = r.t;
    for (const h of this.hounds) {
      const ox = o.x - h.pos.x, oy = o.y - 1.6, oz = o.z - h.pos.z;
      const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - 3.2 * 3.2;
      const disc = b * b - c;
      if (disc > 0) {
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < best) best = t;
      }
    }
    this.aimPoint.copy(o).addScaledVector(d, best);
  }

  _aimAndFire(dt, inp) {
    const P = this.player, S = P.stats;
    const was = P.reload;
    P.reload = Math.max(0, P.reload - dt);
    if (was > 0 && P.reload === 0 && P.alive) this.sound.reloaded();

    if (P.alive && !this.over) {
      this._gunPivot(P, _piv);
      const vx = this.aimPoint.x - _piv.x, vy = this.aimPoint.y - _piv.y, vz = this.aimPoint.z - _piv.z;
      const horiz = Math.hypot(vx, vz);
      this.comp = 0.5 * Math.asin(Math.min(1, (GRAV * horiz) / (S.shellSpeed * S.shellSpeed)));
      const wantYaw = wrap(Math.atan2(vx, vz) - P.yaw);
      const wantPitch = clamp(Math.atan2(vy, horiz) + this.comp, -0.14, 0.35);
      P.turretYaw = approachAngle(P.turretYaw, wantYaw, S.traverse * dt);
      P.gunPitch = approach(P.gunPitch, wantPitch, S.elev * dt);
      this.aimRange = Math.hypot(vx, vy, vz);
      if (inp.fire && P.reload <= 0) this._fire(P, S.shellSpeed, S.damage, 0);
    }
    inp.fire = false;

    this._gunPivot(P, _piv);
    this._gunDir(P, _d, -this.comp);
    this.gunPoint.copy(_piv).addScaledVector(_d, this.aimRange);
  }

  _fire(t, speed, damage, spread) {
    this._gunPivot(t, _piv);
    if (spread) {
      const wy = t.yaw + t.turretYaw + rnd(-spread, spread), p = t.gunPitch + rnd(-spread, spread) * 0.5;
      _d.set(Math.sin(wy) * Math.cos(p), Math.sin(p), Math.cos(wy) * Math.cos(p));
    } else this._gunDir(t, _d);
    const muzzle = _piv.clone().addScaledVector(_d, t.d.gl);
    const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMats[t.isPlayer ? 0 : 1]);
    mesh.position.copy(muzzle);
    this.scene.add(mesh);
    this.shells.push({ owner: t, pos: muzzle, vel: _d.clone().multiplyScalar(speed), damage, life: 5, mesh, whiz: false });
    this.fx.muzzle(muzzle, _d);
    t.recoil = 1;
    t.lean -= 0.05 * Math.cos(t.turretYaw);
    t.reload = t.isPlayer ? t.stats.reload : HOUND.reload * rnd(0.85, 1.15);
    const P = this.player;
    this.sound.cannon(t.isPlayer || !P ? 0 : muzzle.distanceTo(P.pos));
    if (t.isPlayer) {
      this.stats.shots++;
      this.shake = Math.max(this.shake, 0.6);
    }
  }

  _shells(dt) {
    const P = this.player;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      _a.copy(s.pos);
      s.vel.y -= GRAV * dt;
      s.pos.addScaledVector(s.vel, dt);
      _d.subVectors(s.pos, _a);
      const len = _d.length();
      _d.divideScalar(len);

      let best = len, kind = null, tank = null;
      const r = this.city.raycast(_a, _d, len);
      if (r.t < best) { best = r.t; kind = r.kind; }
      for (const t of this.tanks) {
        if (t === s.owner || Math.abs(t.pos.x - _a.x) > len + 8 || Math.abs(t.pos.z - _a.z) > len + 8) continue;
        const th = this._tankRay(t, _a, _d, best);
        if (th < best) { best = th; kind = 'tank'; tank = t; }
      }

      if (P && P.alive && s.owner !== P && !s.whiz && tank !== P) {
        _v.set(P.pos.x - _a.x, 2 - _a.y, P.pos.z - _a.z);
        const along = clamp(_v.dot(_d), 0, best);
        if (_v.addScaledVector(_d, -along).length() < 10) {
          s.whiz = true;
          this.sound.whiz();
        }
      }

      if (kind) {
        _b.copy(_a).addScaledVector(_d, best);
        this._hit(s, kind, tank, _b, _d);
      } else if ((s.life -= dt) > 0 && s.pos.y > -5) {
        s.mesh.position.copy(s.pos);
        s.mesh.lookAt(_tmp.copy(s.pos).add(s.vel));
        continue;
      }
      this.scene.remove(s.mesh);
      this.shells.splice(i, 1);
    }
  }

  _hit(s, kind, tank, p, d) {
    const P = this.player;
    const dist = P ? p.distanceTo(P.pos) : 300;
    if (kind !== 'tank') {
      this.fx.impact(p, kind);
      this.sound.impact(kind, dist);
      if (s.owner === P) {
        // a shell landing close by gives the player's position away
        for (const h of this.hounds) {
          if (h.alive && h.state === 'idle' && Math.hypot(h.pos.x - p.x, h.pos.z - p.z) < 35) {
            h.state = 'search';
            h.search = 10;
            h.lastSeen.copy(P.pos);
          }
        }
      }
      return;
    }
    this.fx.impact(p, 'metal');
    this.sound.impact('metal', tank === P ? 0 : dist);
    if (!tank.alive) return;

    const c = Math.cos(tank.yaw), sn = Math.sin(tank.yaw);
    const lx = d.x * c - d.z * sn, lz = d.x * sn + d.z * c;
    let mult = 1, zone = 'FRONT';
    if (Math.abs(lz) >= Math.abs(lx)) {
      if (lz > 0) { mult = 1.6; zone = 'REAR'; }
    } else { mult = 1.25; zone = 'SIDE'; }
    const roll = rnd(0.9, 1.1);

    if (tank.isHound && s.owner === P) {
      const dmg = Math.round(s.damage * mult * roll);
      tank.hp -= dmg;
      this.stats.hits++;
      if (tank.hp <= 0) this._destroy(tank);
      else {
        this.hud?.hitMarker(`${zone} HIT  −${dmg}`, zone === 'FRONT' ? '' : 'good');
        this._alert(tank, 0.8);
      }
    } else if (tank === P && s.owner.isHound) {
      const dmg = Math.round(HOUND.damage * mult * P.stats.dmgTaken * roll);
      P.hp = Math.max(0, P.hp - dmg);
      this.shake = 1;
      const ang = Math.atan2(s.owner.pos.x - P.pos.x, s.owner.pos.z - P.pos.z) - this.camYaw;
      this.hud?.damage(wrap(ang), `${zone} −${dmg}`);
      if (P.hp <= 0) this._destroy(P);
    }
  }

  _alert(h, reaction) {
    if (h.state !== 'alert') {
      h.reaction = reaction;
      h.shots = 0;
    }
    h.state = 'alert';
    h.vision = HOUND.vision * 1.6;
    h.lost = 0;
    h.lastSeen.copy(this.player.pos);
  }

  _destroy(t) {
    const P = this.player;
    t.alive = false;
    t.hp = 0;
    t.speed = 0;
    t.burn = 1;
    this.fx.explosion(_v.set(t.pos.x, t.d.top * 0.6, t.pos.z), 1.3);
    this.sound.explosion(t === P || !P ? 0 : t.pos.distanceTo(P.pos));
    wreckTank(t.model);
    const tur = t.model.turret;
    t.model.root.updateMatrixWorld(true);
    this.scene.attach(tur);
    this.flying.push({ o: tur, v: new THREE.Vector3(rnd(-2.5, 2.5), rnd(9, 14), rnd(-2.5, 2.5)), w: new THREE.Vector3(rnd(-2, 2), rnd(-3, 3), rnd(-2, 2)), rest: false });

    if (t.isHound) {
      t.ring.g.visible = false;
      this.stats.kills++;
      const left = this.hounds.filter((h) => h.alive).length;
      this.hud?.kill(left, this.total);
      this.shake = Math.max(this.shake, 0.5);
      for (const h of this.hounds) {
        if (h.alive && h.state === 'idle' && h.pos.distanceTo(t.pos) < 160) {
          h.state = 'search';
          h.search = 12;
          h.lastSeen.copy(P.pos);
        }
      }
      if (left === 0 && !this.over) {
        this.over = 'win';
        this.endT = 3;
        this.finishTime = this.time;
      }
    } else if (!this.over) {
      this.over = 'lose';
      this.endT = 3.5;
      this.finishTime = this.time;
      this.sound.setEngine(false);
    }
  }

  _flying(dt) {
    for (const f of this.flying) {
      if (f.rest) continue;
      f.v.y -= GRAV * 1.6 * dt;
      f.o.position.addScaledVector(f.v, dt);
      f.o.rotation.x += f.w.x * dt;
      f.o.rotation.y += f.w.y * dt;
      f.o.rotation.z += f.w.z * dt;
      if (f.o.position.y < 0.3 && f.v.y < 0) {
        f.o.position.y = 0.3;
        if (Math.abs(f.v.y) > 4) {
          f.v.y *= -0.3;
          f.v.x *= 0.5;
          f.v.z *= 0.5;
          f.w.multiplyScalar(0.35);
          this.fx.impact(f.o.position, 'ground');
        } else f.rest = true;
      }
    }
  }

  _hound(h, dt) {
    if (!h.alive) return;
    const P = this.player;
    h.reload -= dt;
    h.reaction -= dt;
    h.losT -= dt;
    if (h.losT <= 0) {
      h.losT = rnd(0.15, 0.25);
      h.canSee = false;
      h.seenByPlayer = false;
      if (P && P.alive) {
        h.dist = Math.hypot(P.pos.x - h.pos.x, P.pos.z - h.pos.z);
        this._gunPivot(h, _a);
        _a.y += 0.5;
        let los = null;
        if (h.dist < h.vision) {
          _b.set(P.pos.x, P.d.top + 0.6, P.pos.z);
          los = !this.city.blocked(_a, _b);
          if (!los) {
            _b.y = 1.0;
            los = !this.city.blocked(_a, _b);
          }
          h.canSee = los;
        }
        if (h.dist < 900) {
          if (los === null) {
            _b.set(P.pos.x, P.d.top + 0.9, P.pos.z);
            los = !this.city.blocked(_b, _a);
          }
          h.seenByPlayer = los || h.dist < 40;
        }
      }
    }

    if (h.canSee) {
      if (h.state !== 'alert') {
        h.state = 'alert';
        h.reaction = Math.max(h.reaction, HOUND.reaction * rnd(0.8, 1.2));
        h.shots = 0;
        if (this.time - (this._lastAlarm ?? -99) > 6) {
          this._lastAlarm = this.time;
          this.sound.alarm();
          this.hud?.message('SPOTTED BY A HOUND', 'warn');
        }
      }
      h.lastSeen.copy(P.pos);
      h.lost = 0;
    } else if (h.state === 'alert') {
      h.lost += dt;
      if (h.lost > 5) { h.state = 'search'; h.search = 10; }
    } else if (h.state === 'search') {
      h.search -= dt;
      if (h.search <= 0) h.state = 'idle';
    }

    let tYaw, tPitch = 0;
    if (h.state !== 'idle' && P) {
      this._gunPivot(h, _a);
      const tracking = h.state === 'alert' && h.canSee;
      _b.copy(tracking ? P.pos : h.lastSeen);
      if (tracking) _b.addScaledVector(P.vel, (Math.hypot(_b.x - _a.x, _b.z - _a.z) / HOUND.shellSpeed) * 0.7);
      _b.y = 1.3;
      const vx = _b.x - _a.x, vy = _b.y - _a.y, vz = _b.z - _a.z, hz = Math.hypot(vx, vz);
      tYaw = Math.atan2(vx, vz) - h.yaw;
      tPitch = Math.atan2(vy, hz) + 0.5 * Math.asin(Math.min(1, (GRAV * hz) / HOUND.shellSpeed ** 2));
    } else {
      tYaw = Math.sin(this.time * 0.2 + h.phase) * 1.4 + h.scan;
    }
    tYaw = wrap(tYaw);
    tPitch = clamp(tPitch, -0.12, 0.3);
    h.turretYaw = approachAngle(h.turretYaw, tYaw, HOUND.traverse * dt);
    h.gunPitch = approach(h.gunPitch, tPitch, HOUND.elev * dt);

    if (h.state === 'alert' && h.canSee && h.reaction <= 0 && h.reload <= 0 && !this.over &&
        Math.abs(wrap(tYaw - h.turretYaw)) < 0.02 && Math.abs(tPitch - h.gunPitch) < 0.02) {
      this._fire(h, HOUND.shellSpeed, HOUND.damage, Math.max(0.004, 0.024 - h.shots * 0.006));
      h.shots++;
    }

    // ring colour follows state
    if (h.ring.state !== h.state) {
      h.ring.state = h.state;
      const col = h.state === 'alert' ? 0xff2a2a : h.state === 'search' ? 0xff7a1a : 0xffb020;
      h.ring.ringMat.color.setHex(col);
      h.ring.fillMat.color.setHex(col);
      h.ring.fillMat.opacity = h.state === 'alert' ? 0.07 : 0.045;
      if (h.vision !== h.ring.vision) {
        h.ring.vision = h.vision;
        const k = h.vision / HOUND.vision;
        h.ring.g.scale.set(k, 1, k);
      }
    }
  }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
