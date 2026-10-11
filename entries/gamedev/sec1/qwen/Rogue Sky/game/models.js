/* =========================================================
   ROGUE SKIES — low-poly aircraft models (built from prims)
   All models face -Z forward (three.js convention), +Y up.
   Exposes: Models.buildSu57(colors), Models.planes, Models.targetColors
   ========================================================= */
(function () {
  const M = THREE.MathUtils;

  function mat(color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts || {}));
  }
  // mirrored extruded polygon wing in XZ plane, thin along Y
  function polyWing(points, thickness, material, mirrorX) {
    const shape = new THREE.Shape();
    points.forEach((p, i) => i === 0 ? shape.moveTo(p[0], p[1]) : shape.lineTo(p[0], p[1]));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);            // XY -> XZ
    const mesh = new THREE.Mesh(geo, material);
    if (mirrorX) mesh.scale.x = -1;
    return mesh;
  }

  /* ---------- generic fighter body ---------- */
  function fuselage(len, noseR, midR, tailR, bodyMat, canopyMat, cfg) {
    const g = new THREE.Group();

    // main body: stacked cylinders give faceted low-poly look
    const segs = 7;
    const bodyGeo = new THREE.CylinderGeometry(noseR, tailR, len * 0.86, segs);
    bodyGeo.rotateX(Math.PI / 2);        // along Z
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.z = len * 0.04;
    g.add(body);

    // nose cone
    const noseGeo = new THREE.ConeGeometry(noseR, len * 0.3, segs);
    noseGeo.rotateX(-Math.PI / 2);       // point toward -Z
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.z = -len * 0.575;
    g.add(nose);

    // tail cone
    const tcGeo = new THREE.ConeGeometry(tailR, len * 0.22, segs);
    tcGeo.rotateX(Math.PI / 2);
    const tc = new THREE.Mesh(tcGeo, bodyMat);
    tc.position.z = len * 0.52;
    g.add(tc);

    // canopy
    if (canopyMat) {
      const cg = new THREE.SphereGeometry(midR * 1.05, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      cg.scale(1, 0.85, 2.6);
      const canopy = new THREE.Mesh(cg, canopyMat);
      canopy.position.set(0, noseR * 0.75, -len * 0.22);
      g.add(canopy);
    }
    return g;
  }

  /* ---------- Su-57 style "Rogue" target ---------- */
  function buildSu57(col) {
    const colr = col || { body: 0x5d6b7c, dark: 0x414c59, accent: 0x2f3a46 };
    const bodyMat = mat(colr.body), darkMat = mat(colr.dark), accMat = mat(colr.accent);
    const g = new THREE.Group();
    const L = 10;

    g.add(fuselage(L, 1.0, 1.35, 1.1, bodyMat, mat(0x1c2733, { emissive: 0x0a1520 }), null));

    // main swept wings (diamond / lifted-body look) — +X = starboard
    const wingPts = [[0.6, 3.2], [4.6, 0.4], [5.0, -1.6], [1.2, -3.4]];
    const wR = polyWing(wingPts, 0.34, bodyMat); wR.position.set(0, -0.15, 0.6); g.add(wR);
    const wL = polyWing(wingPts, 0.34, bodyMat, true); wL.position.set(0, -0.15, 0.6); g.add(wL);

    // wingtip fences
    [[1, 0], [-1, 1]].forEach(([sx]) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 2.2), accMat);
      f.position.set(sx * 4.7, 0.3, 1.9); f.rotation.y = sx * -0.35; g.add(f);
    });

    // all-moving stabilizers (+X = starboard)
    const stPts = [[0.5, 1.6], [3.0, 0.2], [2.6, -1.2], [0.5, -1.4]];
    const sR = polyWing(stPts, 0.28, darkMat); sR.position.set(0, 0.1, 4.6); g.add(sR);
    const sL = polyWing(stPts, 0.28, darkMat, true); sL.position.set(0, 0.1, 4.6); g.add(sL);

    // twin canted vertical tails
    [-1, 1].forEach(sx => {
      const vt = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 3.0), darkMat);
      vt.position.set(sx * 1.5, 1.5, 4.6);
      vt.rotation.z = sx * 0.42; vt.rotation.x = -0.15;
      g.add(vt);
    });

    // engine nacelles + nozzles
    [-1, 1].forEach(sx => {
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 5.2, 6), darkMat);
      nac.rotation.x = Math.PI / 2;
      nac.position.set(sx * 1.25, -0.25, 3.0);
      g.add(nac);
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.9, 6), mat(0x222831));
      noz.rotation.x = Math.PI / 2;
      noz.position.set(sx * 1.25, -0.25, 5.6);
      g.add(noz);
    });

    // leading edge root extensions
    [-1, 1].forEach(sx => {
      const lerp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 4.2), bodyMat);
      lerp.position.set(sx * 1.7, 0.1, -1.2); lerp.rotation.y = sx * 0.5;
      g.add(lerp);
    });

    g.userData.engines = []; // afterburner anchors
    [-1, 1].forEach(sx => {
      const a = new THREE.Object3D(); a.position.set(sx * 1.25, -0.25, 6.0); g.add(a);
      g.userData.engines.push(a);
    });
    const noseAnchor = new THREE.Object3D(); noseAnchor.position.set(0, 0, -6.2); g.add(noseAnchor);
    g.userData.nose = noseAnchor;
    // gun muzzles (needed by any model used as player plane, e.g. Falcon/Su-27)
    g.userData.muzzles = [];
    [-1, 1].forEach(sx => {
      const m = new THREE.Object3D(); m.position.set(sx * 0.9, -0.4, -5.8); g.add(m);
      g.userData.muzzles.push(m);
    });
    return g;
  }

  /* ---------- player planes ---------- */

  // EF Typhoon-ish  ("Thunder")
  function buildTyphoon() {
    const bodyMat = mat(0x9aa7b5), darkMat = mat(0x6b7684);
    const g = new THREE.Group(); const L = 9;
    g.add(fuselage(L, 0.95, 1.2, 0.95, bodyMat, mat(0x2a4a66, { emissive: 0x0c1c28 })));

    // cropped-delta canards (shape points use +X = starboard convention)
    const canPts = [[0.5, 1.0], [2.4, 0.2], [2.2, -0.7], [0.5, -0.8]];
    [-1, 1].forEach(sx => {
      const c = polyWing(canPts, 0.22, darkMat, sx < 0);
      c.position.set(0, 0.35, -3.4); g.add(c);
    });
    // deep delta main wings
    const wingPts = [[0.7, 2.6], [4.4, -0.6], [4.0, -2.6], [0.8, -2.8]];
    [-1, 1].forEach(sx => {
      const w = polyWing(wingPts, 0.34, bodyMat, sx < 0);
      w.position.set(0, -0.1, 0.4); g.add(w);
    });
    // single tall tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.9, 2.6), darkMat);
    tail.position.set(0, 1.6, 4.0); tail.rotation.x = -0.18; g.add(tail);
    // intakes under wings
    [-1, 1].forEach(sx => {
      const q = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 3.2), darkMat);
      q.position.set(sx * 1.7, -0.75, -0.6); g.add(q);
    });
    finishCommon(g, 5.2, 1.1);
    return g;
  }

  // Gryphen — fictional twin-engine strike fighter ("Vulture")
  function buildGryphen() {
    const bodyMat = mat(0x8f9a88), darkMat = mat(0x5c665a);
    const g = new THREE.Group(); const L = 10;
    g.add(fuselage(L, 1.0, 1.3, 1.0, bodyMat, mat(0x33475a, { emissive: 0x0c1c28 })));
    // high-mounted trapezoid wings with anhedral (+X = starboard)
    const wingPts = [[0.8, 2.2], [4.8, 0.6], [4.6, -1.8], [0.9, -2.6]];
    [-1, 1].forEach(sx => {
      const w = polyWing(wingPts, 0.36, bodyMat, sx < 0);
      w.position.set(0, 0.55, 0.2); w.rotation.z = sx * 0.12; g.add(w);
    });
    // big stabilators
    const stPts = [[0.6, 1.8], [3.4, 0.3], [3.2, -1.4], [0.6, -1.6]];
    [-1, 1].forEach(sx => {
      const s = polyWing(stPts, 0.28, darkMat, sx < 0);
      s.position.set(0, 0.4, 4.4); g.add(s);
    });
    // twin fins
    [-1, 1].forEach(sx => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 2.4), darkMat);
      f.position.set(sx * 1.9, 1.6, 4.2); f.rotation.z = sx * 0.2; g.add(f);
    });
    // side intakes
    [-1, 1].forEach(sx => {
      const q = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 3.4), darkMat);
      q.position.set(sx * 1.55, -0.35, 0.4); g.add(q);
    });
    finishCommon(g, 5.6, 1.3);
    return g;
  }

  // Su-27 in Ukrainian colors ("Falcon")
  function buildSu27UA() {
    const blue = mat(0x2b6cc4), yellow = mat(0xf2d24a), grey = mat(0x7d8fa3);
    const g = buildSu57({ body: 0x2b6cc4, dark: 0x1e4e93, accent: 0xf2d24a });
    // repaint: add yellow stripe box on spine + blue tails already; overlay cross
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 7), yellow);
    stripe.position.set(0, 1.05, 0.8); g.add(stripe);
    // Ukrainian flag patch on fin tips
    [-1, 1].forEach(sx => {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8),
        new THREE.MeshBasicMaterial({ color: 0xf2d24a }));
      fl.position.set(sx * 1.9, 2.3, 4.7); fl.rotation.y = sx * Math.PI / 2; g.add(fl);
    });
    g.scale.setScalar(1.02);
    return g;
  }

  // F-22 style ("Shadow") dark stealth
  function buildF22() {
    const bodyMat = mat(0x4b5563), darkMat = mat(0x2f3742);
    const g = new THREE.Group(); const L = 9.6;
    g.add(fuselage(L, 0.95, 1.25, 0.9, bodyMat, mat(0x141c26, { emissive: 0x0a121c })));
    // diamond wings (+X = starboard)
    const wingPts = [[0.8, 3.0], [4.9, 0.2], [4.6, -2.0], [0.9, -3.0]];
    [-1, 1].forEach(sx => {
      const w = polyWing(wingPts, 0.32, bodyMat, sx < 0);
      w.position.set(0, -0.05, 0.6); g.add(w);
    });
    // canted twin tails
    [-1, 1].forEach(sx => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.3, 2.4), darkMat);
      f.position.set(sx * 1.7, 1.3, 4.3); f.rotation.z = sx * 0.55; g.add(f);
    });
    // horizontal stabs (+X = starboard)
    const stPts = [[0.6, 1.6], [3.1, 0.2], [2.9, -1.2], [0.6, -1.4]];
    [-1, 1].forEach(sx => {
      const s = polyWing(stPts, 0.26, darkMat, sx < 0);
      s.position.set(0, 0.15, 4.5); g.add(s);
    });
    // thrust-vectoring nozzles glow rings
    [-1, 1].forEach(sx => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.5, 6), mat(0x1a1f28));
      ring.rotation.x = Math.PI / 2; ring.position.set(sx * 1.15, -0.15, 5.35); g.add(ring);
    });
    // chine edges
    [-1, 1].forEach(sx => {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 6), darkMat);
      ch.position.set(sx * 1.15, 0.15, -0.4); ch.rotation.z = sx * 0.3; g.add(ch);
    });
    finishCommon(g, 5.4, 1.2);
    return g;
  }

  function finishCommon(g, engZ, engX) {
    g.userData.engines = [];
    [-1, 1].forEach(sx => {
      const a = new THREE.Object3D(); a.position.set(sx * engX, -0.2, engZ); g.add(a);
      g.userData.engines.push(a);
    });
    const n = new THREE.Object3D(); n.position.set(0, 0, -(engZ + 1.4)); g.add(n);
    g.userData.nose = n;
    const mgL = new THREE.Object3D(); mgL.position.set(-0.9, -0.4, -engZ - 0.6); g.add(mgL);
    const mgR = new THREE.Object3D(); mgR.position.set(0.9, -0.4, -engZ - 0.6); g.add(mgR);
    g.userData.muzzles = [mgL, mgR];
  }

  window.Models = { buildSu57, buildTyphoon, buildGryphen, buildSu27UA, buildF22 };
})();
