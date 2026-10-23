import * as THREE from 'three';
import { BiomeSystem } from '../procedural/BiomeSystem';
import { audioSystem } from '../audio/ProceduralAudio';
import { ParticleSystem } from '../particles/ParticleSystem';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  cores: number;
  attackPower: number;
  dashCooldown: number;
  isDead: boolean;
  score: number;
  shrinesActivated: number;
}

export class Player {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotationY: number = 0;

  // Stats
  public stats: PlayerStats = {
    hp: 100,
    maxHp: 100,
    shield: 100,
    maxShield: 100,
    energy: 100,
    maxEnergy: 100,
    cores: 0,
    attackPower: 35,
    dashCooldown: 0,
    isDead: false,
    score: 0,
    shrinesActivated: 0,
  };

  // State
  public isGrounded: boolean = true;
  public isDashing: boolean = false;
  private dashTime: number = 0;
  private dashDuration: number = 0.22;
  private dashSpeed: number = 28.0;
  private dashDir: THREE.Vector3 = new THREE.Vector3(0, 0, 1);

  // Attack state
  public isAttacking: boolean = false;
  public attackTimer: number = 0;
  public attackCombo: number = 0;
  public attackHitboxActive: boolean = false;
  private attackComboResetTimer: number = 0;
  public hitstopTimer: number = 0;

  // Shield Parry
  public isParrying: boolean = false;
  private parryTimer: number = 0;

  // Visual composite parts (3-12 parts)
  private torso: THREE.Mesh;
  private core: THREE.Mesh;
  private head: THREE.Mesh;
  private visor: THREE.Mesh;
  private shoulderL: THREE.Mesh;
  private shoulderR: THREE.Mesh;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  public blade: THREE.Group;
  private shieldBubble: THREE.Mesh;
  private cape: THREE.Mesh;

