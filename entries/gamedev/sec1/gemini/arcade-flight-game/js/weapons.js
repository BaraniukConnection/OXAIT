// Weapons System: Machine Guns, Standard Missiles and Aircraft Special Weapons
// Thunder: HighSpeed AA missile
// Vulture: Radar Guided AA missile (more manoeuvrable inside lock circle)
// Falcon: 4x multilock missile
// Shadow: HighPower missile

class WeaponSystem {
    constructor(scene, soundEngine, particleSystem) {
        this.scene = scene;
        this.sound = soundEngine;
        this.particles = particleSystem;

        // Weapon types: 0: 'MG', 1: 'MISSILE', 2: 'SPECIAL'
        this.currentWeaponIndex = 0;
        this.weaponTypes = ['MG', 'MISSILE', 'SPECIAL'];

        // Cooldowns and timers
        this.mgCooldown = 0;
        this.mgFireRate = 0.08; // ~12 rounds per sec
        this.missileCooldown = 0;
        this.missileReloadTime = 2.2;
        this.specialCooldown = 0;
        this.specialReloadTime = 4.5;

        // Projectile containers
        this.bullets = [];   // Active MG bullets
        this.missiles = [];  // Active guided missiles

        // Lock-on status
        this.lockedTarget = null;
        this.multilockTargets = [];
        this.lockProgress = 0;   // 0.0 to 1.0
        this.isLocked = false;
        this.isInsideRadarCircle = false; // For Vulture's special weapon

        // Active plane info
        this.planeType = 'Thunder';
        this.specialName = 'HighSpeed AA Missile';
        this.specialAmmo = Infinity; // Arcade cooldown-based
    }

    reset() {
        for (const b of this.bullets) {
            if (b.mesh) this.scene.remove(b.mesh);
        }
        for (const m of this.missiles) {
            if (m.mesh) this.scene.remove(m.mesh);
        }
        this.bullets = [];
        this.missiles = [];
        this.lockedTarget = null;
        this.multilockTargets = [];
        this.lockProgress = 0;
        this.isLocked = false;
        this.mgCooldown = 0;
        this.missileCooldown = 0;
        this.specialCooldown = 0;
    }

    setPlane(planeType) {
        this.reset();
        this.planeType = planeType;
        if (planeType === 'Thunder') {
            this.specialName = 'HighSpeed AA Missile';
            this.specialReloadTime = 3.5;
        } else if (planeType === 'Vulture') {
            this.specialName = 'Radar Guided AA Missile';
            this.specialReloadTime = 3.8;
        } else if (planeType === 'Falcon') {
            this.specialName = '4x MultiLock Missile';
            this.specialReloadTime = 5.2;
        } else if (planeType === 'Shadow') {
            this.specialName = 'HighPower Missile';
            this.specialReloadTime = 4.8;
        }
    }

    cycleWeapon() {
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weaponTypes.length;
        if (this.sound) this.sound.playWeaponSwitch();
        return this.getCurrentWeapon();
    }

    getCurrentWeapon() {
        const type = this.weaponTypes[this.currentWeaponIndex];
        return {
            type: type,
            name: type === 'MG' ? '20mm Autocannon' : (type === 'MISSILE' ? 'AIM-9 Standard Missile' : this.specialName),
            cooldown: type === 'MG' ? this.mgCooldown : (type === 'MISSILE' ? this.missileCooldown : this.specialCooldown),
            maxCooldown: type === 'MG' ? this.mgFireRate : (type === 'MISSILE' ? this.missileReloadTime : this.specialReloadTime),
            isReady: (type === 'MG' ? this.mgCooldown <= 0 : (type === 'MISSILE' ? this.missileCooldown <= 0 : this.specialCooldown <= 0))
        };
    }

    // Update target locks based on camera, field of view, distance
    updateTargeting(playerMesh, camera, enemies, radarCircleRadius) {
        if (!playerMesh || !enemies || enemies.length === 0) {
            this.lockedTarget = null;
            this.isLocked = false;
            this.lockProgress = 0;
            return;
        }

        const playerPos = playerMesh.position;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);

        let bestTarget = null;
        let bestScore = -Infinity;
        let inCircle = false;

        const screenCenter = new THREE.Vector2(0, 0); // NDC center
        const candidates = [];

        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            const toEnemy = enemy.mesh.position.clone().sub(playerPos);
            const dist = toEnemy.length();

            // Range filter: 1500m max
            if (dist > 1500 || dist < 10) continue;

            toEnemy.normalize();
            const angleCos = forward.dot(toEnemy);

