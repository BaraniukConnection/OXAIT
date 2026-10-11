/* =========================================================
   ROGUE SKIES — low-poly terrain: forest + mountains
   Provides: Terrain.create(scene) -> { mesh, heightAt(x,z), size }
   Analytic heightfield so collision is exact & cheap.
   ========================================================= */
(function () {
  const SIZE = 4000;          // world extends -2000..2000
  const SEG  = 160;           // grid resolution (low-poly look)

  // deterministic pseudo-random hills
  function hash(n) { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); }
  function noise2(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const a = hash(xi * 157.13 + zi * 113.7);
    const b = hash((xi + 1) * 157.13 + zi * 113.7);
    const c = hash(xi * 157.13 + (zi + 1) * 113.7);
    const d = hash((xi + 1) * 157.13 + (zi + 1) * 113.7);
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // mountain peaks placed on a coarse lattice
  const PEAKS = [];
  for (let i = 0; i < 26; i++) {
    const gx = (hash(i * 3.11) - 0.5) * SIZE * 0.92;
    const gz = (hash(i * 7.77 + 3.3) - 0.5) * SIZE * 0.92;
    if (Math.hypot(gx, gz) < 550) continue;             // keep spawn area clear
    PEAKS.push({ x: gx, z: gz, r: 260 + hash(i * 9.1) * 340, h: 240 + hash(i * 5.5) * 430 });
  }

  function heightAt(x, z) {
    let h = 0;
    // rolling base
    h += (noise2(x / 260, z / 260) - 0.5) * 90;
    h += (noise2(x / 90 + 40, z / 90 + 40) - 0.5) * 26;
    // mountains
    for (const p of PEAKS) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r) {
        const t = 1 - d / p.r;
        h += p.h * (t * t * (3 - 2 * t));               // smooth cone
      }
    }
    // rim walls at map border
    const edge = Math.max(Math.abs(x), Math.abs(z));
    if (edge > SIZE * 0.46) {
      const t = (edge - SIZE * 0.46) / (SIZE * 0.04);
      h += t * t * 500;
    }
    return h;
  }

  function create(scene) {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const cLowGrass = new THREE.Color(0x3f7d3a);
    const cGrass    = new THREE.Color(0x4e9c42);
    const cForest   = new THREE.Color(0x2c5e2e);
    const cRock     = new THREE.Color(0x7a746a);
    const cSnow     = new THREE.Color(0xf2f5fa);
    const cSand     = new THREE.Color(0xb9a06a);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      // color by altitude with slight variation
      const v = hash(i * 1.37) * 0.10;
      if (h > 430)       tmp.copy(cSnow);
      else if (h > 300)  tmp.copy(cRock).lerp(cSnow, (h - 300) / 130);
      else if (h > 150)  tmp.copy(cForest).lerp(cRock, (h - 150) / 150);
      else if (h > 30)   tmp.copy(hash(i * 2.9) > 0.5 ? cForest : cGrass);
      else if (h > -6)   tmp.copy(cLowGrass);
      else               tmp.copy(cSand);
      tmp.offsetHSL(0, 0, v - 0.05);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'terrain';
    scene.add(mesh);

    // ---- trees (cones + trunk), instanced-ish via merged groups ----
    const trunkGeo = new THREE.CylinderGeometry(1.4, 2.2, 9, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f, flatShading: true });
    const leafGeo  = new THREE.ConeGeometry(9, 24, 6);
    const leafMats = [0x2f6b2f, 0x3a7d3a, 0x27592b].map(c =>
      new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
    const treeGroup = new THREE.Group();
    let placed = 0, tries = 0;
    while (placed < 420 && tries < 6000) {
      tries++;
      const x = (hash(tries * 12.9898) - 0.5) * SIZE * 0.94;
      const z = (hash(tries * 78.233 + 7) - 0.5) * SIZE * 0.94;
      const h = heightAt(x, z);
      if (h < 5 || h > 160) continue;                    // only in forest belt
      const s = 0.7 + hash(tries * 3.7) * 0.9;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      const leaves = new THREE.Mesh(leafGeo, leafMats[Math.floor(hash(tries * 5.1) * 3)]);
      trunk.scale.setScalar(s); leaves.scale.setScalar(s);
      trunk.position.set(x, h + 4.5 * s, z);
      leaves.position.set(x, h + (9 + 12) * s, z);
      treeGroup.add(trunk, leaves);
      placed++;
    }
    scene.add(treeGroup);

    // rocks on high slopes
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a857c, flatShading: true });
    for (let i = 0; i < 60; i++) {
      const x = (hash(i * 4.51 + 90) - 0.5) * SIZE * 0.9;
      const z = (hash(i * 8.33 + 17) - 0.5) * SIZE * 0.9;
      const h = heightAt(x, z);
      if (h < 180) continue;
      const r = new THREE.Mesh(rockGeo, rockMat);
      const s = 6 + hash(i * 2.2) * 16;
      r.scale.set(s, s * 0.7, s);
      r.position.set(x, h + s * 0.25, z);
      r.rotation.set(hash(i), hash(i * 3), hash(i * 7));
      scene.add(r);
    }

    return { mesh, heightAt, size: SIZE };
  }

  window.Terrain = { create, heightAt, SIZE };
})();