  // Footstep tracker
  private distanceTraveled: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // 1. Torso Chassis
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });
    this.torso = new THREE.Mesh(torsoGeo, armorMat);
    this.torso.position.y = 1.3;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 2. Reactor Core (Glowing sphere on chest)
    const coreGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.2,
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.core.position.set(0, 1.35, 0.28);
    this.group.add(this.core);

    // 3. Head & Helm
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    this.head = new THREE.Mesh(headGeo, armorMat);
    this.head.position.y = 2.05;
    this.head.castShadow = true;
    this.group.add(this.head);

    // 4. Glowing Eye Visor
    const visorGeo = new THREE.BoxGeometry(0.38, 0.12, 0.1);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.visor = new THREE.Mesh(visorGeo, visorMat);
    this.visor.position.set(0, 2.05, 0.23);
    this.group.add(this.visor);

    // 5. Pauldrons / Shoulders
    const pauldronGeo = new THREE.ConeGeometry(0.28, 0.5, 4);
    pauldronGeo.rotateZ(Math.PI / 2);
    this.shoulderL = new THREE.Mesh(pauldronGeo, armorMat);
    this.shoulderL.position.set(-0.55, 1.6, 0);
    this.group.add(this.shoulderL);

    this.shoulderR = new THREE.Mesh(pauldronGeo, armorMat);
    this.shoulderR.position.set(0.55, 1.6, 0);
    this.shoulderR.rotation.y = Math.PI;
    this.group.add(this.shoulderR);

    // 6. Legs
    const legGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.8, 6);
    legGeo.translate(0, -0.4, 0);
    this.legL = new THREE.Mesh(legGeo, armorMat);
    this.legL.position.set(-0.25, 0.8, 0);
    this.legL.castShadow = true;
    this.group.add(this.legL);

    this.legR = new THREE.Mesh(legGeo, armorMat);
    this.legR.position.set(0.25, 0.8, 0);
    this.legR.castShadow = true;
    this.group.add(this.legR);

    // 7. Kinetic Blade Weapon (3 parts: Hilt, Crossguard, Plasma Blade)
    this.blade = new THREE.Group();
    const hiltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6);
    const hilt = new THREE.Mesh(hiltGeo, armorMat);
    hilt.position.y = -0.2;
    this.blade.add(hilt);

    const guardGeo = new THREE.BoxGeometry(0.25, 0.06, 0.08);
    const guard = new THREE.Mesh(guardGeo, armorMat);
    this.blade.add(guard);

    const bladeGeo = new THREE.BoxGeometry(0.08, 1.6, 0.03);
    bladeGeo.translate(0, 0.8, 0);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.5,
    });
    const plasmaBlade = new THREE.Mesh(bladeGeo, bladeMat);
    this.blade.add(plasmaBlade);

    this.blade.position.set(0.6, 1.2, 0.3);
    this.blade.rotation.x = Math.PI / 4;
    this.group.add(this.blade);

    // 8. Energy Shield Barrier Mesh (Spherical shell)
    const shieldGeo = new THREE.IcosahedronGeometry(1.6, 2);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      depthWrite: false,
    });
    this.shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldBubble.position.y = 1.2;
    this.group.add(this.shieldBubble);

    // 9. Energy Cape
    const capeGeo = new THREE.PlaneGeometry(0.6, 1.1, 3, 3);
    capeGeo.translate(0, -0.55, 0);
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    this.cape = new THREE.Mesh(capeGeo, capeMat);
    this.cape.position.set(0, 1.7, -0.26);
    this.group.add(this.cape);

    scene.add(this.group);
  }

  public handleInput(
    input: { moveX: number; moveZ: number; jump: boolean; dash: boolean; attack: boolean; shockwave: boolean; parry: boolean },
    cameraYaw: number,
    dt: number,
    biomeSystem: BiomeSystem,
    particles: ParticleSystem
  ): void {
    if (this.stats.isDead) return;

    // Hitstop tick
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Shield passive regeneration
    if (this.stats.shield < this.stats.maxShield) {
      this.stats.shield = Math.min(this.stats.maxShield, this.stats.shield + 12 * dt);
    }

    // Energy regeneration
    if (this.stats.energy < this.stats.maxEnergy) {
      this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + 20 * dt);
    }

    // Dash cooldown
    if (this.stats.dashCooldown > 0) {
      this.stats.dashCooldown -= dt;
    }

    // 1. Dash Execution
    if (input.dash && this.stats.dashCooldown <= 0 && this.stats.energy >= 25 && !this.isDashing) {
      this.isDashing = true;
      this.dashTime = this.dashDuration;
      this.stats.dashCooldown = 0.9;
      this.stats.energy -= 25;

      // Determine dash direction from movement input or forward
      if (Math.hypot(input.moveX, input.moveZ) > 0.1) {
        this.dashDir.set(input.moveX, 0, input.moveZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw).normalize();
      } else {
        this.dashDir.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY).normalize();
      }

      audioSystem.playDash();
      particles.emitDashTrail(this.position, 16);
    }

    // Update Dash
    if (this.isDashing) {
      this.dashTime -= dt;
      this.velocity.x = this.dashDir.x * this.dashSpeed;
      this.velocity.z = this.dashDir.z * this.dashSpeed;

      particles.emitDashTrail(this.position, 2);

      if (this.dashTime <= 0) {
        this.isDashing = false;
      }
    } else {
      // Normal Movement
      const moveLen = Math.hypot(input.moveX, input.moveZ);
      if (moveLen > 0.05) {
        const rawDir = new THREE.Vector3(input.moveX, 0, input.moveZ).normalize();
        rawDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

        const targetRot = Math.atan2(rawDir.x, rawDir.z);
        // Exponential damping for rotation
        const diff = Math.atan2(Math.sin(targetRot - this.rotationY), Math.cos(targetRot - this.rotationY));
        this.rotationY += diff * Math.min(1.0, 14.0 * dt);

        const speed = this.isAttacking ? 3.5 : 11.0;
        this.velocity.x = rawDir.x * speed;
        this.velocity.z = rawDir.z * speed;

        // Footsteps
        this.distanceTraveled += Math.hypot(this.velocity.x, this.velocity.z) * dt;
        if (this.distanceTraveled > 2.6 && this.isGrounded) {
          audioSystem.playFootstep();
          this.distanceTraveled = 0;
        }

        // Leg walk cycle animation
        const walkCycle = Math.sin(Date.now() * 0.012) * 0.45;
        this.legL.rotation.x = walkCycle;
        this.legR.rotation.x = -walkCycle;
      } else {
        this.velocity.x *= Math.exp(-12.0 * dt);
        this.velocity.z *= Math.exp(-12.0 * dt);
        this.legL.rotation.x *= 0.8;
        this.legR.rotation.x *= 0.8;
      }
    }

    // 2. Jump
    if (input.jump && this.isGrounded && this.stats.energy >= 15) {
      this.velocity.y = 11.5;
      this.isGrounded = false;
      this.stats.energy -= 15;
      audioSystem.playDash();
    }

    // Gravity & Ground Snapping
    if (!this.isGrounded) {
      this.velocity.y -= 26.0 * dt;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    const terrainH = biomeSystem.getHeight(this.position.x, this.position.z);
    if (this.position.y <= terrainH) {
      this.position.y = terrainH;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // 3. Parry / Shield
    if (input.parry && this.stats.energy >= 20 && !this.isParrying) {
      this.isParrying = true;
      this.parryTimer = 0.45;
      this.stats.energy -= 20;
      audioSystem.playParry();
    }

    if (this.isParrying) {
      this.parryTimer -= dt;
      (this.shieldBubble.material as THREE.MeshPhysicalMaterial).opacity = Math.min(0.65, this.parryTimer * 2.0);
      this.shieldBubble.rotation.y += 4.0 * dt;
      if (this.parryTimer <= 0) {
        this.isParrying = false;
        (this.shieldBubble.material as THREE.MeshPhysicalMaterial).opacity = 0;
      }
    }

    // 4. Attack System (3-Hit Combo)
    if (this.attackComboResetTimer > 0) {
      this.attackComboResetTimer -= dt;
      if (this.attackComboResetTimer <= 0) {
        this.attackCombo = 0;
      }
    }

    if (input.attack && !this.isAttacking && !this.isDashing) {
      this.isAttacking = true;
      this.attackTimer = 0.28;
      this.attackHitboxActive = true;
      audioSystem.playSlash(this.attackCombo);

      // Advance combo
      this.attackCombo = (this.attackCombo + 1) % 3;
      this.attackComboResetTimer = 0.8;
    }

    if (this.isAttacking) {
      this.attackTimer -= dt;
      const progress = 1.0 - this.attackTimer / 0.28;

      // Dynamic blade swing animation per combo stage
      if (this.attackCombo === 1) {
        // Horizontal right-to-left sweep
        this.blade.rotation.set(0.3, Math.PI * 0.4 - progress * Math.PI * 0.9, -0.6);
        this.blade.position.set(0.4 + Math.sin(progress * Math.PI) * 0.6, 1.2, 0.4);
      } else if (this.attackCombo === 2) {
        // Upward diagonal slash
        this.blade.rotation.set(-0.8 + progress * 2.0, 0.2, 0.5);
        this.blade.position.set(-0.3 + progress * 0.8, 0.8 + progress * 0.8, 0.5);
      } else {
        // Overhead heavy smash
        this.blade.rotation.set(Math.PI * 0.8 - progress * Math.PI * 1.3, 0, 0);
        this.blade.position.set(0.1, 1.8 - progress * 1.0, 0.5 + progress * 0.5);
      }

      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackHitboxActive = false;
        // Reset blade position
        this.blade.position.set(0.6, 1.2, 0.3);
        this.blade.rotation.set(Math.PI / 4, 0, 0);
      }
    }

    // 5. Kinetic Shockwave
    if (input.shockwave && this.stats.energy >= 45) {
      this.stats.energy -= 45;
      audioSystem.playShockwave();
      particles.emitShockwaveRing(this.position, 8, 48);
    }

    // Sync mesh position and orientation
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;

    // Core pulsing glow
    const pulse = 1.5 + Math.sin(Date.now() * 0.006) * 0.5;
    (this.core.material as THREE.MeshPhysicalMaterial).emissiveIntensity = pulse;

    // Cape flutter based on speed
    const spd = Math.hypot(this.velocity.x, this.velocity.z);
    this.cape.rotation.x = 0.15 + spd * 0.05 + Math.sin(Date.now() * 0.01) * 0.1;
  }

  public takeDamage(amount: number, particles: ParticleSystem): void {
    if (this.stats.isDead || this.isDashing) return;

    // If parrying, absorb 100% damage and award bonus energy!
    if (this.isParrying) {
      audioSystem.playParry();
      this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + 30);
      particles.emitHitSparks(this.position, new THREE.Vector3(0, 1, 0), 20, '#38bdf8');
      return;
    }

    // Shield absorbs first
    if (this.stats.shield > 0) {
      if (this.stats.shield >= amount) {
        this.stats.shield -= amount;
        audioSystem.playHit(false);
        particles.emitHitSparks(this.position, new THREE.Vector3(0, 1, 0), 12, '#38bdf8');
        return;
      } else {
        const remaining = amount - this.stats.shield;
        this.stats.shield = 0;
        this.stats.hp = Math.max(0, this.stats.hp - remaining);
      }
    } else {
      this.stats.hp = Math.max(0, this.stats.hp - amount);
    }

    audioSystem.playHit(true);
    particles.emitHitSparks(this.position, new THREE.Vector3(0, 1, 0), 24, '#ef4444');

    if (this.stats.hp <= 0) {
      this.stats.isDead = true;
    }
  }

  public collectQuantumCore(): void {
    this.stats.cores++;
    this.stats.score += 250;
    this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + 25);
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 15);
  }
}
