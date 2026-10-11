// Low-poly 3D Aircraft and Missile models using Three.js
// Procedural low-poly geometry with authentic silhouettes

const AircraftModels = {
    // Utility for faceted materials
    createMat(color, emissive = 0x000000, roughness = 0.6) {
        return new THREE.MeshStandardMaterial({
            color: color,
            emissive: emissive,
            roughness: roughness,
            metalness: 0.15,
            flatShading: true
        });
    },

    // 1. THUNDER - EF Typhoon
    // Speed: 2/4, Manoeuvrability: 2/4, Special: HighSpeed AA missile
    createThunder() {
        const group = new THREE.Group();
        group.name = "Thunder_EFTyphoon";

        const mBody = this.createMat(0x8a959e); // Eurofighter grey
        const mDark = this.createMat(0x566068);
        const mCanopy = this.createMat(0x223344, 0x112233, 0.2);
        const mExhaust = this.createMat(0x222222);

        // Main Fuselage (long pointed nose, faceted)
        const noseGeo = new THREE.ConeGeometry(0.7, 4.2, 5);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, mBody);
        nose.position.set(0, 0, -3.2);
        group.add(nose);

        const bodyGeo = new THREE.CylinderGeometry(0.8, 0.9, 5.5, 6);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, mBody);
        body.position.set(0, 0, 0.8);
        group.add(body);

        // Cockpit Canopy
        const canopyGeo = new THREE.BoxGeometry(0.7, 0.6, 2.2);
        const canopy = new THREE.Mesh(canopyGeo, mCanopy);
        canopy.position.set(0, 0.6, -1.2);
        canopy.rotation.x = -0.15;
        group.add(canopy);

        // Ventral Chin Intake (signature Eurofighter rectangular intake)
        const intakeGeo = new THREE.BoxGeometry(1.0, 0.5, 2.4);
        const intake = new THREE.Mesh(intakeGeo, mDark);
        intake.position.set(0, -0.65, 0.5);
        group.add(intake);

        // Delta Wings (swept triangular delta wing)
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 2.0);
        wingShape.lineTo(4.4, 3.4);
        wingShape.lineTo(4.3, 4.2);
        wingShape.lineTo(0.9, 3.6);
        wingShape.lineTo(0, 3.8);
        wingShape.lineTo(-0.9, 3.6);
        wingShape.lineTo(-4.3, 4.2);
        wingShape.lineTo(-4.4, 3.4);
        wingShape.closePath();

        const extrudeSettings = { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeo.rotateX(Math.PI / 2);
        wingGeo.translate(0, 0, -2.8);
        const wings = new THREE.Mesh(wingGeo, mBody);
        wings.position.set(0, -0.05, 0);
        group.add(wings);

        // Forward Canards (Typhoon prominent nose canards)
        const canardShape = new THREE.Shape();
        canardShape.moveTo(0, 0);
        canardShape.lineTo(1.5, 0.7);
        canardShape.lineTo(1.4, 1.1);
        canardShape.lineTo(0, 0.8);
        canardShape.closePath();
        const canardGeo = new THREE.ExtrudeGeometry(canardShape, extrudeSettings);
        canardGeo.rotateX(Math.PI / 2);
        const canardR = new THREE.Mesh(canardGeo, mDark);
        canardR.position.set(0.4, 0.1, -2.5);
        group.add(canardR);

        const canardL = new THREE.Mesh(canardGeo, mDark);
        canardL.rotation.y = Math.PI;
        canardL.position.set(-0.4, 0.1, -2.5);
        group.add(canardL);

        // Single Tall Vertical Tail Fin
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(0.6, 2.2);
        finShape.lineTo(1.4, 2.2);
        finShape.lineTo(1.8, 0);
        finShape.closePath();
        const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
        finGeo.rotateY(-Math.PI / 2);
        const fin = new THREE.Mesh(finGeo, mDark);
        fin.position.set(0.07, 0.5, 2.0);
        group.add(fin);

        // Twin Engine Exhausts
        const ex1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.8, 6), mExhaust);
        ex1.rotateX(Math.PI / 2);
        ex1.position.set(0.38, -0.05, 3.8);
        const ex2 = ex1.clone();
        ex2.position.set(-0.38, -0.05, 3.8);
        group.add(ex1);
        group.add(ex2);

        // Exhaust emitters markers
        group.userData = {
            exhausts: [
                new THREE.Vector3(0.38, -0.05, 4.1),
                new THREE.Vector3(-0.38, -0.05, 4.1)
            ],
            gunMuzzles: [
                new THREE.Vector3(0.5, 0.2, -1.8)
            ],
            wingHardpoints: [
                new THREE.Vector3(2.5, -0.1, 0.5),
                new THREE.Vector3(-2.5, -0.1, 0.5)
            ],
            stats: { speed: 2, agility: 2, maxSpeed: 170, turnRate: 1.15, armor: 100 }
        };

        return group;
    },

    // 2. VULTURE - Gripen (JAS-39)
    // Speed: 2/4, Manoeuvrability: 2/4, Special: Radar Guided AA missile
    createVulture() {
        const group = new THREE.Group();
        group.name = "Vulture_Gripen";

        const mBody = this.createMat(0x6e7d89); // Swedish tactical slate grey
        const mDark = this.createMat(0x4a555e);
        const mCanopy = this.createMat(0x2a3845, 0x112233, 0.2);
        const mExhaust = this.createMat(0x222222);

        // Sleek compact fuselage
        const noseGeo = new THREE.ConeGeometry(0.65, 4.0, 5);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, mBody);
        nose.position.set(0, 0, -3.0);
        group.add(nose);

        const bodyGeo = new THREE.CylinderGeometry(0.75, 0.85, 5.0, 6);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, mBody);
        body.position.set(0, 0, 0.6);
        group.add(body);

        // Bubble Canopy
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 2.0), mCanopy);
        canopy.position.set(0, 0.55, -1.0);
        canopy.rotation.x = -0.12;
        group.add(canopy);

        // Side Air Intakes (Gripen D-shaped side intakes)
        const intakeR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 1.8), mDark);
        intakeR.position.set(0.65, -0.1, -0.2);
        const intakeL = intakeR.clone();
        intakeL.position.set(-0.65, -0.1, -0.2);
        group.add(intakeR);
        group.add(intakeL);

        // Delta Wings (compact cropped delta)
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 1.8);
        wingShape.lineTo(3.8, 3.2);
        wingShape.lineTo(3.7, 3.8);
        wingShape.lineTo(0.8, 3.4);
        wingShape.lineTo(0, 3.4);
        wingShape.lineTo(-0.8, 3.4);
        wingShape.lineTo(-3.7, 3.8);
        wingShape.lineTo(-3.8, 3.2);
        wingShape.closePath();

        const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeo.rotateX(Math.PI / 2);
        wingGeo.translate(0, 0, -2.4);
        const wings = new THREE.Mesh(wingGeo, mBody);
        group.add(wings);

        // Close-Coupled Large Canards
        const canardShape = new THREE.Shape();
        canardShape.moveTo(0, 0);
        canardShape.lineTo(1.4, 0.8);
        canardShape.lineTo(1.3, 1.3);
        canardShape.lineTo(0, 0.9);
        canardShape.closePath();
        const canardGeo = new THREE.ExtrudeGeometry(canardShape, extrudeSettings);
        canardGeo.rotateX(Math.PI / 2);
        const canardR = new THREE.Mesh(canardGeo, mDark);
        canardR.position.set(0.35, 0.15, -1.8);
        group.add(canardR);

        const canardL = new THREE.Mesh(canardGeo, mDark);
        canardL.rotation.y = Math.PI;
        canardL.position.set(-0.35, 0.15, -1.8);
        group.add(canardL);

        // Single Tail Fin
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(0.5, 2.0);
        finShape.lineTo(1.3, 2.0);
        finShape.lineTo(1.6, 0);
        finShape.closePath();
        const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
        finGeo.rotateY(-Math.PI / 2);
        const fin = new THREE.Mesh(finGeo, mDark);
        fin.position.set(0.06, 0.5, 1.8);
        group.add(fin);

        // Single Powerful Jet Exhaust
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.9, 6), mExhaust);
        exhaust.rotateX(Math.PI / 2);
        exhaust.position.set(0, 0, 3.4);
        group.add(exhaust);

        group.userData = {
            exhausts: [
                new THREE.Vector3(0, 0, 3.8)
            ],
            gunMuzzles: [
                new THREE.Vector3(-0.45, -0.3, -1.2)
            ],
            wingHardpoints: [
                new THREE.Vector3(2.2, -0.1, 0.6),
                new THREE.Vector3(-2.2, -0.1, 0.6)
            ],
            stats: { speed: 2, agility: 2, maxSpeed: 170, turnRate: 1.15, armor: 100 }
        };

        return group;
    },

    // 3. FALCON - Ukrainian coloured Su-27 Flanker
    // Speed: 3/4, Manoeuvrability: 3/4, Special: 4x multilock missile
    createFalcon() {
        const group = new THREE.Group();
        group.name = "Falcon_Su27_Ukrainian";

        // Ukrainian Digital Camouflage Palette
        const mSkyBlue = this.createMat(0x3a88d1);  // Digital sky blue
        const mGrey = this.createMat(0xc4ced8);     // Light digital grey
        const mDarkNavy = this.createMat(0x1a385c); // Navy pixel accent
        const mYellow = this.createMat(0xffd700);   // Ukrainian golden yellow
        const mCanopy = this.createMat(0x284b63, 0x112233, 0.2);
        const mExhaust = this.createMat(0x222222);

        // Blended Center Fuselage with Drooped Nose
        const noseGeo = new THREE.ConeGeometry(0.7, 4.8, 6);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, mSkyBlue);
        nose.position.set(0, -0.1, -3.5);
        nose.rotation.x = 0.06; // Su-27 iconic drooped nose
        group.add(nose);

        // Nose radome tip (white / grey)
        const radome = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 5), mGrey);
        radome.rotateX(Math.PI / 2);
        radome.position.set(0, -0.18, -5.2);
        group.add(radome);

        // Central Body
        const bodyGeo = new THREE.BoxGeometry(1.6, 0.75, 4.8);
        const body = new THREE.Mesh(bodyGeo, mGrey);
        body.position.set(0, 0.05, 0.2);
        group.add(body);

        // Iconic Flanker Cockpit Bubble
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.65, 2.4), mCanopy);
        canopy.position.set(0, 0.65, -1.8);
        canopy.rotation.x = -0.15;
        group.add(canopy);

        // Long Central Tail "Stinger" (tail boom between engines)
        const stinger = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3.2, 5), mSkyBlue);
        stinger.rotateX(Math.PI / 2);
        stinger.position.set(0, 0.1, 3.5);
        group.add(stinger);

        // Twin Widely Spaced Engine Nacelles
        const nacelleGeo = new THREE.CylinderGeometry(0.55, 0.6, 5.0, 6);
        nacelleGeo.rotateX(Math.PI / 2);

        const nacelleR = new THREE.Mesh(nacelleGeo, mDarkNavy);
        nacelleR.position.set(0.9, -0.3, 1.2);
        const nacelleL = nacelleR.clone();
        nacelleL.position.set(-0.9, -0.3, 1.2);
        group.add(nacelleR);
        group.add(nacelleL);

        // Swept Wings with LERX (Leading Edge Root Extensions)
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0.5);      // LERX start
        wingShape.lineTo(0.9, 1.8);    // LERX sweep
        wingShape.lineTo(5.2, 3.6);    // Wingtip
        wingShape.lineTo(5.0, 4.4);    // Wingtip edge
        wingShape.lineTo(1.2, 3.6);    // Trailing edge
        wingShape.lineTo(0, 3.5);
        wingShape.lineTo(-1.2, 3.6);
        wingShape.lineTo(-5.0, 4.4);
        wingShape.lineTo(-5.2, 3.6);
        wingShape.lineTo(-0.9, 1.8);
        wingShape.closePath();

        const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeo.rotateX(Math.PI / 2);
        wingGeo.translate(0, 0, -2.2);
        const wings = new THREE.Mesh(wingGeo, mSkyBlue);
        group.add(wings);

        // Ukrainian Digital Camo Pixel Patterns on Wings
        const camoTile1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.8), mYellow);
        camoTile1.position.set(2.6, 0.02, 0.2);
        group.add(camoTile1);

        const camoTile2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.8), mYellow);
        camoTile2.position.set(-2.6, 0.02, 0.2);
        group.add(camoTile2);

        const camoTile3 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.9), mDarkNavy);
        camoTile3.position.set(1.5, 0.02, -0.4);
        group.add(camoTile3);

        const camoTile4 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.9), mDarkNavy);
        camoTile4.position.set(-1.5, 0.02, -0.4);
        group.add(camoTile4);

        // Ukrainian Flag Wingtip Accents
        const tipYellowR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 1.0), mYellow);
        tipYellowR.position.set(4.9, 0.03, 1.4);
        const tipYellowL = tipYellowR.clone();
        tipYellowL.position.set(-4.9, 0.03, 1.4);
        group.add(tipYellowR);
        group.add(tipYellowL);

        // Twin Vertical Tail Fins with Outward Cant
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(0.5, 2.4);
        finShape.lineTo(1.4, 2.4);
        finShape.lineTo(1.8, 0);
        finShape.closePath();
        const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
        finGeo.rotateY(-Math.PI / 2);

        const finR = new THREE.Mesh(finGeo, mSkyBlue);
        finR.position.set(0.85, 0.3, 1.8);
        finR.rotation.z = -0.09; // slight outward cant
        group.add(finR);

        const finL = new THREE.Mesh(finGeo, mSkyBlue);
        finL.position.set(-0.85, 0.3, 1.8);
        finL.rotation.z = 0.09;
        group.add(finL);

        // Yellow and Blue Tail Fin Tips (Ukrainian markings)
        const finTipR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.85), mYellow);
        finTipR.position.set(1.05, 2.4, 2.6);
        const finTipL = finTipR.clone();
        finTipL.position.set(-1.05, 2.4, 2.6);
        group.add(finTipR);
        group.add(finTipL);

        // Twin Exhausts
        const exR = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.9, 6), mExhaust);
        exR.rotateX(Math.PI / 2);
        exR.position.set(0.9, -0.3, 3.8);
        const exL = exR.clone();
        exL.position.set(-0.9, -0.3, 3.8);
        group.add(exR);
        group.add(exL);

        group.userData = {
            exhausts: [
                new THREE.Vector3(0.9, -0.3, 4.2),
                new THREE.Vector3(-0.9, -0.3, 4.2)
            ],
            gunMuzzles: [
                new THREE.Vector3(0.55, 0.3, -1.8) // Right wing root GSh-30-1 cannon
            ],
            wingHardpoints: [
                new THREE.Vector3(3.2, -0.2, 0.8),
                new THREE.Vector3(-3.2, -0.2, 0.8),
                new THREE.Vector3(2.0, -0.3, 0.6),
                new THREE.Vector3(-2.0, -0.3, 0.6)
            ],
            stats: { speed: 3, agility: 3, maxSpeed: 205, turnRate: 1.35, armor: 110 }
        };

        return group;
    },

    // 4. SHADOW - F-22 Raptor
    // Speed: 3/4, Manoeuvrability: 3/4, Special: HighPower missile
    createShadow() {
        const group = new THREE.Group();
        group.name = "Shadow_F22";

        const mStealth = this.createMat(0x3e454b); // Charcoal stealth RAM coating
        const mEdges = this.createMat(0x5a636c);   // Light faceted stealth edges
        const mGoldCanopy = this.createMat(0x917f39, 0x4a401c, 0.15); // Signature gold-tinted indium tin oxide canopy
        const mExhaust = this.createMat(0x222222);

        // Diamond Faceted Chine Nose
        const noseGeo = new THREE.ConeGeometry(0.85, 4.6, 4); // 4-sided diamond cone
        noseGeo.rotateX(Math.PI / 2);
        noseGeo.rotateZ(Math.PI / 4);
        const nose = new THREE.Mesh(noseGeo, mStealth);
        nose.position.set(0, 0, -3.2);
        group.add(nose);

        // Stealth Fuselage Body (blended diamond cross section)
        const bodyGeo = new THREE.BoxGeometry(1.8, 0.75, 4.6);
        const body = new THREE.Mesh(bodyGeo, mStealth);
        body.position.set(0, 0, 0.4);
        group.add(body);

        // Gold-Tinted Bubble Canopy
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 2.3), mGoldCanopy);
        canopy.position.set(0, 0.58, -1.4);
        canopy.rotation.x = -0.14;
        group.add(canopy);

        // Stealth Diamond Wings (cropped diamond wings)
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 1.2);
        wingShape.lineTo(4.8, 2.8);
        wingShape.lineTo(4.4, 4.0);
        wingShape.lineTo(1.1, 3.4);
        wingShape.lineTo(0, 3.2);
        wingShape.lineTo(-1.1, 3.4);
        wingShape.lineTo(-4.4, 4.0);
        wingShape.lineTo(-4.8, 2.8);
        wingShape.closePath();

        const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeo.rotateX(Math.PI / 2);
        wingGeo.translate(0, 0, -2.4);
        const wings = new THREE.Mesh(wingGeo, mEdges);
        group.add(wings);

        // Canted Twin Vertical Stabilizers (28 degree outward cant)
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(0.5, 2.3);
        finShape.lineTo(1.3, 2.3);
        finShape.lineTo(1.6, 0);
        finShape.closePath();
        const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
        finGeo.rotateY(-Math.PI / 2);

        const finR = new THREE.Mesh(finGeo, mStealth);
        finR.position.set(0.95, 0.2, 1.6);
        finR.rotation.z = -0.48; // ~28 degrees outward
        group.add(finR);

        const finL = new THREE.Mesh(finGeo, mStealth);
        finL.position.set(-0.95, 0.2, 1.6);
        finL.rotation.z = 0.48;
        group.add(finL);

        // 2D Thrust Vectoring Flat Rectangular Exhaust Nozzles
        const nozzleGeo = new THREE.BoxGeometry(0.7, 0.35, 0.9);
        const nozR = new THREE.Mesh(nozzleGeo, mExhaust);
        nozR.position.set(0.5, 0, 3.6);
        const nozL = nozR.clone();
        nozL.position.set(-0.5, 0, 3.6);
        group.add(nozR);
        group.add(nozL);

        group.userData = {
            exhausts: [
                new THREE.Vector3(0.5, 0, 4.1),
                new THREE.Vector3(-0.5, 0, 4.1)
            ],
            gunMuzzles: [
                new THREE.Vector3(0.65, 0.3, -1.4) // Hidden internal gun port
            ],
            wingHardpoints: [
                new THREE.Vector3(2.8, -0.2, 0.6),
                new THREE.Vector3(-2.8, -0.2, 0.6)
            ],
            stats: { speed: 3, agility: 3, maxSpeed: 210, turnRate: 1.4, armor: 105 }
        };

        return group;
    },

    // 5. ROGUE - Su-57 Felon
    // Named in game "Rogue", stealth faceted blended wing body, splinter camo
    createRogue() {
        const group = new THREE.Group();
        group.name = "Rogue_Su57";

        const mSplinterDark = this.createMat(0x2d3238); // Dark splinter
        const mSplinterMid = this.createMat(0x525c66);  // Mid grey
        const mSplinterLight = this.createMat(0x9aa4ad); // Light grey patches
        const mCanopy = this.createMat(0x1a2530, 0x112233, 0.2);
        const mExhaust = this.createMat(0x1c1c1c);
        const mEngineGlow = this.createMat(0xff3300, 0xff2200, 0.8); // Hostile engine burn

        // Flattened stealth nose with LEVCON strakes
        const noseGeo = new THREE.ConeGeometry(0.9, 4.5, 5);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, mSplinterDark);
        nose.scale.set(1.4, 0.6, 1.0); // wide and flat
        nose.position.set(0, -0.05, -3.2);
        group.add(nose);

        // Blended Center Fuselage with Wide Nacelle Tunnel
        const bodyGeo = new THREE.BoxGeometry(2.3, 0.65, 4.6);
        const body = new THREE.Mesh(bodyGeo, mSplinterMid);
        body.position.set(0, 0, 0.3);
        group.add(body);

        // Stealth Faceted Canopy
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.52, 2.2), mCanopy);
        canopy.position.set(0, 0.5, -1.3);
        canopy.rotation.x = -0.14;
        group.add(canopy);

        // Trapeze Blended Wings with Angular Splinter Camo
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0.8);
        wingShape.lineTo(1.2, 1.8);
        wingShape.lineTo(5.2, 3.4);
        wingShape.lineTo(4.8, 4.4);
        wingShape.lineTo(1.4, 3.8);
        wingShape.lineTo(0, 3.6);
        wingShape.lineTo(-1.4, 3.8);
        wingShape.lineTo(-4.8, 4.4);
        wingShape.lineTo(-5.2, 3.4);
        wingShape.lineTo(-1.2, 1.8);
        wingShape.closePath();

        const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeo.rotateX(Math.PI / 2);
        wingGeo.translate(0, 0, -2.4);
        const wings = new THREE.Mesh(wingGeo, mSplinterDark);
        group.add(wings);

        // Splinter Camo Facets on Wings
        const camo1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.2), mSplinterLight);
        camo1.rotation.y = 0.4;
        camo1.position.set(2.4, 0.02, 0.3);
        group.add(camo1);

        const camo2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.2), mSplinterLight);
        camo2.rotation.y = -0.4;
        camo2.position.set(-2.4, 0.02, 0.3);
        group.add(camo2);

        // All-Moving Canted Vertical Stabilizers
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(0.5, 2.1);
        finShape.lineTo(1.3, 2.1);
        finShape.lineTo(1.7, 0);
        finShape.closePath();
        const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
        finGeo.rotateY(-Math.PI / 2);

        const finR = new THREE.Mesh(finGeo, mSplinterDark);
        finR.position.set(1.0, 0.25, 1.6);
        finR.rotation.z = -0.45; // ~26 deg cant
        group.add(finR);

        const finL = new THREE.Mesh(finGeo, mSplinterDark);
        finL.position.set(-1.0, 0.25, 1.6);
        finL.rotation.z = 0.45;
        group.add(finL);

        // Widely Spaced Engine Nacelles with 3D Nozzles
        const exR = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 1.1, 6), mExhaust);
        exR.rotateX(Math.PI / 2);
        exR.position.set(1.0, -0.15, 3.6);
        const exL = exR.clone();
        exL.position.set(-1.0, -0.15, 3.6);
        group.add(exR);
        group.add(exL);

        // Red Engine Core Glow
        const glowR = new THREE.Mesh(new THREE.CircleGeometry(0.4, 6), mEngineGlow);
        glowR.position.set(1.0, -0.15, 4.16);
        const glowL = glowR.clone();
        glowL.position.set(-1.0, -0.15, 4.16);
        group.add(glowR);
        group.add(glowL);

        group.userData = {
            exhausts: [
                new THREE.Vector3(1.0, -0.15, 4.2),
                new THREE.Vector3(-1.0, -0.15, 4.2)
            ],
            gunMuzzles: [
                new THREE.Vector3(0.5, 0.1, -1.8),
                new THREE.Vector3(-0.5, 0.1, -1.8)
            ],
            stats: { speed: 2.8, agility: 2.8, maxSpeed: 195, turnRate: 1.25, armor: 100 }
        };

        return group;
    },

    // MISSILE MODELS
    createMissile(type = 'standard') {
        const group = new THREE.Group();
        group.name = `Missile_${type}`;

        let bodyColor = 0xe0e0e0;
        let finColor = 0x333333;
        let length = 2.4;
        let radius = 0.12;

        if (type === 'highspeed') {
            bodyColor = 0x6a2c91; // Royal purple hypersonic dart
            finColor = 0x111111;
            length = 3.1;
            radius = 0.10;
        } else if (type === 'radarguided') {
            bodyColor = 0x228b22; // Green guided missile
            finColor = 0x1a451a;
            length = 2.5;
            radius = 0.12;
        } else if (type === 'multilock') {
            bodyColor = 0x1e90ff; // High tech blue
            finColor = 0x104e8b;
            length = 1.9;
            radius = 0.11;
        } else if (type === 'highpower') {
            bodyColor = 0xd9534f; // Crimson explosive warhead
            finColor = 0x8b0000;
            length = 2.8;
            radius = 0.18;
        }

        const mBody = this.createMat(bodyColor);
        const mFin = this.createMat(finColor);
        const mNose = this.createMat(type === 'highpower' ? 0xff0000 : 0x222222);

        // Rocket body
        const bodyGeo = new THREE.CylinderGeometry(radius, radius, length, 6);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, mBody);
        group.add(body);

        // Pointed nose cone
        const noseGeo = new THREE.ConeGeometry(radius, 0.6, 6);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, mNose);
        nose.position.set(0, 0, -(length / 2 + 0.3));
        group.add(nose);

        // Tail stabilizing fins (4 fins in cross shape)
        const finGeo = new THREE.BoxGeometry(radius * 3.5, 0.03, 0.45);
        const fin1 = new THREE.Mesh(finGeo, mFin);
        fin1.position.set(0, 0, length / 2 - 0.25);
        const fin2 = fin1.clone();
        fin2.rotateZ(Math.PI / 2);
        group.add(fin1);
        group.add(fin2);

        // Canard steering fins on Radar Guided missile
        if (type === 'radarguided') {
            const canardGeo = new THREE.BoxGeometry(radius * 2.8, 0.02, 0.3);
            const can1 = new THREE.Mesh(canardGeo, mFin);
            can1.position.set(0, 0, -0.6);
            const can2 = can1.clone();
            can2.rotateZ(Math.PI / 2);
            group.add(can1);
            group.add(can2);
        }

        group.userData = {
            type: type,
            exhaustPos: new THREE.Vector3(0, 0, length / 2)
        };

        return group;
    }
};

window.AircraftModels = AircraftModels;
