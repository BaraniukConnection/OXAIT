// Gameplay: player flight model, Rogue AI, guns, missiles, locks, collisions and mission rules.
import * as THREE from 'three';
import { buildAircraft, buildMissileMesh } from './models.js';
import { HALF, WATER, CEILING } from './world.js';
import { SPEED, AGILITY, WEAPONS, DIFFICULTY } from './data.js';

const UP = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _m = new THREE.Matrix4();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);

// rotate unit vector `dir` toward unit vector `to` by at most `maxAngle`
function turnToward(dir, to, maxAngle) {
  const ang = dir.angleTo(to);
  if (ang < 1e-5) return 0;
  _u.crossVectors(dir, to);
  if (_u.lengthSq() < 1e-10) _u.set(0, 1, 0); // opposite: turn around any axis
  dir.applyAxisAngle(_u.normalize(), Math.min(ang, maxAngle)).normalize();
  return ang;
}

// orientation for a model whose nose is -Z, from a forward vector and a bank angle
function orient(quat, fwd, bank) {
  const right = _v.crossVectors(fwd, UP);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = _w.crossVectors(right, fwd).normalize();
  _m.makeBasis(right, up, _u.copy(fwd).negate());
  quat.setFromRotationMatrix(_m);
  quat.multiply(_q.setFromAxisAngle(AZ, bank));
}

// closest distance between segment a->b and point p
function segDist(a, b, p) {
  _v.subVectors(b, a);
  const l2 = _v.lengthSq();
  let t = l2 > 0 ? _w.subVectors(p, a).dot(_v) / l2 : 0;
  t = clamp(t, 0, 1);
  return _w.copy(a).addScaledVector(_v, t).distanceTo(p);
}

// ======================= PLAYER =======================

