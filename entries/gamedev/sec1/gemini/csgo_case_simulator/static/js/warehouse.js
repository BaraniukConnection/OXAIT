/**
 * 3D Warehouse / Storage Room Environment for CS:GO Case Simulator
 * Features:
 * - Weathered industrial storage room (walls, concrete floor, steel girders, industrial racks)
 * - Wooden crates, steel drums, pallet shelves
 * - Right Station: Desk with PC monitor (Buy cases & Skin market)
 * - Left Station: Heavy workbench (Case opening station with 3D case model)
 * - Center Station: 3D Weapon inspection turntable
 * - Atmospheric lighting, spotlight cones, floating dust particles
 */

class WarehouseEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.dustParticles = null;
        this.caseModel = null;
        this.caseLid = null;
        this.monitorScreenMesh = null;
        this.pedestalGroup = null;
        this.clickableObjects = [];

        this.initTextures();
        this.buildRoom();
        this.buildRightPCStation();
        this.buildLeftOpeningStation();
        this.buildCenterInspectionStation();
        this.buildWarehouseProps();
        this.setupLighting();
        this.setupDustParticles();
    }

    initTextures() {
        // Procedural floor canvas texture
        const floorCanvas = document.createElement('canvas');
        floorCanvas.width = 512;
        floorCanvas.height = 512;
        const fctx = floorCanvas.getContext('2d');
        fctx.fillStyle = '#1c1f24';
        fctx.fillRect(0, 0, 512, 512);
        
        // Concrete seams & grunge
        fctx.strokeStyle = '#121418';
        fctx.lineWidth = 4;
        fctx.strokeRect(0, 0, 256, 256);
        fctx.strokeRect(256, 0, 256, 256);
        fctx.strokeRect(0, 256, 256, 256);
        fctx.strokeRect(256, 256, 256, 256);

        // Yellow hazard border lines
        fctx.fillStyle = '#d4ac0d';
        for (let i = 0; i < 512; i += 40) {
            fctx.fillRect(i, 490, 20, 22);
            fctx.fillRect(i, 0, 20, 22);
        }

        this.floorTex = new THREE.CanvasTexture(floorCanvas);
        this.floorTex.wrapS = THREE.RepeatWrapping;
        this.floorTex.wrapT = THREE.RepeatWrapping;
        this.floorTex.repeat.set(4, 4);

        // Procedural wall canvas texture
        const wallCanvas = document.createElement('canvas');
        wallCanvas.width = 512;
        wallCanvas.height = 512;
        const wctx = wallCanvas.getContext('2d');
        wctx.fillStyle = '#262a33';
        wctx.fillRect(0, 0, 512, 512);
        wctx.strokeStyle = '#181b22';
        wctx.lineWidth = 2;
        for (let y = 0; y < 512; y += 32) {
            wctx.beginPath();
            wctx.moveTo(0, y);
            wctx.lineTo(512, y);
            wctx.stroke();
        }
        this.wallTex = new THREE.CanvasTexture(wallCanvas);
        this.wallTex.wrapS = THREE.RepeatWrapping;
        this.wallTex.wrapT = THREE.RepeatWrapping;
        this.wallTex.repeat.set(6, 3);
    }

    buildRoom() {
        const roomW = 20;
        const roomH = 8;
        const roomD = 16;

        // Floor
        const floorMat = new THREE.MeshStandardMaterial({
            map: this.floorTex,
            roughness: 0.85,
            metalness: 0.15,
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Ceiling with steel girders
        const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.9 });
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = roomH - 2;
        this.scene.add(ceiling);

        // Back Wall
        const wallMat = new THREE.MeshStandardMaterial({
            map: this.wallTex,
            roughness: 0.9,
            metalness: 0.2,
        });
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
        backWall.position.set(0, roomH / 2 - 2, -roomD / 2);
        this.scene.add(backWall);

        // Left Wall
        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-roomW / 2, roomH / 2 - 2, 0);
        this.scene.add(leftWall);

        // Right Wall
        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(roomW / 2, roomH / 2 - 2, 0);
        this.scene.add(rightWall);

        // Structural Steel I-Beams / Girders
        const girderMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.8, roughness: 0.4 });
        for (let x = -8; x <= 8; x += 8) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, roomD), girderMat);
            beam.position.set(x, roomH - 2.3, 0);
            this.scene.add(beam);

            // Vertical support pillars
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, roomH, 0.5), girderMat);
            pillar.position.set(x, roomH / 2 - 2, -roomD / 2 + 0.3);
            this.scene.add(pillar);
        }
    }

    // Right Station: Desk with PC Monitor (Buy cases & Skin market)
    buildRightPCStation() {
        const pcStation = new THREE.Group();
        pcStation.position.set(6.8, -2, 0.5);
        pcStation.rotation.y = -Math.PI / 2;

        const woodDeskMat = new THREE.MeshStandardMaterial({ color: 0x2b2520, roughness: 0.7 });
        const metalFrameMat = new THREE.MeshStandardMaterial({ color: 0x1f2228, metalness: 0.8, roughness: 0.3 });

        // Desk tabletop
        const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 1.8), woodDeskMat);
        deskTop.position.set(0, 1.8, 0);
        pcStation.add(deskTop);

        // Desk legs
        const legGeom = new THREE.BoxGeometry(0.12, 1.8, 0.12);
        [[-1.6, 0.9, -0.75], [1.6, 0.9, -0.75], [-1.6, 0.9, 0.75], [1.6, 0.9, 0.75]].forEach(pos => {
            const leg = new THREE.Mesh(legGeom, metalFrameMat);
            leg.position.set(...pos);
            pcStation.add(leg);
        });

        // PC Monitor Casing
        const monitorCaseMat = new THREE.MeshStandardMaterial({ color: 0x252a32, metalness: 0.5, roughness: 0.5 });
        const monitorStand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.4, 16), monitorCaseMat);
        monitorStand.position.set(0, 2.05, -0.2);
        pcStation.add(monitorStand);

        const monitorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.15), monitorCaseMat);
        monitorFrame.position.set(0, 2.75, -0.2);
        pcStation.add(monitorFrame);

        // Glowing Screen Canvas (Shows CS:GO Shop & Market interface in 3D!)
        const screenCanvas = document.createElement('canvas');
        screenCanvas.width = 512;
        screenCanvas.height = 340;
        const sctx = screenCanvas.getContext('2d');
        sctx.fillStyle = '#0a1017';
        sctx.fillRect(0, 0, 512, 340);
        sctx.fillStyle = '#00f0ff';
        sctx.font = 'bold 28px monospace';
        sctx.fillText('CS:GO BLACK MARKET', 40, 55);
        sctx.fillStyle = '#8fa3b8';
        sctx.font = '18px monospace';
        sctx.fillText('ONLINE // CASE SHOP & SKIN EXCHANGE', 40, 90);
        
        // Mock UI bars
        sctx.fillStyle = '#1e2d3d';
        sctx.fillRect(40, 120, 432, 45);
        sctx.fillStyle = '#00f0ff';
        sctx.fillText('> ASSAULT CASE  $170  [BUY]', 55, 150);

        sctx.fillStyle = '#1e2d3d';
        sctx.fillRect(40, 180, 432, 45);
        sctx.fillStyle = '#ffd700';
        sctx.fillText('> LEGENDARY CASE $2500 [BUY]', 55, 210);

        sctx.fillStyle = '#39ff14';
        sctx.fillText('CLICK MONITOR TO OPEN PC SHOP', 70, 290);

        const screenTexture = new THREE.CanvasTexture(screenCanvas);
        const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
        this.monitorScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.05), screenMat);
        this.monitorScreenMesh.position.set(0, 2.75, -0.12);
        this.monitorScreenMesh.userData = { action: 'station-right' };
        pcStation.add(this.monitorScreenMesh);
        this.clickableObjects.push(this.monitorScreenMesh);

        // Monitor Phosphor Screen Light
        const screenLight = new THREE.PointLight(0x00f0ff, 1.8, 4.5);
        screenLight.position.set(0, 2.8, 0.4);
        pcStation.add(screenLight);

        // Keyboard & Mouse
        const kbMat = new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.5 });
        const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.35), kbMat);
        keyboard.position.set(0, 1.9, 0.25);
        pcStation.add(keyboard);

        const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.2), kbMat);
        mouse.position.set(0.65, 1.9, 0.25);
        pcStation.add(mouse);

        // PC Tower under desk
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.8), monitorCaseMat);
        tower.position.set(1.2, 0.45, 0.2);
        pcStation.add(tower);

        // Interactive "PC SHOP" 3D Sign above
        this.scene.add(pcStation);
    }

    // Left Station: Heavy Workbench (Case opening station)
    buildLeftOpeningStation() {
        const benchStation = new THREE.Group();
        benchStation.position.set(-6.8, -2, 0.5);
        benchStation.rotation.y = Math.PI / 2;

        const steelBenchMat = new THREE.MeshStandardMaterial({ color: 0x323a45, metalness: 0.85, roughness: 0.3 });
        const benchTopMat = new THREE.MeshStandardMaterial({ color: 0x1f242c, metalness: 0.7, roughness: 0.4 });

        // Heavy industrial workbench
        const benchTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.8), benchTopMat);
        benchTop.position.set(0, 1.8, 0);
        benchStation.add(benchTop);

        // Steel frame legs
        const legGeom = new THREE.BoxGeometry(0.16, 1.8, 0.16);
        [[-1.65, 0.9, -0.75], [1.65, 0.9, -0.75], [-1.65, 0.9, 0.75], [1.65, 0.9, 0.75]].forEach(pos => {
            const leg = new THREE.Mesh(legGeom, steelBenchMat);
            leg.position.set(...pos);
            benchStation.add(leg);
        });

        // 3D CS:GO Case Model on Workbench
        this.caseModel = new THREE.Group();
        this.caseModel.position.set(0, 2.1, 0);
        this.caseModel.userData = { action: 'station-left' };

        // Case Base
        const caseBodyMat = new THREE.MeshStandardMaterial({
            color: 0x22262c,
            metalness: 0.6,
            roughness: 0.35,
        });
        const caseBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.9), caseBodyMat);
        caseBody.position.set(0, 0, 0);
        this.caseModel.add(caseBody);

        // Case Lid (Animated during opening)
        this.caseLid = new THREE.Group();
        this.caseLid.position.set(0, 0.2, -0.45); // hinge at back
        const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.25, 0.92), caseBodyMat);
        lidMesh.position.set(0, 0.12, 0.45);
        this.caseLid.add(lidMesh);

        // Glowing Case Accent Strip
        this.caseGlowMat = new THREE.MeshBasicMaterial({ color: 0xffa502 });
        const glowStripe = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.05, 0.94), this.caseGlowMat);
        glowStripe.position.set(0, 0.05, 0.45);
        this.caseLid.add(glowStripe);

        // Metal latches
        const latchMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.9, roughness: 0.2 });
        [-0.45, 0.45].forEach(lx => {
            const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), latchMat);
            latch.position.set(lx, 0.1, 0.92);
            this.caseLid.add(latch);
        });

        this.caseModel.add(this.caseLid);
        benchStation.add(this.caseModel);
        this.clickableObjects.push(caseBody);

        // Task Spotlight directly over the opening table
        const benchSpotlight = new THREE.SpotLight(0xfffae6, 2.5, 9, Math.PI / 4, 0.35);
        benchSpotlight.position.set(0, 5.5, 0);
        benchSpotlight.target = this.caseModel;
        benchStation.add(benchSpotlight);

        // Bench Vise tool
        const vise = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.45), steelBenchMat);
        vise.position.set(-1.4, 2.05, 0.6);
        benchStation.add(vise);

        this.scene.add(benchStation);
    }

    // Center Station: 3D Weapon Inspection Pedestal
    buildCenterInspectionStation() {
        this.pedestalGroup = new THREE.Group();
        this.pedestalGroup.position.set(0, -2, 0);

        // Circular Neon Turntable Base
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x171a21, metalness: 0.8, roughness: 0.3 });
        const baseCylinder = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.3, 32), baseMat);
        baseCylinder.position.y = 0.15;
        this.pedestalGroup.add(baseCylinder);

        // Inner glowing ring
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.04, 16, 48), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.31;
        this.pedestalGroup.add(ring);

        // Soft teal floor glow from pedestal
        const pedestalLight = new THREE.PointLight(0x00f0ff, 1.2, 5);
        pedestalLight.position.set(0, 0.5, 0);
        this.pedestalGroup.add(pedestalLight);

        this.scene.add(this.pedestalGroup);
    }

    // Warehouse Props (Pallet shelves, crates, barrels)
    buildWarehouseProps() {
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x6e5033, roughness: 0.85 });
        const drumMat = new THREE.MeshStandardMaterial({ color: 0x223547, metalness: 0.7, roughness: 0.4 });
        const rackMat = new THREE.MeshStandardMaterial({ color: 0xd35400, metalness: 0.5, roughness: 0.5 }); // Industrial orange racks

        // Pallet racks at back corners
        [-7.5, 7.5].forEach(rx => {
            const rack = new THREE.Group();
            rack.position.set(rx, -2, -6.2);

            // Uprights
            for (let x = -1.5; x <= 1.5; x += 3.0) {
                for (let z = -0.8; z <= 0.8; z += 1.6) {
                    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6, 0.12), rackMat);
                    post.position.set(x, 3, z);
                    rack.add(post);
                }
            }

            // Shelves
            [1.2, 3.2, 5.2].forEach(sy => {
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.8), rackMat);
                shelf.position.set(0, sy, 0);
                rack.add(shelf);

                // Crates on shelves
                const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.2), crateMat);
                crate.position.set((Math.random() - 0.5) * 1.2, sy + 0.5, 0);
                rack.add(crate);
            });

            this.scene.add(rack);
        });

        // Oil drums in left corner
        [[-7.8, -1.2, 5], [-7.2, -1.2, 5.6], [-7.6, -1.2, 6.2]].forEach(pos => {
            const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 20), drumMat);
            drum.position.set(...pos);
            this.scene.add(drum);
        });
    }

    setupLighting() {
        // Ambient cool warehouse light
        const ambient = new THREE.AmbientLight(0x283244, 1.4);
        this.scene.add(ambient);

        // Hanging industrial lamps from ceiling
        const lampPositions = [
            [-3.5, 5.0, -1.5],
            [3.5, 5.0, -1.5],
            [0, 5.2, 3.5],
        ];

        lampPositions.forEach(pos => {
            // Cable
            const cable = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8),
                new THREE.MeshBasicMaterial({ color: 0x111111 })
            );
            cable.position.set(pos[0], pos[1] + 0.75, pos[2]);
            this.scene.add(cable);

            // Industrial Shade
            const shade = new THREE.Mesh(
                new THREE.ConeGeometry(0.5, 0.4, 16, 1, true),
                new THREE.MeshStandardMaterial({ color: 0x333b45, metalness: 0.8, roughness: 0.3 })
            );
            shade.position.set(pos[0], pos[1], pos[2]);
            this.scene.add(shade);

            // Spotlight pointing down
            const spot = new THREE.SpotLight(0xffe6b3, 2.2, 12, Math.PI / 3.5, 0.45);
            spot.position.set(pos[0], pos[1], pos[2]);
            spot.target.position.set(pos[0], -2, pos[2]);
            this.scene.add(spot);
            this.scene.add(spot.target);
        });
    }

    setupDustParticles() {
        const particleCount = 220;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 18;
            positions[i + 1] = Math.random() * 7 - 1.5;
            positions[i + 2] = (Math.random() - 0.5) * 14;
        }

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xffeeaa,
            size: 0.06,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
        });

        this.dustParticles = new THREE.Points(geom, mat);
        this.scene.add(this.dustParticles);
    }

    update(delta) {
        // Animate dust particles slowly floating
        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            for (let i = 1; i < positions.length; i += 3) {
                positions[i] -= delta * 0.15;
                if (positions[i] < -2) positions[i] = 5.5;
            }
            this.dustParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    // Trigger lid opening animation for 3D case
    animateCaseOpen(duration = 1.2) {
        if (!this.caseLid) return;
        const startRot = this.caseLid.rotation.x;
        const targetRot = -Math.PI * 0.55; // Swing lid open backwards
        const startTime = performance.now();

        const step = (now) => {
            const elapsed = (now - startTime) / 1000;
            const t = Math.min(1, elapsed / duration);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            this.caseLid.rotation.x = startRot + (targetRot - startRot) * ease;
            if (t < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }

    // Reset lid to closed
    resetCase() {
        if (this.caseLid) {
            this.caseLid.rotation.x = 0;
        }
    }

    setCaseGlowColor(colorHex) {
        if (this.caseGlowMat) {
            this.caseGlowMat.color.set(colorHex);
        }
    }
}

window.WarehouseEnvironment = WarehouseEnvironment;
