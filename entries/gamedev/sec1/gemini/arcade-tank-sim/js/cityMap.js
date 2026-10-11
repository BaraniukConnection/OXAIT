/**
 * Open City Map Procedural Generator & Collision Engine
 * Arcade Tank Simulator
 * Generates low-poly city grid: avenues, crossroads, buildings, ruins, props, and collision bounds.
 */

class CityMap {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.mapSize = options.mapSize || 360; // 360m x 360m map
        this.blockSize = options.blockSize || 48; // City block size in meters
        this.roadWidth = options.roadWidth || 16; // Wide roads for easy tank combat
        this.colliders = []; // Array of AABBs { minX, maxX, minZ, maxZ, height, mesh }
        this.houndSpawnPoints = [];
        this.playerSpawnPoint = new THREE.Vector3(0, 0, this.mapSize * 0.42);

        this.materials = {
            asphalt: new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.9, flatShading: true }),
            sidewalk: new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.8, flatShading: true }),
            roadLine: new THREE.MeshBasicMaterial({ color: 0xefd03b }),
            crosswalk: new THREE.MeshBasicMaterial({ color: 0xeeeeee }),
            buildingConcrete: new THREE.MeshStandardMaterial({ color: 0x6e7682, roughness: 0.7, flatShading: true }),
            buildingBrick: new THREE.MeshStandardMaterial({ color: 0x8a5547, roughness: 0.8, flatShading: true }),
            buildingDark: new THREE.MeshStandardMaterial({ color: 0x3e444d, roughness: 0.6, flatShading: true }),
            buildingGlass: new THREE.MeshStandardMaterial({ color: 0x4a6572, roughness: 0.3, metalness: 0.4, flatShading: true }),
            ruinWall: new THREE.MeshStandardMaterial({ color: 0x544f49, roughness: 0.9, flatShading: true }),
            metal: new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.6, flatShading: true }),
            treeFoliage: new THREE.MeshStandardMaterial({ color: 0x386638, roughness: 0.8, flatShading: true }),
            treeTrunk: new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9, flatShading: true }),
            barrier: new THREE.MeshStandardMaterial({ color: 0x8c8c88, roughness: 0.8, flatShading: true }),
            containerRed: new THREE.MeshStandardMaterial({ color: 0x993322, roughness: 0.6, metalness: 0.3, flatShading: true }),
            containerBlue: new THREE.MeshStandardMaterial({ color: 0x224488, roughness: 0.6, metalness: 0.3, flatShading: true }),
            containerGreen: new THREE.MeshStandardMaterial({ color: 0x2e663a, roughness: 0.6, metalness: 0.3, flatShading: true }),
        };

        this.cityGroup = new THREE.Group();
        this.scene.add(this.cityGroup);
    }

    generate() {
        this.buildGroundAndRoads();
        this.buildCityBlocks();
        this.buildPerimeterWalls();
        this.generateHoundSpawnPoints();
        console.log(`[CityMap] Generated city map with ${this.colliders.length} colliders and ${this.houndSpawnPoints.length} potential enemy spawns.`);
    }

    buildGroundAndRoads() {
        // Master ground plane
        const groundGeo = new THREE.PlaneGeometry(this.mapSize * 1.4, this.mapSize * 1.4);
        groundGeo.rotateX(-Math.PI / 2);
        const groundMesh = new THREE.Mesh(groundGeo, this.materials.asphalt);
        groundMesh.receiveShadow = true;
        this.cityGroup.add(groundMesh);

        // Grid road markings
        const halfSize = this.mapSize / 2;
        const step = this.blockSize + this.roadWidth;
        const lineGeo = new THREE.PlaneGeometry(0.3, 3);
        lineGeo.rotateX(-Math.PI / 2);

        // Longitudinal & Transverse dashed centerlines along roads
        for (let coord = -halfSize + step / 2; coord <= halfSize; coord += step) {
            // Road lines along Z
            for (let z = -halfSize; z <= halfSize; z += 6) {
                const mark = new THREE.Mesh(lineGeo, this.materials.roadLine);
                mark.position.set(coord, 0.02, z);
                this.cityGroup.add(mark);
            }
            // Road lines along X
            const lineGeoX = new THREE.PlaneGeometry(3, 0.3);
            lineGeoX.rotateX(-Math.PI / 2);
            for (let x = -halfSize; x <= halfSize; x += 6) {
                const mark = new THREE.Mesh(lineGeoX, this.materials.roadLine);
                mark.position.set(x, 0.02, coord);
                this.cityGroup.add(mark);
            }
        }
    }

    buildCityBlocks() {
        const halfSize = this.mapSize / 2;
        const step = this.blockSize + this.roadWidth;
        const bSize = this.blockSize;

        // Iterate through grid cells
        for (let x = -halfSize + this.roadWidth; x < halfSize - this.roadWidth; x += step) {
            for (let z = -halfSize + this.roadWidth; z < halfSize - this.roadWidth; z += step) {
                const blockCenterX = x + bSize / 2;
                const blockCenterZ = z + bSize / 2;

                // Reserve central plaza area at (0, 0)
                const distToCenter = Math.hypot(blockCenterX, blockCenterZ);
                if (distToCenter < 35) {
                    this.buildCentralPlaza(blockCenterX, blockCenterZ, bSize);
                    continue;
                }

                // Reserve player spawn neighborhood at south
                const distToPlayerSpawn = Math.hypot(blockCenterX - this.playerSpawnPoint.x, blockCenterZ - this.playerSpawnPoint.z);
                if (distToPlayerSpawn < 30) {
                    this.buildOpenPark(blockCenterX, blockCenterZ, bSize);
                    continue;
                }

                // Varied block themes: Skyscraper, Commercial, Industrial, or Battle Ruins
                const rand = Math.random();
                if (rand < 0.28) {
                    this.buildSkyscraperBlock(blockCenterX, blockCenterZ, bSize);
                } else if (rand < 0.58) {
                    this.buildCommercialBlock(blockCenterX, blockCenterZ, bSize);
                } else if (rand < 0.80) {
                    this.buildRuinedBlock(blockCenterX, blockCenterZ, bSize);
                } else {
                    this.buildIndustrialBlock(blockCenterX, blockCenterZ, bSize);
                }
            }
        }
    }

    /**
     * Central Plaza with open monument & fountain for tank dueling
     */
    buildCentralPlaza(cx, cz, size) {
        // Plaza raised decorative pavement
        const tileGeo = new THREE.BoxGeometry(size * 0.95, 0.2, size * 0.95);
        const tileMesh = new THREE.Mesh(tileGeo, this.materials.sidewalk);
        tileMesh.position.set(cx, 0.1, cz);
        tileMesh.receiveShadow = true;
        this.cityGroup.add(tileMesh);

        // Center monument obelisk
        const obeliskHeight = 16;
        const obeliskGeo = new THREE.CylinderGeometry(0.8, 1.8, obeliskHeight, 4);
        const obelisk = new THREE.Mesh(obeliskGeo, this.materials.buildingConcrete);
        obelisk.position.set(cx, obeliskHeight / 2, cz);
        obelisk.castShadow = true;
        this.cityGroup.add(obelisk);

        this.addCollider(cx - 2, cx + 2, cz - 2, cz + 2, obeliskHeight, obelisk);

        // Decorative corner barriers & trees
        const offset = size * 0.35;
        this.addTree(cx - offset, cz - offset);
        this.addTree(cx + offset, cz - offset);
        this.addTree(cx - offset, cz + offset);
        this.addTree(cx + offset, cz + offset);

        // Low defensive concrete barriers around perimeter
        this.addBarrier(cx - offset, cz, 0);
        this.addBarrier(cx + offset, cz, 0);
        this.addBarrier(cx, cz - offset, Math.PI / 2);
        this.addBarrier(cx, cz + offset, Math.PI / 2);
    }

    /**
     * Open Park / Staging ground near player spawn
     */
    buildOpenPark(cx, cz, size) {
        const parkGeo = new THREE.BoxGeometry(size * 0.95, 0.15, size * 0.95);
        const parkMat = new THREE.MeshStandardMaterial({ color: 0x3d5c38, roughness: 0.9 });
        const parkMesh = new THREE.Mesh(parkGeo, parkMat);
        parkMesh.position.set(cx, 0.08, cz);
        parkMesh.receiveShadow = true;
        this.cityGroup.add(parkMesh);

        // Several scattered low-poly trees
        for (let i = 0; i < 6; i++) {
            const rx = cx + (Math.random() - 0.5) * (size * 0.6);
            const rz = cz + (Math.random() - 0.5) * (size * 0.6);
            this.addTree(rx, rz);
        }
    }

    /**
     * High-rise Skyscrapers block
     */
    buildSkyscraperBlock(cx, cz, size) {
        // Concrete block base / sidewalk
        this.addBlockSidewalk(cx, cz, size);

        // 1 or 2 mega towers per block
        const count = Math.random() > 0.4 ? 2 : 1;
        if (count === 1) {
            const w = size * 0.65;
            const d = size * 0.65;
            const h = 28 + Math.random() * 24; // 28-52m tall
            this.addBuilding(cx, cz, w, d, h, this.materials.buildingGlass, true);
        } else {
            const w = size * 0.38;
            const d = size * 0.72;
            const h1 = 24 + Math.random() * 20;
            const h2 = 20 + Math.random() * 18;
            this.addBuilding(cx - size * 0.22, cz, w, d, h1, this.materials.buildingGlass, true);
            this.addBuilding(cx + size * 0.22, cz, w, d, h2, this.materials.buildingDark, true);
        }
    }

    /**
     * Mid-rise Commercial & Residential Block (shops, offices)
     */
    buildCommercialBlock(cx, cz, size) {
        this.addBlockSidewalk(cx, cz, size);

        // 4 quadrants of buildings with alleys
        const half = size * 0.24;
        const bW = size * 0.36;
        const bD = size * 0.36;

        const positions = [
            [-half, -half],
            [half, -half],
            [-half, half],
            [half, half]
        ];

        positions.forEach(([dx, dz]) => {
            // Some chance of courtyard or parking instead of building
            if (Math.random() > 0.85) {
                this.addShippingContainer(cx + dx, cz + dz, Math.random() * Math.PI);
                return;
            }
            const h = 10 + Math.random() * 14;
            const mat = Math.random() > 0.5 ? this.materials.buildingBrick : this.materials.buildingConcrete;
            this.addBuilding(cx + dx, cz + dz, bW, bD, h, mat, false);
        });
    }

    /**
     * War-torn / Ruined block (damaged structures, shattered walls, rubble piles)
     */
    buildRuinedBlock(cx, cz, size) {
        this.addBlockSidewalk(cx, cz, size);

        // Ruined building frame
        const bx = cx - size * 0.15;
        const bz = cz - size * 0.15;
        const bw = size * 0.5;
        const bd = size * 0.5;
        const bh = 14;

        // Partially collapsed main frame
        this.addBuilding(bx, bz, bw, bd, bh, this.materials.ruinWall, false);

        // Broken rubble mounds
        for (let i = 0; i < 5; i++) {
            const rx = cx + (Math.random() - 0.5) * (size * 0.7);
            const rz = cz + (Math.random() - 0.5) * (size * 0.7);
            const rSize = 3 + Math.random() * 4;
            const rGeo = new THREE.DodecahedronGeometry(rSize, 0);
            const rMesh = new THREE.Mesh(rGeo, this.materials.ruinWall);
            rMesh.position.set(rx, rSize * 0.4, rz);
            rMesh.rotation.set(Math.random(), Math.random(), Math.random());
            rMesh.castShadow = true;
            this.cityGroup.add(rMesh);
            this.addCollider(rx - rSize * 0.6, rx + rSize * 0.6, rz - rSize * 0.6, rz + rSize * 0.6, rSize, rMesh);
        }

        // Concrete barriers for defensive cover
        this.addBarrier(cx + size * 0.25, cz, 0);
        this.addBarrier(cx, cz + size * 0.25, Math.PI / 2);
    }

    /**
     * Industrial Depot Block (Warehouses & Shipping containers)
     */
    buildIndustrialBlock(cx, cz, size) {
        this.addBlockSidewalk(cx, cz, size);

        // Long warehouse hangar
        const w = size * 0.75;
        const d = size * 0.4;
        const h = 9;
        this.addBuilding(cx, cz - size * 0.18, w, d, h, this.materials.buildingDark, false);

        // Freight yard with shipping containers
        const cColors = [this.materials.containerRed, this.materials.containerBlue, this.materials.containerGreen];
        for (let i = -1; i <= 1; i++) {
            const contMesh = this.addShippingContainer(
                cx + i * 8,
                cz + size * 0.22,
                Math.random() > 0.5 ? 0 : Math.PI / 2,
                cColors[Math.floor(Math.random() * cColors.length)]
            );
        }
    }

    addBlockSidewalk(cx, cz, size) {
        const swGeo = new THREE.BoxGeometry(size * 0.94, 0.2, size * 0.94);
        const swMesh = new THREE.Mesh(swGeo, this.materials.sidewalk);
        swMesh.position.set(cx, 0.1, cz);
        swMesh.receiveShadow = true;
        this.cityGroup.add(swMesh);
    }

    /**
     * Helper to spawn low-poly building with rooftop props and collision box
     */
    addBuilding(x, z, width, depth, height, material, hasRooftopProps = false) {
        const bGeo = new THREE.BoxGeometry(width, height, depth);
        const bMesh = new THREE.Mesh(bGeo, material);
        bMesh.position.set(x, height / 2, z);
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        this.cityGroup.add(bMesh);

        // Rooftop accessories (AC units, radio mast, water tower)
        if (hasRooftopProps) {
            const roofY = height;
            // AC unit box
            const acGeo = new THREE.BoxGeometry(width * 0.25, 1.2, depth * 0.25);
            const acMesh = new THREE.Mesh(acGeo, this.materials.metal);
            acMesh.position.set(x + width * 0.2, roofY + 0.6, z + depth * 0.2);
            this.cityGroup.add(acMesh);

            // Radio mast antenna
            const mastGeo = new THREE.CylinderGeometry(0.1, 0.2, 7, 4);
            const mastMesh = new THREE.Mesh(mastGeo, this.materials.metal);
            mastMesh.position.set(x - width * 0.25, roofY + 3.5, z - depth * 0.25);
            this.cityGroup.add(mastMesh);
        }

        // Add to collision engine
        this.addCollider(x - width / 2, x + width / 2, z - depth / 2, z + depth / 2, height, bMesh);
        return bMesh;
    }

    addShippingContainer(x, z, rot = 0, mat = this.materials.containerRed) {
        const w = 3.2, d = 7.5, h = 3.0;
        const cGeo = new THREE.BoxGeometry(w, h, d);
        const cMesh = new THREE.Mesh(cGeo, mat);
        cMesh.position.set(x, h / 2, z);
        cMesh.rotation.y = rot;
        cMesh.castShadow = true;
        cMesh.receiveShadow = true;
        this.cityGroup.add(cMesh);

        // Approximate AABB
        const halfDiag = (w + d) * 0.35;
        this.addCollider(x - halfDiag, x + halfDiag, z - halfDiag, z + halfDiag, h, cMesh);
        return cMesh;
    }

    addBarrier(x, z, rot = 0) {
        const bGeo = new THREE.BoxGeometry(4.2, 1.2, 0.8);
        const bMesh = new THREE.Mesh(bGeo, this.materials.barrier);
        bMesh.position.set(x, 0.6, z);
        bMesh.rotation.y = rot;
        bMesh.castShadow = true;
        this.cityGroup.add(bMesh);

        const r = rot !== 0 ? 2.5 : 1.5;
        this.addCollider(x - r, x + r, z - r, z + r, 1.2, bMesh);
    }

    addTree(x, z) {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(x, 0, z);

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.5, 6);
        const trunk = new THREE.Mesh(trunkGeo, this.materials.treeTrunk);
        trunk.position.y = 1.25;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Foliage cone / octahedron
        const folGeo = new THREE.ConeGeometry(2.2, 4.5, 6);
        const fol = new THREE.Mesh(folGeo, this.materials.treeFoliage);
        fol.position.y = 4.2;
        fol.castShadow = true;
        treeGroup.add(fol);

        this.cityGroup.add(treeGroup);
        // Small collision around trunk
        this.addCollider(x - 0.8, x + 0.8, z - 0.8, z + 0.8, 4.0, treeGroup);
    }

    /**
     * Surrounding perimeter boundary walls to keep tanks inside play area
     */
    buildPerimeterWalls() {
        const size = this.mapSize;
        const h = 8;
        const thick = 4;
        const half = size / 2;

        // North wall
        this.addBuilding(0, -half, size + thick * 2, thick, h, this.materials.buildingConcrete);
        // South wall
        this.addBuilding(0, half, size + thick * 2, thick, h, this.materials.buildingConcrete);
        // West wall
        this.addBuilding(-half, 0, thick, size, h, this.materials.buildingConcrete);
        // East wall
        this.addBuilding(half, 0, thick, size, h, this.materials.buildingConcrete);
    }

    addCollider(minX, maxX, minZ, maxZ, height, mesh) {
        this.colliders.push({
            minX: Math.min(minX, maxX),
            maxX: Math.max(minX, maxX),
            minZ: Math.min(minZ, maxZ),
            maxZ: Math.max(minZ, maxZ),
            height: height,
            mesh: mesh
        });
    }

    /**
     * Resolves tank circular collision with sliding against city building boxes
     * Returns resolved new position { x, z, collided }
     */
    resolveTankCollision(posX, posZ, tankRadius = 2.4) {
        let resX = posX;
        let resZ = posZ;
        let collided = false;

        // Check against colliders
        for (let i = 0; i < this.colliders.length; i++) {
            const col = this.colliders[i];

            // Nearest point on AABB to circle center
            const nearestX = Math.max(col.minX, Math.min(resX, col.maxX));
            const nearestZ = Math.max(col.minZ, Math.min(resZ, col.maxZ));

            const dx = resX - nearestX;
            const dz = resZ - nearestZ;
            const distSq = dx * dx + dz * dz;

            if (distSq < tankRadius * tankRadius) {
                collided = true;
                const dist = Math.sqrt(distSq);
                if (dist > 0.0001) {
                    const overlap = tankRadius - dist;
                    const pushX = (dx / dist) * overlap;
                    const pushZ = (dz / dist) * overlap;
                    resX += pushX;
                    resZ += pushZ;
                } else {
                    // Deep penetration: push away from center
                    const centerX = (col.minX + col.maxX) / 2;
                    const centerZ = (col.minZ + col.maxZ) / 2;
                    const awayX = resX - centerX >= 0 ? 1 : -1;
                    const awayZ = resZ - centerZ >= 0 ? 1 : -1;
                    resX += awayX * 0.5;
                    resZ += awayZ * 0.5;
                }
            }
        }

        return { x: resX, z: resZ, collided };
    }

    /**
     * Fast Line-of-Sight Raycast check against city buildings
     * Returns true if clear sightline exists between (from) and (to)
     */
    hasLineOfSight(from, to) {
        const dirX = to.x - from.x;
        const dirZ = to.z - from.z;
        const maxDist = Math.hypot(dirX, dirZ);
        if (maxDist < 0.1) return true;

        const normX = dirX / maxDist;
        const normZ = dirZ / maxDist;

        // Fast Ray vs AABB intersection
        for (let i = 0; i < this.colliders.length; i++) {
            const b = this.colliders[i];
            // Ignore low props like barriers for line of sight if elevation is high enough
            if (b.height < 1.5) continue;

            let tmin = 0;
            let tmax = maxDist;

            // X slab
            if (Math.abs(normX) > 0.00001) {
                let tx1 = (b.minX - from.x) / normX;
                let tx2 = (b.maxX - from.x) / normX;
                if (tx1 > tx2) [tx1, tx2] = [tx2, tx1];
                tmin = Math.max(tmin, tx1);
                tmax = Math.min(tmax, tx2);
                if (tmin > tmax) continue;
            } else {
                if (from.x < b.minX || from.x > b.maxX) continue;
            }

            // Z slab
            if (Math.abs(normZ) > 0.00001) {
                let tz1 = (b.minZ - from.z) / normZ;
                let tz2 = (b.maxZ - from.z) / normZ;
                if (tz1 > tz2) [tz1, tz2] = [tz2, tz1];
                tmin = Math.max(tmin, tz1);
                tmax = Math.min(tmax, tz2);
                if (tmin > tmax) continue;
            } else {
                if (from.z < b.minZ || from.z > b.maxZ) continue;
            }

            // Ray intersects building between 0 and maxDist
            if (tmin < maxDist && tmax > 0.5) {
                return false; // View is obstructed
            }
        }

        return true; // Clear line of sight
    }

    /**
     * Check if a 3D projectile point hit any building or ground
     */
    checkProjectileHit(pos) {
        // Ground hit
        if (pos.y <= 0.1) {
            return { hit: true, point: new THREE.Vector3(pos.x, 0, pos.z), isGround: true };
        }

        // Building hit
        for (let i = 0; i < this.colliders.length; i++) {
            const b = this.colliders[i];
            if (pos.x >= b.minX && pos.x <= b.maxX &&
                pos.z >= b.minZ && pos.z <= b.maxZ &&
                pos.y <= b.height) {
                return { hit: true, point: pos.clone(), isBuilding: true };
            }
        }

        return { hit: false };
    }

    /**
     * Pre-computes strategic spawn locations for Hound enemy tanks
     */
    generateHoundSpawnPoints() {
        const half = this.mapSize * 0.42;
        const candidatePoints = [
            // Northern industrial sector
            new THREE.Vector3(-100, 0, -110),
            new THREE.Vector3(0, 0, -125),
            new THREE.Vector3(100, 0, -105),
            // Eastern business district
            new THREE.Vector3(115, 0, -45),
            new THREE.Vector3(125, 0, 45),
            // Western sector
            new THREE.Vector3(-115, 0, -40),
            new THREE.Vector3(-120, 0, 50),
            // Midfield crossroads
            new THREE.Vector3(-60, 0, -60),
            new THREE.Vector3(60, 0, -60),
            new THREE.Vector3(-60, 0, 50),
            new THREE.Vector3(60, 0, 50),
            // Central plaza approaches
            new THREE.Vector3(-30, 0, -5),
            new THREE.Vector3(30, 0, 5),
            new THREE.Vector3(0, 0, -40),
        ];

        this.houndSpawnPoints = candidatePoints;
    }

    /**
     * Returns N randomized, well-spaced spawn points for Hounds
     */
    getRandomHoundSpawns(count = 7) {
        const shuffled = [...this.houndSpawnPoints].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
}

window.CityMap = CityMap;
