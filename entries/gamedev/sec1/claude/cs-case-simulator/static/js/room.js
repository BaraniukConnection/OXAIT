// The old storage room: walls, floor, shelving, crates, desk with PC (right),
// workbench with case rack (left) and a showcase wall (front).
import * as THREE from 'three';
import {
  makeConcrete, makeBrick, makeWood, makeCardboard, makeMetal, makeDustSprite, makePoster, rng,
} from './textures.js';

export const ROOM = { minX: -2.8, maxX: 2.8, minZ: -4.4, maxZ: 3.0, height: 3.6 };

function box(w, h, d, mat, x, y, z, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

export function buildRoom(scene) {
  const R = ROOM, W = R.maxX - R.minX, D = R.maxZ - R.minZ, H = R.height;
  const refs = {};

  // ---------------- materials
  const floorMat = new THREE.MeshStandardMaterial({ ...makeConcrete(4, 6, 7, [112, 108, 100]), roughness: 0.92, bumpScale: 1.5 });
  const wallMat = new THREE.MeshStandardMaterial({ ...makeBrick(3, 1.6), roughness: 0.95, bumpScale: 2 });
  const wallMatSide = new THREE.MeshStandardMaterial({ ...makeBrick(4.5, 1.6), roughness: 0.95, bumpScale: 2 });
  const ceilMat = new THREE.MeshStandardMaterial({ ...makeConcrete(3, 4, 99, [80, 80, 82]), roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ ...makeWood(1, 1, [150, 105, 62], 4, 5), roughness: 0.8 });
  const crateWood = new THREE.MeshStandardMaterial({ ...makeWood(1, 1, [128, 98, 58], 5, 8), roughness: 0.9 });
  const darkWood = new THREE.MeshStandardMaterial({ ...makeWood(1, 1, [90, 62, 40], 6, 12), roughness: 0.75 });
  const steel = new THREE.MeshStandardMaterial({ map: makeMetal([92, 98, 104], 0.35, 4), roughness: 0.55, metalness: 0.7 });
  const greenSteel = new THREE.MeshStandardMaterial({ map: makeMetal([60, 84, 64], 0.45, 6), roughness: 0.6, metalness: 0.6 });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5, metalness: 0.2 });

  // ---------------- shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((R.minX + R.maxX) / 2, 0, (R.minZ + R.maxZ) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(floor.position.x, H, floor.position.z);
  scene.add(ceil);

  const wall = (w, mat, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat);
    m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true;
    scene.add(m);
  };
  wall(W, wallMat, 0, R.minZ, 0);
  wall(W, wallMat, 0, R.maxZ, Math.PI);
  wall(D, wallMatSide, R.minX, floor.position.z, Math.PI / 2);
  wall(D, wallMatSide, R.maxX, floor.position.z, -Math.PI / 2);

  // ceiling beams & pipes
  for (let z = R.minZ + 1; z < R.maxZ; z += 2.1) scene.add(box(W, 0.22, 0.18, darkWood, 0, H - 0.11, z, { cast: false }));
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6d5a48, roughness: 0.6, metalness: 0.6 });
  for (const [x, r] of [[-1.9, 0.06], [-1.6, 0.04], [1.4, 0.08]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, D, 12), pipeMat);
    p.rotation.x = Math.PI / 2; p.position.set(x, H - 0.35, floor.position.z);
    scene.add(p);
  }
  // baseboard stripe
  const stripe = new THREE.MeshStandardMaterial({ color: 0x5a6a52, roughness: 0.9 });
  scene.add(box(W, 0.9, 0.02, stripe, 0, 0.45, R.minZ + 0.011, { cast: false }));

  // ---------------- props: shelving with boxes
  const shelfUnit = (x, z, ry, seed) => {
    const g = new THREE.Group(), r = rng(seed);
    const w = 1.8, d = 0.55, h = 2.4;
    for (const sx of [-w / 2, w / 2]) for (const sz of [-d / 2, d / 2]) g.add(box(0.05, h, 0.05, greenSteel, sx, h / 2, sz));
    for (const y of [0.15, 0.8, 1.45, 2.1]) {
      g.add(box(w, 0.04, d, greenSteel, 0, y, 0));
      let cx = -w / 2 + 0.05;
      while (cx < w / 2 - 0.3) {
        const bw = 0.3 + r() * 0.35, bh = 0.2 + r() * 0.35, bd = 0.3 + r() * 0.2;
        if (cx + bw > w / 2 - 0.05) break;
        if (r() < 0.82) {
          const lbl = ['AMMO', 'PARTS', 'FRAGILE', 'MISC', 'CASES', '7.62', '5.56', 'SPARE'][(r() * 8) | 0];
          const m = box(bw, bh, bd, new THREE.MeshStandardMaterial({ map: makeCardboard(r() < 0.6 ? lbl : null), roughness: 0.95 }), cx + bw / 2, y + 0.02 + bh / 2, (r() - 0.5) * 0.08);
          m.rotation.y = (r() - 0.5) * 0.15;
          g.add(m);
        }
        cx += bw + 0.03 + r() * 0.08;
      }
    }
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g);
  };
  shelfUnit(R.minX + 0.32, -2.9, Math.PI / 2, 1);
  shelfUnit(R.maxX - 0.32, -2.9, -Math.PI / 2, 2);
  shelfUnit(-1.5, R.maxZ - 0.32, Math.PI, 3);

  // crates
  const crate = (s, x, y, z, ry) => {
    const g = new THREE.Group();
    g.add(box(s, s, s, crateWood, 0, 0, 0));
    for (const e of [-1, 1]) for (const f of [-1, 1]) {
      g.add(box(s + 0.02, 0.07, 0.07, darkWood, 0, e * (s / 2 - 0.035), f * (s / 2 - 0.035)));
      g.add(box(0.07, s + 0.02, 0.07, darkWood, e * (s / 2 - 0.035), 0, f * (s / 2 - 0.035)));
    }
    g.position.set(x, y + s / 2, z); g.rotation.y = ry;
    g.traverse(o => { o.castShadow = o.receiveShadow = true; });
    scene.add(g);
  };
  crate(0.8, -2.2, 0, -3.8, 0.1);
  crate(0.6, -2.25, 0.8, -3.75, -0.2);
  crate(0.7, 2.25, 0, -3.85, 0.05);
  crate(0.7, 1.4, 0, 2.4, 0.3);
  crate(0.55, 2.3, 0, 2.3, -0.1);
  crate(0.5, 1.45, 0.7, 2.35, 0.15);

  // barrels
  const barrelMat = new THREE.MeshStandardMaterial({ map: makeMetal([110, 40, 30], 0.6, 13), roughness: 0.6, metalness: 0.5 });
  const barrelMat2 = new THREE.MeshStandardMaterial({ map: makeMetal([40, 70, 110], 0.5, 17), roughness: 0.6, metalness: 0.5 });
  const barrel = (x, z, mat) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 24), mat);
    b.position.set(x, 0.44, z); b.castShadow = b.receiveShadow = true;
    scene.add(b);
    for (const y of [0.2, 0.68]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.302, 0.015, 6, 24), steel);
      ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z);
      scene.add(ring);
    }
  };
  barrel(1.75, -4.0, barrelMat);
  barrel(-1.45, -4.05, barrelMat2);
  barrel(-2.35, 2.45, barrelMat);

  // pallet on floor
  const pallet = new THREE.Group();
  for (let i = 0; i < 5; i++) pallet.add(box(1.0, 0.025, 0.14, crateWood, 0, 0.13, -0.5 + i * 0.25));
  for (const z of [-0.45, 0, 0.45]) pallet.add(box(1.0, 0.1, 0.1, crateWood, 0, 0.06, z));
  pallet.position.set(-0.4, 0, 2.4); pallet.rotation.y = 0.2;
  scene.add(pallet);

  // posters
  const poster = (lines, x, y, z, ry, bg) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ map: makePoster(lines, bg), roughness: 0.9 }));
    m.position.set(x, y, z); m.rotation.y = ry; m.rotation.z = (Math.random() - 0.5) * 0.06;
    scene.add(m);
  };
  poster(['NO', 'SMOKING', 'IN THE', 'STORAGE'], 2.0, 2.3, R.minZ + 0.02, 0);
  poster(['ARMS', 'DEAL', 'CASES', 'IN STOCK', 'DAILY'], -2.0, 2.3, R.minZ + 0.02, 0, '#c8d0b8');
  poster(['KEEP', 'OUT', 'AUTH', 'ONLY'], R.maxX - 0.02, 2.2, 1.5, -Math.PI / 2, '#d8c8a8');

  // ---------------- RIGHT: desk with PC
  const desk = new THREE.Group();
  const deskX = R.maxX - 0.42, deskZ = 0.6;
  desk.add(box(0.8, 0.05, 1.7, wood, 0, 0.76, 0));
  for (const sx of [-0.35, 0.35]) for (const sz of [-0.8, 0.8]) desk.add(box(0.05, 0.74, 0.05, steel, sx, 0.37, sz));
  desk.add(box(0.7, 0.4, 0.02, steel, 0.0, 0.5, -0.79));
  desk.position.set(deskX, 0, deskZ);
  scene.add(desk);
  // PC tower under desk
  const tower = box(0.45, 0.46, 0.2, blackPlastic, deskX + 0.05, 0.24, deskZ + 0.55);
  scene.add(tower);
  const towerLed = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.3), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  towerLed.position.set(deskX - 0.175, 0.26, deskZ + 0.45); towerLed.rotation.y = -Math.PI / 2;
  scene.add(towerLed);
  // keyboard + mouse
  const kb = box(0.16, 0.02, 0.45, blackPlastic, deskX - 0.2, 0.795, deskZ);
  scene.add(kb);
  const kbGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.35 }));
  kbGlow.rotation.x = -Math.PI / 2; kbGlow.rotation.z = Math.PI / 2;
  kbGlow.position.set(deskX - 0.2, 0.807, deskZ);
  scene.add(kbGlow);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 8), blackPlastic);
  mouse.scale.set(1.5, 0.6, 1); mouse.position.set(deskX - 0.2, 0.795, deskZ - 0.38);
  scene.add(mouse);
  // mug & papers
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xa83232, roughness: 0.4 }));
  mug.position.set(deskX - 0.05, 0.835, deskZ + 0.62);
  scene.add(mug);

  // monitor (screen faces -X, toward the player)
  const SW = 0.72, SH = 0.45;
  const mon = new THREE.Group();
  mon.add(box(0.04, SH + 0.05, SW + 0.05, blackPlastic, 0.0, 0, 0));
  mon.add(box(0.05, 0.3, 0.06, blackPlastic, 0.05, -0.32, 0));
  mon.add(box(0.2, 0.015, 0.26, blackPlastic, 0.05, -0.47, 0));
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1280; screenCanvas.height = 800;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(-0.0215, 0, 0); screen.rotation.y = -Math.PI / 2;
  mon.add(screen);
  mon.position.set(deskX + 0.15, 0.785 + 0.48, deskZ - 0.05);
  mon.rotation.y = 0.12; // angle slightly toward the room centre
  scene.add(mon);
  mon.traverse(o => { if (o !== screen) { o.castShadow = true; } });
  const monLight = new THREE.PointLight(0x5aa0ff, 1.6, 3.5, 2);
  monLight.position.set(deskX - 0.35, 1.25, deskZ);
  scene.add(monLight);
  refs.monitor = { group: mon, screen, screenCanvas, screenTex, width: SW, height: SH, light: monLight };

  // desk lamp
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 16), blackPlastic);
  lampBase.position.set(deskX + 0.2, 0.795, deskZ + 0.7); scene.add(lampBase);
  const arm = box(0.015, 0.4, 0.015, blackPlastic, deskX + 0.2, 0.99, deskZ + 0.7); scene.add(arm);

  // ---------------- LEFT: workbench + case rack
  const benchX = R.minX + 0.48, benchZ = 0.6, benchTop = 0.9;
  const bench = new THREE.Group();
  bench.add(box(0.95, 0.07, 2.6, darkWood, 0, benchTop - 0.035, 0));
  for (const sx of [-0.4, 0.4]) for (const sz of [-1.2, 1.2]) bench.add(box(0.08, benchTop - 0.07, 0.08, steel, sx, (benchTop - 0.07) / 2, sz));
  bench.add(box(0.85, 0.03, 2.4, darkWood, 0, 0.18, 0));
  bench.position.set(benchX, 0, benchZ);
  scene.add(bench);
  // rubber opening mat
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.85), new THREE.MeshStandardMaterial({ color: 0x1d2a22, roughness: 0.95 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(benchX + 0.2, benchTop + 0.002, benchZ);
  mat.receiveShadow = true;
  scene.add(mat);
  refs.openSpot = new THREE.Vector3(benchX + 0.2, benchTop + 0.004, benchZ);

  // rack shelves on the wall above/behind the bench: 2 rows x 3 slots
  const rack = new THREE.Group();
  const rackX = R.minX + 0.22;
  const rows = [1.2, 1.72];
  for (const y of rows) rack.add(box(0.42, 0.035, 2.6, steel, rackX, y, benchZ));
  for (const z of [-1.25, 1.25]) for (const y of rows) rack.add(box(0.42, 0.04, 0.04, steel, rackX, y - 0.05, benchZ + z));
  for (const z of [-1.28, 0, 1.28]) rack.add(box(0.03, 1.2, 0.04, steel, R.minX + 0.03, 1.5, benchZ + z));
  scene.add(rack);
  refs.caseSlots = [];
  const slotZ = [0.82, 0, -0.82]; // left -> right as seen from the room
  // LED strips under each shelf so the cases read well
  for (const y of rows) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 2.4), new THREE.MeshBasicMaterial({ color: 0xffe6b0 }));
    led.position.set(rackX + 0.17, y - 0.03, benchZ);
    rack.add(led);
    const l = new THREE.PointLight(0xffd9a0, 1.4, 1.6, 1.6);
    l.position.set(rackX + 0.3, y - 0.08, benchZ);
    scene.add(l);
  }
  ['assault', 'pistol', 'smg', 'shotgun', 'lmg', 'legendary'].forEach((id, i) => {
    const y = rows[1 - Math.floor(i / 3)] + 0.018, z = benchZ + slotZ[i % 3];
    const anchor = new THREE.Group();
    anchor.position.set(rackX, y, z);
    scene.add(anchor);
    refs.caseSlots.push({ caseId: id, anchor });
  });

  // ---------------- FRONT: showcase pegboard
  const pegMat = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.9 });
  const board = box(3.6, 1.5, 0.04, pegMat, 0, 1.75, R.minZ + 0.04, { cast: false });
  scene.add(board);
  const frameMat = darkWood;
  scene.add(box(3.7, 0.06, 0.07, frameMat, 0, 2.52, R.minZ + 0.06));
  scene.add(box(3.7, 0.06, 0.07, frameMat, 0, 0.98, R.minZ + 0.06));
  const header = document.createElement('canvas'); header.width = 512; header.height = 64;
  const hctx = header.getContext('2d');
  hctx.fillStyle = '#1b1712'; hctx.fillRect(0, 0, 512, 64);
  hctx.fillStyle = '#e4ae39'; hctx.font = 'bold 40px Impact, sans-serif'; hctx.textAlign = 'center';
  hctx.fillText('★ HALL OF DROPS ★', 256, 48);
  const headerTex = new THREE.CanvasTexture(header); headerTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshStandardMaterial({ map: headerTex, emissive: 0xffffff, emissiveMap: headerTex, emissiveIntensity: 0.4 }));
  sign.position.set(0, 2.72, R.minZ + 0.05);
  scene.add(sign);
  refs.showcase = { anchor: new THREE.Group(), z: R.minZ + 0.14, y0: 1.75 };
  scene.add(refs.showcase.anchor);

  // ---------------- lights
  scene.add(new THREE.HemisphereLight(0x8a96a8, 0x2a2218, 0.55));
  scene.add(new THREE.AmbientLight(0x404650, 0.35));

  const bulb = (x, y, z, color, intensity, shadow) => {
    const g = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, H - y, 6), blackPlastic);
    cord.position.y = (H - y) / 2; g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f3a33, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }));
    shade.position.y = 0.02; g.add(shade);
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 8), new THREE.MeshBasicMaterial({ color: 0xfff1cc }));
    bulbMesh.position.y = -0.05; g.add(bulbMesh);
    const light = new THREE.PointLight(color, intensity, 9, 1.6);
    light.position.y = -0.08;
    if (shadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.002;
      light.shadow.radius = 4;
    }
    g.add(light);
    g.position.set(x, y, z);
    scene.add(g);
    return { light, bulbMesh, base: intensity };
  };
  refs.lamps = [
    bulb(0, 2.75, 0.4, 0xffd7a0, 9, true),
    bulb(0, 2.85, -2.6, 0xffd7a0, 6, false),
  ];

  // bench work-light (spot)
  const benchSpot = new THREE.SpotLight(0xffe2b8, 18, 4, Math.PI / 5, 0.5, 1.4);
  benchSpot.position.set(benchX + 0.5, 2.6, benchZ);
  benchSpot.target.position.copy(refs.openSpot);
  benchSpot.castShadow = true;
  benchSpot.shadow.mapSize.set(1024, 1024);
  benchSpot.shadow.bias = -0.0015;
  scene.add(benchSpot, benchSpot.target);
  const fixture = box(0.25, 0.06, 0.5, steel, benchX + 0.5, 2.63, benchZ, { cast: false });
  scene.add(fixture);
  refs.benchSpot = benchSpot;

  // showcase spot
  const showSpot = new THREE.SpotLight(0xfff0d8, 22, 7, Math.PI / 6, 0.6, 1.2);
  showSpot.position.set(0, H - 0.2, R.minZ + 2.2);
  showSpot.target.position.set(0, 1.75, R.minZ);
  scene.add(showSpot, showSpot.target);

  // flickering fluorescent tube near the back
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xdff4ff });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8), tubeMat);
  tube.rotation.z = Math.PI / 2; tube.position.set(0.5, H - 0.12, 2.0);
  scene.add(tube);
  const tubeLight = new THREE.PointLight(0xcfe8ff, 3, 6, 1.8);
  tubeLight.position.set(0.5, H - 0.3, 2.0);
  scene.add(tubeLight);
  refs.tube = { mesh: tube, light: tubeLight, mat: tubeMat };

  // dust particles in the air
  const N = 600, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = R.minX + Math.random() * W;
    pos[i * 3 + 1] = Math.random() * H;
    pos[i * 3 + 2] = R.minZ + Math.random() * D;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.018, map: makeDustSprite(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe8c8,
  }));
  scene.add(dust);
  refs.dust = dust;

  return refs;
}

/** Per-frame ambience: dust drift, light flicker. */
export function animateRoom(refs, t, dt) {
  const p = refs.dust.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i) - dt * 0.02 * (0.5 + (i % 7) / 7);
    if (y < 0) y = ROOM.height;
    p.setY(i, y);
    p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.01);
  }
  p.needsUpdate = true;

  // the tube flickers in bursts
  const burst = Math.sin(t * 0.7) > 0.93 || Math.sin(t * 1.9 + 1) > 0.985;
  const on = !burst || Math.random() > 0.5;
  refs.tube.light.intensity = on ? 3 : 0.2;
  refs.tube.mat.color.setHex(on ? 0xdff4ff : 0x445058);

  // ceiling bulbs: subtle mains wobble
  refs.lamps.forEach((l, i) => {
    l.light.intensity = l.base * (0.97 + Math.sin(t * 9 + i) * 0.02 + Math.random() * 0.02);
  });
}
