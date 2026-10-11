/**
 * Main Game Controller & Simulation Engine
 * Arcade Tank Simulator
 * Coordinates:
 *  - 3D Tank Showcase & Selection Flow
 *  - WASD Hull Driving Physics & Neutral Track Steering
 *  - Independent Mouse Turret Aiming & Gun Elevation
 *  - LMB Cannon Fire & RMB Optic Sight Zoom
 *  - T-80 "Hound" Static AI Detection Circles & Attack State Machine
 *  - Victory / Defeat Lifecycle
 */

class TankSimGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.canvas = document.getElementById('webgl-canvas');

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Subsystems
        this.cityMap = null;
        this.projectileMgr = null;
        this.hud = null;

        // Game State
        this.state = 'MENU'; // 'MENU', 'PLAYING', 'VICTORY', 'GAMEOVER'
        this.selectedTankId = 'bastion'; // Default selected
        this.playerTank = null;
        this.hounds = [];
        this.totalHounds = 8;

        // Player Control State
        this.keys = {
            KeyW: false,
            KeyS: false,
            KeyA: false,
            KeyD: false
        };
        this.mousePos = new THREE.Vector2(0, 0); // Normalized device coordinates (-1 to +1)
        this.screenMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.aimTargetWorld = new THREE.Vector3(0, 1.5, 0);
        this.gunActualWorld = new THREE.Vector3(0, 1.5, 0);

        // Player Combat State
        this.currentHp = 100;
        this.maxHp = 100;
        this.speed = 0; // Current velocity (m/s)
        this.reloadTimer = 0;
        this.isReloading = false;
        this.isSightZoomed = false;
        this.barrelRecoilOffset = 0;

        // Camera Spring Arm
        this.cameraTargetPos = new THREE.Vector3();
        this.cameraTargetLook = new THREE.Vector3();
        this.screenShake = 0;

        // Menu Showcase Pedestal
        this.menuPedestal = null;
        this.menuShowcaseTank = null;

        // UI Modals
        this.startMenu = document.getElementById('start-menu');
        this.hudOverlay = document.getElementById('game-hud');
        this.victoryModal = document.getElementById('victory-modal');
        this.defeatModal = document.getElementById('defeat-modal');

        this.init();
    }

    init() {
        // 1. Setup Three.js Scene, Camera, Renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x8fa3b5);
        this.scene.fog = new THREE.FogExp2(0x8fa3b5, 0.0055);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 800);
        this.camera.position.set(0, 6, 12);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 2. Lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.65);
        this.scene.add(hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfff8ee, 1.25);
        this.sunLight.position.set(120, 180, 80);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 400;
        const d = 160;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0008;
        this.scene.add(this.sunLight);

        // 3. Initialize Subsystems
        this.hud = new HUD();
        this.projectileMgr = new ProjectileManager(this.scene);
        this.cityMap = new CityMap(this.scene, { mapSize: 360 });
        this.cityMap.generate();

        // 4. Setup Hangar Showcase for Main Menu
        this.setupShowcasePedestal();
        this.updateShowcaseTank(this.selectedTankId);

        // 5. Event Listeners
        this.setupEventListeners();

        // 6. Start Main Animation Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupShowcasePedestal() {
        this.menuPedestal = new THREE.Group();
        this.menuPedestal.position.set(0, 0, 0);

        // Cylindrical turntable
        const tableGeo = new THREE.CylinderGeometry(5.2, 5.6, 0.6, 32);
        const tableMat = new THREE.MeshStandardMaterial({
            color: 0x2b3036,
            roughness: 0.5,
            metalness: 0.5,
            flatShading: true
        });
        const tableMesh = new THREE.Mesh(tableGeo, tableMat);
        tableMesh.position.y = 0.3;
        tableMesh.receiveShadow = true;
        this.menuPedestal.add(tableMesh);

        // Glowing perimeter ring
        const ringGeo = new THREE.RingGeometry(4.8, 5.1, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.y = 0.62;
        this.menuPedestal.add(ringMesh);

        this.scene.add(this.menuPedestal);
    }

    updateShowcaseTank(tankId) {
        if (this.menuShowcaseTank) {
            this.menuPedestal.remove(this.menuShowcaseTank.root);
            this.menuShowcaseTank = null;
        }

        const tank = TankBuilder.build(tankId);
        tank.root.position.set(0, 0.6, 0);
        this.menuShowcaseTank = tank;
        this.menuPedestal.add(tank.root);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING') return;
            if (e.code in this.keys) {
                this.keys[e.code] = true;
            }
            if (e.code === 'KeyM') {
                if (window.soundEngine) window.soundEngine.toggleMute();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code in this.keys) {
                this.keys[e.code] = false;
            }
        });

        // Mouse Move for Aiming
        window.addEventListener('mousemove', (e) => {
            this.screenMouse.x = e.clientX;
            this.screenMouse.y = e.clientY;
            this.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Mouse Down for Shoot (LMB) & Sight (RMB)
        window.addEventListener('mousedown', (e) => {
            if (this.state !== 'PLAYING') return;

            // Initialize sound engine on first user interaction
            if (window.soundEngine) window.soundEngine.resume();

            if (e.button === 0) { // Left Mouse Button: FIRE!
                this.firePlayerCannon();
            } else if (e.button === 2) { // Right Mouse Button: SIGHT OPTIC
                e.preventDefault();
                this.toggleSightMode(true);
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (this.state !== 'PLAYING') return;
            if (e.button === 2) { // RMB release
                this.toggleSightMode(false);
            }
        });

        // Disable browser right-click context menu
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // Tank Selection Card Clicks
        document.querySelectorAll('.tank-card').forEach((card) => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.tank-card').forEach((c) => c.classList.remove('selected'));
                card.classList.add('selected');
                const tankId = card.getAttribute('data-tank');
                this.selectedTankId = tankId;
                this.updateShowcaseTank(tankId);
                if (window.soundEngine) window.soundEngine.playSightToggle(true);
            });
        });

        // Start Game Button
        const startBtn = document.getElementById('start-game-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startGame();
            });
        }

        // Retry / Play Again Buttons
        document.querySelectorAll('.btn-restart').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.returnToMenu();
            });
        });
    }

    startGame() {
        if (window.soundEngine) {
            window.soundEngine.init();
            window.soundEngine.resume();
            window.soundEngine.startEngine();
        }

        // Clean up menu pedestal
        if (this.menuShowcaseTank) {
            this.menuPedestal.remove(this.menuShowcaseTank.root);
            this.menuShowcaseTank = null;
        }
        this.menuPedestal.visible = false;

        // Hide start menu, show HUD
        this.startMenu.classList.add('hidden');
        this.victoryModal.classList.add('hidden');
        this.defeatModal.classList.add('hidden');
        this.hudOverlay.classList.remove('hidden');

        // Spawn Player Tank
        this.spawnPlayer(this.selectedTankId);

        // Spawn Random Static T-80 "Hound" targets around map
        this.spawnHounds(this.totalHounds);

        // Initialize HUD
        this.hud.init(this.playerTank.def, this.hounds.length);

        this.state = 'PLAYING';
    }

    returnToMenu() {
        if (window.soundEngine) {
            window.soundEngine.stopEngine();
        }

        // Clear player tank
        if (this.playerTank) {
            this.scene.remove(this.playerTank.root);
            this.playerTank = null;
        }

        // Clear hounds
        for (let i = 0; i < this.hounds.length; i++) {
            this.scene.remove(this.hounds[i].root);
        }
        this.hounds = [];

        // Restore showcase pedestal
        this.menuPedestal.visible = true;
        this.updateShowcaseTank(this.selectedTankId);

        // UI state
        this.hudOverlay.classList.add('hidden');
        this.victoryModal.classList.add('hidden');
        this.defeatModal.classList.add('hidden');
        this.startMenu.classList.remove('hidden');

        this.state = 'MENU';
    }

    spawnPlayer(tankId) {
        this.playerTank = TankBuilder.build(tankId);
        const spawnPos = this.cityMap.playerSpawnPoint;
        this.playerTank.root.position.set(spawnPos.x, 0, spawnPos.z);
        this.playerTank.root.rotation.y = Math.PI; // Face north into the city

        this.scene.add(this.playerTank.root);

        const def = this.playerTank.def;
        this.maxHp = def.mechanics.maxHp;
        this.currentHp = this.maxHp;
        this.speed = 0;
        this.reloadTimer = 0;
        this.isReloading = false;
        this.playerTank.hp = this.currentHp;
    }

    spawnHounds(count) {
        // Clear previous
        for (let i = 0; i < this.hounds.length; i++) {
            this.scene.remove(this.hounds[i].root);
        }
        this.hounds = [];

        const spawnPoints = this.cityMap.getRandomHoundSpawns(count);

        spawnPoints.forEach((pos, idx) => {
            const hound = TankBuilder.build('hound');
            hound.id = `hound_${idx + 1}`;
            hound.root.position.copy(pos);
            hound.root.rotation.y = Math.random() * Math.PI * 2;

            hound.hp = hound.def.mechanics.maxHp;
            hound.maxHp = hound.hp;
            hound.isAttacking = false;
            hound.reloadTimer = Math.random() * 1.5; // Staggered initial reload
            hound.aimAzimuth = hound.root.rotation.y;
            hound.isDestroyed = false;

            this.scene.add(hound.root);
            this.hounds.push(hound);
        });

        console.log(`[Game] Spawned ${this.hounds.length} T-80 Hounds across the city.`);
    }

    toggleSightMode(active) {
        if (this.isSightZoomed === active) return;
        this.isSightZoomed = active;

        if (window.soundEngine) {
            window.soundEngine.playSightToggle(active);
        }

        // Camera FOV transition
        this.camera.fov = active ? 22 : 60;
        this.camera.updateProjectionMatrix();

        this.hud.setSightMode(active);
    }

    firePlayerCannon() {
        if (!this.playerTank || this.playerTank.isDestroyed || this.isReloading) return;

        const muzzleWorld = new THREE.Vector3();
        this.playerTank.muzzlePoint.getWorldPosition(muzzleWorld);

        // Fire direction along barrel
        const fireDir = new THREE.Vector3();
        this.playerTank.barrel.getWorldDirection(fireDir);

        const def = this.playerTank.def.mechanics;
        this.projectileMgr.spawnShell(
            muzzleWorld,
            fireDir,
            def.bulletSpeed,
            def.damage,
            true,
            this.playerTank
        );

        // Recoil effect
        this.barrelRecoilOffset = 0.45;

        // Camera screenshake
        this.screenShake = 0.28;

        // Start reload cycle
        this.isReloading = true;
        this.reloadTimer = def.reloadTime;
    }

    fireHoundCannon(hound) {
        if (!hound || hound.isDestroyed) return;

        const muzzleWorld = new THREE.Vector3();
        hound.muzzlePoint.getWorldPosition(muzzleWorld);

        const fireDir = new THREE.Vector3();
        hound.barrel.getWorldDirection(fireDir);

        const def = hound.def.mechanics;
        this.projectileMgr.spawnShell(
            muzzleWorld,
            fireDir,
            def.bulletSpeed,
            def.damage,
            false,
            hound
        );

        hound.reloadTimer = def.reloadTime;
    }

    /**
     * Updates player physics: WASD driving, track steering, collision sliding
     */
    updatePlayerPhysics(dt) {
        if (!this.playerTank || this.playerTank.isDestroyed) return;

        const def = this.playerTank.def.mechanics;
        const root = this.playerTank.root;

        // 1. Steering (A / D) - neutral track steering rotates hull in place
        let steerInput = 0;
        if (this.keys.KeyA) steerInput += 1;
        if (this.keys.KeyD) steerInput -= 1;

        if (steerInput !== 0) {
            root.rotation.y += steerInput * def.turnSpeed * dt;
        }

        // 2. Throttle (W / S) - Forward and Reverse
        let throttleInput = 0;
        if (this.keys.KeyW) throttleInput += 1;
        if (this.keys.KeyS) throttleInput -= 0.6; // Reverse is slower

        const targetSpeed = throttleInput * def.maxSpeed;
        const accelRate = throttleInput !== 0 ? def.acceleration : def.acceleration * 1.5;

        // Accelerate or brake toward target speed
        if (this.speed < targetSpeed) {
            this.speed = Math.min(targetSpeed, this.speed + accelRate * dt);
        } else if (this.speed > targetSpeed) {
            this.speed = Math.max(targetSpeed, this.speed - accelRate * dt);
        }

        // 3. Move along tank heading
        const isMoving = Math.abs(this.speed) > 0.1 || steerInput !== 0;
        if (Math.abs(this.speed) > 0.01) {
            const forwardX = Math.sin(root.rotation.y) * this.speed * dt;
            const forwardZ = Math.cos(root.rotation.y) * this.speed * dt;

            const desiredX = root.position.x + forwardX;
            const desiredZ = root.position.z + forwardZ;

            // Resolve collision sliding against city buildings & obstacles
            const collisionRes = this.cityMap.resolveTankCollision(desiredX, desiredZ, 2.4);
            root.position.x = collisionRes.x;
            root.position.z = collisionRes.z;

            // Slight speed damping if rubbing against building
            if (collisionRes.collided) {
                this.speed *= 0.94;
            }
        }

        // 4. Update Engine Audio
        if (window.soundEngine) {
            const speedFraction = Math.abs(this.speed) / def.maxSpeed;
            window.soundEngine.updateEngine(speedFraction, isMoving);
        }

        // 5. Barrel Recoil restoration
        if (this.barrelRecoilOffset > 0) {
            this.barrelRecoilOffset = Math.max(0, this.barrelRecoilOffset - dt * 2.5);
            this.playerTank.barrel.position.z = 1.8 - this.barrelRecoilOffset;
        }

        // 6. Reload timer update
        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.isReloading = false;
                if (window.soundEngine) window.soundEngine.playReload();
            }
        }
    }

    /**
     * Mouse Turret Aiming and Gun Elevation
     */
    updatePlayerTurret(dt) {
        if (!this.playerTank || this.playerTank.isDestroyed) return;

        // Cast ray from camera through mouse cursor onto ground plane
        this.raycaster.setFromCamera(this.mousePos, this.camera);
        const intersectPoint = new THREE.Vector3();

        if (this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint)) {
            this.aimTargetWorld.copy(intersectPoint);
        }

        const turret = this.playerTank.turret;
        const root = this.playerTank.root;

        // Calculate world vector from turret center to aim target
        const turretWorldPos = new THREE.Vector3();
        turret.getWorldPosition(turretWorldPos);

        const dx = this.aimTargetWorld.x - turretWorldPos.x;
        const dz = this.aimTargetWorld.z - turretWorldPos.z;
        const targetWorldAngle = Math.atan2(dx, dz);

        // Convert world angle to local turret angle relative to tank hull
        let localTargetAngle = targetWorldAngle - root.rotation.y;

        // Normalize angle to -PI..PI
        while (localTargetAngle > Math.PI) localTargetAngle -= Math.PI * 2;
        while (localTargetAngle < -Math.PI) localTargetAngle += Math.PI * 2;

        // Smoothly traverse turret toward target angle with rate limit
        const turnSpeed = this.playerTank.def.mechanics.turretTurnSpeed;
        const diff = localTargetAngle - turret.rotation.y;
        let delta = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;

        const maxStep = turnSpeed * dt;
        if (Math.abs(delta) <= maxStep) {
            turret.rotation.y = localTargetAngle;
        } else {
            turret.rotation.y += Math.sign(delta) * maxStep;
        }

        // Calculate gun elevation/depression based on distance
        const distToAim = Math.hypot(dx, dz);
        const targetPitch = Math.max(-0.08, Math.min(0.25, -Math.atan2(0.5, distToAim)));
        this.playerTank.barrel.rotation.x = targetPitch;
    }

    /**
     * Hound AI: Detection Circles, LOS Checking, Aiming & Attacking
     */
    updateHoundAI(dt) {
        if (!this.playerTank) return;
        const playerPos = this.playerTank.root.position;
        let alertingCount = 0;

        for (let i = 0; i < this.hounds.length; i++) {
            const hound = this.hounds[i];
            if (hound.isDestroyed) continue;

            const houndPos = hound.root.position;
            const distToPlayer = Math.hypot(playerPos.x - houndPos.x, playerPos.z - houndPos.z);
            const detectionRadius = hound.def.mechanics.detectionRadius;

            // Check if player entered Hound's view circle
            if (distToPlayer <= detectionRadius && !this.playerTank.isDestroyed) {
                // Check if Hound has direct line of sight to player (not blocked by buildings)
                const hasLOS = this.cityMap.hasLineOfSight(houndPos, playerPos);

                if (hasLOS) {
                    if (!hound.isAttacking) {
                        hound.isAttacking = true;
                        if (window.soundEngine) window.soundEngine.playAlarm();
                        // Turn detection disc pulsing red
                        if (hound.detectionDisc) hound.detectionDisc.material.color.setHex(0xff1111);
                        if (hound.detectionRing) hound.detectionRing.material.color.setHex(0xff1111);
                    }
                    alertingCount++;

                    // Aim turret at player
                    const dx = playerPos.x - houndPos.x;
                    const dz = playerPos.z - houndPos.z;
                    const targetAngle = Math.atan2(dx, dz) - hound.root.rotation.y;

                    // Normalize angle
                    let diff = ((targetAngle - hound.turret.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
                    const turnRate = hound.def.mechanics.turretTurnSpeed * dt;
                    if (Math.abs(diff) <= turnRate) {
                        hound.turret.rotation.y = targetAngle;
                    } else {
                        hound.turret.rotation.y += Math.sign(diff) * turnRate;
                    }

                    // Reload & Fire
                    hound.reloadTimer -= dt;
                    if (hound.reloadTimer <= 0 && Math.abs(diff) < 0.25) {
                        this.fireHoundCannon(hound);
                    }
                }
            } else {
                if (hound.isAttacking) {
                    hound.isAttacking = false;
                    if (hound.detectionDisc) hound.detectionDisc.material.color.setHex(0xff3b30);
                    if (hound.detectionRing) hound.detectionRing.material.color.setHex(0xff3b30);
                }
            }
        }

        // Update HUD warning banner
        this.hud.setWarning(alertingCount > 0, alertingCount);
    }

    /**
     * Dynamic Camera Follow (3rd-Person Spring-Arm or 1st-Person Sight)
     */
    updateCamera(dt) {
        if (this.state === 'MENU') {
            // Smoothly rotate showcase pedestal in hangar
            if (this.menuPedestal) {
                this.menuPedestal.rotation.y += dt * 0.35;
            }
            this.camera.position.set(0, 4.5, 9.5);
            this.camera.lookAt(0, 1.4, 0);
            return;
        }

        if (!this.playerTank) return;
        const root = this.playerTank.root;

        if (this.isSightZoomed) {
            // Gunner Optic 1st-Person View: camera locked to gun barrel sight
            const muzzleWorld = new THREE.Vector3();
            this.playerTank.muzzlePoint.getWorldPosition(muzzleWorld);

            const barrelDir = new THREE.Vector3();
            this.playerTank.barrel.getWorldDirection(barrelDir);

            this.camera.position.copy(muzzleWorld).add(new THREE.Vector3(0, 0.4, 0));
            this.camera.lookAt(muzzleWorld.clone().add(barrelDir.multiplyScalar(50)));

            // Update sniper range & heading
            const headingDeg = ((-root.rotation.y - this.playerTank.turret.rotation.y) * 180 / Math.PI + 360) % 360;
            const dist = this.aimTargetWorld ? this.camera.position.distanceTo(this.aimTargetWorld) : 0;
            this.hud.setSightMode(true, dist, headingDeg);
        } else {
            // 3rd-Person Follow Camera
            const camDist = 11.0;
            const camHeight = 5.2;

            // Camera sits behind the tank hull
            const behindX = -Math.sin(root.rotation.y) * camDist;
            const behindZ = -Math.cos(root.rotation.y) * camDist;

            const desiredPos = new THREE.Vector3(
                root.position.x + behindX,
                root.position.y + camHeight,
                root.position.z + behindZ
            );

            const desiredLook = new THREE.Vector3(
                root.position.x,
                root.position.y + 2.0,
                root.position.z
            );

            // Apply screenshake
            if (this.screenShake > 0) {
                desiredPos.x += (Math.random() - 0.5) * this.screenShake;
                desiredPos.y += (Math.random() - 0.5) * this.screenShake;
                this.screenShake = Math.max(0, this.screenShake - dt * 1.5);
            }

            // Smooth damping
            this.camera.position.lerp(desiredPos, dt * 7);
            this.cameraTargetLook.lerp(desiredLook, dt * 9);
            this.camera.lookAt(this.cameraTargetLook);
        }
    }

    /**
     * Hit Callback: Floating Combat Numbers & Victory/Defeat Checks
     */
    handleCombatHit(target, damage, isKilled) {
        // Floating damage number on screen
        const targetWorldPos = target.root.position.clone().add(new THREE.Vector3(0, 2.2, 0));
        const screenPos = targetWorldPos.project(this.camera);

        const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

        this.hud.triggerHitMarker();
        this.hud.spawnDamageNumber(screenX, screenY, damage, isKilled);

        // Check Victory: All Hounds destroyed
        const remainingHounds = this.hounds.filter((h) => !h.isDestroyed).length;
        this.hud.updateTargetsRemaining(remainingHounds, this.totalHounds);

        if (remainingHounds === 0 && this.state === 'PLAYING') {
            this.handleVictory();
        }

        // Check Defeat: Player tank destroyed
        if (target === this.playerTank && isKilled && this.state === 'PLAYING') {
            this.handleDefeat();
        }
    }

    handleVictory() {
        this.state = 'VICTORY';
        if (this.victoryModal) {
            this.victoryModal.classList.remove('hidden');
        }
    }

    handleDefeat() {
        this.state = 'GAMEOVER';
        if (this.defeatModal) {
            this.defeatModal.classList.remove('hidden');
        }
    }

    /**
     * Main Animation & Render Loop
     */
    animate() {
        requestAnimationFrame(this.animate);
        const dt = Math.min(this.clock.getDelta(), 0.1);

        if (this.state === 'PLAYING') {
            this.updatePlayerPhysics(dt);
            this.updatePlayerTurret(dt);
            this.updateHoundAI(dt);

            // Update projectiles and collisions
            this.projectileMgr.update(
                dt,
                this.cityMap,
                this.playerTank,
                this.hounds,
                (target, dmg, isKilled) => this.handleCombatHit(target, dmg, isKilled)
            );

            // Update HUD
            const def = this.playerTank.def.mechanics;
            const reloadFrac = this.isReloading ? 1 - (this.reloadTimer / def.reloadTime) : 1;
            const speedKmH = this.speed * 3.6; // convert m/s to km/h
            const isReverse = this.speed < -0.1;

            this.hud.updatePlayerStatus(
                this.playerTank.hp,
                this.maxHp,
                speedKmH,
                isReverse,
                reloadFrac,
                this.isReloading
            );

            this.hud.drawMinimap(this.cityMap, this.playerTank, this.hounds);
        }

        this.hud.update(dt);
        this.updateCamera(dt);

        this.renderer.render(this.scene, this.camera);
    }
}

// Instantiate and start simulation on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    window.game = new TankSimGame();
});
