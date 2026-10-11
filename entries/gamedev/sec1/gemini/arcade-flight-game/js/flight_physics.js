// Arcade Flight Physics Engine
// Smooth responsive 6-DOF arcade flight model

class FlightPhysics {
    constructor(planeMesh, planeConfig) {
        this.mesh = planeMesh;
        this.config = planeConfig || {
            name: "Thunder",
            maxSpeed: 175,
            minSpeed: 55,
            cruiseSpeed: 120,
            turnRate: 1.2,
            acceleration: 38,
            deceleration: 32,
            armor: 100
        };

        // State
        this.speed = this.config.cruiseSpeed;
        this.throttle = 0.6; // 0.0 to 1.0
        this.isBoost = false;
        this.isAirbrake = false;
        this.health = this.config.armor;
        this.maxHealth = this.config.armor;
        this.isAlive = true;

        // Rotation angles & rates
        this.pitchRate = 0;
        this.rollRate = 0;
        this.yawRate = 0;

        // Setting: invert pitch (default false: Down arrow = pitch up / pull back stick)
        this.invertPitch = false;

        // Kinematics vectors
        this.velocity = new THREE.Vector3();
        this.forward = new THREE.Vector3(0, 0, -1);
        this.up = new THREE.Vector3(0, 1, 0);
        this.right = new THREE.Vector3(1, 0, 0);

        // G-force tracker
        this.gForce = 1.0;
        this.lastVelocity = new THREE.Vector3();

        // Control input state
        this.inputs = {
            pitch: 0,   // -1 (down) to +1 (up)
            roll: 0,    // -1 (left) to +1 (right)
            yaw: 0,     // -1 (left) to +1 (right)
            throttleUp: false,
            throttleDown: false
        };
    }

    setPlaneConfig(config) {
        this.config = config;
        this.speed = config.cruiseSpeed || 120;
        this.health = config.armor || 100;
        this.maxHealth = this.health;
    }

    handleKeyDown(code) {
        switch (code) {
            case 'ArrowDown':
                this.inputs.pitch = this.invertPitch ? -1 : 1; // Pull back = pitch up
                break;
            case 'ArrowUp':
                this.inputs.pitch = this.invertPitch ? 1 : -1; // Push stick = pitch down
                break;
            case 'ArrowLeft':
                this.inputs.roll = -1; // Bank left
                break;
            case 'ArrowRight':
                this.inputs.roll = 1;  // Bank right
                break;
            case 'KeyW':
            case 'Keyw':
                this.inputs.throttleUp = true;
                break;
            case 'KeyS':
            case 'Keys':
                this.inputs.throttleDown = true;
                break;
            case 'KeyA':
            case 'Keya':
                this.inputs.yaw = -1; // Rudder left
                break;
            case 'KeyD':
            case 'Keyd':
                this.inputs.yaw = 1;  // Rudder right
                break;
        }
    }

    handleKeyUp(code) {
        switch (code) {
            case 'ArrowDown':
                if (this.inputs.pitch === (this.invertPitch ? -1 : 1)) this.inputs.pitch = 0;
                break;
            case 'ArrowUp':
                if (this.inputs.pitch === (this.invertPitch ? 1 : -1)) this.inputs.pitch = 0;
                break;
            case 'ArrowLeft':
                if (this.inputs.roll === -1) this.inputs.roll = 0;
                break;
            case 'ArrowRight':
                if (this.inputs.roll === 1) this.inputs.roll = 0;
                break;
            case 'KeyW':
            case 'Keyw':
                this.inputs.throttleUp = false;
                break;
            case 'KeyS':
            case 'Keys':
                this.inputs.throttleDown = false;
                break;
            case 'KeyA':
            case 'Keya':
                if (this.inputs.yaw === -1) this.inputs.yaw = 0;
                break;
            case 'KeyD':
            case 'Keyd':
                if (this.inputs.yaw === 1) this.inputs.yaw = 0;
                break;
        }
    }

    update(delta) {
        if (!this.isAlive) return;

        // 1. Throttle logic
        if (this.inputs.throttleUp) {
            this.throttle = Math.min(1.0, this.throttle + 0.5 * delta);
        } else if (this.inputs.throttleDown) {
            this.throttle = Math.max(0.15, this.throttle - 0.5 * delta);
        }

        this.isBoost = this.throttle > 0.85;
        this.isAirbrake = this.throttle < 0.3;

        // Target speed calculation based on throttle and aircraft stats
        const minSpd = this.config.minSpeed;
        const maxSpd = this.config.maxSpeed;
        const targetSpeed = minSpd + (maxSpd - minSpd) * this.throttle;

        // Speed ramp with acceleration / braking
        const accelRate = this.isBoost ? this.config.acceleration * 1.4 : this.config.acceleration;
        if (this.speed < targetSpeed) {
            this.speed = Math.min(targetSpeed, this.speed + accelRate * delta);
        } else {
            this.speed = Math.max(targetSpeed, this.speed - this.config.deceleration * delta);
        }

        // Gravity influence: diving increases speed, climbing reduces speed slightly
        const worldDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const pitchAngle = Math.asin(Math.max(-1, Math.min(1, worldDir.y)));
        this.speed -= Math.sin(pitchAngle) * 16 * delta;
        this.speed = Math.max(minSpd * 0.9, Math.min(maxSpd * 1.25, this.speed));

        // 2. Angular Rates & Rotations
        const agility = this.config.turnRate;
        const targetPitchRate = this.inputs.pitch * 1.8 * agility;
        const targetRollRate = -this.inputs.roll * 3.4 * agility; // Rolling
        const targetYawRate = -this.inputs.yaw * 0.9 * agility;

        // Smooth damping
        const smoothFactor = 12.0 * delta;
        this.pitchRate += (targetPitchRate - this.pitchRate) * Math.min(1, smoothFactor);
        this.rollRate += (targetRollRate - this.rollRate) * Math.min(1, smoothFactor);
        this.yawRate += (targetYawRate - this.yawRate) * Math.min(1, smoothFactor);

        // Aerodynamic roll-to-yaw bank coupling (natural coordinated banking turn)
        const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);
        const autoBankTurn = localRight.y * 0.4 * agility;

        // Apply local rotations
        this.mesh.rotateX(this.pitchRate * delta);
        this.mesh.rotateZ(this.rollRate * delta);
        this.mesh.rotateY((this.yawRate + autoBankTurn) * delta);

        // 3. Forward Movement
        this.forward.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        this.velocity.copy(this.forward).multiplyScalar(this.speed);
        this.mesh.position.addScaledVector(this.velocity, delta);

        // 4. G-Force computation
        const accelVec = this.velocity.clone().sub(this.lastVelocity).divideScalar(Math.max(0.001, delta));
        this.gForce = 1.0 + (accelVec.length() / 9.81) * 0.25;
        this.lastVelocity.copy(this.velocity);
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.isAlive = false;
        }
        return this.health;
    }
}

window.FlightPhysics = FlightPhysics;