export class Player {
  constructor(def, scene) {
    this.def = def;
    this.model = buildAircraft(def.id);
    this.obj = this.model.group;
    scene.add(this.obj);
    this.pos = this.obj.position;
    this.quat = this.obj.quaternion;
    this.vel = new THREE.Vector3();
    this.maxSpeed = SPEED[def.speed];
    this.minSpeed = 95;
    this.ag = AGILITY[def.agility];
    this.speed = 210;
    this.throttle = 0.62;
    this.hp = 100;
    this.alive = true;
    this.radius = 6;
    this.inp = { pitch: 0, roll: 0, yaw: 0 };
    this.weapons = ['gun', 'msl', def.special];
    this.wi = 0;
    this.ammo = { gun: Infinity, msl: WEAPONS.msl.ammo, [def.special]: WEAPONS[def.special].ammo };
    this.rails = { msl: new Array(WEAPONS.msl.rails).fill(0), [def.special]: new Array(WEAPONS[def.special].rails).fill(0) };
    this.gunCd = 0;
    this.pylonI = 0;
    this.pylonTimers = this.model.pylons.map(() => 0);
    this.stall = false;
    this.gLoad = 1;
  }
  get weapon() { return this.weapons[this.wi]; }
  fwd(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.quat); }
  up(out = new THREE.Vector3()) { return out.set(0, 1, 0).applyQuaternion(this.quat); }
  right(out = new THREE.Vector3()) { return out.set(1, 0, 0).applyQuaternion(this.quat); }
  local(x, y, z, out = new THREE.Vector3()) { return out.set(x, y, z).applyQuaternion(this.quat).add(this.pos); }

  update(dt, keys, invert) {
    const ag = this.ag, inp = this.inp;
    // Default (flight-stick style): Down arrow = pull up. Inverted: Up arrow = pull up.
    let tp = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    if (invert) tp = -tp;
    const tr = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
    const ty = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
    const k = Math.min(1, dt * 7);
    inp.pitch += (tp - inp.pitch) * k;
    inp.roll += (tr - inp.roll) * Math.min(1, dt * 9);
    inp.yaw += (ty - inp.yaw) * k;
    if (keys.KeyW) this.throttle = Math.min(1, this.throttle + dt * 0.55);
    if (keys.KeyS) this.throttle = Math.max(0, this.throttle - dt * 0.55);

    const eff = clamp((this.speed - 50) / 170, 0.3, 1.05);
    this.quat.multiply(_q.setFromAxisAngle(AX, inp.pitch * ag.pitch * eff * dt));
    this.quat.multiply(_q.setFromAxisAngle(AZ, inp.roll * ag.roll * dt));
    this.quat.multiply(_q.setFromAxisAngle(AY, inp.yaw * ag.yaw * eff * dt));
    // lift: a banked aircraft slowly turns toward the low wing even without pulling
    const right = this.right(new THREE.Vector3());
    this.quat.premultiply(_q.setFromAxisAngle(UP, right.y * 0.5 * eff * dt));
    this.quat.normalize();

    const fwd = this.fwd(new THREE.Vector3());
    // speed: throttle target + gravity along the flight path + drag when pulling hard
    const target = this.minSpeed + (this.maxSpeed - this.minSpeed) * this.throttle;
    this.speed += (target - this.speed) * 0.32 * dt;
    this.speed -= fwd.y * 9.81 * 1.1 * dt;
    this.speed -= Math.abs(inp.pitch) * eff * 9 * dt;
    this.speed = clamp(this.speed, 55, this.maxSpeed * 1.25);
    this.gLoad = 1 + Math.abs(inp.pitch) * ag.pitch * eff * this.speed / 9.81 * 0.9;

    // stall: below ~90 m/s the nose falls through
    this.stall = this.speed < 90;
    if (this.stall) this.dropNose(fwd, (90 - this.speed) / 60 * 1.4 * dt);
    // altitude ceiling: thin air pushes the nose down
    if (this.pos.y > CEILING) this.dropNose(fwd, clamp((this.pos.y - CEILING) / 150, 0, 1.5) * dt);

    this.fwd(fwd);
    this.vel.copy(fwd).multiplyScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
    this.obj.updateMatrixWorld();

    // afterburner flames
    const ab = this.throttle > 0.85;
    for (const f of this.model.flames) {
      const s = 0.25 + this.throttle * 0.75 + (ab ? Math.random() * 0.25 : 0);
      f.scale.z = s;
      f.visible = this.throttle > 0.15;
      f.material.opacity = ab ? 0.85 : 0.45;
    }
    // pylon missiles come back after reload
    for (let i = 0; i < this.pylonTimers.length; i++) {
      if (this.pylonTimers[i] > 0) {
        this.pylonTimers[i] -= dt;
        if (this.pylonTimers[i] <= 0 && !this.model.internalBay) this.model.pylonMissiles[i].visible = true;
      }
    }
    for (const id in this.rails) this.rails[id] = this.rails[id].map((t) => Math.max(0, t - dt));
    this.gunCd -= dt;
  }

  dropNose(fwd, amount) {
    _v.crossVectors(fwd, UP);
    if (_v.lengthSq() < 1e-6) return;
    this.quat.premultiply(_q.setFromAxisAngle(_v.normalize(), -amount));
  }

  // points used for terrain collision: nose, tail, both wingtips
  hullPoints() {
    const L = this.model.length / 2, S = this.model.span / 2;
    return [this.local(0, 0, -L), this.local(0, 0.5, L * 0.9), this.local(S, 0, L * 0.3), this.local(-S, 0, L * 0.3), this.pos.clone()];
  }
}

// ======================= ROGUE (enemy) =======================

export class Rogue {
  constructor(game, center, radius, idx) {
    this.game = game;
    this.cfg = game.cfg;
    this.model = buildAircraft('rogue');
    this.obj = this.model.group;
    game.scene.add(this.obj);
    this.pos = this.obj.position;
    this.center = center;
    this.radius = radius;
    this.name = `ROGUE-${idx + 1}`;
    this.orbitR = radius * rand(0.42, 0.68);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.phase = Math.random() * Math.PI * 2;
    const a = Math.random() * Math.PI * 2;
    this.pos.set(center.x + Math.cos(a) * this.orbitR, center.y, center.z + Math.sin(a) * this.orbitR);
    this.dir = new THREE.Vector3(-Math.sin(a) * this.orbitDir, 0, Math.cos(a) * this.orbitDir).normalize();
    this.speed = 215;
    this.vel = new THREE.Vector3();
    this.hp = 100;
    this.alive = true;
    this.dying = false;
    this.state = 'patrol';
    this.bank = 0;
    this.gunCd = 0;
    this.burst = 0;
    this.missileCd = rand(...this.cfg.missileCd) * 0.6;
    this.lockT = 0;
    this.evadeT = 0;
    this.evadeDir = new THREE.Vector3();
    this.hitTimer = 0;
    this.losT = 0;
    this.los = true;
    this.hitR = 12;
    this.spin = 0;
    this.removeT = 0;
    orient(this.obj.quaternion, this.dir, 0);
  }

