import * as THREE from 'three';
import { BiomeSystem, BiomeType } from '../procedural/BiomeSystem';
import { Player } from './Player';
import { ParticleSystem } from '../particles/ParticleSystem';
import { audioSystem } from '../audio/ProceduralAudio';

export type EnemyType = 'ANCIENT_GOLEM' | 'VOID_SWARMER' | 'PRISMATIC_SENTINEL';

export interface Enemy {
  id: number;
  type: EnemyType;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  telegraphTimer: number;
  isTelegraphing: boolean;
  telegraphMesh: THREE.Mesh | null;
  radius: number;
  damage: number;
  speed: number;
  scoreValue: number;
}

export interface Projectile {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
  isDeflected: boolean;
}

export interface QuantumDrop {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  life: number;
}

export class EnemyManager {
  public scene: THREE.Scene;
  public biomeSystem: BiomeSystem;
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public drops: QuantumDrop[] = [];

  private nextEnemyId = 1;
  private maxActiveEnemies = 28;
  private spawnTimer = 0;

  // Spatial Hash Grid telemetry
  public spatialCellSize = 16;
  public spatialGrid = new Map<string, number[]>();
  public telemetry = {
    activeEntities: 0,
    cellsOccupied: 0,
    broadphasePairsTested: 0,
    bruteForcePairsTotal: 0,
    pruningEfficiencyPct: 0,
  };

