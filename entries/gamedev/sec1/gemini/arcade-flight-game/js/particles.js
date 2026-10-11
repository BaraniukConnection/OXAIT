// Low-poly Particle and Visual Effects System
// Jet exhaust, missile smoke trails, explosions, muzzle flashes, wreckage physics

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.debris = [];

        // Shared geometries and materials for low-poly performance
        this.boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        this.sparkGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        this.smokeGeo = new THREE.DodecahedronGeometry(0.7, 0);

        this.mSmoke = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.6
        });

        this.mFire = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.9
        });

        this.mSpark = new THREE.MeshBasicMaterial({
            color: 0xffea00
        });

        this.mDebris = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2,
            flatShading: true
        });
    }

    createJetExhaust(planeMesh, intensity = 1.0) {
        const exhausts = planeMesh.userData.exhausts;
        if (!exhausts) return;

        const isBoost = intensity > 1.2;

        for (const exOffset of exhausts) {
            const worldPos = exOffset.clone().applyQuaternion(planeMesh.quaternion).add(planeMesh.position);

            const geo = this.sparkGeo;
            const mat = isBoost
                ? new THREE.MeshBasicMaterial({ color: 0x88ccff }) // High temp blue afterburner
                : new THREE.MeshBasicMaterial({ color: 0xff7700 }); // Orange jet flame

            const p = new THREE.Mesh(geo, mat);
            p.position.copy(worldPos);

            // Small jitter
            p.position.x += (Math.random() - 0.5) * 0.2;
            p.position.y += (Math.random() - 0.5) * 0.2;
            p.position.z += (Math.random() - 0.5) * 0.2;

            const scale = 0.6 * intensity;
            p.scale.set(scale, scale, scale * (isBoost ? 2.5 : 1.4));
            p.quaternion.copy(planeMesh.quaternion);

            this.scene.add(p);

            this.particles.push({
                mesh: p,
                vel: new THREE.Vector3(0, 0, 15 * intensity).applyQuaternion(planeMesh.quaternion),
                life: 0.08,
                maxLife: 0.08,
                shrink: true
            });
        }
    }

    createMissileSmoke(position, type = 'standard') {
        const p = new THREE.Mesh(this.smokeGeo, this.mSmoke.clone());
        p.position.copy(position);

        if (type === 'highspeed') {
            p.material.color.setHex(0x9b59b6); // Hypersonic purple trail
        } else if (type === 'highpower') {
            p.material.color.setHex(0xe67e22); // Thick orange smoke
        }

        const size = (type === 'highpower' ? 2.2 : 1.2) * (0.8 + Math.random() * 0.4);
        p.scale.set(size, size, size);
        this.scene.add(p);

        this.particles.push({
            mesh: p,
            vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5),
            life: 1.2,
            maxLife: 1.2,
            fade: true,
            grow: true
        });
    }

    createMuzzleFlash(position, direction) {
        const flash = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color: 0xfffa65 }));
        flash.position.copy(position);
        flash.scale.set(1.4, 1.4, 3.0);
        this.scene.add(flash);

        this.particles.push({
            mesh: flash,
            vel: direction.clone().multiplyScalar(40),
            life: 0.04,
            maxLife: 0.04,
            shrink: true
        });
    }

    createHitSparks(position) {
        for (let i = 0; i < 7; i++) {
            const p = new THREE.Mesh(this.sparkGeo, this.mSpark);
            p.position.copy(position);
            p.scale.set(0.4, 0.4, 0.4);
            this.scene.add(p);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 25
            );

            this.particles.push({
                mesh: p,
                vel: vel,
                life: 0.35,
                maxLife: 0.35,
                shrink: true
            });
        }
    }

    createExplosion(position, scale = 1.0) {
        const count = Math.floor(18 * scale);

        // Expanding fireballs
        for (let i = 0; i < count; i++) {
            const mat = (Math.random() > 0.4) ? this.mFire.clone() : this.mSmoke.clone();
            const p = new THREE.Mesh(this.smokeGeo, mat);
            p.position.copy(position);

            const pScale = (2.0 + Math.random() * 3.5) * scale;
            p.scale.set(pScale, pScale, pScale);
            this.scene.add(p);

            const speed = (25 + Math.random() * 45) * scale;
            const dir = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5 + 0.3,
                Math.random() - 0.5
            ).normalize();

            this.particles.push({
                mesh: p,
                vel: dir.multiplyScalar(speed),
                drag: 0.92,
                life: 0.9 + Math.random() * 0.7,
                maxLife: 1.6,
                fade: true,
                grow: true
            });
        }

        // Shockwave ring for large explosions
        if (scale > 1.8) {
            const ringGeo = new THREE.RingGeometry(2, 6, 32);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(position);
            this.scene.add(ring);

            this.particles.push({
                mesh: ring,
                vel: new THREE.Vector3(0, 0, 0),
                life: 0.7,
                maxLife: 0.7,
                customUpdate: (p, delta) => {
                    const ratio = 1 - (p.life / p.maxLife);
                    const s = 1 + ratio * 85 * scale;
                    ring.scale.set(s, s, s);
                    ring.material.opacity = (p.life / p.maxLife) * 0.8;
                }
            });
        }
    }

    createAircraftExplosion(position, orientation) {
        // Massive explosion at plane death
        this.createExplosion(position, 2.2);

        // Scatter 10 burning wreckage debris chunks
        for (let i = 0; i < 12; i++) {
            const debGeo = new THREE.BoxGeometry(
                1.0 + Math.random() * 2.2,
                0.3 + Math.random() * 0.8,
                1.5 + Math.random() * 2.5
            );
            const deb = new THREE.Mesh(debGeo, this.mDebris);
            deb.position.copy(position);
            deb.quaternion.copy(orientation);
            deb.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4
            ));
            this.scene.add(deb);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 60,
                20 + Math.random() * 50,
                (Math.random() - 0.5) * 60
            );

            const rotVel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            );

            this.debris.push({
                mesh: deb,
                vel: vel,
                rotVel: rotVel,
                life: 6.0,
                smokeTimer: 0
            });
        }
    }

    update(delta, terrain) {
        // 1. Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            if (p.customUpdate) {
                p.customUpdate(p, delta);
            } else {
                if (p.drag) p.vel.multiplyScalar(p.drag);
                p.mesh.position.addScaledVector(p.vel, delta);

                const lifeRatio = p.life / p.maxLife;

                if (p.fade && p.mesh.material) {
                    p.mesh.material.opacity = lifeRatio * 0.65;
                }
                if (p.shrink) {
                    const s = lifeRatio;
                    p.mesh.scale.set(s, s, s);
                } else if (p.grow) {
                    p.mesh.scale.multiplyScalar(1.0 + 0.8 * delta);
                }
            }
        }

        // 2. Update debris chunks with gravity and ground bounce
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.life -= delta;

            // Gravity
            d.vel.y -= 38 * delta;

            d.mesh.position.addScaledVector(d.vel, delta);
            d.mesh.rotation.x += d.rotVel.x * delta;
            d.mesh.rotation.y += d.rotVel.y * delta;
            d.mesh.rotation.z += d.rotVel.z * delta;

            // Trailing black smoke from wreckage
            d.smokeTimer += delta;
            if (d.smokeTimer > 0.08) {
                d.smokeTimer = 0;
                this.createMissileSmoke(d.mesh.position, 'standard');
            }

            // Ground impact
            if (terrain) {
                const groundY = terrain.getTerrainHeight(d.mesh.position.x, d.mesh.position.z);
                if (d.mesh.position.y <= groundY + 1.0) {
                    d.mesh.position.y = groundY + 1.0;
                    d.vel.y = -d.vel.y * 0.35; // bounce
                    d.vel.x *= 0.6;
                    d.vel.z *= 0.6;
                    d.rotVel.multiplyScalar(0.5);
                }
            }

            if (d.life <= 0) {
                this.scene.remove(d.mesh);
                this.debris.splice(i, 1);
            }
        }
    }
}

window.ParticleSystem = ParticleSystem;
