/**
 * Projectile Ballistics & Particle VFX Engine
 * Arcade Tank Simulator
 * Handles:
 *  - High-velocity cannon shells with glowing tracers
 *  - Muzzle flashes and cannon recoil
 *  - Multi-stage low-poly explosions & shrapnel debris
 *  - Turret blow-off death physics for destroyed tanks
 */

class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = [];
        this.particles = [];
        this.explosions = [];
        this.wreckages = [];

        // Shared geometries & materials for peak WebGL performance
        this.bulletGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6);
        this.bulletGeo.rotateX(Math.PI / 2);
        this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

        this.tracerMat = new THREE.MeshBasicMaterial({
            color: 0xffaa22,
            transparent: true,
            opacity: 0.85
        });

        this.enemyTracerMat = new THREE.MeshBasicMaterial({
            color: 0xff3322,
            transparent: true,
            opacity: 0.85
        });

        this.debrisGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        this.debrisMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            flatShading: true
        });

        this.fireMat = new THREE.MeshBasicMaterial({
            color: 0xff7711,
            transparent: true,
            opacity: 0.9
        });

        this.smokeMat = new THREE.MeshStandardMaterial({
            color: 0x555555,
            transparent: true,
            opacity: 0.6,
            roughness: 0.9,
            flatShading: true
        });
    }

    /**
     * Spawn fired cannon shell
     */
    spawnShell(originPos, direction, speed, damage, isPlayer = true, owner = null) {
        const shellGroup = new THREE.Group();
        shellGroup.position.copy(originPos);

        // Shell mesh
        const mesh = new THREE.Mesh(this.bulletGeo, isPlayer ? this.tracerMat : this.enemyTracerMat);
        shellGroup.add(mesh);

        // Small dynamic point light for tracer glow
        const light = new THREE.PointLight(isPlayer ? 0xffbb44 : 0xff3311, 2.0, 14);
        shellGroup.add(light);

        // Align shell rotation with velocity direction
        const dir = direction.clone().normalize();
        shellGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

        this.scene.add(shellGroup);

        this.projectiles.push({
            mesh: shellGroup,
            velocity: dir.multiplyScalar(speed),
            damage: damage,
            isPlayer: isPlayer,
            owner: owner,
            life: 0,
            maxLife: 4.5 // 4.5 seconds max range
        });

        // Spawn Muzzle Flash at origin
        this.spawnMuzzleFlash(originPos, direction);

        // Audio trigger
        if (window.soundEngine) {
            window.soundEngine.playCannonFire(isPlayer);
        }
    }

    /**
     * Fiery muzzle flash burst with smoke puff
     */
    spawnMuzzleFlash(pos, dir) {
        const flashGroup = new THREE.Group();
        flashGroup.position.copy(pos);

        // Expanding flame cone/spikes
        const flameGeo = new THREE.ConeGeometry(0.7, 1.6, 6);
        flameGeo.rotateX(Math.PI / 2);
        const flameMesh = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffcc33 }));
        flameMesh.position.copy(dir.clone().multiplyScalar(0.7));
        flameMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        flashGroup.add(flameMesh);

        // Muzzle light
        const flashLight = new THREE.PointLight(0xffaa22, 5.0, 18);
        flashGroup.add(flashLight);

        this.scene.add(flashGroup);

        this.particles.push({
            mesh: flashGroup,
            scaleSpeed: 3.5,
            fadeSpeed: 14.0,
            life: 0.12,
            update: (dt, p) => {
                p.life -= dt;
                flashGroup.scale.multiplyScalar(1 + dt * 5);
                flashLight.intensity = Math.max(0, flashLight.intensity - dt * 45);
                if (p.life <= 0) {
                    this.scene.remove(flashGroup);
                    return false;
                }
                return true;
            }
        });
    }

    /**
     * Multi-stage explosion at impact point
     */
    spawnExplosion(pos, scale = 1.0) {
        // 1. Fireball sphere
        const fireGeo = new THREE.DodecahedronGeometry(2.2 * scale, 1);
        const fireMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 1.0
        });
        const fireMesh = new THREE.Mesh(fireGeo, fireMat);
        fireMesh.position.copy(pos);
        this.scene.add(fireMesh);

        // 2. Blast light
        const blastLight = new THREE.PointLight(0xff6611, 8.0 * scale, 26 * scale);
        blastLight.position.copy(pos);
        this.scene.add(blastLight);

        this.particles.push({
            mesh: fireMesh,
            light: blastLight,
            life: 0.35,
            update: (dt, p) => {
                p.life -= dt;
                fireMesh.scale.addScalar(dt * 7 * scale);
                fireMat.opacity = Math.max(0, p.life / 0.35);
                blastLight.intensity = fireMat.opacity * 8.0 * scale;
                if (p.life <= 0) {
                    this.scene.remove(fireMesh);
                    this.scene.remove(blastLight);
                    return false;
                }
                return true;
            }
        });

        // 3. Shrapnel & Debris Chunks flying outward
        const debrisCount = Math.floor(10 * scale);
        for (let i = 0; i < debrisCount; i++) {
            const dMesh = new THREE.Mesh(this.debrisGeo, this.debrisMat);
            dMesh.position.copy(pos);
            dMesh.scale.setScalar(0.6 + Math.random() * 0.8 * scale);
            this.scene.add(dMesh);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 24 * scale,
                (Math.random() * 16 + 6) * scale,
                (Math.random() - 0.5) * 24 * scale
            );

            this.particles.push({
                mesh: dMesh,
                vel: vel,
                rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
                life: 1.4,
                update: (dt, p) => {
                    p.life -= dt;
                    p.vel.y -= 25 * dt; // gravity
                    p.mesh.position.addScaledVector(p.vel, dt);
                    p.mesh.rotation.x += p.rotVel.x * dt;
                    p.mesh.rotation.y += p.rotVel.y * dt;

                    // Ground bounce
                    if (p.mesh.position.y <= 0.2) {
                        p.mesh.position.y = 0.2;
                        p.vel.y = -p.vel.y * 0.4;
                        p.vel.x *= 0.7;
                        p.vel.z *= 0.7;
                    }

                    if (p.life <= 0) {
                        this.scene.remove(p.mesh);
                        return false;
                    }
                    return true;
                }
            });
        }

        // 4. Rising Smoke Puffs
        for (let s = 0; s < 5; s++) {
            const smokeGeo = new THREE.DodecahedronGeometry(1.4 * scale, 0);
            const sMat = new THREE.MeshStandardMaterial({
                color: 0x444444,
                transparent: true,
                opacity: 0.7,
                flatShading: true
            });
            const sMesh = new THREE.Mesh(smokeGeo, sMat);
            sMesh.position.copy(pos).add(new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                0.5,
                (Math.random() - 0.5) * 1.5
            ));
            this.scene.add(sMesh);

            this.particles.push({
                mesh: sMesh,
                mat: sMat,
                upVel: 2.5 + Math.random() * 3.5,
                life: 1.6 + Math.random() * 0.8,
                maxLife: 2.2,
                update: (dt, p) => {
                    p.life -= dt;
                    p.mesh.position.y += p.upVel * dt;
                    p.mesh.scale.addScalar(dt * 1.5);
                    p.mat.opacity = Math.max(0, (p.life / p.maxLife) * 0.7);
                    if (p.life <= 0) {
                        this.scene.remove(p.mesh);
                        return false;
                    }
                    return true;
                }
            });
        }
    }

    /**
     * Spectacular Tank Destruction: Pop off turret and turn hull into smoking wreckage
     */
    destroyTank(tank) {
        if (!tank || tank.isDestroyed) return;
        tank.isDestroyed = true;

        const tankPos = tank.root.position.clone();

        // Audio: Massive explosion
        if (window.soundEngine) {
            window.soundEngine.playExplosion();
        }

        // Massive central explosion
        this.spawnExplosion(tankPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 2.2);

        // Detach turret and launch it skyward with spinning torque!
        if (tank.turret) {
            const turretWorldPos = new THREE.Vector3();
            tank.turret.getWorldPosition(turretWorldPos);
            const turretWorldQuat = new THREE.Quaternion();
            tank.turret.getWorldQuaternion(turretWorldQuat);

            // Remove from tank hierarchy and add directly to world scene
            tank.turret.parent.remove(tank.turret);
            tank.turret.position.copy(turretWorldPos);
            tank.turret.quaternion.copy(turretWorldQuat);
            this.scene.add(tank.turret);

            // Upward explosive rocket impulse + random torque
            const launchVel = new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                20 + Math.random() * 8, // Launch 20+ meters into air!
                (Math.random() - 0.5) * 12
            );
            const rotVel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            );

            this.particles.push({
                mesh: tank.turret,
                vel: launchVel,
                rotVel: rotVel,
                life: 6.0,
                update: (dt, p) => {
                    p.life -= dt;
                    p.vel.y -= 22 * dt; // Gravity
                    p.mesh.position.addScaledVector(p.vel, dt);
                    p.mesh.rotation.x += p.rotVel.x * dt;
                    p.mesh.rotation.y += p.rotVel.y * dt;
                    p.mesh.rotation.z += p.rotVel.z * dt;

                    // Hit ground
                    if (p.mesh.position.y <= 0.8) {
                        p.mesh.position.y = 0.8;
                        p.vel.y = -p.vel.y * 0.3; // bounce
                        p.vel.x *= 0.6;
                        p.vel.z *= 0.6;
                        p.rotVel.multiplyScalar(0.7);
                    }

                    return p.life > 0;
                }
            });
        }

        // Turn tank hull into scorched burnt black metal
        tank.root.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x1f1f21,
                    roughness: 0.95,
                    metalness: 0.1,
                    flatShading: true
                });
            }
        });

        // Hide detection rings on destroyed enemy Hound
        if (tank.detectionRing) tank.detectionRing.visible = false;
        if (tank.detectionDisc) tank.detectionDisc.visible = false;

        // Persistent burning smoke and fire from chassis
        this.wreckages.push({
            pos: tankPos.clone().add(new THREE.Vector3(0, 1.2, 0)),
            smokeTimer: 0
        });
    }

    /**
     * Update loop for all active projectiles, particles, and wrecks
     */
    update(dt, cityMap, playerTank, hounds, onHitCallback) {
        // 1. Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life += dt;

            // Gravity arc
            p.velocity.y -= 4.2 * dt;

            // Step motion
            const moveStep = p.velocity.clone().multiplyScalar(dt);
            p.mesh.position.add(moveStep);

            // Orient shell mesh along flight direction
            const flightDir = p.velocity.clone().normalize();
            p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), flightDir);

            let hitSomething = false;

            // A) Check building/ground hit
            const mapHit = cityMap.checkProjectileHit(p.mesh.position);
            if (mapHit.hit) {
                this.spawnExplosion(mapHit.point, 0.9);
                if (window.soundEngine) window.soundEngine.playImpact(false);
                hitSomething = true;
            }

            // B) If player shell: check collision against all active Hounds
            if (!hitSomething && p.isPlayer) {
                for (let h = 0; h < hounds.length; h++) {
                    const hound = hounds[h];
                    if (hound.isDestroyed) continue;

                    const hPos = hound.root.position;
                    const distToHound = Math.hypot(p.mesh.position.x - hPos.x, p.mesh.position.z - hPos.z);
                    const vertDist = Math.abs(p.mesh.position.y - (hPos.y + 1.0));

                    // Hound hit box
                    if (distToHound < 2.6 && vertDist < 2.2) {
                        this.spawnExplosion(p.mesh.position, 1.2);
                        if (window.soundEngine) {
                            window.soundEngine.playImpact(true);
                            window.soundEngine.playHitMarker();
                        }
                        hound.hp -= p.damage;
                        if (onHitCallback) onHitCallback(hound, p.damage, hound.hp <= 0);

                        if (hound.hp <= 0) {
                            this.destroyTank(hound);
                        }
                        hitSomething = true;
                        break;
                    }
                }
            }

            // C) If enemy Hound shell: check collision against Player Tank
            if (!hitSomething && !p.isPlayer && playerTank && !playerTank.isDestroyed) {
                const pPos = playerTank.root.position;
                const distToPlayer = Math.hypot(p.mesh.position.x - pPos.x, p.mesh.position.z - pPos.z);
                const vertDist = Math.abs(p.mesh.position.y - (pPos.y + 1.0));

                if (distToPlayer < 2.7 && vertDist < 2.4) {
                    this.spawnExplosion(p.mesh.position, 1.2);
                    if (window.soundEngine) window.soundEngine.playImpact(true);

                    // Armor damage mitigation
                    const armorFactor = playerTank.def.stats.armor; // 1, 2, or 3
                    const mitigatedDmg = Math.round(p.damage * (1.3 - armorFactor * 0.22));

                    playerTank.hp -= mitigatedDmg;
                    if (onHitCallback) onHitCallback(playerTank, mitigatedDmg, playerTank.hp <= 0);

                    if (playerTank.hp <= 0) {
                        this.destroyTank(playerTank);
                    }
                    hitSomething = true;
                }
            }

            // Remove dead or collided projectiles
            if (hitSomething || p.life >= p.maxLife) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }

        // 2. Update VFX Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            const alive = part.update(dt, part);
            if (!alive) {
                this.particles.splice(i, 1);
            }
        }

        // 3. Update Smoking Tank Wrecks
        for (let w = 0; w < this.wreckages.length; w++) {
            const wreck = this.wreckages[w];
            wreck.smokeTimer += dt;
            if (wreck.smokeTimer > 0.18) {
                wreck.smokeTimer = 0;
                // Emit small rising smoke puff
                const puff = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(0.7, 0),
                    new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 0.6, flatShading: true })
                );
                puff.position.copy(wreck.pos).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 1.0,
                    0,
                    (Math.random() - 0.5) * 1.0
                ));
                this.scene.add(puff);

                this.particles.push({
                    mesh: puff,
                    life: 2.2,
                    maxLife: 2.2,
                    update: (pdt, p) => {
                        p.life -= pdt;
                        p.mesh.position.y += 2.2 * pdt;
                        p.mesh.scale.addScalar(pdt * 0.8);
                        p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.6);
                        if (p.life <= 0) {
                            this.scene.remove(p.mesh);
                            return false;
                        }
                        return true;
                    }
                });
            }
        }
    }
}

window.ProjectileManager = ProjectileManager;