  damage(dmg, byPlayer = true) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.hitTimer = 15; // retaliate (inside its own zone) for a while
    if (this.hp <= 0) {
      this.alive = false;
      this.dying = true;
      this.vel.copy(this.dir).multiplyScalar(this.speed);
      this.spin = (Math.random() < 0.5 ? -1 : 1) * rand(1.5, 3.5);
      this.game.onKill(this, byPlayer);
      return true;
    }
    return false;
  }

  update(dt) {
    const g = this.game, world = g.world, fx = g.effects;
    if (this.dying) {
      this.vel.y -= 22 * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.obj.rotateZ(this.spin * dt);
      this.obj.rotateX(-0.25 * dt);
      this.removeT += dt;
      fx.burn(this.pos, this.vel, 1.3);
      if (this.pos.y < world.groundHeight(this.pos.x, this.pos.z) + 2 || this.removeT > 9) {
        fx.explosion(this.pos, 1.2);
        g.sound('explosion', this.pos);
        this.dying = false;
        this.obj.visible = false;
      }
      return;
    }
    if (!this.alive) return;

    const p = g.player, cfg = this.cfg;
    const dCx = this.pos.x - this.center.x, dCz = this.pos.z - this.center.z;
    const dC = Math.hypot(dCx, dCz);
    const pdC = p.alive ? Math.hypot(p.pos.x - this.center.x, p.pos.z - this.center.z) : Infinity;
    if (this.hitTimer > 0) this.hitTimer -= dt;
    const aggro = p.alive && (pdC < this.radius * cfg.aggro || this.hitTimer > 0);
    this.evadeT -= dt;
    this.state = this.evadeT > 0 ? 'evade' : aggro ? 'attack' : 'patrol';

    const desired = new THREE.Vector3();
    const toP = new THREE.Vector3().subVectors(p.pos, this.pos);
    const distP = toP.length();
    if (this.state === 'patrol') {
      const ang = Math.atan2(dCz, dCx) + this.orbitDir * 0.4;
      const alt = this.center.y + Math.sin(g.time * 0.15 + this.phase) * 120;
      desired.set(this.center.x + Math.cos(ang) * this.orbitR - this.pos.x, alt - this.pos.y,
        this.center.z + Math.sin(ang) * this.orbitR - this.pos.z).normalize();
    } else if (this.state === 'attack') {
      const lead = clamp(distP / 1150, 0, 1.2);
      desired.copy(p.pos).addScaledVector(p.vel, lead).sub(this.pos).normalize();
      if (distP < 160 && this.dir.dot(toP) > 0) desired.copy(this.dir).addScaledVector(UP, 0.4).normalize(); // don't ram
    } else {
      desired.copy(this.evadeDir);
    }
    // stay inside the zone: blend toward the centre as the edge approaches
    const w = smooth(this.radius * 0.72, this.radius * 0.98, dC);
    if (w > 0) {
      _v.set(-dCx, (this.center.y - this.pos.y) * 0.5, -dCz).normalize();
      desired.lerp(_v, w).normalize();
    }
    // terrain avoidance (look ahead along the flight path)
    const la = this.speed * 1.6;
    const gAhead = Math.max(
      world.groundHeight(this.pos.x, this.pos.z),
      world.groundHeight(this.pos.x + this.dir.x * la, this.pos.z + this.dir.z * la),
      world.groundHeight(this.pos.x + this.dir.x * la * 2, this.pos.z + this.dir.z * la * 2),
    );
    const clear = this.pos.y - gAhead;
    if (clear < 200) desired.y += (200 - clear) / 90;
    if (this.pos.y > CEILING - 250) desired.y -= 0.5;
    desired.y = clamp(desired.y, -0.55, 0.85);
    desired.normalize();

    const maxTurn = cfg.turn * (this.state === 'patrol' ? 0.55 : 1) * (clear < 120 ? 1.6 : 1);
    const prev = _w.copy(this.dir);
    const prevX = prev.x, prevZ = prev.z;
    turnToward(this.dir, desired, maxTurn * dt);
    const yawRate = (this.dir.x * prevZ - this.dir.z * prevX) / Math.max(dt, 1e-4); // >0 = turning left
    this.bank += (clamp(yawRate * 1.5, -1.35, 1.35) - this.bank) * Math.min(1, dt * 3);
    const tgtSpeed = this.state === 'patrol' ? 205 : 255;
    this.speed += (tgtSpeed - this.speed) * 0.5 * dt - this.dir.y * 9.81 * dt * 0.6;
    this.vel.copy(this.dir).multiplyScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
    orient(this.obj.quaternion, this.dir, this.bank);
    for (const f of this.model.flames) f.scale.z = this.state === 'patrol' ? 0.5 : 0.9 + Math.random() * 0.2;

    if (this.pos.y < world.groundHeight(this.pos.x, this.pos.z) + 3) { // crashed into the ground
      this.damage(999, false);
      return;
    }

    // --- weapons ---
    this.losT -= dt;
    if (this.losT <= 0) { this.losT = 0.3; this.los = world.lineOfSight(this.pos, p.pos, 10); }
    const off = distP > 1 ? this.dir.angleTo(toP) : Math.PI;
    if (this.state !== 'patrol' && p.alive && this.los) {
      // gun bursts
      this.gunCd -= dt;
      if (distP < 950 && off < 0.09) {
        if (this.burst <= 0 && this.gunCd <= 0) { this.burst = 0.6; this.gunCd = rand(1.0, 2.0); }
      }
      if (this.burst > 0) {
        this.burst -= dt;
        this.shotT = (this.shotT || 0) - dt;
        if (this.shotT <= 0) {
          this.shotT = 0.09;
          const d = this.dir.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(cfg.accuracy)).normalize();
          g.fireBullet(this.obj.localToWorld(this.model.gun.clone()), d, this.speed, 'enemy');
        }
      }
      // missile lock + launch
      if (distP < WEAPONS.emsl.range && off < 0.42) this.lockT += dt;
      else this.lockT = Math.max(0, this.lockT - dt * 2);
      this.missileCd -= dt;
      if (this.lockT > 1.6 && this.missileCd <= 0) {
        this.missileCd = rand(...cfg.missileCd);
        this.lockT = 0.5;
        g.fireMissile('emsl', this.obj.localToWorld(new THREE.Vector3(0, -0.8, 0)), this.dir, this.speed, p, 'enemy');
      }
    } else {
      this.lockT = Math.max(0, this.lockT - dt * 2);
    }
  }

  // called by an incoming player missile (once per missile)
  considerEvade(missile) {
    if (this.state === 'evade' || Math.random() > this.cfg.evade) return;
    this.evadeT = rand(1.4, 2.6);
    _v.crossVectors(missile.dir, UP).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    this.evadeDir.copy(_v).addScaledVector(UP, rand(-0.35, 0.2)).normalize();
  }

  dispose() {
    this.game.scene.remove(this.obj);
  }
}

