import * as THREE from 'three';
import { BiomeSystem } from '../procedural/BiomeSystem';
import { Player } from './Player';
import { ParticleSystem } from '../particles/ParticleSystem';
import { audioSystem } from '../audio/ProceduralAudio';

export interface Shrine {
  id: string;
  x: number;
  z: number;
  height: number;
  isActivated: boolean;
  group: THREE.Group;
  ringMesh: THREE.Mesh;
  coreMesh: THREE.Mesh;
}

export class ShrineManager {
  public scene: THREE.Scene;
  public biomeSystem: BiomeSystem;
  public shrines: Map<string, Shrine> = new Map();
  public nearbyShrine: Shrine | null = null;

  private shrineSpacing = 96.0;
  private shrineRadius = 2.8;

  constructor(scene: THREE.Scene, biomeSystem: BiomeSystem) {
    this.scene = scene;
    this.biomeSystem = biomeSystem;
  }

  public update(player: Player, particles: ParticleSystem): void {
    const px = player.position.x;
    const pz = player.position.z;

    const minCx = Math.floor((px - 140) / this.shrineSpacing);
    const maxCx = Math.floor((px + 140) / this.shrineSpacing);
    const minCz = Math.floor((pz - 140) / this.shrineSpacing);
    const maxCz = Math.floor((pz + 140) / this.shrineSpacing);

    const activeKeys = new Set<string>();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = `${cx},${cz}`;
        activeKeys.add(key);

        if (!this.shrines.has(key)) {
          // Deterministic pseudorandom placement within cell
          const hash = Math.sin(cx * 43.123 + cz * 91.456) * 12345.678;
          const rnd1 = (hash - Math.floor(hash));
          const rnd2 = ((hash * 3.7) - Math.floor(hash * 3.7));

          const sx = (cx + 0.2 + rnd1 * 0.6) * this.shrineSpacing;
          const sz = (cz + 0.2 + rnd2 * 0.6) * this.shrineSpacing;
          const sh = this.biomeSystem.getHeight(sx, sz);

          const shrine = this.createShrine(key, sx, sz, sh);
          this.shrines.set(key, shrine);
        }
      }
    }

    // Prune distant shrines
    for (const [key, shrine] of this.shrines.entries()) {
      if (!activeKeys.has(key)) {
        this.scene.remove(shrine.group);
        this.shrines.delete(key);
      }
    }

    // Check nearest shrine for interaction
    let closest: Shrine | null = null;
    let closestDist = 999;

    for (const shrine of this.shrines.values()) {
      const d = Math.hypot(px - shrine.x, pz - shrine.z);

      // Floating animation for shrine core
      shrine.coreMesh.rotation.y += 0.02;
      shrine.ringMesh.rotation.z += 0.015;

      if (d < 5.0 && d < closestDist) {
        closestDist = d;
        closest = shrine;
      }
    }

    this.nearbyShrine = closest;
  }

  public activateNearbyShrine(player: Player, particles: ParticleSystem): boolean {
    if (!this.nearbyShrine || this.nearbyShrine.isActivated) return false;

    this.nearbyShrine.isActivated = true;
    (this.nearbyShrine.ringMesh.material as THREE.MeshStandardMaterial).emissive.set(0x38bdf8);
    (this.nearbyShrine.ringMesh.material as THREE.MeshStandardMaterial).color.set(0x38bdf8);
    (this.nearbyShrine.coreMesh.material as THREE.MeshStandardMaterial).emissive.set(0x38bdf8);

    player.stats.shrinesActivated++;
    player.stats.maxHp += 20;
    player.stats.hp = player.stats.maxHp;
    player.stats.maxShield += 25;
    player.stats.shield = player.stats.maxShield;
    player.stats.attackPower += 10;
    player.stats.score += 1000;

    audioSystem.playShrineActivation();
    particles.emitShockwaveRing(new THREE.Vector3(this.nearbyShrine.x, this.nearbyShrine.height + 1.5, this.nearbyShrine.z), 10, 48);

    return true;
  }

  private createShrine(id: string, x: number, z: number, h: number): Shrine {
    const group = new THREE.Group();
    group.position.set(x, h, z);

    // 1. Stepped Base Platform
    const baseGeo = new THREE.CylinderGeometry(3.5, 4.0, 0.6, 8);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
    });
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.3;
    base.receiveShadow = true;
    group.add(base);

    // 2. 4 Surrounding Pylons
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pylonGeo = new THREE.BoxGeometry(0.5, 3.2, 0.5);
      const pylon = new THREE.Mesh(pylonGeo, stoneMat);
      pylon.position.set(Math.cos(angle) * 2.4, 1.6, Math.sin(angle) * 2.4);
      pylon.castShadow = true;
      group.add(pylon);
    }

    // 3. Floating Quantum Monolith Core
    const coreGeo = new THREE.OctahedronGeometry(1.0, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 2.4;
    group.add(coreMesh);

    // 4. Orbiting Energy Ring
    const ringGeo = new THREE.TorusGeometry(1.6, 0.08, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: new THREE.Color(0xb45309),
      emissiveIntensity: 1.2,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 2.4;
    ringMesh.rotation.x = Math.PI / 4;
    group.add(ringMesh);

    this.scene.add(group);

    return {
      id,
      x,
      z,
      height: h,
      isActivated: false,
      group,
      ringMesh,
      coreMesh,
    };
  }

  public dispose(): void {
    for (const s of this.shrines.values()) {
      this.scene.remove(s.group);
    }
    this.shrines.clear();
  }
}
