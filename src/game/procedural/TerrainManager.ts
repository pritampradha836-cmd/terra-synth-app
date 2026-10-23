import * as THREE from 'three';
import { BiomeSystem, BIOMES, BiomeType } from './BiomeSystem';

export interface ChunkKey {
  cx: number;
  cz: number;
}

export class TerrainChunk {
  public cx: number;
  public cz: number;
  public mesh: THREE.Mesh;
  public geometry: THREE.PlaneGeometry;
  public material: THREE.MeshStandardMaterial;
  public lastUsed: number = 0;

  constructor(
    cx: number,
    cz: number,
    chunkSize: number,
    resolution: number,
    biomeSystem: BiomeSystem,
    material: THREE.MeshStandardMaterial
  ) {
    this.cx = cx;
    this.cz = cz;
    this.material = material;
    this.geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, resolution, resolution);
    this.geometry.rotateX(-Math.PI / 2);

    this.rebuild(chunkSize, resolution, biomeSystem);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(cx * chunkSize, 0, cz * chunkSize);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
  }

  public rebuild(chunkSize: number, resolution: number, biomeSystem: BiomeSystem): void {
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const count = posAttr.count;

    // Ensure color attribute exists
    let colorAttr = this.geometry.attributes.color as THREE.BufferAttribute | undefined;
    if (!colorAttr || colorAttr.count !== count) {
      this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    }

    const worldOriginX = this.cx * chunkSize;
    const worldOriginZ = this.cz * chunkSize;

    for (let i = 0; i < count; i++) {
      const lx = posAttr.getX(i);
      const lz = posAttr.getZ(i);
      const wx = worldOriginX + lx;
      const wz = worldOriginZ + lz;

      const h = biomeSystem.getHeight(wx, wz);
      posAttr.setY(i, h);

      const { slope } = biomeSystem.getNormalAndGradient(wx, wz);
      const col = biomeSystem.getColorAt(wx, wz, h, slope);

      colorAttr.setXYZ(i, col.r, col.g, col.b);
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  public dispose(): void {
    this.geometry.dispose();
  }
}

export class TerrainManager {
  public scene: THREE.Scene;
  public biomeSystem: BiomeSystem;
  public chunkSize = 48; // Size of each chunk in world units
  public resolution = 24; // Subdivisions per chunk
  public viewDistance = 3; // Grid radius (e.g. 3 => (2*3+1)^2 = 49 chunks)
  public activeChunks = new Map<string, TerrainChunk>();
  public groundMaterial: THREE.MeshStandardMaterial;

  // Instanced props: Foliage, Crystals, Monolith Boulders
  private foliageInstanced: THREE.InstancedMesh;
  private crystalInstanced: THREE.InstancedMesh;
  private boulderInstanced: THREE.InstancedMesh;
  private maxFoliage = 1500;
  private maxCrystals = 600;
  private maxBoulders = 800;

  private currentCenterCx = 999999;
  private currentCenterCz = 999999;

  // Procedural prop geometries & materials
  private foliageGeo: THREE.ConeGeometry;
  private crystalGeo: THREE.OctahedronGeometry;
  private boulderGeo: THREE.DodecahedronGeometry;

  constructor(scene: THREE.Scene, biomeSystem: BiomeSystem) {
    this.scene = scene;
    this.biomeSystem = biomeSystem;

    // Shared terrain material with vertex colors and subtle roughness
    this.groundMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.08,
      flatShading: false,
    });

    // Composite foliage geometry (pine spire style)
    this.foliageGeo = new THREE.ConeGeometry(1.4, 5.5, 5);
    this.foliageGeo.translate(0, 2.75, 0); // bottom-center pivot

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true,
    });
    this.foliageInstanced = new THREE.InstancedMesh(this.foliageGeo, foliageMat, this.maxFoliage);
    this.foliageInstanced.castShadow = true;
    this.foliageInstanced.receiveShadow = true;
    this.foliageInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.foliageInstanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxFoliage * 3), 3);
    this.foliageInstanced.frustumCulled = false;
    this.scene.add(this.foliageInstanced);

    // Crystal Spire Instanced Mesh
    this.crystalGeo = new THREE.OctahedronGeometry(1.2, 0);
    this.crystalGeo.scale(0.8, 2.4, 0.8);
    this.crystalGeo.translate(0, 1.2, 0);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.85,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.4,
    });
    this.crystalInstanced = new THREE.InstancedMesh(this.crystalGeo, crystalMat, this.maxCrystals);
    this.crystalInstanced.castShadow = true;
    this.crystalInstanced.receiveShadow = true;
    this.crystalInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crystalInstanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxCrystals * 3), 3);
    this.crystalInstanced.frustumCulled = false;
    this.scene.add(this.crystalInstanced);

    // Monolith / Boulder Instanced Mesh
    this.boulderGeo = new THREE.DodecahedronGeometry(1.6, 0);
    this.boulderGeo.scale(1.2, 0.85, 1.1);
    this.boulderGeo.translate(0, 0.8, 0);

    const boulderMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    this.boulderInstanced = new THREE.InstancedMesh(this.boulderGeo, boulderMat, this.maxBoulders);
    this.boulderInstanced.castShadow = true;
    this.boulderInstanced.receiveShadow = true;
    this.boulderInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.boulderInstanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxBoulders * 3), 3);
    this.boulderInstanced.frustumCulled = false;
    this.scene.add(this.boulderInstanced);
  }

  public updatePlayerPosition(playerX: number, playerZ: number): boolean {
    const centerCx = Math.floor((playerX + this.chunkSize * 0.5) / this.chunkSize);
    const centerCz = Math.floor((playerZ + this.chunkSize * 0.5) / this.chunkSize);

    if (centerCx === this.currentCenterCx && centerCz === this.currentCenterCz) {
      return false; // No chunk streaming required
    }

    this.currentCenterCx = centerCx;
    this.currentCenterCz = centerCz;

    const neededKeys = new Set<string>();

    // Determine chunks in radius
    for (let dx = -this.viewDistance; dx <= this.viewDistance; dx++) {
      for (let dz = -this.viewDistance; dz <= this.viewDistance; dz++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.activeChunks.has(key)) {
          const chunk = new TerrainChunk(
            cx,
            cz,
            this.chunkSize,
            this.resolution,
            this.biomeSystem,
            this.groundMaterial
          );
          this.activeChunks.set(key, chunk);
          this.scene.add(chunk.mesh);
        }
      }
    }

    // Prune distant chunks
    for (const [key, chunk] of this.activeChunks.entries()) {
      if (!neededKeys.has(key)) {
        this.scene.remove(chunk.mesh);
        chunk.dispose();
        this.activeChunks.delete(key);
      }
    }

    // Populate instanced props across active area
    this.populateInstancedProps(playerX, playerZ);

    return true;
  }

  /**
   * Distributes foliage, crystals, and boulders deterministically based on noise
   */
  private populateInstancedProps(playerX: number, playerZ: number): void {
    let foliageCount = 0;
    let crystalCount = 0;
    let boulderCount = 0;

    const dummy = new THREE.Object3D();
    const tempCol = new THREE.Color();
    const radius = this.viewDistance * this.chunkSize;
    const minX = playerX - radius;
    const maxX = playerX + radius;
    const minZ = playerZ - radius;
    const maxZ = playerZ + radius;

    // Deterministic pseudo-grid sampling
    const step = 6.0;
    for (let x = Math.floor(minX / step) * step; x < maxX; x += step) {
      for (let z = Math.floor(minZ / step) * step; z < maxZ; z += step) {
        // Pseudo-random offset based on coordinate hash
        const hash = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        const rnd = hash - Math.floor(hash);
        if (rnd < 0.25) continue; // sparse distribution

        const px = x + (rnd - 0.5) * (step * 0.85);
        const pz = z + ((rnd * 7.1) % 1 - 0.5) * (step * 0.85);

        // Don't place right on player spawn
        if (Math.hypot(px - playerX, pz - playerZ) < 4.0) continue;

        const h = this.biomeSystem.getHeight(px, pz);
        if (h <= this.biomeSystem.params.seaLevel + 0.2) continue; // no trees submerged

        const { slope, normal } = this.biomeSystem.getNormalAndGradient(px, pz);
        const { primaryBiome } = this.biomeSystem.getBiomeWeights(px, pz);

        // Decide prop type by biome density and slope
        if (slope > 0.85) {
          // Boulder on steep cliff
          if (boulderCount < this.maxBoulders && rnd < primaryBiome.boulderDensity) {
            dummy.position.set(px, h, pz);
            const scale = 0.7 + rnd * 0.8;
            dummy.scale.set(scale, scale * (0.8 + rnd * 0.4), scale);
            dummy.rotation.set(normal.x * 0.3, rnd * Math.PI * 2, normal.z * 0.3);
            dummy.updateMatrix();

            this.boulderInstanced.setMatrixAt(boulderCount, dummy.matrix);
            tempCol.copy(primaryBiome.primaryColor).lerp(new THREE.Color('#64748b'), 0.4);
            this.boulderInstanced.setColorAt(boulderCount, tempCol);
            boulderCount++;
          }
        } else if (primaryBiome.id === 'CRYSTALLINE_TUNDRA' || primaryBiome.id === 'CYBER_AETHER') {
          // Crystal spires
          if (crystalCount < this.maxCrystals && rnd < primaryBiome.crystalDensity) {
            dummy.position.set(px, h, pz);
            const scale = 0.6 + rnd * 0.9;
            dummy.scale.set(scale, scale * (1.0 + rnd * 0.8), scale);
            dummy.rotation.set(0, rnd * Math.PI * 2, 0);
            dummy.updateMatrix();

            this.crystalInstanced.setMatrixAt(crystalCount, dummy.matrix);
            tempCol.copy(primaryBiome.secondaryColor);
            this.crystalInstanced.setColorAt(crystalCount, tempCol);
            crystalCount++;
          }
        } else {
          // Foliage / Conifer Tree
          if (foliageCount < this.maxFoliage && rnd < primaryBiome.vegetationDensity) {
            dummy.position.set(px, h, pz);
            const scale = 0.7 + rnd * 0.6;
            dummy.scale.set(scale, scale * (0.9 + rnd * 0.5), scale);
            dummy.rotation.set(0, rnd * Math.PI * 2, 0);
            dummy.updateMatrix();

            this.foliageInstanced.setMatrixAt(foliageCount, dummy.matrix);
            tempCol.copy(primaryBiome.primaryColor).lerp(primaryBiome.accentColor, rnd * 0.3);
            this.foliageInstanced.setColorAt(foliageCount, tempCol);
            foliageCount++;
          }
        }
      }
    }

    this.foliageInstanced.count = foliageCount;
    this.foliageInstanced.instanceMatrix.needsUpdate = true;
    if (this.foliageInstanced.instanceColor) this.foliageInstanced.instanceColor.needsUpdate = true;

    this.crystalInstanced.count = crystalCount;
    this.crystalInstanced.instanceMatrix.needsUpdate = true;
    if (this.crystalInstanced.instanceColor) this.crystalInstanced.instanceColor.needsUpdate = true;

    this.boulderInstanced.count = boulderCount;
    this.boulderInstanced.instanceMatrix.needsUpdate = true;
    if (this.boulderInstanced.instanceColor) this.boulderInstanced.instanceColor.needsUpdate = true;
  }

  public rebuildAllChunks(): void {
    for (const chunk of this.activeChunks.values()) {
      chunk.rebuild(this.chunkSize, this.resolution, this.biomeSystem);
    }
  }

  public setResolution(newRes: number): void {
    if (newRes === this.resolution) return;
    this.resolution = newRes;
    // Recreate chunks with new subdivision level
    for (const chunk of this.activeChunks.values()) {
      this.scene.remove(chunk.mesh);
      chunk.dispose();
    }
    this.activeChunks.clear();
    const cx = this.currentCenterCx;
    const cz = this.currentCenterCz;
    this.currentCenterCx = 999999;
    this.currentCenterCz = 999999;
    this.updatePlayerPosition(cx * this.chunkSize, cz * this.chunkSize);
  }

  public setViewDistance(dist: number): void {
    this.viewDistance = dist;
    const cx = this.currentCenterCx;
    const cz = this.currentCenterCz;
    this.currentCenterCx = 999999;
    this.currentCenterCz = 999999;
    this.updatePlayerPosition(cx * this.chunkSize, cz * this.chunkSize);
  }

  public dispose(): void {
    for (const chunk of this.activeChunks.values()) {
      this.scene.remove(chunk.mesh);
      chunk.dispose();
    }
    this.activeChunks.clear();
    this.scene.remove(this.foliageInstanced);
    this.scene.remove(this.crystalInstanced);
    this.scene.remove(this.boulderInstanced);
    this.foliageGeo.dispose();
    this.crystalGeo.dispose();
    this.boulderGeo.dispose();
  }
}