// ======================= MISSILE =======================

class Missile {
  constructor(game, kind, pos, dir, speed, target, owner) {
    this.game = game;
    this.kind = kind;
    this.spec = WEAPONS[kind];
    this.pos = pos.clone();
    this.dir = dir.clone().normalize();
    this.speed = speed;
    this.target = target;
    this.owner = owner;
    this.age = 0;
    this.alive = true;
    this.trailT = 0;
    this.warned = false;
    this.mesh = buildMissileMesh(kind);
    this.mesh.position.copy(this.pos);
    game.scene.add(this.mesh);
  }
  get vel() { return this.dir.clone().multiplyScalar(this.speed); }

  update(dt) {
    const g = this.game, s = this.spec;
    this.age += dt;
    this.speed = Math.min(s.speed, this.speed + s.speed * 1.4 * dt);
    const t = this.target;
    if (t && (!t.alive || (t === g.player && !g.player.alive))) this.target = null;
    if (this.target && this.age > 0.2) {
      let guide = true;
      if (s.needsCircle && this.owner === 'player') guide = g.inLockCircle(this.target, s.cone);
      if (guide) {
        const d = this.pos.distanceTo(t.pos);
        const lead = clamp(d / this.speed, 0, 2.5) * 0.85;
        _v.copy(t.pos).addScaledVector(t.vel, lead).sub(this.pos).normalize();
        const off = this.dir.angleTo(_v);
        if (off > 1.35 && !s.needsCircle) this.target = null; // overshot: lock lost
        else turnToward(this.dir, _v, s.turn * dt);
        if (!this.warned && this.owner === 'player' && d < 1100 && t.considerEvade) { this.warned = true; t.considerEvade(this); }
      }
    }
    const prev = this.pos.clone();
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.mesh.position.copy(this.pos);
    this.mesh.quaternion.setFromUnitVectors(_w.set(0, 0, -1), this.dir);

    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.025;
      g.effects.trail(this.pos.clone().addScaledVector(this.dir, -2.2), this.owner === 'enemy' ? 0xb8b8b8 : 0xe6e6e6, this.kind === 'hpaa' ? 2.4 : 1.6);
    }