            // Forward cone: must be within ~40 degrees
            if (angleCos > 0.76) {
                // Check screen position
                const screenPos = enemy.mesh.position.clone().project(camera);
                const screenDist = Math.hypot(screenPos.x, screenPos.y);

                // Score favoring center of sight and closer distance
                const score = angleCos * 1000 - dist * 0.3;
                candidates.push({ enemy, score, screenDist, screenPos });

                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = enemy;
                    // Vulture Radar circle check: within normalized radius ~0.35 of screen center
                    inCircle = (screenDist < 0.38);
                }
            }
        }

        this.isInsideRadarCircle = inCircle;

        // Multilock tracking for Falcon (select top 4 candidates)
        if (this.planeType === 'Falcon') {
            candidates.sort((a, b) => b.score - a.score);
            this.multilockTargets = candidates.slice(0, 4).map(c => c.enemy);
        } else {
            this.multilockTargets = bestTarget ? [bestTarget] : [];
        }

        // Lock progress integration
        if (bestTarget) {
            this.lockedTarget = bestTarget;
            const lockSpeed = (this.planeType === 'Thunder' && this.currentWeaponIndex === 2) ? 1.8 : 1.0;
            this.lockProgress = Math.min(1.0, this.lockProgress + lockSpeed * 0.035);
            this.isLocked = (this.lockProgress >= 1.0);

            if (this.sound) {
                this.sound.setLockTone(this.isLocked ? 'locked' : 'acquiring');
            }
        } else {
            this.lockedTarget = null;
            this.lockProgress = Math.max(0, this.lockProgress - 0.06);
            this.isLocked = false;
            if (this.sound) {
                this.sound.setLockTone('none');
            }
        }
    }

    // Trigger firing current weapon
    fire(playerMesh, camera) {
        const weaponType = this.weaponTypes[this.currentWeaponIndex];

        if (weaponType === 'MG') {
            if (this.mgCooldown <= 0) {
                this.fireMG(playerMesh);
                this.mgCooldown = this.mgFireRate;
            }
        } else if (weaponType === 'MISSILE') {
            if (this.missileCooldown <= 0) {
                this.fireStandardMissile(playerMesh);
                this.missileCooldown = this.missileReloadTime;
            }
        } else if (weaponType === 'SPECIAL') {
            if (this.specialCooldown <= 0) {
                this.fireSpecialWeapon(playerMesh);
                this.specialCooldown = this.specialReloadTime;
            }
        }
    }

    fireMG(playerMesh, isEnemy = false, enemyTarget = null) {
        const muzzles = playerMesh.userData.gunMuzzles || [new THREE.Vector3(0, 0, -2)];
        const muzz = muzzles[Math.floor(Math.random() * muzzles.length)].clone();
        muzz.applyQuaternion(playerMesh.quaternion).add(playerMesh.position);

        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
        // Slight dispersion spread
        dir.x += (Math.random() - 0.5) * 0.015;
        dir.y += (Math.random() - 0.5) * 0.015;
        dir.normalize();

        const speed = 720; // 720 m/s bullet speed

        // Tracer bullet mesh
        const bulletGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 4);
        bulletGeo.rotateX(Math.PI / 2);
        const bulletMat = new THREE.MeshBasicMaterial({
            color: isEnemy ? 0xff4433 : 0xffdd44
        });
        const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
        bulletMesh.position.copy(muzz);
        bulletMesh.quaternion.copy(playerMesh.quaternion);
        this.scene.add(bulletMesh);

        this.bullets.push({
            mesh: bulletMesh,
            dir: dir,
            speed: speed,
            life: 1.8,
            damage: isEnemy ? 6 : 14,
            isEnemy: isEnemy
        });

        if (!isEnemy && this.sound) {
            this.sound.playGunFire();
        }
        if (this.particles) {
            this.particles.createMuzzleFlash(muzz, dir);
        }
    }

    fireStandardMissile(playerMesh) {
        const target = this.isLocked ? this.lockedTarget : null;
        this.spawnMissile(playerMesh, 'standard', target);
        if (this.sound) this.sound.playMissileLaunch('standard');
    }

    fireSpecialWeapon(playerMesh) {
        if (this.planeType === 'Thunder') {
            // HighSpeed AA missile
            const target = this.isLocked ? this.lockedTarget : null;
            this.spawnMissile(playerMesh, 'highspeed', target);
            if (this.sound) this.sound.playMissileLaunch('highspeed');

        } else if (this.planeType === 'Vulture') {
            // Radar Guided AA missile: requires lock inside circle for full guidance
            const target = (this.isLocked && this.isInsideRadarCircle) ? this.lockedTarget : (this.isLocked ? this.lockedTarget : null);
            this.spawnMissile(playerMesh, 'radarguided', target, { agileInCircle: this.isInsideRadarCircle });
            if (this.sound) this.sound.playMissileLaunch('standard');

        } else if (this.planeType === 'Falcon') {
            // 4x Multilock missile: salvo of 4 missiles
            const targets = this.multilockTargets.length > 0 ? this.multilockTargets : (this.lockedTarget ? [this.lockedTarget] : []);

            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    if (!playerMesh || !this.scene) return;
                    // Assign targets round-robin or single target
                    const tgt = targets.length > 0 ? targets[i % targets.length] : null;
                    const offset = (i - 1.5) * 1.4;
                    this.spawnMissile(playerMesh, 'multilock', tgt, { wingOffset: offset });
                    if (this.sound) this.sound.playMissileLaunch('standard');
                }, i * 90);
            }

        } else if (this.planeType === 'Shadow') {
            // HighPower missile: massive damage and explosion blast
            const target = this.isLocked ? this.lockedTarget : null;
            this.spawnMissile(playerMesh, 'highpower', target);
            if (this.sound) this.sound.playMissileLaunch('standard');
        }
    }

    spawnMissile(launcherMesh, type, target, options = {}) {
        const missileMesh = AircraftModels.createMissile(type);

        const spawnPos = launcherMesh.position.clone();
        if (options.wingOffset) {
            const sideVec = new THREE.Vector3(1, 0, 0).applyQuaternion(launcherMesh.quaternion);
            spawnPos.addScaledVector(sideVec, options.wingOffset);
        }
        // Slightly below wings
        const downVec = new THREE.Vector3(0, -1, 0).applyQuaternion(launcherMesh.quaternion);
        spawnPos.addScaledVector(downVec, 0.8);

        missileMesh.position.copy(spawnPos);
        missileMesh.quaternion.copy(launcherMesh.quaternion);
        this.scene.add(missileMesh);

        // Attributes based on type
        let speed = 260;
        let maxSpeed = 380;
        let accel = 180;
        let turnRate = 2.4;
        let damage = 50;
        let blastRadius = 15;
        let life = 6.0;

        if (type === 'highspeed') {
            speed = 460;
            maxSpeed = 820; // Blazing hypersonic speed
            accel = 520;
            turnRate = 1.9;
            damage = 65;
            life = 4.0;
        } else if (type === 'radarguided') {
            speed = 280;
            maxSpeed = 420;
            accel = 210;
            // High maneuverability inside radar circle
            turnRate = options.agileInCircle ? 5.2 : 2.0;
            damage = 55;
            life = 6.5;
        } else if (type === 'multilock') {
            speed = 300;
            maxSpeed = 450;
            accel = 240;
            turnRate = 3.2;
            damage = 40; // 4x40 = 160 total possible damage
            life = 5.5;
        } else if (type === 'highpower') {
            speed = 250;
            maxSpeed = 360;
            accel = 150;
            turnRate = 1.8;
            damage = 130; // Devastating single hit
            blastRadius = 65; // Area-of-effect shockwave
            life = 7.0;
        }

        this.missiles.push({
            mesh: missileMesh,
            type: type,
            target: target,
            speed: speed,
            maxSpeed: maxSpeed,
            accel: accel,
            turnRate: turnRate,
            damage: damage,
            blastRadius: blastRadius,
            life: life,
            isEnemy: false
        });
    }

    // Rogue enemies can also fire missiles at player!
    spawnEnemyMissile(enemyMesh, playerMesh) {
        const missileMesh = AircraftModels.createMissile('standard');
        missileMesh.position.copy(enemyMesh.position);
        missileMesh.quaternion.copy(enemyMesh.quaternion);
        this.scene.add(missileMesh);

        this.missiles.push({
            mesh: missileMesh,
            type: 'standard',
            target: { mesh: playerMesh, isAlive: true },
            speed: 240,
            maxSpeed: 340,
            accel: 140,
            turnRate: 1.8,
            damage: 30,
            blastRadius: 15,
            life: 6.0,
            isEnemy: true
        });

        if (this.sound) this.sound.playMissileLaunch('standard');
    }

    update(delta, terrain, enemies, player) {
        // Cooldown ticks
        if (this.mgCooldown > 0) this.mgCooldown -= delta;
        if (this.missileCooldown > 0) this.missileCooldown -= delta;
        if (this.specialCooldown > 0) this.specialCooldown -= delta;

        // 1. Update MG Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.life -= delta;
            b.mesh.position.addScaledVector(b.dir, b.speed * delta);

            // Terrain collision
            const groundY = terrain.getTerrainHeight(b.mesh.position.x, b.mesh.position.z);
            if (b.mesh.position.y <= groundY || b.life <= 0) {
                if (this.particles && b.mesh.position.y <= groundY) {
                    this.particles.createHitSparks(b.mesh.position);
                }
                this.scene.remove(b.mesh);
                this.bullets.splice(i, 1);
                continue;
            }

            // Hit detection against player (if enemy bullet)
            if (b.isEnemy) {
                if (player && player.isAlive) {
                    const distToPlayer = b.mesh.position.distanceTo(player.mesh.position);
                    if (distToPlayer < 4.2) {
                        player.takeDamage(b.damage);
                        if (this.sound) this.sound.playHit();
                        if (this.particles) this.particles.createHitSparks(b.mesh.position);
                        this.scene.remove(b.mesh);
                        this.bullets.splice(i, 1);
                        continue;
                    }
                }
            } else {
                // Hit detection against enemies
                let hitEnemy = false;
                for (const enemy of enemies) {
                    if (!enemy.isAlive) continue;
                    const dist = b.mesh.position.distanceTo(enemy.mesh.position);
                    if (dist < 4.8) {
                        enemy.takeDamage(b.damage);
                        if (this.sound) this.sound.playHit();
                        if (this.particles) this.particles.createHitSparks(b.mesh.position);
                        this.scene.remove(b.mesh);
                        this.bullets.splice(i, 1);
                        hitEnemy = true;
                        break;
                    }
                }
                if (hitEnemy) continue;
            }
        }

        // 2. Update Guided Missiles
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            m.life -= delta;

            // Accelerate
            if (m.speed < m.maxSpeed) {
                m.speed += m.accel * delta;
            }

            // Guidance logic: Proportional Navigation towards target
            if (m.target && m.target.isAlive) {
                const targetPos = m.target.mesh.position;
                const toTarget = targetPos.clone().sub(m.mesh.position);
                const distToTarget = toTarget.length();

                // Check direct hit
                if (distToTarget < 6.0) {
                    this.detonateMissile(m, enemies, player);
                    this.scene.remove(m.mesh);
                    this.missiles.splice(i, 1);
                    continue;
                }

                // Turn towards target
                toTarget.normalize();
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(m.mesh.quaternion);

                // Rotate quaternion smoothly towards target direction
                const targetRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), toTarget);
                m.mesh.quaternion.rotateTowards(targetRotation, m.turnRate * delta);
            }

            // Forward flight
            const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(m.mesh.quaternion);
            m.mesh.position.addScaledVector(forwardDir, m.speed * delta);

            // Smoke trail particle emission
            if (this.particles) {
                this.particles.createMissileSmoke(m.mesh.position, m.type);
            }

            // Ground collision
            const groundY = terrain.getTerrainHeight(m.mesh.position.x, m.mesh.position.z);
            if (m.mesh.position.y <= groundY || m.life <= 0) {
                this.detonateMissile(m, enemies, player);
                this.scene.remove(m.mesh);
                this.missiles.splice(i, 1);
            }
        }
    }

    detonateMissile(missile, enemies, player) {
        const pos = missile.position || missile.mesh.position;
        const isHighPower = (missile.type === 'highpower');

        if (this.sound) {
            this.sound.playExplosion(isHighPower);
        }
        if (this.particles) {
            this.particles.createExplosion(pos, isHighPower ? 2.5 : 1.2);
        }

        // Damage calculation
        if (missile.isEnemy) {
            // Damaged player
            if (player && player.isAlive) {
                const dist = pos.distanceTo(player.mesh.position);
                if (dist <= missile.blastRadius) {
                    const dmg = missile.damage * (1.0 - dist / missile.blastRadius);
                    player.takeDamage(dmg);
                    if (this.sound) this.sound.playHit();
                }
            }
        } else {
            // Damage enemies within blast radius
            for (const enemy of enemies) {
                if (!enemy.isAlive) continue;
                const dist = pos.distanceTo(enemy.mesh.position);
                if (dist <= missile.blastRadius) {
                    const falloff = 1.0 - (dist / missile.blastRadius) * 0.5;
                    const finalDamage = Math.max(15, missile.damage * falloff);
                    enemy.takeDamage(finalDamage);
                }
            }
        }
    }
}

window.WeaponSystem = WeaponSystem;
