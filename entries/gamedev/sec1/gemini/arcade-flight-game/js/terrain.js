// Procedural Low-Poly Terrain, Mountains, Forests and Collision System

class WorldTerrain {
    constructor(scene) {
        this.scene = scene;
        this.worldSize = 5000; // 5000m x 5000m map
        this.segments = 140;   // Low-poly faceted resolution
        this.maxHeight = 420;
        this.waterLevel = 14;

        this.trees = []; // { x, y, z, radius, height }
        this.terrainMesh = null;
        this.waterMesh = null;
        this.clouds = [];
        this.zoneRings = [];

        this.init();
    }

    // Mathematical height generator combining multiple sinusoidal octaves and ridged noise
    getTerrainHeight(x, z) {
        // Boundary containment: mountains rise at map edges
        const distFromCenter = Math.hypot(x, z);
        const edgeFactor = Math.max(0, (distFromCenter - 1800) / 700);
        const wallHeight = edgeFactor * edgeFactor * 250;

        // Base undulating valleys
        const nx = x * 0.0012;
        const nz = z * 0.0012;

        let h = Math.sin(nx * 1.5) * Math.cos(nz * 1.5) * 80;
        h += Math.sin(nx * 3.2 + 0.8) * Math.cos(nz * 2.8 - 0.4) * 55;

        // Sharp ridged mountain ranges
        const rx = x * 0.0028;
        const rz = z * 0.0028;
        const ridge = Math.abs(Math.sin(rx + Math.cos(rz * 1.8))) * 110;
        const subRidge = Math.abs(Math.sin(rx * 2.5 - rz * 1.2)) * 60;
        h += ridge + subRidge;

        // Mountain peaks
        const p1 = Math.exp(-Math.hypot(x - 800, z - 700) / 380) * 280;
        const p2 = Math.exp(-Math.hypot(x + 1100, z - 600) / 420) * 310;
        const p3 = Math.exp(-Math.hypot(x - 900, z + 1000) / 360) * 260;
        const p4 = Math.exp(-Math.hypot(x + 600, z + 1200) / 400) * 290;
        const p5 = Math.exp(-Math.hypot(x, z + 1500) / 350) * 240;

        // Central flight valley smoothing
        const centerValley = Math.exp(-Math.hypot(x, z) / 450);
        h = h * (1.0 - centerValley * 0.85) + (centerValley * 20);

        h += p1 + p2 + p3 + p4 + p5 + wallHeight;

        return Math.max(8, h);
    }

    init() {
        this.buildTerrainMesh();
        this.buildWater();
        this.buildForest();
        this.buildClouds();
    }

    buildTerrainMesh() {
        const geo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, this.segments, this.segments);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        const colors = new Float32Array(pos.count * 3);

        const cWater = new THREE.Color(0x356885);
        const cSand = new THREE.Color(0xc2b280);
        const cGrass = new THREE.Color(0x3e7a3a);
        const cForest = new THREE.Color(0x285926);
        const cRock = new THREE.Color(0x656b73);
        const cSnow = new THREE.Color(0xf2f4f7);

        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vz = pos.getZ(i);
            const vy = this.getTerrainHeight(vx, vz);
            pos.setY(i, vy);

            const col = new THREE.Color();
            if (vy < 18) {
                col.copy(cSand);
            } else if (vy < 90) {
                col.copy(cGrass).lerp(cForest, (vy - 18) / 72);
            } else if (vy < 200) {
                col.copy(cForest).lerp(cRock, (vy - 90) / 110);
            } else if (vy < 300) {
                col.copy(cRock).lerp(cSnow, (vy - 200) / 100);
            } else {
                col.copy(cSnow);
            }