    // hits
    if (this.owner === 'player') {
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const r = e === this.target ? s.prox : e.hitR;
        if (segDist(prev, this.pos, e.pos) < r) return this.detonate(e);
      }
    } else if (g.player.alive && segDist(prev, this.pos, g.player.pos) < s.prox) {
      return this.detonate(g.player);
    }
    if (this.pos.y < g.world.groundHeight(this.pos.x, this.pos.z)) return this.detonate(null, true);
    if (this.age > s.life) return this.detonate(null);
  }

  detonate(hit, ground = false) {
    const g = this.game, s = this.spec;
    this.alive = false;
    g.scene.remove(this.mesh);
    g.effects.explosion(this.pos, s.blast ? 1.1 : 0.45, this.vel);
    g.sound('explosion', this.pos, s.blast ? 1 : 0.6);
    if (ground) g.effects.impact(this.pos);
    if (this.owner === 'player') {
      if (s.blast) {
        const inBlast = g.enemies.filter((e) => e.alive && e.pos.distanceTo(this.pos) < s.blast);
        if (inBlast.length) g.registerHit('missile');
        for (const e of inBlast) e.damage(s.dmg * (1 - (e.pos.distanceTo(this.pos) / s.blast) * 0.5));
      } else if (hit) {
        g.registerHit('missile');
        hit.damage(s.dmg);
      }
      if (!hit && !s.blast && !ground) g.msg('MISSED', '#ffd36b', 1);
    } else if (hit === g.player) {
      g.damagePlayer(s.dmg, 'missile');
    }
  }
}

// ======================= GAME =======================

export class Game {
  constructor({ scene, world, effects, audio, planeDef, difficulty }) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.audio = audio;
    this.diffKey = difficulty;
    this.cfg = DIFFICULTY[difficulty];
    this.time = 0;
    this.missionTime = 0;
    this.state = 'playing'; // playing | won | lost
    this.endT = 0;
    this.messages = [];
    this.missiles = [];
    this.bullets = [];
    this.enemies = [];
    this.stats = { shots: 0, gunHits: 0, missiles: 0, missileHits: 0, kills: 0 };
    this.lock = { target: null, progress: 0, locked: false, multi: [], multiT: 0 };
    this.target = null;
    this.gunTarget = null;
    this.warning = { missile: false, locked: false, pullUp: false, area: false, stall: false };
    this.camShake = 0;
    this.hitFlash = 0;