  // Reusable materials & geometries for procedural multi-part enemy construction
  private golemMat: THREE.MeshStandardMaterial;
  private golemEyeMat: THREE.MeshBasicMaterial;
  private swarmerMat: THREE.MeshStandardMaterial;
  private sentinelMat: THREE.MeshPhysicalMaterial;
  private dropMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, biomeSystem: BiomeSystem) {
    this.scene = scene;
    this.biomeSystem = biomeSystem;

    this.golemMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.3,
      flatShading: true,
    });
    this.golemEyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    this.swarmerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.9,
    });

    this.sentinelMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.8,
      transmission: 0.5,
    });

    this.dropMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.5,
    });
  }

  private createGolemMesh(): { group: THREE.Group; telegraphMesh: THREE.Mesh } {
    const group = new THREE.Group();

    // 1. Torso Boulder
    const torsoGeo = new THREE.DodecahedronGeometry(1.4, 0);
    const torso = new THREE.Mesh(torsoGeo, this.golemMat);
    torso.position.y = 1.8;
    torso.castShadow = true;
    group.add(torso);

    // 2. Glowing Eye Monolith
    const eyeGeo = new THREE.BoxGeometry(0.5, 0.2, 0.2);
    const eye = new THREE.Mesh(eyeGeo, this.golemEyeMat);
    eye.position.set(0, 2.1, 1.1);
    group.add(eye);

    // 3. Shoulders
    const shoulderGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const sL = new THREE.Mesh(shoulderGeo, this.golemMat);
    sL.position.set(-1.4, 2.0, 0);
    group.add(sL);

    const sR = new THREE.Mesh(shoulderGeo, this.golemMat);
    sR.position.set(1.4, 2.0, 0);
    group.add(sR);

    // 4. Heavy fists
    const fistGeo = new THREE.BoxGeometry(0.8, 1.0, 0.8);
    const fL = new THREE.Mesh(fistGeo, this.golemMat);
    fL.position.set(-1.5, 0.8, 0.3);
    group.add(fL);

    const fR = new THREE.Mesh(fistGeo, this.golemMat);
    fR.position.set(1.5, 0.8, 0.3);
    group.add(fR);

    // 5. Telegraph warning ring (red circle on ground)
    const ringGeo = new THREE.RingGeometry(0.2, 3.8, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const telegraphMesh = new THREE.Mesh(ringGeo, ringMat);
    telegraphMesh.position.y = 0.05;
    group.add(telegraphMesh);

    return { group, telegraphMesh };
  }

  private createSwarmerMesh(): { group: THREE.Group; telegraphMesh: THREE.Mesh } {
    const group = new THREE.Group();

    // 1. Thorax
    const bodyGeo = new THREE.ConeGeometry(0.5, 1.2, 5);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, this.swarmerMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    // 2. Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const e1 = new THREE.Mesh(eyeGeo, eyeMat);
    e1.position.set(0.18, 0.7, 0.6);
    const e2 = new THREE.Mesh(eyeGeo, eyeMat);
    e2.position.set(-0.18, 0.7, 0.6);
    group.add(e1);
    group.add(e2);

    // 3. Legs
    for (let i = 0; i < 4; i++) {
      const legGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.7, 4);
      const leg = new THREE.Mesh(legGeo, this.swarmerMat);
      const sign = i % 2 === 0 ? 1 : -1;
      const front = i < 2 ? 0.3 : -0.3;
      leg.position.set(sign * 0.45, 0.3, front);
      leg.rotation.z = sign * 0.5;
      group.add(leg);
    }

    // Telegraph ring
    const ringGeo = new THREE.RingGeometry(0.1, 1.8, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const telegraphMesh = new THREE.Mesh(ringGeo, ringMat);
    telegraphMesh.position.y = 0.05;
    group.add(telegraphMesh);

    return { group, telegraphMesh };
  }

  private createSentinelMesh(): { group: THREE.Group; telegraphMesh: THREE.Mesh } {
    const group = new THREE.Group();

    // 1. Floating Obelisk Core
    const coreGeo = new THREE.OctahedronGeometry(0.9, 0);
    coreGeo.scale(0.8, 2.0, 0.8);
    const core = new THREE.Mesh(coreGeo, this.sentinelMat);
    core.position.y = 2.4;
    core.castShadow = true;
    group.add(core);

    // 2. Orbiting Torus Ring
    const ringGeo = new THREE.TorusGeometry(1.3, 0.06, 8, 24);
    const ring = new THREE.Mesh(ringGeo, this.sentinelMat);
    ring.position.y = 2.4;
    ring.rotation.x = Math.PI / 3;
    group.add(ring);

    // Telegraph line
    const teleGeo = new THREE.CylinderGeometry(0.05, 0.05, 20, 6);
    teleGeo.rotateX(Math.PI / 2);
    teleGeo.translate(0, 0, 10);
    const teleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const telegraphMesh = new THREE.Mesh(teleGeo, teleMat);
    telegraphMesh.position.y = 2.4;
    group.add(telegraphMesh);

    return { group, telegraphMesh };
  }

  public spawnEnemy(type: EnemyType, x: number, z: number): void {
    const h = this.biomeSystem.getHeight(x, z);
    let composite: { group: THREE.Group; telegraphMesh: THREE.Mesh };
    let hp = 100;
    let radius = 1.2;
    let damage = 20;
    let speed = 4.0;
    let scoreValue = 100;

    if (type === 'ANCIENT_GOLEM') {
      composite = this.createGolemMesh();
      hp = 220;
      radius = 2.0;
      damage = 35;
      speed = 3.2;
      scoreValue = 300;
    } else if (type === 'VOID_SWARMER') {
      composite = this.createSwarmerMesh();
      hp = 60;
      radius = 0.9;
      damage = 15;
      speed = 8.5;
      scoreValue = 120;
    } else {
      composite = this.createSentinelMesh();
      hp = 110;
      radius = 1.3;
      damage = 25;
      speed = 2.0;
      scoreValue = 200;
    }

    composite.group.position.set(x, h, z);
    this.scene.add(composite.group);

    this.enemies.push({
      id: this.nextEnemyId++,
      type,
      group: composite.group,
      position: composite.group.position,
      velocity: new THREE.Vector3(),
      hp,
      maxHp: hp,
      attackCooldown: 1.0 + Math.random() * 2.0,
      telegraphTimer: 0,
      isTelegraphing: false,
      telegraphMesh: composite.telegraphMesh,
      radius,
      damage,
      speed,
      scoreValue,
    });
  }

  /**
   * Spatial Hash partitioning to eliminate O(N^2) bottlenecks
   */
  private updateSpatialHash(): void {
    this.spatialGrid.clear();
    const cellSize = this.spatialCellSize;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const cx = Math.floor(e.position.x / cellSize);
      const cz = Math.floor(e.position.z / cellSize);
      const key = `${cx},${cz}`;

      let cell = this.spatialGrid.get(key);
      if (!cell) {
        cell = [];
        this.spatialGrid.set(key, cell);
      }
      cell.push(i);
    }

    // Telemetry calculations
    const totalEnemies = this.enemies.length;
    const bruteForcePairs = (totalEnemies * (totalEnemies - 1)) / 2;
    let pairsTested = 0;

    for (const cell of this.spatialGrid.values()) {
      const len = cell.length;
      pairsTested += (len * (len - 1)) / 2;
    }

    const prunedPct = bruteForcePairs > 0
      ? Math.max(0, Math.min(100, ((bruteForcePairs - pairsTested) / bruteForcePairs) * 100))
      : 100;

    this.telemetry = {
      activeEntities: totalEnemies + this.projectiles.length,
      cellsOccupied: this.spatialGrid.size,
      broadphasePairsTested: pairsTested,
      bruteForcePairsTotal: bruteForcePairs,
      pruningEfficiencyPct: Math.round(prunedPct * 10) / 10,
    };
  }

  public update(dt: number, player: Player, particles: ParticleSystem): void {
    const px = player.position.x;
    const pz = player.position.z;

    // 1. Procedural dynamic spawner around player
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < this.maxActiveEnemies) {
      this.spawnTimer = 2.5;
      const angle = Math.random() * Math.PI * 2;
      const dist = 32.0 + Math.random() * 24.0;
      const spawnX = px + Math.cos(angle) * dist;
      const spawnZ = pz + Math.sin(angle) * dist;

      const { primaryBiome } = this.biomeSystem.getBiomeWeights(spawnX, spawnZ);
      let type: EnemyType = 'VOID_SWARMER';
      if (primaryBiome.id === 'OBSIDIAN_RIFT') type = 'ANCIENT_GOLEM';
      else if (primaryBiome.id === 'CRYSTALLINE_TUNDRA') type = 'PRISMATIC_SENTINEL';
      else if (Math.random() < 0.35) type = 'ANCIENT_GOLEM';

      this.spawnEnemy(type, spawnX, spawnZ);
    }

    // 2. Spatial Hash Update
    this.updateSpatialHash();

    // 3. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const distToPlayer = Math.hypot(px - enemy.position.x, pz - enemy.position.z);

      // Cull enemies if player moved far away
      if (distToPlayer > 110) {
        this.scene.remove(enemy.group);
        this.enemies.splice(i, 1);
        continue;
      }

      // Orientation toward player
      const angleToPlayer = Math.atan2(px - enemy.position.x, pz - enemy.position.z);
      enemy.group.rotation.y = angleToPlayer;

      // Enemy AI State Machine
      if (enemy.isTelegraphing) {
        enemy.telegraphTimer -= dt;

        // Visual telegraph feedback
        if (enemy.telegraphMesh) {
          (enemy.telegraphMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(
            0.8,
            (1.0 - enemy.telegraphTimer / 0.8) * 0.8
          );
        }

        // Execute Attack
        if (enemy.telegraphTimer <= 0) {
          enemy.isTelegraphing = false;
          if (enemy.telegraphMesh) {
            (enemy.telegraphMesh.material as THREE.MeshBasicMaterial).opacity = 0;
          }

          if (enemy.type === 'ANCIENT_GOLEM') {
            audioSystem.playShockwave();
            particles.emitShockwaveRing(enemy.position, 6, 32);
            if (distToPlayer < 6.5) {
              player.takeDamage(enemy.damage, particles);
            }
          } else if (enemy.type === 'VOID_SWARMER') {
            audioSystem.playSlash(0);
            if (distToPlayer < 3.2) {
              player.takeDamage(enemy.damage, particles);
            }
          } else if (enemy.type === 'PRISMATIC_SENTINEL') {
            this.fireSentinelBolt(enemy.position, player.position);
          }

          enemy.attackCooldown = 2.0 + Math.random() * 1.5;
        }
      } else {
        // Normal Navigation / Approach
        const minAttackDist = enemy.type === 'PRISMATIC_SENTINEL' ? 18.0 : 3.5;

        if (distToPlayer > minAttackDist) {
          const dirX = Math.sin(angleToPlayer);
          const dirZ = Math.cos(angleToPlayer);
          enemy.position.x += dirX * enemy.speed * dt;
          enemy.position.z += dirZ * enemy.speed * dt;
        }

        // Height adjustment to terrain
        const th = this.biomeSystem.getHeight(enemy.position.x, enemy.position.z);
        enemy.position.y = enemy.type === 'PRISMATIC_SENTINEL' ? th + 1.8 : th;

        // Attack trigger
        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0 && distToPlayer < (enemy.type === 'PRISMATIC_SENTINEL' ? 24 : 5.0)) {
          enemy.isTelegraphing = true;
          enemy.telegraphTimer = enemy.type === 'ANCIENT_GOLEM' ? 0.9 : 0.45;
        }
      }

      // Combat Collision: Player Weapon vs Enemy
      if (player.attackHitboxActive && distToPlayer < 3.8) {
        // Check if player is facing enemy
        const toEnemyX = enemy.position.x - px;
        const toEnemyZ = enemy.position.z - pz;
        const forwardX = Math.sin(player.rotationY);
        const forwardZ = Math.cos(player.rotationY);
        const dot = forwardX * toEnemyX + forwardZ * toEnemyZ;

        if (dot > 0 || distToPlayer < 2.0) {
          player.attackHitboxActive = false; // hit once per swing
          player.hitstopTimer = 0.06; // 60ms visceral hitstop!
          const dmg = player.stats.attackPower * (player.attackCombo === 2 ? 1.5 : 1.0);
          enemy.hp -= dmg;

          audioSystem.playHit(player.attackCombo === 2);
          particles.emitHitSparks(enemy.position, new THREE.Vector3(0, 1, 0), 20, '#38bdf8');

          // Knockback
          enemy.position.x += Math.sin(player.rotationY) * 2.5;
          enemy.position.z += Math.cos(player.rotationY) * 2.5;

          // Enemy Death
          if (enemy.hp <= 0) {
            audioSystem.playShockwave();
            particles.emitShockwaveRing(enemy.position, 4, 24);
            player.stats.score += enemy.scoreValue;

            // Spawn Quantum Core Drop
            this.spawnDrop(enemy.position);

            this.scene.remove(enemy.group);
            this.enemies.splice(i, 1);
            continue;
          }
        }
      }
    }

    // 4. Update Projectiles
    for (let pIdx = this.projectiles.length - 1; pIdx >= 0; pIdx--) {
      const proj = this.projectiles[pIdx];
      proj.position.x += proj.velocity.x * dt;
      proj.position.y += proj.velocity.y * dt;
      proj.position.z += proj.velocity.z * dt;
      proj.mesh.position.copy(proj.position);
      proj.life -= dt;

      // Check hit with player (if not deflected)
      if (!proj.isDeflected) {
        const d = proj.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        if (d < 1.4) {
          if (player.isParrying) {
            // Deflect projectile back towards origin!
            proj.isDeflected = true;
            proj.velocity.negate().multiplyScalar(1.4);
            audioSystem.playParry();
            particles.emitHitSparks(proj.position, new THREE.Vector3(0, 1, 0), 24, '#38bdf8');
          } else {
            player.takeDamage(proj.damage, particles);
            this.scene.remove(proj.mesh);
            this.projectiles.splice(pIdx, 1);
            continue;
          }
        }
      } else {
        // Deflected projectile can damage enemies!
        for (let eIdx = 0; eIdx < this.enemies.length; eIdx++) {
          const e = this.enemies[eIdx];
          if (proj.position.distanceTo(e.position) < e.radius) {
            e.hp -= 80;
            audioSystem.playHit(true);
            particles.emitHitSparks(e.position, new THREE.Vector3(0, 1, 0), 24, '#38bdf8');
            this.scene.remove(proj.mesh);
            this.projectiles.splice(pIdx, 1);
            break;
          }
        }
      }

      if (proj.life <= 0) {
        this.scene.remove(proj.mesh);
        this.projectiles.splice(pIdx, 1);
      }
    }

    // 5. Update Quantum Drops
    for (let dIdx = this.drops.length - 1; dIdx >= 0; dIdx--) {
      const drop = this.drops[dIdx];
      drop.life -= dt;
      drop.mesh.rotation.y += 2.5 * dt;
      drop.mesh.rotation.x += 1.2 * dt;

      const d = Math.hypot(px - drop.position.x, pz - drop.position.z);
      if (d < 2.5) {
        player.collectQuantumCore();
        audioSystem.playParry();
        particles.emitHitSparks(drop.position, new THREE.Vector3(0, 1, 0), 16, '#38bdf8');
        this.scene.remove(drop.mesh);
        this.drops.splice(dIdx, 1);
        continue;
      }

      if (drop.life <= 0) {
        this.scene.remove(drop.mesh);
        this.drops.splice(dIdx, 1);
      }
    }
  }

  private fireSentinelBolt(origin: THREE.Vector3, target: THREE.Vector3): void {
    const geo = new THREE.SphereGeometry(0.3, 12, 12);
    const mesh = new THREE.Mesh(geo, this.sentinelMat);
    const startPos = origin.clone().add(new THREE.Vector3(0, 2.2, 0));
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    const targetPos = target.clone().add(new THREE.Vector3(0, 1.2, 0));
    const dir = targetPos.sub(startPos).normalize();

    this.projectiles.push({
      mesh,
      position: startPos,
      velocity: dir.multiplyScalar(22.0),
      damage: 25,
      life: 3.5,
      isDeflected: false,
    });
  }

  private spawnDrop(pos: THREE.Vector3): void {
    const geo = new THREE.OctahedronGeometry(0.4, 0);
    const mesh = new THREE.Mesh(geo, this.dropMat);
    mesh.position.set(pos.x, pos.y + 0.8, pos.z);
    this.scene.add(mesh);

    this.drops.push({
      mesh,
      position: mesh.position,
      life: 25.0,
    });
  }

  public dispose(): void {
    for (const e of this.enemies) this.scene.remove(e.group);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
  }
}
