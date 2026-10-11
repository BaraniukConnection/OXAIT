// Main Arcade Flight Combat Game Engine
// Integrates 3D Scene, Physics, Rogues, Weapons, Audio, HUD and Hangar Selection

class ArcadeFlightGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.state = 'MENU'; // 'MENU', 'PLAYING', 'GAMEOVER', 'VICTORY'

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Subsystems
        this.terrain = null;
        this.particles = null;
        this.sound = window.soundEngine;
        this.hud = null;
        this.weapons = null;

        // Entities
        this.player = null;
        this.playerMesh = null;
        this.rogues = [];
        this.totalRogues = 6;
        this.selectedPlaneKey = 'Thunder';

        // Camera chase parameters
        this.cameraOffset = new THREE.Vector3(0, 4.2, 16.5);
        this.cameraLookOffset = new THREE.Vector3(0, 1.2, -18.0);
        this.cameraPos = new THREE.Vector3();
        this.cameraTarget = new THREE.Vector3();
        this.shakeIntensity = 0;

        // Clock & Game Stats
        this.clock = new THREE.Clock();
        this.missionTime = 0;
        this.kills = 0;
        this.shotsFired = 0;
        this.hitsLanded = 0;

        // Hangar preview scene
        this.hangarMesh = null;

        this.init();
    }

    init() {
        // 1. Setup Three.js Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);

        // 2. Setup Scene & Atmospheric Lighting
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        this.scene.fog = new THREE.FogExp2(0xb0d5f0, 0.00032);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 7000);
        this.camera.position.set(0, 150, 300);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
        sunLight.position.set(1200, 2000, 800);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 100;
        sunLight.shadow.camera.far = 4500;
        const d = 1200;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        this.scene.add(sunLight);

        // Hemispheric light for soft ground bounce
        const hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x3d4f3b, 0.45);
        this.scene.add(hemiLight);

        // 3. Initialize Subsystems
        this.terrain = new WorldTerrain(this.scene);
        this.particles = new ParticleSystem(this.scene);
        this.weapons = new WeaponSystem(this.scene, this.sound, this.particles);
        this.hud = new FlightHUD();

        // 4. Setup Input Handlers
        this.setupEventListeners();

        // 5. Setup 3D Hangar Showcase
        this.setupHangarPreview();

        // 6. Start Animation Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupHangarPreview() {
        this.updateHangarModel(this.selectedPlaneKey);
    }

    updateHangarModel(planeKey) {
        if (this.hangarMesh) {
            this.scene.remove(this.hangarMesh);
        }

        let mesh = null;
        if (planeKey === 'Thunder') mesh = AircraftModels.createThunder();
        else if (planeKey === 'Vulture') mesh = AircraftModels.createVulture();
        else if (planeKey === 'Falcon') mesh = AircraftModels.createFalcon();
        else if (planeKey === 'Shadow') mesh = AircraftModels.createShadow();

        if (mesh) {
            mesh.position.set(0, 160, 260);
            mesh.scale.set(2.0, 2.0, 2.0);
            this.scene.add(mesh);
            this.hangarMesh = mesh;
        }
    }

    startMission(planeKey) {
        // Initialize sound context on user gesture
        this.sound.init();
        this.sound.resume();

        this.selectedPlaneKey = planeKey;

        // Remove hangar mesh
        if (this.hangarMesh) {
            this.scene.remove(this.hangarMesh);
            this.hangarMesh = null;
        }

        // Clean up previous rogues
        for (const r of this.rogues) {
            if (r.mesh) this.scene.remove(r.mesh);
        }
        this.rogues = [];

        // 1. Spawn Player Aircraft
        if (this.playerMesh) {
            this.scene.remove(this.playerMesh);
        }

        if (planeKey === 'Thunder') {
            this.playerMesh = AircraftModels.createThunder();
        } else if (planeKey === 'Vulture') {
            this.playerMesh = AircraftModels.createVulture();
        } else if (planeKey === 'Falcon') {
            this.playerMesh = AircraftModels.createFalcon();
        } else if (planeKey === 'Shadow') {
            this.playerMesh = AircraftModels.createShadow();
        }

        // Place player in central takeoff valley
        const spawnX = 0;
        const spawnZ = 0;
        const groundY = this.terrain.getTerrainHeight(spawnX, spawnZ);
        const spawnAlt = groundY + 120; // 120m altitude heading north

        this.playerMesh.position.set(spawnX, spawnAlt, spawnZ);
        this.playerMesh.rotation.set(0, 0, 0); // facing north (-Z)
        this.cameraPos.copy(this.playerMesh.position).add(new THREE.Vector3(0, 4.2, 16.5));
        this.cameraTarget.copy(this.playerMesh.position).add(new THREE.Vector3(0, 1.2, -18.0));
        this.camera.position.copy(this.cameraPos);
        this.camera.lookAt(this.cameraTarget);
        this.scene.add(this.playerMesh);

        // Player physics
        const stats = this.playerMesh.userData.stats;
        this.player = new FlightPhysics(this.playerMesh, {
            name: planeKey,
            maxSpeed: stats.maxSpeed,
            minSpeed: 60,
            cruiseSpeed: stats.maxSpeed * 0.65,
            turnRate: stats.turnRate,
            acceleration: 45,
            deceleration: 35,
            armor: stats.armor
        });

        // Initialize weapon system for chosen aircraft
        this.weapons.setPlane(planeKey);

        // 2. Spawn Rogues at random locations across map
        this.spawnRogues();

        // 3. Reset mission variables
        this.state = 'PLAYING';
        this.missionTime = 0;
        this.kills = 0;
        this.shotsFired = 0;
        this.hitsLanded = 0;
        this.isFiring = false;

        // UI switch
        document.getElementById('hangar-screen').classList.add('hidden');
        document.getElementById('hud-overlay').classList.remove('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('pause-menu').classList.add('hidden');

        this.updateHUDWeaponDisplay();
    }

    spawnRogues() {
        const count = this.totalRogues;

        // Predefined diverse geographic sectors across the 5000m map
        const sectors = [
            { x: -950, z: -1100, radius: 480 }, // Northern Valley
            { x: 1200, z: -900,  radius: 520 }, // North-East Ridge
            { x: -1300, z: 800,  radius: 460 }, // Western Mountains
            { x: 1100, z: 1200,  radius: 500 }, // Southern Canyon
            { x: -300, z: 1600,  radius: 450 }, // South-West Peaks
            { x: 500, z: -1700,  radius: 490 }  // Deep Northern Pass
        ];

        // Clear visual patrol rings from terrain
        this.terrain.zoneRings = [];

        for (let i = 0; i < count; i++) {
            const sec = sectors[i % sectors.length];
            // Jitter position slightly for randomness
            const rx = sec.x + (Math.random() - 0.5) * 200;
            const rz = sec.z + (Math.random() - 0.5) * 200;
            const groundY = this.terrain.getTerrainHeight(rx, rz);
            const ry = groundY + 140 + Math.random() * 80;

            const center = new THREE.Vector3(rx, ry, rz);
            const rogue = new RogueAI(i + 1, this.scene, center, sec.radius, this.sound, this.particles);
            this.rogues.push(rogue);

            // Add visual holographic ring on map
            this.terrain.addPatrolZoneVisual(center, sec.radius, rogue.name);
        }
    }

    setupEventListeners() {
        // Keyboard inputs
        window.addEventListener('keydown', (e) => {
            if (this.state === 'PLAYING') {
                this.player.handleKeyDown(e.code);

                if (e.code === 'Space') {
                    e.preventDefault();
                    this.isFiring = true;
                }
                if (e.code === 'KeyC') {
                    e.preventDefault();
                    this.weapons.cycleWeapon();
                    this.updateHUDWeaponDisplay();
                }
                if (e.code === 'Escape') {
                    this.togglePause();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.state === 'PLAYING') {
                this.player.handleKeyUp(e.code);

                if (e.code === 'Space') {
                    this.isFiring = false;
                }
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (this.camera && this.renderer) {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });
    }

    updateHUDWeaponDisplay() {
        const weapon = this.weapons.getCurrentWeapon();
        const weaponEl = document.getElementById('hud-weapon-name');
        const weaponTypeEl = document.getElementById('hud-weapon-type');
        const ammoEl = document.getElementById('hud-weapon-ammo');

        if (weaponEl) weaponEl.textContent = weapon.name;
        if (weaponTypeEl) weaponTypeEl.textContent = `[${weapon.type}]`;
        if (ammoEl) {
            ammoEl.textContent = weapon.isReady ? "READY" : "RELOADING...";
            ammoEl.style.color = weapon.isReady ? "#00ff88" : "#ffaa00";
        }
    }

    triggerShake(amount) {
        this.shakeIntensity = Math.max(this.shakeIntensity, amount);
    }

    updateCamera(delta) {
        if (!this.player || !this.player.mesh) return;

        const mesh = this.player.mesh;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);

        // Dynamic FOV on afterburner boost
        const targetFov = this.player.isBoost ? 68 : 60;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 4.0);
        this.camera.updateProjectionMatrix();

        // Calculate chase position behind aircraft
        const idealPos = mesh.position.clone()
            .addScaledVector(forward, -this.cameraOffset.z)
            .addScaledVector(up, this.cameraOffset.y);

        // Look at point ahead of aircraft
        const idealLookAt = mesh.position.clone()
            .addScaledVector(forward, -this.cameraLookOffset.z)
            .addScaledVector(up, this.cameraLookOffset.y);

        // Smooth camera damping
        const posLerp = 10.0 * delta;
        this.cameraPos.lerp(idealPos, Math.min(1, posLerp));
        this.cameraTarget.lerp(idealLookAt, Math.min(1, posLerp * 1.2));

        // Screen shake (gunfire, afterburner, explosions)
        if (this.shakeIntensity > 0) {
            const shake = new THREE.Vector3(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity
            );
            this.cameraPos.add(shake);
            this.shakeIntensity = Math.max(0, this.shakeIntensity - 5.0 * delta);
        }

        this.camera.position.copy(this.cameraPos);
        this.camera.lookAt(this.cameraTarget);
        this.camera.up.copy(up);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const delta = Math.min(0.1, this.clock.getDelta());

        if (this.state === 'MENU') {
            // Hangar preview rotation
            if (this.hangarMesh) {
                this.hangarMesh.rotation.y += 0.8 * delta;
            }
            this.renderer.render(this.scene, this.camera);
            return;
        }

        if (this.state === 'PLAYING') {
            this.missionTime += delta;

            // 1. Update Player Flight Physics
            this.player.update(delta);

            // 2. Continuous shooting while Space is held
            if (this.isFiring) {
                this.weapons.fire(this.player.mesh, this.camera);
                this.triggerShake(0.12);
            }

            // 3. Update Targeting
            const radarRadius = Math.min(window.innerWidth, window.innerHeight) * 0.38;
            this.weapons.updateTargeting(this.player.mesh, this.camera, this.rogues, radarRadius);

            // 4. Update Weapon Projectiles & Hits
            this.weapons.update(delta, this.terrain, this.rogues, this.player);

            // 5. Update Rogues AI
            let aliveRoguesCount = 0;
            for (const rogue of this.rogues) {
                if (rogue.isAlive) {
                    rogue.update(delta, this.player, this.terrain, this.weapons);
                    aliveRoguesCount++;
                }
            }

            // 6. Terrain & Tree Collisions for Player
            const col = this.terrain.checkCollision(this.player.mesh.position, 3.2);
            if (col.collided) {
                this.handlePlayerCrash(col.reason);
            }

            // 7. Check Player Health
            if (!this.player.isAlive) {
                this.handlePlayerKilled();
            }

            // 8. Check Objective Victory
            if (aliveRoguesCount === 0 && this.rogues.length > 0) {
                this.handleVictory();
            }

            // 9. Particles, Jet Trails & Audio
            this.terrain.update(delta);
            this.particles.update(delta, this.terrain);
            this.particles.createJetExhaust(this.player.mesh, this.player.isBoost ? 1.6 : (this.player.throttle * 0.9));

            this.sound.updateEngineSound(
                this.player.throttle,
                this.player.isBoost,
                this.player.speed / this.player.config.maxSpeed
            );

            // 10. Third person camera chase
            this.updateCamera(delta);

            // 11. HUD Rendering & DOM Updates
            this.hud.render(this.player, this.camera, this.terrain, this.rogues, this.weapons);
            this.updateDOMHUD(aliveRoguesCount);

            // Render 3D Scene
            this.renderer.render(this.scene, this.camera);
        }
    }

    updateDOMHUD(aliveCount) {
        // Update Targets remaining
        const roguesEl = document.getElementById('hud-targets-count');
        if (roguesEl) roguesEl.textContent = `${aliveCount} / ${this.totalRogues}`;

        // Update Health bar
        const healthBar = document.getElementById('hud-health-bar');
        const healthText = document.getElementById('hud-health-text');
        if (healthBar && this.player) {
            const hpRatio = Math.max(0, this.player.health / this.player.maxHealth);
            healthBar.style.width = `${hpRatio * 100}%`;
            if (healthText) healthText.textContent = `${Math.round(this.player.health)}%`;

            if (hpRatio < 0.3) {
                healthBar.style.background = '#ff2222';
            } else if (hpRatio < 0.6) {
                healthBar.style.background = '#ffaa00';
            } else {
                healthBar.style.background = '#00ff88';
            }
        }

        // Throttle indicator
        const throttleBar = document.getElementById('hud-throttle-bar');
        const throttleText = document.getElementById('hud-throttle-text');
        if (throttleBar && this.player) {
            throttleBar.style.height = `${this.player.throttle * 100}%`;
            if (throttleText) {
                throttleText.textContent = this.player.isBoost ? "BOOST" : `${Math.round(this.player.throttle * 100)}%`;
                throttleText.style.color = this.player.isBoost ? "#00ffff" : "#00ff88";
            }
        }

        // Weapon Cooldown update
        const weapon = this.weapons.getCurrentWeapon();
        const ammoEl = document.getElementById('hud-weapon-ammo');
        if (ammoEl) {
            if (weapon.isReady) {
                ammoEl.textContent = "READY";
                ammoEl.style.color = "#00ff88";
            } else {
                const pct = Math.round((1 - weapon.cooldown / weapon.maxCooldown) * 100);
                ammoEl.textContent = `RELOAD ${pct}%`;
                ammoEl.style.color = "#ffaa00";
            }
        }
    }

    handlePlayerCrash(reason) {
        if (!this.player.isAlive) return;
        this.player.isAlive = false;
        this.sound.playExplosion(true);
        this.particles.createAircraftExplosion(this.player.mesh.position, this.player.mesh.quaternion);
        this.triggerShake(1.5);

        setTimeout(() => {
            this.state = 'GAMEOVER';
            document.getElementById('hud-overlay').classList.add('hidden');
            const goScreen = document.getElementById('game-over-screen');
            goScreen.classList.remove('hidden');
            document.getElementById('game-over-reason').textContent = reason || "CRASHED INTO TERRAIN";
        }, 1200);
    }

    handlePlayerKilled() {
        this.sound.playExplosion(true);
        this.particles.createAircraftExplosion(this.player.mesh.position, this.player.mesh.quaternion);
        this.triggerShake(1.5);

        setTimeout(() => {
            this.state = 'GAMEOVER';
            document.getElementById('hud-overlay').classList.add('hidden');
            const goScreen = document.getElementById('game-over-screen');
            goScreen.classList.remove('hidden');
            document.getElementById('game-over-reason').textContent = "SHOT DOWN IN COMBAT";
        }, 1200);
    }

    handleVictory() {
        this.state = 'VICTORY';
        this.sound.playVictory();

        setTimeout(() => {
            document.getElementById('hud-overlay').classList.add('hidden');
            const vicScreen = document.getElementById('victory-screen');
            vicScreen.classList.remove('hidden');

            const mins = Math.floor(this.missionTime / 60);
            const secs = Math.floor(this.missionTime % 60);
            document.getElementById('victory-time').textContent = `${mins}m ${secs}s`;
            document.getElementById('victory-kills').textContent = `${this.totalRogues} Rogues`;
        }, 1200);
    }

    togglePause() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu.classList.contains('hidden')) {
            pauseMenu.classList.remove('hidden');
        } else {
            pauseMenu.classList.add('hidden');
        }
    }
}

window.ArcadeFlightGame = ArcadeFlightGame;
