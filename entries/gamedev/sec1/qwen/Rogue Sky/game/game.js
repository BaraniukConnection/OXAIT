/* =========================================================
   ROGUE SKIES — main game logic
   Arcade third-person flight combat, low-poly world.
   ========================================================= */
(function () {
  const V3 = THREE.Vector3, Q = THREE.Quaternion, E = THREE.Euler, MU = THREE.MathUtils;

  /* ================= PLANE / WEAPON DEFINITIONS ================= */
  // speed tier -> max speed (m/s), maneuver tier -> turn authority
  const PLANES = [
    {
      id: 'thunder', name: 'THUNDER', model: 'EF Typhoon', build: () => Models.buildTyphoon(),
      speed: 2, agi: 2, colorCss: '#9aa7b5',
      special: { key: 'hsam', name: 'HSM-31 High-Speed AA Missile', ammo: 8,
        desc: 'Rocket-boosted interceptor missile.<br>Extreme speed, minimal turn.' },
      stats: { maxSpeed: 240, minSpeed: 60, accel: 55, pitchRate: 55, rollRate: 140, yawRate: 22 }
    },
    {
      id: 'vulture', name: 'VULTURE', model: 'Gryphen', build: () => Models.buildGryphen(),
      speed: 2, agi: 2, colorCss: '#8f9a88',
      special: { key: 'radar', name: 'RGA-9 Radar-Guided AA Missile', ammo: 6,
        desc: 'Needs radar lock on target to arm.<br>Hypersonic agility while locked.' },
      stats: { maxSpeed: 235, minSpeed: 60, accel: 55, pitchRate: 55, rollRate: 140, yawRate: 22 }
    },
    {
      id: 'falcon', name: 'FALCON', model: 'Su-27 "Ukraine"', build: () => Models.buildSu27UA(),
      speed: 3, agi: 3, colorCss: '#2b6cc4',
      special: { key: 'multi', name: 'ML-4 Multi-Lock Missile', ammo: 4,
        desc: 'Salvo of 4 missiles that auto-lock<br>onto up to 4 different targets.' },
      stats: { maxSpeed: 285, minSpeed: 60, accel: 70, pitchRate: 72, rollRate: 180, yawRate: 28 }
    },
    {
      id: 'shadow', name: 'SHADOW', model: 'F-22 Raptor', build: () => Models.buildF22(),
      speed: 3, agi: 3, colorCss: '#4b5563',
      special: { key: 'hpw', name: 'APW-1 High-Power Missile', ammo: 5,
        desc: 'Massive warhead. Big damage,<br>wide blast radius.' },
      stats: { maxSpeed: 285, minSpeed: 60, accel: 70, pitchRate: 72, rollRate: 180, yawRate: 28 }
    },
  ];

  const MG = { name: '20mm MG', fireDelay: 0.09, dmg: 4, speed: 520, life: 1.6 };
  const BASIC_MISSILE = { name: 'AA-11 Basic Missile', ammoMax: 12, dmg: 34, speed: 190, turn: 3.2, life: 7, blast: 12 };

  const TARGET_COUNT = 8;
  const TARGET_RADIUS = 420;     // patrol radius around spawn anchor
  const ATTACK_RANGE  = 620;     // rogue engages player within this range
  const WORLD_LIMIT   = 1900;

  /* ================= GLOBAL STATE ================= */
  let renderer, scene, camera, clock;
  let terrain, player, targets = [], projectiles = [], particles = [], pickups = [];
  let sun, hemi;
  let state = 'menu';            // menu | playing | victory | defeat
  let selectedPlane = PLANES[2]; // default Falcon
  let keys = {};
  let hudEls = {};
  let menuPreview = null; // (unused legacy slot) per-card renderers used instead
  let shakeT = 0;
  let kills = 0, startTime = 0;
  let weaponIndex = 0;           // 0 = MG, 1 = basic missile, 2 = special
  let lastMG = 0, lastMSL = 0, mgHeat = 0;
  let lockTarget = null, lockTime = 0;
  let msgTimer = 0;

  /* ================= HELPERS ================= */
  const clamp = MU.clamp, lerp = MU.lerp;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function showMsg(text, dur) {
    hudEls.centerMsg.textContent = text;
    hudEls.centerMsg.style.display = 'block';
    msgTimer = dur || 2.2;
  }

  /* ================= SCENE SETUP ================= */
  function initScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    document.getElementById('app').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc8ec);
    scene.fog = new THREE.Fog(0xbfdcf5, 900, 3800);

    camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.5, 6000);

    sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
    sun.position.set(600, 900, 300);
    scene.add(sun);
    hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3e5b3a, 0.85);
    scene.add(hemi);

    terrain = Terrain.create(scene);

    // simple clouds
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(24, 55), 0), cloudMat);
        s.position.set(rnd(-60, 60), rnd(-8, 8), rnd(-30, 30));
        s.scale.y = 0.5;
        c.add(s);
      }
      c.position.set(rnd(-1800, 1800), rnd(520, 850), rnd(-1800, 1800));
      scene.add(c);
    }

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    clock = new THREE.Clock();
    animate();
  }

  /* ================= PLAYER ================= */
  function makePlayer(def) {
    const obj = def.build();
    obj.scale.setScalar(1.15);
    scene.add(obj);
    const p = {
      def, mesh: obj,
      pos: new V3(rnd(-200, 200), 0, rnd(-200, 200)),
      quat: new Q(),
      vel: new V3(),
      speed: def.stats.maxSpeed * 0.55,
      throttle: 0.55,
      hull: 100, alive: true,
      weapons: { mg: true, msl: { ...BASIC_MISSILE, ammo: BASIC_MISSILE.ammoMax },
                 sp: { ...def.special, ammo: def.special.ammo } },
      afterburners: [],
    };
    // start above terrain
    p.pos.y = terrain.heightAt(p.pos.x, p.pos.z) + rnd(180, 260);
    const yaw = rnd(0, Math.PI * 2);
    p.quat.setFromEuler(new E(0, yaw, 0));
    // afterburner sprites
    obj.userData.engines.forEach(a => {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff9a3c, transparent: true, opacity: 0 }));
      spr.scale.set(2.2, 2.2, 1);
      a.add(spr);
      p.afterburners.push(spr);
    });
    return p;
  }

  function updatePlayer(dt) {
    const p = player, st = p.def.stats;
    if (!p.alive) return;

    // ---- throttle W/S ----
    if (keys['KeyW']) p.throttle = clamp(p.throttle + dt * 0.55, 0, 1);
    if (keys['KeyS']) p.throttle = clamp(p.throttle - dt * 0.55, 0, 1);
    const targetSpeed = lerp(st.minSpeed, st.maxSpeed, p.throttle);
    p.speed = lerp(p.speed, targetSpeed, 1 - Math.exp(-dt * (st.accel / 40)));

    // ---- attitude control: arrows pitch/roll, A/D yaw ----
    let pitchIn = 0, rollIn = 0, yawIn = 0;
    if (keys['ArrowUp'])   pitchIn += 1;   // nose up
    if (keys['ArrowDown']) pitchIn -= 1;   // nose down
    if (keys['ArrowLeft'])  rollIn += 1;   // roll left
    if (keys['ArrowRight']) rollIn -= 1;   // roll right
    if (keys['KeyA']) yawIn += 1;          // yaw left
    if (keys['KeyD']) yawIn -= 1;          // yaw right

    // control authority scales with speed (arcade-ish, never fully dead)
    const authority = clamp(0.35 + 0.65 * (p.speed / st.maxSpeed), 0.35, 1);
    const qd = new Q();
    const eul = new E(
      -pitchIn * THREE.MathUtils.degToRad(st.pitchRate) * authority * dt,
       yawIn   * THREE.MathUtils.degToRad(st.yawRate)   * authority * dt,
       rollIn  * THREE.MathUtils.degToRad(st.rollRate)  * authority * dt,
       'YXZ');
    qd.setFromEuler(eul);
    p.quat.multiply(qd);                    // local-space rotations

    // coordinated turn: rolling banks the nose — add induced yaw from bank
    const fwd = new V3(0, 0, -1).applyQuaternion(p.quat);
    const up  = new V3(0, 1, 0).applyQuaternion(p.quat);
    const bank = Math.atan2(up.clone().cross(fwd).y, up.y) * 0; // handled naturally by local pitch/roll
    // gentle gravity vs lift: at low speed sink slightly
    const liftFactor = clamp((p.speed - st.minSpeed * 0.8) / (st.maxSpeed * 0.4), 0, 1);

    // ---- move ----
    p.vel.copy(fwd).multiplyScalar(p.speed);
    p.vel.y -= (1 - liftFactor) * 38 * dt * 60 * 0.02 * 60; // small sink at idle
    p.pos.addScaledVector(p.vel, dt);

    // keep inside map
    if (Math.abs(p.pos.x) > WORLD_LIMIT) { p.pos.x = Math.sign(p.pos.x) * WORLD_LIMIT; showMsg('⚠ RETURN TO COMBAT ZONE', 1); }
    if (Math.abs(p.pos.z) > WORLD_LIMIT) { p.pos.z = Math.sign(p.pos.z) * WORLD_LIMIT; showMsg('⚠ RETURN TO COMBAT ZONE', 1); }

    // ---- terrain collision ----
    const ground = terrain.heightAt(p.pos.x, p.pos.z);
    if (p.pos.y < ground + 3.5) {
      if (p.speed > 110) { crashPlayer(); return; }
      p.pos.y = ground + 3.5;                      // skid (slow) — damage over time
      p.hull -= dt * 14;
      flashDamage();
      if (p.hull <= 0) crashPlayer();
    }

    // apply transform
    p.mesh.position.copy(p.pos);
    p.mesh.quaternion.copy(p.quat);

    // afterburner glow
    const abOn = p.throttle > 0.85;
    p.afterburners.forEach(s => {
      s.material.opacity = lerp(s.material.opacity, abOn ? 0.9 : (p.throttle > 0.5 ? 0.25 : 0), dt * 6);
      const sc = abOn ? 3.4 : 1.8;
      s.scale.set(lerp(s.scale.x, sc, dt * 8), lerp(s.scale.y, sc * 0.8, dt * 8), 1);
    });

    // ---- firing ----
    if (keys['Space']) fire(dt);

    updateLock(dt);
  }

  function crashPlayer() {
    const p = player;
    if (!p.alive) return;
    p.alive = false;
    explode(p.mesh.position, 2.4);
    scene.remove(p.mesh);
    shakeT = 0.9;
    setTimeout(() => endGame(false), 1200);
  }

  /* ================= LOCK-ON (radar) ================= */
  function updateLock(dt) {
    lockTarget = null;
    const fwd = new V3(0, 0, -1).applyQuaternion(player.quat);
    let bestDot = 0.965, bestDist = 900;
    for (const t of targets) {
      if (!t.alive) continue;
      const to = t.mesh.position.clone().sub(player.mesh.position);
      const d = to.length();
      if (d > bestDist) continue;
      const dot = to.normalize().dot(fwd);
      if (dot > bestDot) { bestDot = dot; lockTarget = t; }
    }
    if (lockTarget) {
      lockTime += dt;
      hudEls.lock.style.display = 'block';
    } else {
      lockTime = 0;
      hudEls.lock.style.display = 'none';
    }
    // draw lock reticle in 3D via sprite
    if (lockTarget) {
      if (!hudEls.lockSprite) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128;
        hudEls.lockCv = cv;
        const tex = new THREE.CanvasTexture(cv);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        spr.scale.set(46, 46, 1); spr.renderOrder = 999;
        scene.add(spr);
        hudEls.lockSprite = spr;
      }
      hudEls.lockSprite.visible = true;
      hudEls.lockSprite.position.copy(lockTarget.mesh.position);
      const cv = hudEls.lockCv, ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      ctx.strokeStyle = lockTime > 0.8 ? '#ff3b3b' : '#ffb03a';
      ctx.lineWidth = 5;
      const r = 44;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(64, 64, r, a - 0.5, a + 0.5);
        ctx.stroke();
      }
      if (lockTime > 0.8) { ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#ff3b3b'; ctx.fillText('LOCK', 40, 70); }
      hudEls.lockSprite.material.map.needsUpdate = true;
    } else if (hudEls.lockSprite) hudEls.lockSprite.visible = false;
  }

  /* ================= WEAPONS FIRING ================= */
  function fire(dt) {
    const wsel = ['mg', 'msl', 'sp'][weaponIndex];
    if (wsel === 'mg') {
      const now = performance.now() / 1000;
      if (now - lastMG < MG.fireDelay || mgHeat >= 1) return;
      lastMG = now;
      mgHeat = clamp(mgHeat + 0.06, 0, 1);
      player.def.build; // noop
      player.mesh.userData.muzzles.forEach(m => {
        const wp = m.getWorldPosition(new V3());
        const dir = new V3(0, 0, -1).applyQuaternion(player.quat);
        spawnBullet(wp, dir);
      });
    } else if (wsel === 'msl') {
      const now = performance.now() / 1000;
      if (now - lastMSL < 0.8) return;
      if (player.weapons.msl.ammo <= 0) { showMsg('MISSILE OUT', 1); return; }
      lastMSL = now;
      player.weapons.msl.ammo--;
      launchMissile(BASIC_MISSILE, null);
    } else {
      fireSpecial();
    }
  }

  function fireSpecial() {
    const sp = player.weapons.sp;
    const now = performance.now() / 1000;
    if (now - lastMSL < 1.0) return;
    if (sp.ammo <= 0) { showMsg('SPECIAL WEAPON EMPTY', 1); return; }
    switch (sp.key) {
      case 'hsam':
        lastMSL = now; sp.ammo--;
        launchMissile({ ...sp, speed: 330, turn: 1.6, dmg: 30, blast: 10, life: 6 }, null);
        break;
      case 'radar':
        if (!lockTarget || lockTime < 0.8) { showMsg('RADAR LOCK REQUIRED', 1.2); return; }
        lastMSL = now; sp.ammo--;
        launchMissile({ ...sp, speed: 200, turn: 7.5, onlyWhenLocked: true, dmg: 40, blast: 12, life: 8 }, lockTarget);
        break;
      case 'multi': {
        const alive = targets.filter(t => t.alive);
        if (!alive.length) return;
        const chosen = alive.sort((a, b) =>
          a.mesh.position.distanceTo(player.mesh.position) - b.mesh.position.distanceTo(player.mesh.position)
        ).slice(0, 4);
        lastMSL = now; sp.ammo--;
        chosen.forEach((t, i) => {
          launchMissile({ ...sp, speed: 175, turn: 4.2, dmg: 26, blast: 10, life: 9 }, t, i);
        });
        showMsg('MULTI-LOCK SALVO ×' + chosen.length, 1.4);
        break;
      }
      case 'hpw':
        lastMSL = now; sp.ammo--;
        launchMissile({ ...sp, speed: 165, turn: 2.6, dmg: 85, blast: 34, life: 7 }, null);
        break;
    }
    updateWeaponHud();
  }

  function spawnBullet(pos, dir) {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 2.6);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(dir));
    scene.add(mesh);
    const jitter = new V3(rnd(-0.008, 0.008), rnd(-0.008, 0.008), 0);
    projectiles.push({ type: 'bullet', mesh, vel: dir.clone().add(jitter).normalize().multiplyScalar(MG.speed),
                       ttl: MG.life, dmg: MG.dmg, owner: 'player' });
  }

  function launchMissile(cfg, forcedTarget, salvoIdx) {
    const nose = player.mesh.userData.nose.getWorldPosition(new V3());
    const dir = new V3(0, 0, -1).applyQuaternion(player.quat);
    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.28, 3.4, 5);
    bodyGeo.rotateX(Math.PI / 2);
    const col = cfg.key === 'hpw' ? 0xd0d0d8 : cfg.key === 'multi' ? 0xffd27f : cfg.key === 'radar' ? 0xa8e0ff : 0xe8e8ee;
    const mesh = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: col, flatShading: true }));
    // fins
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.8), new THREE.MeshBasicMaterial({ color: 0xcc4433 }));
      fin.position.z = 1.5;
      fin.rotation.z = i * Math.PI / 2;
      fin.position.x = Math.sin(i * Math.PI / 2) * 0.35;
      fin.position.y = Math.cos(i * Math.PI / 2) * 0.35;
      mesh.add(fin);
    }
    // smoke trail sprite anchor
    mesh.position.copy(nose);
    if (salvoIdx) {
      const side = new V3(1, 0, 0).applyQuaternion(player.quat).multiplyScalar((salvoIdx % 2 ? 1 : -1) * (1 + salvoIdx));
      mesh.position.add(side);
    }
    mesh.lookAt(nose.clone().add(dir));
    scene.add(mesh);
    const target = forcedTarget || findSoftTarget(nose, dir);
    projectiles.push({
      type: 'missile', mesh, cfg,
      vel: dir.clone().multiplyScalar(cfg.speed * 0.4),
      dir: dir.clone(), speed: cfg.speed * 0.4,
      target, ttl: cfg.life, owner: 'player', age: 0,
    });
  }

  // pick nearest target roughly ahead for generic missiles
  function findSoftTarget(from, dir) {
    let best = null, bestScore = 0.86;
    for (const t of targets) {
      if (!t.alive) continue;
      const to = t.mesh.position.clone().sub(from);
      const d = to.length();
      if (d > 1100) continue;
      const score = to.normalize().dot(dir);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
  }

  /* ================= TARGETS ("ROGUE" Su-57) ================= */
  function spawnTargets() {
    for (let i = 0; i < TARGET_COUNT; i++) {
      let x, z, ok = false, tries = 0;
      while (!ok && tries++ < 80) {
        x = rnd(-WORLD_LIMIT * 0.85, WORLD_LIMIT * 0.85);
        z = rnd(-WORLD_LIMIT * 0.85, WORLD_LIMIT * 0.85);
        if (Math.hypot(x - (player ? player.pos.x : 0), z - (player ? player.pos.z : 0)) > 700) ok = true;
      }
      const anchor = new V3(x, 0, z);
      const alt = terrain.heightAt(x, z) + rnd(160, 340);
      const mesh = Models.buildSu57({ body: 0x5d6b7c, dark: 0x414c59, accent: 0x8a3030 });
      mesh.scale.setScalar(1.1);
      scene.add(mesh);
      // red ID light
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.5, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xff3333 }));
      light.position.set(0, 2.6, 4.4); mesh.add(light);
      const t = {
        mesh, anchor, alive: true, hull: 60,
        homeAngle: rnd(0, Math.PI * 2),
        orbitDir: Math.random() > 0.5 ? 1 : -1,
        orbitSpeed: rnd(0.10, 0.16),
        altitude: alt,
        state: 'patrol',
        fireCd: rnd(1, 3),
        bobPhase: rnd(0, 6),
        speed: rnd(95, 120),
      };
      mesh.position.set(x, alt, z);
      targets.push(t);
    }
    hudEls.tgtCount.textContent = TARGET_COUNT;
  }

  function updateTargets(dt) {
    let remaining = 0;
    for (const t of targets) {
      if (!t.alive) continue;
      remaining++;
      const pos = t.mesh.position;
      const pp = player.alive ? player.mesh.position : null;
      const distToPlayer = pp ? pos.distanceTo(pp) : Infinity;

      // decide behavior
      const engaged = pp && distToPlayer < ATTACK_RANGE;
      t.state = engaged ? 'attack' : 'patrol';

      let desired = new V3();
      if (engaged) {
        // chase player but stay within patrol radius
        desired.copy(pp).sub(pos);
      } else {
        // fly patrol circle around anchor
        t.homeAngle += t.orbitDir * t.orbitSpeed * dt;
        const px = t.anchor.x + Math.cos(t.homeAngle) * TARGET_RADIUS;
        const pz = t.anchor.z + Math.sin(t.homeAngle) * TARGET_RADIUS;
        desired.set(px - pos.x, 0, pz - pos.z);
      }
      // leash: if beyond radius, steer hard back toward anchor zone
      const fromAnchor = new V3(pos.x - t.anchor.x, 0, pos.z - t.anchor.z);
      if (fromAnchor.length() > TARGET_RADIUS) {
        const back = fromAnchor.clone().multiplyScalar(-1).normalize().multiplyScalar(3);
        desired.add(back.multiplyScalar(desired.length()));
      }
      desired.normalize();

      // vertical: hold altitude band; attack = match player's alt (min terrain+60)
      const floorY = terrain.heightAt(pos.x, pos.z) + 60;
      const wantY = engaged ? clamp(pp.y, floorY, 900) : clamp(t.altitude, floorY, 900);
      const dy = (wantY - pos.y) * 0.02;
      desired.y = clamp(dy, -0.5, 0.5);
      desired.normalize();

      // steer orientation toward desired
      const curDir = new V3(0, 0, -1).applyQuaternion(t.mesh.quaternion);
      const step = curDir.angleTo(desired);
      const turn = Math.min(step, dt * (engaged ? 1.6 : 0.9));
      if (step > 0.0001) {
        const axis = curDir.clone().cross(desired).normalize();
        t.mesh.quaternion.premultiply(new Q().setFromAxisAngle(axis, turn));
      }

      const spd = engaged ? 130 : t.speed;
      const mv = new V3(0, 0, -1).applyQuaternion(t.mesh.quaternion);
      pos.addScaledVector(mv, spd * dt);
      // enforce leash hard clamp
      const dAnchor = Math.hypot(pos.x - t.anchor.x, pos.z - t.anchor.z);
      if (dAnchor > TARGET_RADIUS * 1.12) {
        const k = (TARGET_RADIUS * 1.12) / dAnchor;
        pos.x = t.anchor.x + (pos.x - t.anchor.x) * k;
        pos.z = t.anchor.z + (pos.z - t.anchor.z) * k;
      }
      // keep above terrain
      const g = terrain.heightAt(pos.x, pos.z) + 45;
      if (pos.y < g) pos.y = lerp(pos.y, g, dt * 3);

      // shoot at player when engaged and facing
      if (engaged && player.alive) {
        t.fireCd -= dt;
        const aim = pp.clone().sub(pos).normalize();
        const face = aim.dot(mv);
        if (t.fireCd <= 0 && face > 0.965 && distToPlayer < ATTACK_RANGE * 0.9) {
          t.fireCd = rnd(0.5, 1.1);
          enemyShoot(t, pos.clone().addScaledVector(mv, 6), aim);
        }
      }
      // blink ID light
      lightPulse(t, dt);
    }
    hudEls.tgtLeft.textContent = 'Remaining Rogues: ' + remaining;
    if (remaining === 0 && state === 'playing') endGame(true);
  }

  function lightPulse(t, dt) {
    t.bobPhase += dt * 4;
    const m = t.mesh.children.find(c => c.material && c.material.color && c.material.color.getHex() === 0xff3333);
    if (m) m.visible = Math.sin(t.bobPhase) > 0;
  }

  function enemyShoot(t, from, dir) {
    const geo = new THREE.SphereGeometry(0.45, 5, 4);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffcf5a }));
    mesh.position.copy(from);
    scene.add(mesh);
    projectiles.push({ type: 'shell', mesh, vel: dir.clone().multiplyScalar(300), ttl: 3.2, dmg: 5, owner: 'rogue' });
  }

  /* ================= PROJECTILE UPDATE ================= */
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.ttl -= dt;
      let dead = pr.ttl <= 0;

      if (pr.type === 'missile') {
        pr.age += dt;
        // acquire target if none yet
        if (!pr.target) pr.target = findSoftTarget(pr.mesh.position, pr.dir);
        // accelerate
        pr.speed = Math.min(pr.speed + dt * 260, pr.cfg.speed);
        if (pr.target && pr.target.alive) {
          const to = pr.target.mesh.position.clone().sub(pr.mesh.position);
          const want = to.clone().normalize();
          // radar-guided: only super-maneuverable while still inside lock cone of its launcher heading? use lock-circle rule:
          let turnRate = pr.cfg.turn;
          if (pr.cfg.onlyWhenLocked) {
            // stays agile only while target remains within 25° lock circle of missile's current view
            const dot = want.dot(pr.dir);
            turnRate = dot > Math.cos(THREE.MathUtils.degToRad(25)) ? 7.5 : 1.2;
          }
          const ang = pr.dir.angleTo(want);
          const stepAng = Math.min(ang, turnRate * dt);
          if (ang > 0.0001) {
            const ax = pr.dir.clone().cross(want).normalize();
            const q = new Q().setFromAxisAngle(ax, stepAng);
            pr.dir.applyQuaternion(q).normalize();
          }
          // proximity fuse
          if (to.length() < 9) { detonate(pr, i); continue; }
        }
        pr.vel.copy(pr.dir).multiplyScalar(pr.speed);
        pr.mesh.position.addScaledVector(pr.vel, dt);
        pr.mesh.lookAt(pr.mesh.position.clone().add(pr.dir));
        // smoke trail
        if (Math.random() < 0.8) puff(pr.mesh.position, 0.55, 0xcccccc, 0.9);
      } else {
        pr.mesh.position.addScaledVector(pr.vel, dt);
        if (pr.type === 'bullet') {
          // slight gravity drop
          pr.vel.y -= 12 * dt;
        }
      }

      // collisions
      if (!dead) {
        if (pr.owner === 'player') {
          for (const t of targets) {
            if (!t.alive) continue;
            if (pr.mesh.position.distanceTo(t.mesh.position) < (pr.type === 'missile' ? 9 : 5.5)) {
              hitTarget(t, pr, i); dead = true; break;
            }
          }
        } else {
          if (player.alive && pr.mesh.position.distanceTo(player.mesh.position) < 5) {
            player.hull -= pr.dmg; flashDamage(); shakeT = Math.max(shakeT, 0.15);
            sparks(pr.mesh.position, 0xff7744, 6);
            dead = true;
          }
        }
        // terrain hit
        if (!dead && pr.mesh.position.y < terrain.heightAt(pr.mesh.position.x, pr.mesh.position.z)) {
          if (pr.type === 'missile') { detonate(pr, i); continue; }
          dead = true;
        }
      }

      if (dead) { scene.remove(pr.mesh); projectiles.splice(i, 1); }
    }
  }

  function hitTarget(t, pr, idx) {
    const dmg = pr.type === 'missile' ? pr.cfg.dmg : pr.dmg;
    t.hull -= dmg;
    sparks(pr.mesh.position, 0xffdd66, pr.type === 'missile' ? 16 : 5);
    if (pr.type === 'missile') { detonateVisual(pr.mesh.position, pr.cfg.blast); scene.remove(pr.mesh); projectiles.splice(idx, 1); }
    else { scene.remove(pr.mesh); projectiles.splice(idx, 1); }
    if (t.hull <= 0) destroyTarget(t);
    updateWeaponHud();
  }

  function detonate(pr, idx) {
    detonateVisual(pr.mesh.position, pr.cfg.blast);
    scene.remove(pr.mesh); projectiles.splice(idx, 1);
    // splash damage on targets
    for (const t of targets) {
      if (!t.alive) continue;
      const d = t.mesh.position.distanceTo(pr.mesh.position);
      if (d < pr.cfg.blast) { t.hull -= pr.cfg.dmg * (1 - d / pr.cfg.blast); if (t.hull <= 0) destroyTarget(t); }
    }
    if (player.alive) {
      const d = player.mesh.position.distanceTo(pr.mesh.position);
      if (d < pr.cfg.blast * 0.7 && pr.owner !== 'player') { player.hull -= 20; flashDamage(); }
    }
  }

  function destroyTarget(t) {
    if (!t.alive) return;
    t.alive = false;
    kills++;
    explode(t.mesh.position, 1.8);
    scene.remove(t.mesh);
    showMsg('✦ ROGUE DESTROYED ✦', 1.4);
    // chance to drop ammo pickup
    if (Math.random() < 0.6) spawnPickup(t.mesh.position.clone());
  }

  /* ================= PICKUPS ================= */
  function spawnPickup(pos) {
    const geo = new THREE.OctahedronGeometry(3.2, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x35d07f, emissive: 0x0a5a2a, flatShading: true }));
    mesh.position.copy(pos);
    scene.add(mesh);
    pickups.push({ mesh, ttl: 30 });
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.ttl -= dt;
      pk.mesh.rotation.y += dt * 2;
      pk.mesh.position.y -= 14 * dt;
      if (player.alive && pk.mesh.position.distanceTo(player.mesh.position) < 14) {
        player.weapons.msl.ammo = Math.min(player.weapons.msl.ammo + 4, player.weapons.msl.ammoMax);
        player.weapons.sp.ammo = Math.min(player.weapons.sp.ammo + 2, player.def.special.ammo);
        player.hull = Math.min(100, player.hull + 15);
        showMsg('+ RESUPPLY', 1.2);
        updateWeaponHud();
        scene.remove(pk.mesh); pickups.splice(i, 1); continue;
      }
      if (pk.ttl <= 0 || pk.mesh.position.y < terrain.heightAt(pk.mesh.position.x, pk.mesh.position.z)) {
        scene.remove(pk.mesh); pickups.splice(i, 1);
      }
    }
  }

  /* ================= PARTICLES ================= */
  // shared geometries/materials — never disposed, so pooled meshes stay reusable
  const sparkGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const bigSparkGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const sparkMats = {};
  function basicMat(color) {
    if (!sparkMats[color]) sparkMats[color] = new THREE.MeshBasicMaterial({ color });
    return sparkMats[color];
  }
  const smokeTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(16, 16, 2, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(cv);
  })();

  function sparks(pos, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, basicMat(color));
      m.position.copy(pos);
      scene.add(m);
      particles.push({ mesh: m, vel: new V3(rnd(-40, 40), rnd(-20, 50), rnd(-40, 40)), ttl: rnd(0.3, 0.8), grav: true });
    }
  }
  function puff(pos, s, color, life) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.5 }));
    m.position.copy(pos); m.scale.set(s, s, 1);
    scene.add(m);
    particles.push({ mesh: m, vel: new V3(rnd(-3, 3), rnd(1, 5), rnd(-3, 3)), ttl: life, fade: true });
  }
  function explode(pos, scale) {
    shakeT = Math.max(shakeT, 0.5 * scale);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(bigSparkGeo, basicMat(i % 3 === 0 ? 0xff5522 : 0xffaa33));
      m.position.copy(pos);
      scene.add(m);
      particles.push({ mesh: m, vel: new V3(rnd(-70, 70), rnd(0, 90), rnd(-70, 70)).multiplyScalar(scale), ttl: rnd(0.5, 1.4), grav: true });
    }
    for (let i = 0; i < 10; i++) puff(pos.clone().add(new V3(rnd(-8, 8), rnd(-4, 10), rnd(-8, 8))), 8 * scale, 0x555555, 2.2);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xffffcc, transparent: true, opacity: 1 }));
    flash.position.copy(pos); flash.scale.set(18 * scale, 18 * scale, 1);
    scene.add(flash);
    particles.push({ mesh: flash, vel: new V3(), ttl: 0.25, fade: true });
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.ttl -= dt;
      if (pt.grav) pt.vel.y -= 60 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.fade) {
        pt.mesh.material.opacity = clamp(pt.ttl * 0.8, 0, 0.55);
        pt.mesh.scale.multiplyScalar(1 + dt * 1.4);
      }
      if (pt.ttl <= 0) { scene.remove(pt.mesh); particles.splice(i, 1); }
    }
  }

  /* ================= CAMERA ================= */
  const camPos = new V3(), camLook = new V3();
  function updateCamera(dt) {
    if (!player) return;
    const behind = new V3(0, 6.5, 22).applyQuaternion(player.quat).add(player.pos);
    // don't put camera through terrain
    const g = terrain.heightAt(behind.x, behind.z) + 4;
    if (behind.y < g) behind.y = g;
    camPos.lerp(behind, 1 - Math.exp(-dt * 4.2));
    camera.position.copy(camPos);
    const lookAt = player.pos.clone().add(new V3(0, 0, -30).applyQuaternion(player.quat));
    camLook.lerp(lookAt, 1 - Math.exp(-dt * 6));
    camera.up.set(0, 1, 0).applyQuaternion(player.quat).lerp(new V3(0, 1, 0), 0.45).normalize();
    camera.lookAt(camLook);
    camera.fov = lerp(camera.fov, 66 + (player.speed / player.def.stats.maxSpeed) * 10, dt * 3);
    camera.updateProjectionMatrix();
    // screen shake
    if (shakeT > 0) {
      shakeT -= dt;
      camera.position.x += rnd(-1, 1) * shakeT * 2.2;
      camera.position.y += rnd(-1, 1) * shakeT * 2.2;
    }
  }

  /* ================= HUD ================= */
  function cacheHud() {
    const id = x => document.getElementById(x);
    hudEls = {
      spdVal: id('spdVal'), altVal: id('altVal'), hdgVal: id('hdgVal'), hullVal: id('hullVal'),
      throttleBar: id('throttleBar'), weaponName: id('weaponName'), weaponCount: id('weaponCount'),
      mgHeat: id('mgHeat'), tgtCount: id('tgtCount'), tgtLeft: id('tgtLeft'), lock: id('lockIndicator'),
      centerMsg: id('centerMsg'), damageFlash: id('damageFlash'), minimap: id('minimap'), hud: id('hud'),
    };
  }
  function updateWeaponHud() {
    if (!player) return;
    const wsel = ['mg', 'msl', 'sp'][weaponIndex];
    if (wsel === 'mg') { hudEls.weaponName.textContent = MG.name; hudEls.weaponCount.textContent = '∞ (heat-limited)'; }
    else if (wsel === 'msl') { hudEls.weaponName.textContent = player.weapons.msl.name; hudEls.weaponCount.textContent = '×' + player.weapons.msl.ammo; }
    else { hudEls.weaponName.textContent = player.weapons.sp.name; hudEls.weaponCount.textContent = '×' + player.weapons.sp.ammo; }
  }
  function updateHud(dt) {
    if (!player) return;
    hudEls.spdVal.textContent = Math.round(player.speed * 3.6);
    hudEls.altVal.textContent = Math.round(player.pos.y);
    const fwd = new V3(0, 0, -1).applyQuaternion(player.quat);
    let hdg = Math.atan2(fwd.x, -fwd.z) * 180 / Math.PI; if (hdg < 0) hdg += 360;
    hudEls.hdgVal.textContent = Math.round(hdg);
    hudEls.hullVal.textContent = Math.max(0, Math.round(player.hull));
    hudEls.hullVal.style.color = player.hull < 30 ? '#ff6b6b' : '#7fffb0';
    hudEls.throttleBar.style.width = (player.throttle * 100) + '%';
    mgHeat = clamp(mgHeat - dt * 0.35, 0, 1);
    hudEls.mgHeat.style.width = (mgHeat * 100) + '%';
    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) hudEls.centerMsg.style.display = 'none'; }
    hudEls.damageFlash.style.opacity = Math.max(0, parseFloat(hudEls.damageFlash.style.opacity || 0) - dt * 2);
    drawMinimap();
  }
  function flashDamage() { hudEls.damageFlash.style.opacity = 0.9; }

  function drawMinimap() {
    const cv = hudEls.minimap, ctx = cv.getContext('2d');
    const S = cv.width, sc = S / (WORLD_LIMIT * 2.2);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0a1a2c'; ctx.fillRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2;
    // patrol zones
    ctx.strokeStyle = '#1f4066';
    for (const t of targets) {
      if (!t.alive) continue;
      ctx.beginPath();
      ctx.arc(cx + t.anchor.x * sc, cy + t.anchor.z * sc, TARGET_RADIUS * sc, 0, Math.PI * 2);
      ctx.stroke();
    }
    // targets
    ctx.fillStyle = '#ff5b5b';
    for (const t of targets) {
      if (!t.alive) continue;
      ctx.beginPath(); ctx.arc(cx + t.mesh.position.x * sc, cy + t.mesh.position.z * sc, 3, 0, Math.PI * 2); ctx.fill();
    }
    // pickups
    ctx.fillStyle = '#35d07f';
    for (const pk of pickups) {
      ctx.fillRect(cx + pk.mesh.position.x * sc - 2, cy + pk.mesh.position.z * sc - 2, 4, 4);
    }
    // player arrow
    if (player) {
      const fwd = new V3(0, 0, -1).applyQuaternion(player.quat);
      const a = Math.atan2(fwd.x, -fwd.z);
      ctx.save();
      ctx.translate(cx + player.pos.x * sc, cy + player.pos.z * sc);
      ctx.rotate(a);
      ctx.fillStyle = '#7fd4ff';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ================= MENU PREVIEW ================= */
  let menuAngle = 0;
  function initMenuPreviews() {
    const wrap = document.getElementById('planes');
    PLANES.forEach(def => {
      const card = document.createElement('div');
      card.className = 'planeCard' + (def === selectedPlane ? ' selected' : '');
      card.innerHTML = `
        <canvas class="preview"></canvas>
        <div class="pname">${def.name}</div>
        <div class="pmodel">${def.model}</div>
        <div class="statRow"><span class="lbl">Speed</span><span class="pips">${pips(def.speed)}</span></div>
        <div class="statRow"><span class="lbl">Maneuver</span><span class="pips">${pips(def.agi)}</span></div>
        <div class="special">${def.special.desc}</div>`;
      card.addEventListener('click', () => {
        selectedPlane = def;
        document.querySelectorAll('.planeCard').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      wrap.appendChild(card);
      const cnv = card.querySelector('canvas');
      def._canvas = cnv;
    });
    initCardRenderers();
  }
  function pips(n) {
    let s = '';
    for (let i = 1; i <= 4; i++) s += `<span class="pip${i <= n ? ' on' : ''}"></span>`;
    return s;
  }
  // one small WebGL renderer per card canvas (cheap: only renders when visible)
  function initCardRenderers() {
    PLANES.forEach(def => {
      const cnv = def._canvas;
      cnv.width = 220; cnv.height = 120;
      const r = new THREE.WebGLRenderer({ canvas: cnv, alpha: true, antialias: true });
      r.setSize(220, 120, false);
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.3));
      const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(5, 8, 6); sc.add(dl);
      const cam = new THREE.PerspectiveCamera(40, 220 / 120, 0.1, 100);
      cam.position.set(0, 4.5, 17);
      cam.lookAt(0, 0, 0);
      const model = def.build();
      model.scale.setScalar(1.35);
      sc.add(model);
      def._card = { renderer: r, scene: sc, camera: cam, model };
    });
  }

  function renderMenuPreviews(dt) {
    if (state !== 'menu') return;
    menuAngle += dt * 0.7;
    PLANES.forEach(def => {
      const c = def._card;
      if (!c) return;
      c.model.rotation.y = menuAngle;
      c.model.rotation.z = Math.sin(menuAngle * 0.6) * 0.12;
      c.renderer.render(c.scene, c.camera);
    });
  }

  /* ================= GAME FLOW ================= */
  // exposed for local debugging/testing; not used by normal gameplay
  window.__dbg = () => ({ THREE, targets, player, projectiles, PLANES });

  function startGame() {
    document.getElementById('menu').style.display = 'none';
    hudEls.hud.style.display = 'block';
    document.getElementById('victory').style.display = 'none';
    document.getElementById('defeat').style.display = 'none';
    // clear old entities
    targets.forEach(t => t.alive && scene.remove(t.mesh));
    targets = []; projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
    particles.forEach(p => scene.remove(p.mesh)); particles = [];
    pickups.forEach(p => scene.remove(p.mesh)); pickups = [];
    if (player) scene.remove(player.mesh);
    kills = 0; startTime = performance.now();
    player = makePlayer(selectedPlane);
    weaponIndex = 0; mgHeat = 0;
    spawnTargets();
    updateWeaponHud();
    state = 'playing';
    showMsg('ENGAGE ALL ROGUE AIRCRAFT', 2.6);
  }

  function endGame(win) {
    state = win ? 'victory' : 'defeat';
    const secs = Math.round((performance.now() - startTime) / 1000);
    const stats = `Kills: ${kills}/${TARGET_COUNT} · Time: ${Math.floor(secs / 60)}m ${secs % 60}s`;
    if (win) {
      document.getElementById('vicStats').textContent = stats;
      document.getElementById('victory').style.display = 'flex';
    } else {
      document.getElementById('deaStats').textContent = stats;
      document.getElementById('defeat').style.display = 'flex';
    }
  }

  /* ================= INPUT ================= */
  function initInput() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      keys[e.code] = true;
      if (state !== 'playing') return;
      if (e.code === 'KeyC') {
        weaponIndex = (weaponIndex + 1) % 3;
        updateWeaponHud();
        const names = ['MG', 'MISSILE', 'SPECIAL'];
        showMsg(names[weaponIndex], 0.8);
      }
      if (e.code === 'KeyH') {
        const hb = document.getElementById('helpBox');
        hb.style.display = hb.style.display === 'none' ? 'block' : 'none';
      }
      if (e.code === 'KeyR' && !player.alive) startGame();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.querySelectorAll('.againBtn').forEach(b => b.addEventListener('click', () => {
      document.getElementById('victory').style.display = 'none';
      document.getElementById('defeat').style.display = 'none';
      document.getElementById('menu').style.display = 'flex';
      state = 'menu';
    }));
  }

  /* ================= MAIN LOOP ================= */
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state === 'menu') {
      renderMenuPreviews(dt);
    } else if (state === 'playing') {
      updatePlayer(dt);
      updateTargets(dt);
      updateProjectiles(dt);
      updatePickups(dt);
      updateParticles(dt);
      updateCamera(dt);
      updateHud(dt);
      sun.position.set(player.pos.x + 600, 900, player.pos.z + 300);
    } else {
      updateParticles(dt);
      if (player && player.alive) updateCamera(dt);
    }
    renderer.render(scene, camera);
  }

  /* ================= BOOT ================= */
  cacheHud();
  initScene();
  initMenuPreviews();
  initInput();
})();
