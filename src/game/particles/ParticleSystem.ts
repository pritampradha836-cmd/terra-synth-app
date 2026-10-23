import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private maxParticles = 1200;
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  public mesh: THREE.Points;

  private positions: Float32Array;
  private colors: Float32Array;
  private activeCount = 0;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Procedural soft circle sprite canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.PointsMaterial({
      size: 0.6,
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;

    // Pre-allocate pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        size: 0.5,
        life: 0,
        maxLife: 1,
      });
    }
  }

  public emitHitSparks(origin: THREE.Vector3, normal: THREE.Vector3, count: number = 24, colorHex: string = '#38bdf8'): void {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxParticles) break;
      const p = this.particles[this.activeCount++];
      p.position.copy(origin);
      p.velocity.set(
        normal.x + (Math.random() - 0.5) * 6,
        normal.y + Math.random() * 6 + 1,
        normal.z + (Math.random() - 0.5) * 6
      );
      p.color.copy(col);
      p.maxLife = 0.3 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.size = 0.5 + Math.random() * 0.5;
    }
  }

  public emitShockwaveRing(center: THREE.Vector3, radius: number = 6, count: number = 40): void {
    const col = new THREE.Color('#38bdf8');
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxParticles) break;
      const angle = (i / count) * Math.PI * 2;
      const p = this.particles[this.activeCount++];
      p.position.set(
        center.x + Math.cos(angle) * (radius * 0.2),
        center.y + 0.3,
        center.z + Math.sin(angle) * (radius * 0.2)
      );
      p.velocity.set(
        Math.cos(angle) * 14.0,
        Math.random() * 2.0,
        Math.sin(angle) * 14.0
      );
      p.color.copy(col);
      p.maxLife = 0.45;
      p.life = p.maxLife;
      p.size = 0.8;
    }
  }

  public emitDashTrail(origin: THREE.Vector3, count: number = 8): void {
    const col = new THREE.Color('#818cf8');
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxParticles) break;
      const p = this.particles[this.activeCount++];
      p.position.set(
        origin.x + (Math.random() - 0.5) * 0.6,
        origin.y + 0.2 + Math.random() * 1.2,
        origin.z + (Math.random() - 0.5) * 0.6
      );
      p.velocity.set((Math.random() - 0.5) * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 0.5);
      p.color.copy(col);
      p.maxLife = 0.25;
      p.life = p.maxLife;
      p.size = 0.6;
    }
  }

  public update(dt: number): void {
    let writeIdx = 0;

    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life > 0) {
        // Physics update
        p.position.x += p.velocity.x * dt;
        p.position.y += p.velocity.y * dt;
        p.position.z += p.velocity.z * dt;
        p.velocity.y -= 12.0 * dt; // gravity

        // Life ratio
        const alpha = p.life / p.maxLife;

        // Pack buffer
        this.positions[writeIdx * 3] = p.position.x;
        this.positions[writeIdx * 3 + 1] = p.position.y;
        this.positions[writeIdx * 3 + 2] = p.position.z;

        this.colors[writeIdx * 3] = p.color.r * alpha;
        this.colors[writeIdx * 3 + 1] = p.color.g * alpha;
        this.colors[writeIdx * 3 + 2] = p.color.b * alpha;

        // Keep particle in active list
        if (writeIdx !== i) {
          const target = this.particles[writeIdx];
          target.position.copy(p.position);
          target.velocity.copy(p.velocity);
          target.color.copy(p.color);
          target.size = p.size;
          target.life = p.life;
          target.maxLife = p.maxLife;
        }

        writeIdx++;
      }
    }

    this.activeCount = writeIdx;
    this.geometry.setDrawRange(0, this.activeCount);
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
