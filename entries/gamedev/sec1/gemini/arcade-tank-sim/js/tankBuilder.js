/**
 * Low-Poly 3D Tank Procedural Modeling Module
 * Arcade Tank Simulator
 * Builds:
 *  - Liberator (M1A2 Abrams analog)
 *  - Hunter (Leopard 2A6 analog)
 *  - Royal (Challenger 2 analog)
 *  - Bastion (BM Oplot analog)
 *  - Hound (T-80 enemy tank analog)
 */

const TankDefinitions = {
    liberator: {
        id: 'liberator',
        name: 'Liberator',
        analog: 'M1A2 Abrams Analog',
        description: 'Heavy armor juggernaut with a high-caliber smoothbore gun and depleted uranium composite shielding.',
        // Stats: 1/4 speed, 3/4 armor, 3/4 power
        stats: {
            speed: 1,      // 1/4
            armor: 3,      // 3/4
            power: 3,      // 3/4
        },
        mechanics: {
            maxSpeed: 14.0,       // m/s (~50 km/h)
            acceleration: 9.0,
            turnSpeed: 1.3,       // rad/s
            turretTurnSpeed: 1.6, // rad/s
            maxHp: 200,
            damage: 120,
            reloadTime: 2.2,      // seconds
            bulletSpeed: 95,
        },
        themeColor: 0xd8b584,     // Desert Sand Tan
        secondaryColor: 0x3d352a, // Dark accent
        treadColor: 0x222222
    },
    hunter: {
        id: 'hunter',
        name: 'Hunter',
        analog: 'Leopard 2A6 Analog',
        description: 'Fast and agile hunter-killer tank featuring sharp arrowhead wedge armor and rapid-firing high-velocity gun.',
        // Stats: 3/4 speed, 2/4 armor, 2/4 power
        stats: {
            speed: 3,      // 3/4
            armor: 2,      // 2/4
            power: 2,      // 2/4
        },
        mechanics: {
            maxSpeed: 23.0,       // m/s (~82 km/h) - high speed!
            acceleration: 18.0,
            turnSpeed: 2.2,
            turretTurnSpeed: 2.6,
            maxHp: 130,
            damage: 80,
            reloadTime: 1.4,      // fast reload
            bulletSpeed: 115,
        },
        themeColor: 0x4f6442,     // NATO Olive Green
        secondaryColor: 0x2c3527, // Dark Green
        treadColor: 0x222222
    },
    royal: {
        id: 'royal',
        name: 'Royal',
        analog: 'Challenger 2 Analog',
        description: 'British doctrine armored gun platform. Heavy rifled barrel delivering devastating alpha kinetic strikes.',
        // Stats: 2/4 speed, 1/4 armor, 3/4 power
        stats: {
            speed: 2,      // 2/4
            armor: 1,      // 1/4
            power: 3,      // 3/4
        },
        mechanics: {
            maxSpeed: 18.0,       // m/s (~65 km/h)
            acceleration: 13.0,
            turnSpeed: 1.7,
            turretTurnSpeed: 1.8,
            maxHp: 100,           // 1/4 armor
            damage: 135,          // 3/4 power - high alpha damage!
            reloadTime: 2.3,
            bulletSpeed: 100,
        },
        themeColor: 0x6e6e58,     // British Bronzed Olive
        secondaryColor: 0x3d3d30,
        treadColor: 0x222222
    },
    bastion: {
        id: 'bastion',
        name: 'Bastion',
        analog: 'BM Oplot Analog',
        description: 'Ukrainian modern main battle tank equipped with layered Duplet ERA reactive armor and panoramic hunter sight.',
        // Stats: 2/4 speed, 2/4 armor, 2/4 power
        stats: {
            speed: 2,      // 2/4
            armor: 2,      // 2/4
            power: 2,      // 2/4
        },
        mechanics: {
            maxSpeed: 18.5,       // m/s
            acceleration: 14.0,
            turnSpeed: 1.8,
            turretTurnSpeed: 2.1,
            maxHp: 140,
            damage: 90,
            reloadTime: 1.7,
            bulletSpeed: 105,
        },
        themeColor: 0x5b7052,     // Ukrainian Steppe Green / Pixel Camo
        secondaryColor: 0x8a9270, // Pixel highlights
        treadColor: 0x222222
    },
    hound: {
        id: 'hound',
        name: 'Hound',
        analog: 'T-80 Soviet Main Battle Tank',
        description: 'Static perimeter defense tank. Senses intruders within its optical perimeter circle and engages with 125mm cannon fire.',
        stats: {
            speed: 0,
            armor: 2,
            power: 2,
        },
        mechanics: {
            maxHp: 120,
            damage: 35,
            reloadTime: 2.4,
            bulletSpeed: 85,
            detectionRadius: 48,  // View circle radius (meters)
            turretTurnSpeed: 1.4,
        },
        themeColor: 0x3f464d,     // Soviet Gunmetal Slate
        secondaryColor: 0x932727, // Red tactical identification markings
        treadColor: 0x1d1f22
    }
};

