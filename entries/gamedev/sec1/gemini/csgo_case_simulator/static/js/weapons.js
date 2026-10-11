/**
 * 3D Procedural Weapon Geometry Factory for CS:GO Case Simulator
 * Builds all 10 featured weapons with distinct authentic geometry:
 * 1. M4A1
 * 2. Ak47
 * 3. Desert Eagle
 * 4. Glock
 * 5. MP5
 * 6. P90
 * 7. BenelliM4
 * 8. Nova
 * 9. M249
 * 10. Negev
 */

class WeaponFactory {
    constructor() {
        this.darkMetal = new THREE.MeshStandardMaterial({
            color: 0x1b1f24,
            metalness: 0.85,
            roughness: 0.35,
        });
        this.steelMat = new THREE.MeshStandardMaterial({
            color: 0x3d434d,
            metalness: 0.9,
            roughness: 0.25,
        });
        this.woodMat = new THREE.MeshStandardMaterial({
            color: 0x5a2d13,
            roughness: 0.65,
            metalness: 0.1,
        });
    }

    createWeapon(weaponId, skin) {
        const mat = window.skinTextureGenerator.getMaterial(skin);
        const group = new THREE.Group();
        group.name = weaponId;

        switch (weaponId) {
            case 'M4A1':
                this.buildM4A1(group, mat);
                break;
            case 'Ak47':
                this.buildAK47(group, mat);
                break;
            case 'Desert Eagle':
                this.buildDesertEagle(group, mat);
                break;
            case 'Glock':
                this.buildGlock(group, mat);
                break;
            case 'MP5':
                this.buildMP5(group, mat);
                break;
            case 'P90':
                this.buildP90(group, mat);
                break;
            case 'BenelliM4':
                this.buildBenelliM4(group, mat);
                break;
            case 'Nova':
                this.buildNova(group, mat);
                break;
            case 'M249':
                this.buildM249(group, mat);
                break;
            case 'Negev':
                this.buildNegev(group, mat);
                break;
            default:
                this.buildAK47(group, mat);
        }

        // Standardize scaling & center pivot
        group.scale.set(1.5, 1.5, 1.5);
        return group;
    }

