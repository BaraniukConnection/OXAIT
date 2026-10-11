// Rogue AI Controller (Su-57 "Rogue")
// Patrols within dedicated radius, attacks player on intrusion, strictly adheres to leash radius

class RogueAI {
    constructor(id, scene, centerPos, radius, soundEngine, particleSystem) {
        this.id = id;
        this.name = `Rogue ${id}`;
        this.scene = scene;
        this.sound = soundEngine;
        this.particles = particleSystem;

        // Territory definition
        this.center = centerPos.clone();
        this.radius = radius; // e.g. 480 meters

        // 3D Model
        this.mesh = AircraftModels.createRogue();
        this.mesh.position.copy(centerPos);
        this.scene.add(this.mesh);

        // Flight parameters
        this.speed = 130;
        this.cruiseSpeed = 125;
        this.combatSpeed = 175;
        this.turnRate = 1.6;
        this.health = 100;
        this.maxHealth = 100;
        this.isAlive = true;

        // AI State: 'PATROL', 'ATTACK', 'RETURN'
        this.state = 'PATROL';
        this.patrolAngle = Math.random() * Math.PI * 2;
        this.patrolAltitude = centerPos.y;

        // Combat timers
        this.gunCooldown = 0;
        this.gunBurstTimer = 0;
        this.missileCooldown = 6.0 + Math.random() * 4.0;
        this.timeTargetInSights = 0;

        // Random patrol radius offset
        this.orbitRadius = radius * (0.45 + Math.random() * 0.35);
        this.orbitSpeed = 0.35 * (Math.random() > 0.5 ? 1 : -1);
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.destroy();
        }
        return this.health;
    }

    destroy() {
        this.isAlive = false;
        if (this.sound) {
            this.sound.playExplosion(true);
        }
        if (this.particles) {
            this.particles.createAircraftExplosion(this.mesh.position, this.mesh.quaternion);
        }
        this.scene.remove(this.mesh);
    }

    update(delta, player, terrain, weapons) {
        if (!this.isAlive) return;

        // Timers
        if (this.gunCooldown > 0) this.gunCooldown -= delta;
        if (this.missileCooldown > 0) this.missileCooldown -= delta;

        const currentPos = this.mesh.position;
        const distFromCenter = currentPos.distanceTo(this.center);

        const playerPos = player ? player.mesh.position : null;
        const distPlayerToCenter = playerPos ? playerPos.distanceTo(this.center) : Infinity;
        const playerInRadius = (distPlayerToCenter <= this.radius);

        // State Machine Decision
        if (this.state === 'PATROL') {
            if (player && player.isAlive && playerInRadius) {
                // Player breached our airspace! Switch to ATTACK
                this.state = 'ATTACK';
            }
        } else if (this.state === 'ATTACK') {
            // STRICT LEASH ENFORCEMENT:
            // 1. If player left our radius -> break off attack and return!
            // 2. If Rogue itself reached the edge of its radius -> break off attack and return!
            if (!playerInRadius || distFromCenter > (this.radius - 25)) {
                this.state = 'RETURN';
            }
        } else if (this.state === 'RETURN') {
            // Once we have returned safely back towards our center
            if (distFromCenter < this.radius * 0.55) {
                if (playerInRadius && player && player.isAlive) {
                    this.state = 'ATTACK';
                } else {
                    this.state = 'PATROL';
                }
            }
        }

        // Execute behavior based on state
        let targetPoint = new THREE.Vector3();

        if (this.state === 'PATROL') {
            this.speed = THREE.MathUtils.lerp(this.speed, this.cruiseSpeed, delta * 2.0);
            this.patrolAngle += this.orbitSpeed * delta;

            targetPoint.set(
                this.center.x + Math.cos(this.patrolAngle) * this.orbitRadius,
                this.patrolAltitude + Math.sin(this.patrolAngle * 2) * 25,
                this.center.z + Math.sin(this.patrolAngle) * this.orbitRadius
            );

        } else if (this.state === 'ATTACK') {
            this.speed = THREE.MathUtils.lerp(this.speed, this.combatSpeed, delta * 3.0);

            // Lead target point ahead of player
            const playerVel = player.velocity ? player.velocity.clone() : new THREE.Vector3();
            targetPoint.copy(playerPos).addScaledVector(playerVel, 0.45);

            // Combat engagement: Fire machine gun & missiles if lined up
            this.handleCombatShooting(delta, player, weapons);

        } else if (this.state === 'RETURN') {
            this.speed = THREE.MathUtils.lerp(this.speed, this.combatSpeed, delta * 2.0);
            targetPoint.copy(this.center);
        }

        // Terrain Collision Avoidance for Rogue
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const lookAhead = currentPos.clone().addScaledVector(forward, 240);
        const groundAhead = terrain.getTerrainHeight(lookAhead.x, lookAhead.z);

        if (lookAhead.y - groundAhead < 80) {
            // Pull up aggressively to clear mountain!
            targetPoint.y = Math.max(targetPoint.y, groundAhead + 120);
        }

        // Turn towards target point
        const desiredDir = targetPoint.clone().sub(currentPos).normalize();
        const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);

        const targetRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), desiredDir);
        this.mesh.quaternion.rotateTowards(targetRot, this.turnRate * delta);

        // Move forward
        const updatedForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        this.mesh.position.addScaledVector(updatedForward, this.speed * delta);

        // Engine trail particles
        if (this.particles) {
            this.particles.createJetExhaust(this.mesh, 0.7);
        }
    }

    handleCombatShooting(delta, player, weapons) {
        if (!player || !player.isAlive || !weapons) return;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const toPlayer = player.mesh.position.clone().sub(this.mesh.position);
        const dist = toPlayer.length();
        toPlayer.normalize();

        const angleCos = forward.dot(toPlayer);

        // If player is in front arc (< 22 degrees) and within 650m
        if (angleCos > 0.92 && dist < 650) {
            this.timeTargetInSights += delta;

            // Machine Gun Burst
            if (this.gunCooldown <= 0) {
                weapons.fireMG(this.mesh, true, player);
                this.gunCooldown = 0.12; // Gun burst rate
            }

            // Missile Launch (if tracked for > 2.2s and missile ready)
            if (this.timeTargetInSights > 2.2 && this.missileCooldown <= 0 && dist < 800) {
                weapons.spawnEnemyMissile(this.mesh, player.mesh);
                this.missileCooldown = 9.0;
                this.timeTargetInSights = 0;
            }
        } else {
            this.timeTargetInSights = Math.max(0, this.timeTargetInSights - delta);
        }
    }
}

window.RogueAI = RogueAI;