class TankBuilder {
    static createMaterial(color, roughness = 0.65, metalness = 0.25) {
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: roughness,
            metalness: metalness,
            flatShading: true
        });
    }

    /**
     * Common chassis with treads, roadwheels, skirts, and engine deck
     */
    static buildBaseChassis(width, length, height, bodyMat, treadMat, wheelMat, skirtMat) {
        const hullGroup = new THREE.Group();

        // 1. Lower chassis tub
        const tubGeo = new THREE.BoxGeometry(width * 0.76, height * 0.55, length * 0.95);
        const tubMesh = new THREE.Mesh(tubGeo, bodyMat);
        tubMesh.position.y = height * 0.45;
        tubMesh.castShadow = true;
        tubMesh.receiveShadow = true;
        hullGroup.add(tubMesh);

        // 2. Upper sloped hull
        const upperGeo = new THREE.BoxGeometry(width * 0.94, height * 0.45, length * 0.92);
        const upperMesh = new THREE.Mesh(upperGeo, bodyMat);
        upperMesh.position.y = height * 0.78;
        upperMesh.castShadow = true;
        upperMesh.receiveShadow = true;
        hullGroup.add(upperMesh);

        // 3. Front sloped glacis plate
        const glacisGeo = new THREE.BoxGeometry(width * 0.9, height * 0.4, length * 0.35);
        glacisGeo.rotateX(Math.PI / 6);
        const glacisMesh = new THREE.Mesh(glacisGeo, bodyMat);
        glacisMesh.position.set(0, height * 0.65, length * 0.45);
        glacisMesh.castShadow = true;
        hullGroup.add(glacisMesh);

        // 4. Tracks (Left & Right)
        const treadWidth = width * 0.22;
        const treadLength = length * 1.05;
        const treadHeight = height * 0.6;
        const trackGeo = new THREE.BoxGeometry(treadWidth, treadHeight, treadLength);

        const leftTrack = new THREE.Mesh(trackGeo, treadMat);
        leftTrack.position.set(-width * 0.46, height * 0.35, 0);
        leftTrack.castShadow = true;
        hullGroup.add(leftTrack);

        const rightTrack = new THREE.Mesh(trackGeo, treadMat);
        rightTrack.position.set(width * 0.46, height * 0.35, 0);
        rightTrack.castShadow = true;
        hullGroup.add(rightTrack);

        // 5. Road wheels
        const wheelCount = 6;
        const wheelRadius = height * 0.25;
        const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, treadWidth * 1.05, 10);
        wheelGeo.rotateZ(Math.PI / 2);

        for (let i = 0; i < wheelCount; i++) {
            const z = -length * 0.45 + (length * 0.9 / (wheelCount - 1)) * i;
            
            const wL = new THREE.Mesh(wheelGeo, wheelMat);
            wL.position.set(-width * 0.46, height * 0.32, z);
            wL.castShadow = true;
            hullGroup.add(wL);

            const wR = new THREE.Mesh(wheelGeo, wheelMat);
            wR.position.set(width * 0.46, height * 0.32, z);
            wR.castShadow = true;
            hullGroup.add(wR);
        }

        // 6. Side Skirts
        const skirtGeo = new THREE.BoxGeometry(0.08, height * 0.42, length * 0.88);
        const leftSkirt = new THREE.Mesh(skirtGeo, skirtMat);
        leftSkirt.position.set(-width * 0.58, height * 0.48, 0);
        leftSkirt.castShadow = true;
        hullGroup.add(leftSkirt);

        const rightSkirt = new THREE.Mesh(skirtGeo, skirtMat);
        rightSkirt.position.set(width * 0.58, height * 0.48, 0);
        rightSkirt.castShadow = true;
        hullGroup.add(rightSkirt);

        // 7. Engine exhaust grills on rear
        const grillGeo = new THREE.BoxGeometry(width * 0.6, 0.08, length * 0.25);
        const grillMesh = new THREE.Mesh(grillGeo, wheelMat);
        grillMesh.position.set(0, height * 0.98, -length * 0.32);
        hullGroup.add(grillMesh);

        return hullGroup;
    }

    /**
     * LIBERATOR (M1A2 Abrams Analog)
     */
    static buildLiberator() {
        const def = TankDefinitions.liberator;
        const tankRoot = new THREE.Group();
        tankRoot.name = 'tank_liberator';

        const mainMat = this.createMaterial(def.themeColor);
        const darkMat = this.createMaterial(def.secondaryColor);
        const treadMat = this.createMaterial(def.treadColor, 0.8, 0.1);
        const metalMat = this.createMaterial(0x3a3a3a, 0.4, 0.6);

        // Dimensions: wide, heavy, angular
        const width = 3.6, length = 6.8, height = 1.35;
        const hull = this.buildBaseChassis(width, length, height, mainMat, treadMat, metalMat, darkMat);
        tankRoot.add(hull);

        // Abrams distinctive angular turret
        const turretGroup = new THREE.Group();
        turretGroup.position.set(0, height * 0.95, -0.2);

        // Turret main body
        const turretBaseGeo = new THREE.BoxGeometry(2.7, 0.9, 3.8);
        const turretBase = new THREE.Mesh(turretBaseGeo, mainMat);
        turretBase.position.set(0, 0.45, 0);
        turretBase.castShadow = true;
        turretGroup.add(turretBase);

        // Sloped cheek armor (left & right wedges)
        const cheekGeo = new THREE.BoxGeometry(0.7, 0.85, 2.2);
        cheekGeo.rotateY(Math.PI / 12);
        const leftCheek = new THREE.Mesh(cheekGeo, mainMat);
        leftCheek.position.set(-1.25, 0.42, 0.8);
        leftCheek.castShadow = true;
        turretGroup.add(leftCheek);

        const rightCheek = new THREE.Mesh(cheekGeo, mainMat);
        rightCheek.rotation.y = -Math.PI / 12;
        rightCheek.position.set(1.25, 0.42, 0.8);
        rightCheek.castShadow = true;
        turretGroup.add(rightCheek);

        // Rear bustle rack (storage basket)
        const rackGeo = new THREE.BoxGeometry(2.4, 0.5, 0.9);
        const rackMesh = new THREE.Mesh(rackGeo, darkMat);
        rackMesh.position.set(0, 0.45, -1.8);
        turretGroup.add(rackMesh);

        // Commander CITV panoramic viewer cylinder
        const citvGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.45, 8);
        const citvMesh = new THREE.Mesh(citvGeo, metalMat);
        citvMesh.position.set(-0.8, 1.05, 0.2);
        turretGroup.add(citvMesh);

        // .50 cal machine gun mount
        const mgGeo = new THREE.BoxGeometry(0.12, 0.16, 0.9);
        const mgMesh = new THREE.Mesh(mgGeo, metalMat);
        mgMesh.position.set(0.65, 1.15, 0.4);
        turretGroup.add(mgMesh);

        // Cannon barrel assembly (Pitch / Recoil)
        const barrelGroup = new THREE.Group();
        barrelGroup.position.set(0, 0.48, 1.8);

        // Gun mantlet
        const mantletGeo = new THREE.BoxGeometry(0.9, 0.6, 0.7);
        const mantlet = new THREE.Mesh(mantletGeo, darkMat);
        mantlet.position.set(0, 0, 0.1);
        barrelGroup.add(mantlet);

        // Main 120mm barrel
        const barrelLen = 4.8;
        const barrelGeo = new THREE.CylinderGeometry(0.14, 0.16, barrelLen, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrelMesh = new THREE.Mesh(barrelGeo, mainMat);
        barrelMesh.position.set(0, 0, barrelLen * 0.5);
        barrelMesh.castShadow = true;
        barrelGroup.add(barrelMesh);

        // Bore evacuator cylinder
        const evacGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.9, 10);
        evacGeo.rotateX(Math.PI / 2);
        const evacMesh = new THREE.Mesh(evacGeo, darkMat);
        evacMesh.position.set(0, 0, 2.7);
        barrelGroup.add(evacMesh);

        // Muzzle point anchor (for projectile and flashes)
        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.position.set(0, 0, barrelLen + 0.1);
        barrelGroup.add(muzzlePoint);

        turretGroup.add(barrelGroup);
        tankRoot.add(turretGroup);

        return {
            root: tankRoot,
            hull: hull,
            turret: turretGroup,
            barrel: barrelGroup,
            muzzlePoint: muzzlePoint,
            def: def
        };
    }

    /**
     * HUNTER (Leopard 2A6 Analog)
     */
    static buildHunter() {
        const def = TankDefinitions.hunter;
        const tankRoot = new THREE.Group();
        tankRoot.name = 'tank_hunter';

        const mainMat = this.createMaterial(def.themeColor);
        const darkMat = this.createMaterial(def.secondaryColor);
        const treadMat = this.createMaterial(def.treadColor, 0.8, 0.1);
        const metalMat = this.createMaterial(0x333b30, 0.4, 0.6);

        // Agile, sleek NATO chassis
        const width = 3.5, length = 7.0, height = 1.3;
        const hull = this.buildBaseChassis(width, length, height, mainMat, treadMat, metalMat, darkMat);
        tankRoot.add(hull);

        const turretGroup = new THREE.Group();
        turretGroup.position.set(0, height * 0.95, -0.1);

        // Turret base
        const turretBaseGeo = new THREE.BoxGeometry(2.5, 0.85, 3.6);
        const turretBase = new THREE.Mesh(turretBaseGeo, mainMat);
        turretBase.position.set(0, 0.42, -0.1);
        turretBase.castShadow = true;
        turretGroup.add(turretBase);

        // Leopard iconic Arrowhead Wedge Armor (V-shaped front)
        const wedgeGeoL = new THREE.ConeGeometry(0.85, 1.8, 4);
        wedgeGeoL.rotateZ(Math.PI / 2);
        wedgeGeoL.rotateY(-Math.PI / 5);
        const wedgeL = new THREE.Mesh(wedgeGeoL, mainMat);
        wedgeL.position.set(-0.85, 0.42, 1.55);
        turretGroup.add(wedgeL);

        const wedgeGeoR = new THREE.ConeGeometry(0.85, 1.8, 4);
        wedgeGeoR.rotateZ(Math.PI / 2);
        wedgeGeoR.rotateY(Math.PI / 5);
        const wedgeR = new THREE.Mesh(wedgeGeoR, mainMat);
        wedgeR.position.set(0.85, 0.42, 1.55);
        turretGroup.add(wedgeR);

        // PERI R17 Commander sight
        const periGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.5, 8);
        const periMesh = new THREE.Mesh(periGeo, metalMat);
        periMesh.position.set(0.65, 1.05, 0.1);
        turretGroup.add(periMesh);

        // Smoke grenade dischargers
        for (let i = 0; i < 4; i++) {
            const sgL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 6), darkMat);
            sgL.position.set(-1.3, 0.65, -0.2 + i * 0.25);
            sgL.rotation.z = Math.PI / 6;
            turretGroup.add(sgL);

            const sgR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 6), darkMat);
            sgR.position.set(1.3, 0.65, -0.2 + i * 0.25);
            sgR.rotation.z = -Math.PI / 6;
            turretGroup.add(sgR);
        }

        // Long Rheinmetall L/55 Cannon
        const barrelGroup = new THREE.Group();
        barrelGroup.position.set(0, 0.45, 1.7);

        const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.7), darkMat);
        barrelGroup.add(mantlet);

        // Longer high-velocity barrel
        const barrelLen = 5.5;
        const barrelGeo = new THREE.CylinderGeometry(0.12, 0.15, barrelLen, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrelMesh = new THREE.Mesh(barrelGeo, mainMat);
        barrelMesh.position.set(0, 0, barrelLen * 0.5);
        barrelMesh.castShadow = true;
        barrelGroup.add(barrelMesh);

        // Muzzle brake
        const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 8), darkMat);
        muzzleBrake.rotateX(Math.PI / 2);
        muzzleBrake.position.set(0, 0, barrelLen - 0.2);
        barrelGroup.add(muzzleBrake);

        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.position.set(0, 0, barrelLen + 0.1);
        barrelGroup.add(muzzlePoint);

        turretGroup.add(barrelGroup);
        tankRoot.add(turretGroup);

        return {
            root: tankRoot,
            hull: hull,
            turret: turretGroup,
            barrel: barrelGroup,
            muzzlePoint: muzzlePoint,
            def: def
        };
    }

    /**
     * ROYAL (Challenger 2 Analog)
     */
    static buildRoyal() {
        const def = TankDefinitions.royal;
        const tankRoot = new THREE.Group();
        tankRoot.name = 'tank_royal';

        const mainMat = this.createMaterial(def.themeColor);
        const darkMat = this.createMaterial(def.secondaryColor);
        const treadMat = this.createMaterial(def.treadColor, 0.8, 0.1);
        const metalMat = this.createMaterial(0x35352c, 0.4, 0.6);

        // Massive British hull
        const width = 3.7, length = 7.1, height = 1.38;
        const hull = this.buildBaseChassis(width, length, height, mainMat, treadMat, metalMat, darkMat);
        tankRoot.add(hull);

        const turretGroup = new THREE.Group();
        turretGroup.position.set(0, height * 0.95, -0.25);

        // Boxy turret body with massive Dorchester armor cheeks
        const turretBaseGeo = new THREE.BoxGeometry(2.8, 0.95, 3.7);
        const turretBase = new THREE.Mesh(turretBaseGeo, mainMat);
        turretBase.position.set(0, 0.48, 0);
        turretBase.castShadow = true;
        turretGroup.add(turretBase);

        // Heavy slab composite cheek armor
        const cheekGeo = new THREE.BoxGeometry(0.8, 0.9, 2.4);
        const leftSlab = new THREE.Mesh(cheekGeo, darkMat);
        leftSlab.position.set(-1.3, 0.48, 0.6);
        turretGroup.add(leftSlab);

        const rightSlab = new THREE.Mesh(cheekGeo, darkMat);
        rightSlab.position.set(1.3, 0.48, 0.6);
        turretGroup.add(rightSlab);

        // TOGS thermal sight housing box
        const togsGeo = new THREE.BoxGeometry(0.65, 0.5, 0.7);
        const togsMesh = new THREE.Mesh(togsGeo, metalMat);
        togsMesh.position.set(0.9, 0.85, 1.2);
        turretGroup.add(togsMesh);

        // 120mm L30A1 Rifled Gun assembly
        const barrelGroup = new THREE.Group();
        barrelGroup.position.set(0, 0.5, 1.85);

        const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.65), darkMat);
        barrelGroup.add(mantlet);

        // Heavy barrel with thermal shroud sleeves
        const barrelLen = 4.9;
        const barrelGeo = new THREE.CylinderGeometry(0.15, 0.18, barrelLen, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrelMesh = new THREE.Mesh(barrelGeo, mainMat);
        barrelMesh.position.set(0, 0, barrelLen * 0.5);
        barrelMesh.castShadow = true;
        barrelGroup.add(barrelMesh);

        // Segmented thermal sleeve bands
        for (let s = 1; s <= 3; s++) {
            const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 10), darkMat);
            sleeve.rotateX(Math.PI / 2);
            sleeve.position.set(0, 0, 1.1 * s);
            barrelGroup.add(sleeve);
        }

        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.position.set(0, 0, barrelLen + 0.1);
        barrelGroup.add(muzzlePoint);

        turretGroup.add(barrelGroup);
        tankRoot.add(turretGroup);

        return {
            root: tankRoot,
            hull: hull,
            turret: turretGroup,
            barrel: barrelGroup,
            muzzlePoint: muzzlePoint,
            def: def
        };
    }

    /**
     * BASTION (Ukrainian BM Oplot Analog)
     */
    static buildBastion() {
        const def = TankDefinitions.bastion;
        const tankRoot = new THREE.Group();
        tankRoot.name = 'tank_bastion';

        const mainMat = this.createMaterial(def.themeColor);
        const pixelMat = this.createMaterial(def.secondaryColor);
        const treadMat = this.createMaterial(def.treadColor, 0.8, 0.1);
        const metalMat = this.createMaterial(0x353d32, 0.4, 0.6);

        // Low, well-contoured hull
        const width = 3.5, length = 6.9, height = 1.25;
        const hull = this.buildBaseChassis(width, length, height, mainMat, treadMat, metalMat, pixelMat);
        tankRoot.add(hull);

        // Duplet ERA side modules on skirts
        for (let i = 0; i < 5; i++) {
            const z = -2.2 + i * 1.1;
            const eraL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.9), pixelMat);
            eraL.position.set(-width * 0.59, height * 0.5, z);
            hull.add(eraL);

            const eraR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.9), pixelMat);
            eraR.position.set(width * 0.59, height * 0.5, z);
            hull.add(eraR);
        }

        const turretGroup = new THREE.Group();
        turretGroup.position.set(0, height * 0.92, -0.15);

        // Low profile faceted turret
        const turretBaseGeo = new THREE.BoxGeometry(2.6, 0.75, 3.3);
        const turretBase = new THREE.Mesh(turretBaseGeo, mainMat);
        turretBase.position.set(0, 0.38, 0);
        turretBase.castShadow = true;
        turretGroup.add(turretBase);

        // Duplet ERA angular frontal wedge blocks
        const eraWedgeGeo = new THREE.BoxGeometry(1.1, 0.45, 0.7);
        eraWedgeGeo.rotateX(Math.PI / 8);

        const leftWedge = new THREE.Mesh(eraWedgeGeo, pixelMat);
        leftWedge.position.set(-0.8, 0.4, 1.4);
        leftWedge.rotation.y = -Math.PI / 10;
        turretGroup.add(leftWedge);

        const rightWedge = new THREE.Mesh(eraWedgeGeo, pixelMat);
        rightWedge.position.set(0.8, 0.4, 1.4);
        rightWedge.rotation.y = Math.PI / 10;
        turretGroup.add(rightWedge);

        // Famous PNK-6 panoramic commander periscope sight on turret roof
        const pnkGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.65, 10);
        const pnkMesh = new THREE.Mesh(pnkGeo, metalMat);
        pnkMesh.position.set(-0.6, 0.95, 0.2);
        turretGroup.add(pnkMesh);

        // Optic lens element
        const lensGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8);
        lensGeo.rotateX(Math.PI / 2);
        const lensMesh = new THREE.Mesh(lensGeo, new THREE.MeshBasicMaterial({ color: 0x4fc3f7 }));
        lensMesh.position.set(-0.6, 1.15, 0.35);
        turretGroup.add(lensMesh);

        // 125mm KBA-3 Smoothbore Gun
        const barrelGroup = new THREE.Group();
        barrelGroup.position.set(0, 0.42, 1.6);

        const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), pixelMat);
        barrelGroup.add(mantlet);

        const barrelLen = 5.2;
        const barrelGeo = new THREE.CylinderGeometry(0.13, 0.16, barrelLen, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrelMesh = new THREE.Mesh(barrelGeo, mainMat);
        barrelMesh.position.set(0, 0, barrelLen * 0.5);
        barrelMesh.castShadow = true;
        barrelGroup.add(barrelMesh);

        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.position.set(0, 0, barrelLen + 0.1);
        barrelGroup.add(muzzlePoint);

        turretGroup.add(barrelGroup);
        tankRoot.add(turretGroup);

        return {
            root: tankRoot,
            hull: hull,
            turret: turretGroup,
            barrel: barrelGroup,
            muzzlePoint: muzzlePoint,
            def: def
        };
    }

    /**
     * HOUND (T-80 Soviet Main Battle Tank - Enemy Target)
     */
    static buildHound() {
        const def = TankDefinitions.hound;
        const tankRoot = new THREE.Group();
        tankRoot.name = 'tank_hound';

        const mainMat = this.createMaterial(def.themeColor);
        const redMat = this.createMaterial(def.secondaryColor, 0.5, 0.3);
        const treadMat = this.createMaterial(def.treadColor, 0.8, 0.1);
        const metalMat = this.createMaterial(0x282b2e, 0.4, 0.6);

        // Soviet low-profile hull
        const width = 3.4, length = 6.6, height = 1.2;
        const hull = this.buildBaseChassis(width, length, height, mainMat, treadMat, metalMat, mainMat);
        tankRoot.add(hull);

        // Twin external fuel barrels on rear
        const fuelDrumGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.2, 8);
        fuelDrumGeo.rotateZ(Math.PI / 2);

        const drum1 = new THREE.Mesh(fuelDrumGeo, redMat);
        drum1.position.set(0, height * 0.7, -length * 0.52);
        hull.add(drum1);

        const turretGroup = new THREE.Group();
        turretGroup.position.set(0, height * 0.9, -0.1);

        // Low dome cast turret (hemisphere / flattened sphere)
        const domeGeo = new THREE.SphereGeometry(1.6, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
        domeGeo.scale(1.0, 0.55, 1.2);
        const domeMesh = new THREE.Mesh(domeGeo, mainMat);
        domeMesh.position.set(0, 0.1, 0);
        domeMesh.castShadow = true;
        turretGroup.add(domeMesh);

        // Kontakt-1 / Kontakt-5 ERA explosive reactive bricks on turret face
        const brickGeo = new THREE.BoxGeometry(0.28, 0.16, 0.45);
        for (let angle = -0.7; angle <= 0.7; angle += 0.28) {
            const bx = Math.sin(angle) * 1.45;
            const bz = Math.cos(angle) * 1.55;
            const brick = new THREE.Mesh(brickGeo, redMat);
            brick.position.set(bx, 0.35, bz);
            brick.rotation.y = angle;
            turretGroup.add(brick);
        }

        // Luna Infrared Searchlight (mounted right next to gun)
        const lunaGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 8);
        lunaGeo.rotateX(Math.PI / 2);
        const lunaMesh = new THREE.Mesh(lunaGeo, metalMat);
        lunaMesh.position.set(0.55, 0.42, 1.2);
        turretGroup.add(lunaMesh);

        // Glowing red sensor optic
        const eyeMesh = new THREE.Mesh(
            new THREE.CircleGeometry(0.18, 8),
            new THREE.MeshBasicMaterial({ color: 0xff2222 })
        );
        eyeMesh.position.set(0.55, 0.42, 1.37);
        turretGroup.add(eyeMesh);

        // Snorkel tube cylinder on turret rear
        const snorkelGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.8, 8);
        snorkelGeo.rotateZ(Math.PI / 2);
        const snorkelMesh = new THREE.Mesh(snorkelGeo, metalMat);
        snorkelMesh.position.set(0, 0.45, -1.35);
        turretGroup.add(snorkelMesh);

        // 125mm 2A46 Smoothbore Gun
        const barrelGroup = new THREE.Group();
        barrelGroup.position.set(0, 0.38, 1.3);

        const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), mainMat);
        barrelGroup.add(mantlet);

        const barrelLen = 4.8;
        const barrelGeo = new THREE.CylinderGeometry(0.13, 0.16, barrelLen, 10);
        barrelGeo.rotateX(Math.PI / 2);
        const barrelMesh = new THREE.Mesh(barrelGeo, mainMat);
        barrelMesh.position.set(0, 0, barrelLen * 0.5);
        barrelMesh.castShadow = true;
        barrelGroup.add(barrelMesh);

        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.position.set(0, 0, barrelLen + 0.1);
        barrelGroup.add(muzzlePoint);

        turretGroup.add(barrelGroup);
        tankRoot.add(turretGroup);

        // Create View / Detection Circle on the ground around the Hound
        const detectionRadius = def.mechanics.detectionRadius;
        const ringGeo = new THREE.RingGeometry(detectionRadius - 0.4, detectionRadius, 48);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff3b30,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.y = 0.08; // slightly above ground to avoid z-fighting
        tankRoot.add(ringMesh);

        // Subtle radar disc filler
        const discGeo = new THREE.CircleGeometry(detectionRadius, 36);
        discGeo.rotateX(-Math.PI / 2);
        const discMat = new THREE.MeshBasicMaterial({
            color: 0xff3b30,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.07
        });
        const discMesh = new THREE.Mesh(discGeo, discMat);
        discMesh.position.y = 0.05;
        tankRoot.add(discMesh);

        return {
            root: tankRoot,
            hull: hull,
            turret: turretGroup,
            barrel: barrelGroup,
            muzzlePoint: muzzlePoint,
            detectionRing: ringMesh,
            detectionDisc: discMesh,
            def: def
        };
    }

    /**
     * Factory function by tank ID
     */
    static build(tankId) {
        switch (tankId.toLowerCase()) {
            case 'liberator':
                return this.buildLiberator();
            case 'hunter':
                return this.buildHunter();
            case 'royal':
                return this.buildRoyal();
            case 'bastion':
                return this.buildBastion();
            case 'hound':
                return this.buildHound();
            default:
                console.warn(`Unknown tank type ${tankId}, defaulting to Liberator`);
                return this.buildLiberator();
        }
    }
}

window.TankDefinitions = TankDefinitions;
window.TankBuilder = TankBuilder;