    // 1. M4A1-S (Silenced Tactical Carbine)
    buildM4A1(root, skinMat) {
        // Lower & Upper Receiver (Skin applied)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 1.4), skinMat);
        receiver.position.set(0, 0, 0);
        root.add(receiver);

        // Carry handle / Picatinny rail
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.0), this.darkMetal);
        rail.position.set(0, 0.28, -0.05);
        root.add(rail);

        // Handguard (Skin applied)
        const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16), skinMat);
        handguard.rotation.x = Math.PI / 2;
        handguard.position.set(0, 0.02, 1.2);
        root.add(handguard);

        // Barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12), this.darkMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, 2.0);
        root.add(barrel);

        // Suppressor / Silencer (Distinctive M4A1 feature, skin accent)
        const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.4, 24), skinMat);
        silencer.rotation.x = Math.PI / 2;
        silencer.position.set(0, 0.02, 2.9);
        root.add(silencer);

        // Buffer tube & Crane Stock (Skin applied)
        const buffer = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12), this.darkMetal);
        buffer.rotation.x = Math.PI / 2;
        buffer.position.set(0, 0.05, -1.0);
        root.add(buffer);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 1.0), skinMat);
        stock.position.set(0, -0.05, -1.5);
        root.add(stock);

        // Curved Magazine
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.35), this.steelMat);
        mag.rotation.x = 0.35;
        mag.position.set(0, -0.5, 0.25);
        root.add(mag);

        // Pistol grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.3), this.darkMetal);
        grip.rotation.x = -0.4;
        grip.position.set(0, -0.45, -0.4);
        root.add(grip);
    }

    // 2. AK-47 (Iconic Assault Rifle)
    buildAK47(root, skinMat) {
        // Stamped steel receiver (Skin applied)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 1.5), skinMat);
        receiver.position.set(0, 0, 0);
        root.add(receiver);

        // Top receiver cover
        const topCover = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 12), this.steelMat);
        topCover.rotation.x = Math.PI / 2;
        topCover.position.set(0, 0.26, -0.05);
        root.add(topCover);

        // Wooden / Custom Foregrip Handguard (Skin applied)
        const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 1.1), skinMat);
        foregrip.position.set(0, 0.05, 1.25);
        root.add(foregrip);

        // Gas tube on top
        const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 12), this.darkMetal);
        gasTube.rotation.x = Math.PI / 2;
        gasTube.position.set(0, 0.25, 1.3);
        root.add(gasTube);

        // Barrel with slant compensator
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 12), this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.08, 2.4);
        root.add(barrel);

        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.3, 12), this.darkMetal);
        muzzle.rotation.x = Math.PI / 2 + 0.1;
        muzzle.position.set(0, 0.08, 3.25);
        root.add(muzzle);

        // Iconic Curved Banana Magazine (Skin applied)
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.45), skinMat);
        mag.rotation.x = 0.55;
        mag.position.set(0, -0.65, 0.3);
        root.add(mag);

        // Wooden / Composite Buttstock (Skin applied)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 1.4), skinMat);
        stock.rotation.x = -0.15;
        stock.position.set(0, -0.15, -1.4);
        root.add(stock);

        // Pistol grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.3), this.darkMetal);
        grip.rotation.x = -0.45;
        grip.position.set(0, -0.48, -0.38);
        root.add(grip);
    }

    // 3. Desert Eagle (Heavy Caliber Handgun)
    buildDesertEagle(root, skinMat) {
        // Heavy triangular slide (Skin applied)
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.52, 1.7), skinMat);
        slide.position.set(0, 0.2, 0.2);
        root.add(slide);

        // Massive bore barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.2, 1.05);
        root.add(barrel);

        // Pistol frame & trigger guard
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 1.3), this.darkMetal);
        frame.position.set(0, -0.1, 0.1);
        root.add(frame);

        // Beavertail & grip (Skin applied on panels)
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.1, 0.5), skinMat);
        grip.rotation.x = -0.35;
        grip.position.set(0, -0.6, -0.2);
        root.add(grip);

        // Hammer
        const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.15), this.steelMat);
        hammer.rotation.x = -0.5;
        hammer.position.set(0, 0.4, -0.65);
        root.add(hammer);
    }

    // 4. Glock-18 (Compact Polymer Handgun)
    buildGlock(root, skinMat) {
        // Boxy slide (Skin applied)
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 1.4), skinMat);
        slide.position.set(0, 0.15, 0.15);
        root.add(slide);

        // Polymer lower frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 1.3), this.darkMetal);
        frame.position.set(0, -0.12, 0.15);
        root.add(frame);

        // Pistol grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.95, 0.42), skinMat);
        grip.rotation.x = -0.3;
        grip.position.set(0, -0.55, -0.15);
        root.add(grip);

        // Trigger guard
        const guard = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16, Math.PI), this.darkMetal);
        guard.rotation.z = Math.PI;
        guard.position.set(0, -0.25, 0.25);
        root.add(guard);
    }

    // 5. MP5-SD (Submachine Gun with Integral Silencer)
    buildMP5(root, skinMat) {
        // Main receiver (Skin applied)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 1.2), skinMat);
        receiver.position.set(0, 0, 0);
        root.add(receiver);

        // Ribbed integral cylindrical silencer shroud (Skin applied)
        const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 20), skinMat);
        silencer.rotation.x = Math.PI / 2;
        silencer.position.set(0, 0.05, 1.3);
        root.add(silencer);

        // Curved 9mm magazine
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.28), this.steelMat);
        mag.rotation.x = 0.4;
        mag.position.set(0, -0.55, 0.3);
        root.add(mag);

        // Dual wire retractable stock
        const stockWireL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), this.darkMetal);
        stockWireL.rotation.x = Math.PI / 2;
        stockWireL.position.set(0.14, 0.05, -1.1);
        root.add(stockWireL);

        const stockWireR = stockWireL.clone();
        stockWireR.position.x = -0.14;
        root.add(stockWireR);

        const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.15), skinMat);
        buttPad.position.set(0, 0.05, -1.75);
        root.add(buttPad);

        // Pistol grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.28), this.darkMetal);
        grip.rotation.x = -0.4;
        grip.position.set(0, -0.45, -0.3);
        root.add(grip);
    }

    // 6. P90 (Futuristic Bullpup SMG)
    buildP90(root, skinMat) {
        // Monolithic futuristic bullpup body (Skin applied)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 1.8), skinMat);
        body.position.set(0, 0, 0);
        root.add(body);

        // Front ergonomic thumbhole loop
        const frontGrip = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.08, 10, 20), skinMat);
        frontGrip.position.set(0, -0.4, 0.65);
        root.add(frontGrip);

        // Horizontal translucent top magazine
        const topMag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 1.4), this.steelMat);
        topMag.position.set(0, 0.45, 0.1);
        root.add(topMag);

        // Barrel & flash hider
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 12), this.darkMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, 1.15);
        root.add(barrel);

        // Rear stock curve
        const stockEnd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.3), this.darkMetal);
        stockEnd.position.set(0, -0.05, -1.0);
        root.add(stockEnd);
    }

    // 7. Benelli M4 (Tactical Shotgun)
    buildBenelliM4(root, skinMat) {
        // Shotgun receiver (Skin applied)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 1.4), skinMat);
        receiver.position.set(0, 0, 0);
        root.add(receiver);

        // Long shotgun barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.3, 16), this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.12, 1.7);
        root.add(barrel);

        // Under-barrel tubular magazine
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.0, 16), this.darkMetal);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(0, -0.08, 1.55);
        root.add(tube);

        // Ribbed tactical forend pump (Skin applied)
        const forend = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 16), skinMat);
        forend.rotation.x = Math.PI / 2;
        forend.position.set(0, 0.02, 1.2);
        root.add(forend);

        // Skeletonized tactical stock (Skin applied)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 1.3), skinMat);
        stock.position.set(0, -0.15, -1.35);
        root.add(stock);

        // Pistol grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.3), this.darkMetal);
        grip.rotation.x = -0.45;
        grip.position.set(0, -0.45, -0.35);
        root.add(grip);
    }

    // 8. Nova (Pump-Action Shotgun)
    buildNova(root, skinMat) {
        // Receiver (Skin applied)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 1.5), skinMat);
        receiver.position.set(0, 0, 0);
        root.add(receiver);

        // Long barrel with bead sight
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 16), this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.14, 1.9);
        root.add(barrel);

        // Magazine tube
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 16), this.darkMetal);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(0, -0.06, 1.75);
        root.add(tube);

        // Moving ribbed pump grip (Skin applied)
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.95), skinMat);
        pump.position.set(0, 0.02, 1.5);
        root.add(pump);

        // Solid polymer stock (Skin applied)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 1.5), skinMat);
        stock.rotation.x = -0.12;
        stock.position.set(0, -0.2, -1.45);
        root.add(stock);
    }

    // 9. M249 (Heavy Squad Automatic Machine Gun)
    buildM249(root, skinMat) {
        // Massive heavy receiver (Skin applied)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 1.7), skinMat);
        receiver.position.set(0, 0, 0);
        root.add(receiver);

        // Ammo box magazine (200-round box)
        const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.55), this.steelMat);
        ammoBox.position.set(0.12, -0.65, 0.15);
        root.add(ammoBox);

        // Perforated barrel heat shroud (Skin applied)
        const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.6, 16), skinMat);
        shroud.rotation.x = Math.PI / 2;
        shroud.position.set(0, 0.08, 1.55);
        root.add(shroud);

        // Barrel & flash hider
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 12), this.darkMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.08, 2.7);
        root.add(barrel);

        // Top carry handle
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16, Math.PI), this.darkMetal);
        handle.rotation.y = Math.PI / 2;
        handle.position.set(0, 0.55, 0.9);
        root.add(handle);

        // Folding Bipod
        const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), this.darkMetal);
        bipodL.rotation.z = 0.35;
        bipodL.position.set(0.35, -0.4, 2.1);
        root.add(bipodL);

        const bipodR = bipodL.clone();
        bipodR.rotation.z = -0.35;
        bipodR.position.x = -0.35;
        root.add(bipodR);

        // Heavy composite stock (Skin applied)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 1.3), skinMat);
        stock.position.set(0, -0.1, -1.5);
        root.add(stock);

        // Pistol grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.32), this.darkMetal);
        grip.rotation.x = -0.4;
        grip.position.set(0, -0.5, -0.3);
        root.add(grip);
    }

    // 10. Negev (High-Capacity Suppressive LMG)
    buildNegev(root, skinMat) {
        // Heavy rugged receiver (Skin applied)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 1.6), skinMat);
        receiver.position.set(0, 0, 0);
        root.add(receiver);

        // Round drum magazine
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.45, 24), this.steelMat);
        drum.rotation.z = Math.PI / 2;
        drum.position.set(0, -0.65, 0.1);
        root.add(drum);

        // Heavy slotted heat shield (Skin applied)
        const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.7, 20), skinMat);
        heatShield.rotation.x = Math.PI / 2;
        heatShield.position.set(0, 0.12, 1.55);
        root.add(heatShield);

        // Forward vertical tactical handgrip
        const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12), this.darkMetal);
        foregrip.position.set(0, -0.4, 1.35);
        root.add(foregrip);

        // Heavy reinforced stock (Skin applied)
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 1.4), skinMat);
        stock.position.set(0, -0.05, -1.5);
        root.add(stock);

        // Barrel tip
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 16), this.darkMetal);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, 0.12, 2.7);
        root.add(muzzle);

        // Pistol grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.35), this.darkMetal);
        grip.rotation.x = -0.42;
        grip.position.set(0, -0.52, -0.32);
        root.add(grip);
    }
}

window.weaponFactory = new WeaponFactory();
