/**
 * High-performance, zero-allocation Simplex & Fractal Noise generator.
 * Supports standard Simplex, Fractional Brownian Motion (fBm),
 * Ridged Multifractal, and Voronoi/Cellular procedural noise.
 */

export class SimplexNoise {
  private p: Uint8Array = new Uint8Array(256);
  private perm: Uint8Array = new Uint8Array(512);
  private permMod12: Uint8Array = new Uint8Array(512);

  constructor(seed: number = 42) {
    this.reseed(seed);
  }

  public reseed(seed: number): void {
    // Linear Congruential Generator for reproducible pseudo-random seed permutation
    let s = (Math.abs(seed) % 2147483647) || 1;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }

    for (let i = 255; i > 0; i--) {
      const r = Math.floor(rnd() * (i + 1));
      const tmp = this.p[i];
      this.p[i] = this.p[r];
      this.p[r] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = (this.perm[i] % 12);
    }
  }

  // Fast 2D Simplex Noise
  public noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1 = 0;
    let j1 = 0;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.grad2D(gi0, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.grad2D(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.grad2D(gi2, x2, y2);
    }

    // Result in range [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  private grad2D(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  /**
   * Fractional Brownian Motion (fBm) multi-octave synthesis
   */
  public fbm2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0,
    frequency: number = 1.0
  ): number {
    let total = 0;
    let amplitude = 1.0;
    let maxAmplitude = 0;
    let freq = frequency;

    for (let o = 0; o < octaves; o++) {
      total += this.noise2D(x * freq, y * freq) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      freq *= lacunarity;
    }

    return total / maxAmplitude;
  }

  /**
   * Ridged multifractal noise for sharp mountain peaks and ravines
   */
  public ridged2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0,
    frequency: number = 1.0
  ): number {
    let total = 0;
    let amplitude = 1.0;
    let maxAmplitude = 0;
    let freq = frequency;
    let weight = 1.0;

    for (let o = 0; o < octaves; o++) {
      let signal = Math.abs(this.noise2D(x * freq, y * freq));
      signal = 1.0 - signal; // invert so peaks are sharp ridges
      signal = signal * signal * weight; // square to sharpen
      weight = Math.min(1.0, Math.max(0.0, signal * 2.0));

      total += signal * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      freq *= lacunarity;
    }

    return (total / maxAmplitude) * 2.0 - 1.0;
  }

  /**
   * Voronoi / Cellular noise for crystalline & basalt formations
   */
  public cellular2D(x: number, y: number): { f1: number; f2: number } {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let d1 = 999.0;
    let d2 = 999.0;

    for (let xo = -1; xo <= 1; xo++) {
      for (let yo = -1; yo <= 1; yo++) {
        const cx = ix + xo;
        const cy = iy + yo;
        // Pseudo-random feature point inside cell
        const h1 = this.noise2D(cx * 12.9898, cy * 78.233);
        const h2 = this.noise2D(cx * 39.346, cy * 11.135);
        const px = cx + 0.5 + 0.4 * h1;
        const py = cy + 0.5 + 0.4 * h2;

        const dx = px - x;
        const dy = py - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < d1) {
          d2 = d1;
          d1 = dist;
        } else if (dist < d2) {
          d2 = dist;
        }
      }
    }

    return { f1: d1, f2: d2 };
  }
}