    this.player = new Player(planeDef, scene);
    this.spawnPlayer();
    this.spawnEnemies(this.cfg.count);
    this.initBulletMesh();
  }

  // ---------- spawning ----------
  spawnPlayer() {
    const side = Math.floor(Math.random() * 4);
    const along = rand(-0.4, 0.4) * HALF;
    const d = HALF * 0.7;
    const pos = [[along, -d], [d, along], [along, d], [-d, along]][side];
    const p = this.player;
    p.pos.set(pos[0], 0, pos[1]);
    const toC = new THREE.Vector3(-pos[0], 0, -pos[1]).normalize();
    let gmax = 0;
    for (let i = 0; i <= 8; i++) gmax = Math.max(gmax, this.world.groundHeight(p.pos.x + toC.x * i * 400, p.pos.z + toC.z * i * 400));
    p.pos.y = Math.min(CEILING - 300, gmax + 450);
    orient(p.quat, toC, 0);
  }

  spawnEnemies(count) {
    const centers = [];
    const pp = this.player.pos;
    for (let tries = 0; centers.length < count && tries < 4000; tries++) {
      const R = rand(950, 1400);
      const x = rand(-1, 1) * HALF * 0.7, z = rand(-1, 1) * HALF * 0.7;
      if (Math.hypot(x - pp.x, z - pp.z) < 3800 - Math.min(tries, 2500) * 0.4) continue;
      if (centers.some((c) => Math.hypot(c.x - x, c.z - z) < (c.R + R) * (tries < 2000 ? 0.85 : 0.5))) continue;
      let gmax = this.world.groundHeight(x, z);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        for (const f of [0.5, 1]) gmax = Math.max(gmax, this.world.groundHeight(x + Math.cos(a) * R * f, z + Math.sin(a) * R * f));
      }
      const alt = gmax + rand(380, 650);
      if (alt > CEILING - 250 && tries < 3000) continue;
      centers.push({ x, z, R, alt: Math.min(alt, CEILING - 250) });
    }
    centers.forEach((c, i) => this.enemies.push(new Rogue(this, new THREE.Vector3(c.x, c.alt, c.z), c.R, i)));
    this.total = this.enemies.length;
  }

  initBulletMesh() {
    const geo = new THREE.BoxGeometry(0.35, 0.35, 11);
    this.bulletMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 500);
    this.bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bulletMesh.frustumCulled = false;
    for (let i = 0; i < 500; i++) this.bulletMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    this.scene.add(this.bulletMesh);
  }

  dispose() {
    this.scene.remove(this.player.obj);
    for (const e of this.enemies) e.dispose();
    for (const m of this.missiles) this.scene.remove(m.mesh);
    this.scene.remove(this.bulletMesh);
    this.bulletMesh.dispose();
  }

  // ---------- helpers ----------
  msg(text, color = '#9dffb0', dur = 2) {
    this.messages.push({ text, color, t: dur, dur });
    if (this.messages.length > 4) this.messages.shift();
  }

  sound(name, pos, vol = 1) {
    if (!this.audio) return;
    const d = pos ? pos.distanceTo(this.player.pos) : 0;
    const v = vol * clamp(1 - d / 5000, 0, 1);
    if (name === 'explosion') this.audio.explosion(v);
    else if (name === 'gun') this.audio.gun(v);
  }

  registerHit(kind) {
    if (kind === 'missile') { this.stats.missileHits++; this.msg('HIT', '#ff6b5b', 1); }
    else this.stats.gunHits++;
    this.audio?.hit();
  }

  onKill(enemy, byPlayer) {
    this.stats.kills++;
    const left = this.enemies.filter((e) => e.alive).length;
    this.msg(`${enemy.name} DESTROYED`, '#ff6b5b', 2.5);
    if (left > 0) this.msg(`${left} TARGET${left > 1 ? 'S' : ''} REMAINING`, '#9dffb0', 2.5);
    if (left === 0 && this.state === 'playing') {
      this.state = 'won';
      this.endT = 0;
      this.msg('ALL TARGETS DESTROYED', '#ffe27a', 4);
    }
  }

  damagePlayer(dmg, kind) {
    const p = this.player;
    if (!p.alive || this.state !== 'playing') return;
    p.hp -= dmg;
    this.hitFlash = kind === 'missile' ? 0.6 : 0.25;
    this.camShake = Math.max(this.camShake, kind === 'missile' ? 1 : 0.3);
    if (kind === 'missile') this.msg('DAMAGE!', '#ff6b5b', 1.5);
    if (p.hp <= 0) this.killPlayer('SHOT DOWN');
  }

  killPlayer(reason) {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    p.hp = Math.min(p.hp, 0);
    this.effects.explosion(p.pos, 1.4, p.vel);
    this.audio?.explosion(1);
    p.obj.visible = false;
    if (this.state === 'playing') { this.state = 'lost'; this.endT = 0; this.failReason = reason; }
    this.msg(reason, '#ff6b5b', 4);
  }

  // is the target inside the player's lock circle (angular cone around the nose)?
  inLockCircle(t, cone) {
    const p = this.player;
    if (!p.alive) return false;
    _v.subVectors(t.pos, p.pos);
    return p.fwd(_w).angleTo(_v) < cone;
  }

  // ---------- weapons ----------
  fireBullet(pos, dir, baseSpeed, owner) {
    const spec = WEAPONS.gun;
    this.bullets.push({ pos: pos.clone(), vel: dir.clone().multiplyScalar(spec.speed + baseSpeed), life: spec.life, owner });
    if (this.bullets.length > 480) this.bullets.shift();
    this.sound('gun', pos, owner === 'player' ? 1 : 0.5);
  }

  fireMissile(kind, pos, dir, speed, target, owner) {
    const m = new Missile(this, kind, pos, dir, speed, target, owner);
    this.missiles.push(m);
    if (owner === 'player') this.audio?.missile();
    return m;
  }

  // player presses fire
  trigger() {
    const p = this.player;
    if (!p.alive || this.state === 'lost') return;
    const w = p.weapon;
    if (w === 'gun') return; // gun is handled as "hold to fire"
    const spec = WEAPONS[w];
    if (p.ammo[w] <= 0) { this.msg('NO AMMO', '#ffd36b', 1); return; }
    const rails = p.rails[w];
    const free = rails.findIndex((t) => t <= 0);
    if (free < 0) return;

    const fwd = p.fwd(new THREE.Vector3());
    const launch = (target) => {
      const pi = p.pylonI++ % p.model.pylons.length;
      const pos = p.obj.localToWorld(p.model.pylons[pi].clone());
      p.model.pylonMissiles[pi].visible = false;
      p.pylonTimers[pi] = spec.reload;
      this.fireMissile(w, pos, fwd, p.speed, target, 'player');
      p.ammo[w]--;
      this.stats.missiles++;
    };
    if (spec.multi) {
      const targets = this.lock.multi.filter((t) => t.alive).slice(0, Math.min(spec.multi, p.ammo[w]));
      if (targets.length === 0) launch(null);
      else targets.forEach((t) => launch(t));
      this.lock.multi = [];
      this.lock.multiT = 0;
    } else {
      launch(this.lock.locked ? this.lock.target : null);
    }
    rails[free] = spec.reload;
  }

  switchWeapon() {
    const p = this.player;
    p.wi = (p.wi + 1) % p.weapons.length;
    this.lock = { target: null, progress: 0, locked: false, multi: [], multiT: 0 };
    this.audio?.click();
  }

  updateLocks(dt) {
    const p = this.player, w = p.weapon, L = this.lock;
    const fwd = p.fwd(new THREE.Vector3());
    // HUD target: closest to the nose (weighted by distance)
    let best = null, bestScore = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      _v.subVectors(e.pos, p.pos);
      const d = _v.length(), a = fwd.angleTo(_v);
      e._dist = d;
      e._off = a;
      const score = a + d / 9000;
      if (score < bestScore) { bestScore = score; best = e; }
      e._losT = (e._losT || 0) - dt;
      if (e._losT <= 0) { e._losT = 0.25; e._los = this.world.lineOfSight(p.pos, e.pos, 12); }
    }
    this.target = best;
    this.gunTarget = best && best._dist < 1600 && best._off < 0.5 ? best : null;
    if (w === 'gun' || !p.alive) { L.target = null; L.locked = false; L.progress = 0; L.multi = []; return; }
    const spec = WEAPONS[w];
    const cands = this.enemies.filter((e) => e.alive && e._dist < spec.range && e._off < spec.cone && e._los);
    if (spec.multi) {
      L.multi = L.multi.filter((e) => cands.includes(e));
      L.multiT += dt;
      if (L.multiT >= spec.lockTime && L.multi.length < spec.multi) {
        const next = cands.filter((e) => !L.multi.includes(e)).sort((a, b) => a._off - b._off)[0];
        if (next) { L.multi.push(next); L.multiT = 0; this.audio?.click(); }
      }
      L.target = L.multi[0] || null;
      L.locked = L.multi.length > 0;
      L.seeking = cands.length > L.multi.length;
    } else {
      const c = cands.sort((a, b) => a._off - b._off)[0] || null;
      if (c !== L.target) { L.target = c; L.progress = 0; L.locked = false; }
      if (c) {
        L.progress += dt;
        if (!L.locked && L.progress >= spec.lockTime) { L.locked = true; }
      }
      L.seeking = !!c && !L.locked;
    }
  }

  // ---------- main update ----------
  update(dt, keys, opts) {
    this.time += dt;
    const p = this.player, world = this.world;
    if (this.state === 'playing') this.missionTime += dt;
    if (this.state !== 'playing') this.endT += dt;

    if (p.alive) {
      p.update(dt, keys, opts.invert);
      // gun: hold to fire
      if (keys.Space && p.weapon === 'gun' && p.gunCd <= 0) {
        p.gunCd = 1 / WEAPONS.gun.rate;
        const fwd = p.fwd(new THREE.Vector3());
        const d = fwd.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.006)).normalize();
        this.fireBullet(p.obj.localToWorld(p.model.gun.clone()), d, p.speed, 'player');
        this.stats.shots++;
      }
      this.checkPlayerCollisions();
    }
    this.updateLocks(dt);

    for (const e of this.enemies) e.update(dt);
    for (const m of this.missiles) if (m.alive) m.update(dt);
    this.missiles = this.missiles.filter((m) => m.alive);
    this.updateBullets(dt);

    // warnings
    const wn = this.warning;
    wn.missile = p.alive && this.missiles.some((m) => m.owner === 'enemy' && m.target === p);
    wn.locked = p.alive && !wn.missile && this.enemies.some((e) => e.alive && e.lockT > 0.4);
    wn.stall = p.alive && p.stall;
    wn.area = p.alive && world.edgeFactor(p.pos.x, p.pos.z) > 0.8;
    wn.ceiling = p.alive && p.pos.y > CEILING - 50;
    wn.pullUp = false;
    if (p.alive) {
      for (const t of [1, 2, 3]) {
        const x = p.pos.x + p.vel.x * t, y = p.pos.y + p.vel.y * t, z = p.pos.z + p.vel.z * t;
        if (y < world.groundHeight(x, z) + 15) { wn.pullUp = true; break; }
      }
    }

    for (const m of this.messages) m.t -= dt;
    this.messages = this.messages.filter((m) => m.t > 0);
    this.camShake = Math.max(0, this.camShake - dt * 1.5);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (p.alive && p.hp < 35) this.effects.burn(p.local(0, 0.3, p.model.length * 0.45), p.vel, 0.6);
  }

  checkPlayerCollisions() {
    const p = this.player, world = this.world;
    for (const pt of p.hullPoints()) {
      const ground = world.terrainHeight(pt.x, pt.z);
      if (pt.y < ground) return this.killPlayer(world.edgeFactor(pt.x, pt.z) > 0.84 ? 'CRASHED INTO MOUNTAINS' : 'CRASHED');
      if (pt.y < WATER + 0.5) return this.killPlayer('CRASHED INTO WATER');
    }
    if (world.treeHit(p.pos, p.radius)) return this.killPlayer('CRASHED INTO TREES');
    for (const e of this.enemies) {
      if (e.alive && e.pos.distanceTo(p.pos) < 13) {
        e.damage(999);
        return this.killPlayer('MID-AIR COLLISION');
      }
    }
  }

  updateBullets(dt) {
    const p = this.player, world = this.world, mesh = this.bulletMesh;
    const prev = new THREE.Vector3();
    const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), dirv = new THREE.Vector3();
    const yel = new THREE.Color(1, 0.86, 0.35), red = new THREE.Color(1, 0.35, 0.2);
    let n = 0;
    const keep = [];
    for (const b of this.bullets) {
      b.life -= dt;
      prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      let dead = b.life <= 0;
      if (!dead && b.owner === 'player') {
        for (const e of this.enemies) {
          if (e.alive && segDist(prev, b.pos, e.pos) < e.hitR) {
            this.effects.sparks(b.pos, 5);
            e.damage(WEAPONS.gun.dmg);
            this.registerHit('gun');
            dead = true;
            break;
          }
        }
      } else if (!dead && p.alive && segDist(prev, b.pos, p.pos) < 7) {
        this.damagePlayer(this.cfg.gunDmg, 'gun');
        this.effects.sparks(b.pos, 3);
        dead = true;
      }
      if (!dead) {
        const gh = world.groundHeight(b.pos.x, b.pos.z);
        if (b.pos.y < gh) {
          if (b.pos.distanceTo(p.pos) < 1500) this.effects.impact(new THREE.Vector3(b.pos.x, gh, b.pos.z), gh <= WATER + 0.01);
          dead = true;
        }
      }
      if (dead) continue;
      keep.push(b);
      if (n < 500) {
        dirv.copy(b.vel).normalize();
        q.setFromUnitVectors(AZ, dirv);
        _m.compose(b.pos, q, one);
        mesh.setMatrixAt(n, _m);
        mesh.setColorAt(n, b.owner === 'player' ? yel : red);
        n++;
      }
    }
    this.bullets = keep;
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