            // Slight low-poly shade jitter
            const jitter = (Math.sin(vx * 0.1) * Math.cos(vz * 0.1)) * 0.05;
            col.r = Math.min(1, Math.max(0, col.r + jitter));
            col.g = Math.min(1, Math.max(0, col.g + jitter));
            col.b = Math.min(1, Math.max(0, col.b + jitter));

            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.05,
            flatShading: true
        });

        this.terrainMesh = new THREE.Mesh(geo, mat);
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);
    }

    buildWater() {
        const waterGeo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 2, 2);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x1a4563,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.85
        });

        this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
        this.waterMesh.position.y = this.waterLevel;
        this.scene.add(this.waterMesh);
    }

    buildForest() {
        // Build instanced low-poly pine trees across valleys and slopes
        const treeCount = 1800;

        // Tree trunk geometry & foliage geometry combined in instanced meshes
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 5, 5);
        trunkGeo.translate(0, 2.5, 0);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3319, roughness: 0.9, flatShading: true });

        const foliageGeo = new THREE.ConeGeometry(3.6, 9, 5);
        foliageGeo.translate(0, 8.5, 0);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1e4620, roughness: 0.85, flatShading: true });

        const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
        const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);

        const dummy = new THREE.Object3D();
        let placed = 0;

        // Random deterministic placement across map
        for (let i = 0; i < treeCount * 3 && placed < treeCount; i++) {
            const rx = (Math.sin(i * 12.9898) * 43758.5453 % 1) * (this.worldSize * 0.84) - (this.worldSize * 0.42);
            const rz = (Math.cos(i * 78.233) * 43758.5453 % 1) * (this.worldSize * 0.84) - (this.worldSize * 0.42);

            const ty = this.getTerrainHeight(rx, rz);

            // Trees thrive in valleys and mid-slopes, not under water and not on high snowy peaks
            if (ty > 22 && ty < 220) {
                const scale = 0.85 + (Math.sin(i) * 0.5 + 0.5) * 0.5;
                dummy.position.set(rx, ty, rz);
                dummy.rotation.y = Math.sin(i * 3) * Math.PI;
                dummy.scale.set(scale, scale, scale);
                dummy.updateMatrix();

                trunkMesh.setMatrixAt(placed, dummy.matrix);
                foliageMesh.setMatrixAt(placed, dummy.matrix);

                // Store for collision
                this.trees.push({
                    x: rx,
                    y: ty,
                    z: rz,
                    height: 12 * scale,
                    radius: 3.8 * scale
                });

                placed++;
            }
        }

        trunkMesh.instanceMatrix.needsUpdate = true;
        foliageMesh.instanceMatrix.needsUpdate = true;
        trunkMesh.receiveShadow = true;
        foliageMesh.receiveShadow = true;

        this.scene.add(trunkMesh);
        this.scene.add(foliageMesh);
    }

    buildClouds() {
        // Stylized low-poly clouds
        const cloudCount = 35;
        const cloudMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.6,
            flatShading: true,
            transparent: true,
            opacity: 0.85
        });

        for (let i = 0; i < cloudCount; i++) {
            const group = new THREE.Group();
            const puffCount = 4 + Math.floor(Math.random() * 4);

            for (let j = 0; j < puffCount; j++) {
                const geo = new THREE.DodecahedronGeometry(25 + Math.random() * 20, 1);
                const mesh = new THREE.Mesh(geo, cloudMat);
                mesh.position.set(
                    (j - puffCount / 2) * 28 + (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 25
                );
                mesh.scale.set(1.2, 0.65, 1.0);
                group.add(mesh);
            }

            const cx = (Math.random() - 0.5) * (this.worldSize * 0.8);
            const cz = (Math.random() - 0.5) * (this.worldSize * 0.8);
            const cy = 340 + Math.random() * 120;
            group.position.set(cx, cy, cz);
            this.scene.add(group);
            this.clouds.push(group);
        }
    }

    // Add visual holographic patrol boundary ring on terrain for each Rogue
    addPatrolZoneVisual(center, radius, name = "PATROL ZONE") {
        const ringGeo = new THREE.RingGeometry(radius - 6, radius + 6, 64);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff3b30,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45
        });

        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(center.x, center.y - 120, center.z);
        this.scene.add(ringMesh);

        // Cylinder holographic perimeter fence
        const cylinderGeo = new THREE.CylinderGeometry(radius, radius, 300, 32, 1, true);
        const cylinderMat = new THREE.MeshBasicMaterial({
            color: 0xff3b30,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.07,
            wireframe: true
        });
        const cylinderMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
        cylinderMesh.position.set(center.x, center.y, center.z);
        this.scene.add(cylinderMesh);

        this.zoneRings.push({ ring: ringMesh, cylinder: cylinderMesh, center: center, radius: radius });
    }

    update(delta) {
        // Slowly drift clouds
        for (const cloud of this.clouds) {
            cloud.position.x += 6 * delta;
            if (cloud.position.x > this.worldSize * 0.5) {
                cloud.position.x = -this.worldSize * 0.5;
            }
        }
    }

    // Collision check against ground and trees
    // Returns: { collided: boolean, reason: string, normal: Vector3 }
    checkCollision(position, radius = 3.5) {
        // 1. Terrain Height Collision
        const groundY = this.getTerrainHeight(position.x, position.z);
        if (position.y - radius <= groundY) {
            return {
                collided: true,
                reason: "TERRAIN IMPACT",
                groundY: groundY
            };
        }

        // 2. Tree Collision
        // Check only trees within bounding box
        const px = position.x;
        const py = position.y;
        const pz = position.z;

        for (let i = 0; i < this.trees.length; i++) {
            const tree = this.trees[i];
            const dx = px - tree.x;
            const dz = pz - tree.z;

            // Fast horizontal box check
            if (Math.abs(dx) < 10 && Math.abs(dz) < 10) {
                const distH = Math.hypot(dx, dz);
                if (distH < tree.radius + radius) {
                    if (py < tree.y + tree.height && py > tree.y) {
                        return {
                            collided: true,
                            reason: "FOREST TREE COLLISION",
                            groundY: tree.y
                        };
                    }
                }
            }
        }

        return { collided: false };
    }
}

window.WorldTerrain = WorldTerrain;
