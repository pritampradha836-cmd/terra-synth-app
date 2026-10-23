import * as THREE from 'three';
import { SimplexNoise } from './Noise';

export type BiomeType = 'VERDANT_HIGHLANDS' | 'CRYSTALLINE_TUNDRA' | 'OBSIDIAN_RIFT' | 'CYBER_AETHER';

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  primaryColor: THREE.Color;
  secondaryColor: THREE.Color;
  accentColor: THREE.Color;
  fogColor: THREE.Color;
  skyColor: THREE.Color;
  roughness: number;
  vegetationDensity: number;
  crystalDensity: number;
  boulderDensity: number;
  ambientFreq: number; // For procedural audio drone harmonic
}

export interface TerrainParameters {
  seed: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  heightMultiplier: number;
  ridgeSharpness: number;
  erosionStrength: number;
  biomeScale: number;
  seaLevel: number;
}

export const DEFAULT_TERRAIN_PARAMS: TerrainParameters = {
  seed: 1337,
  scale: 0.012,
  octaves: 4,
  persistence: 0.52,
  lacunarity: 2.1,
  heightMultiplier: 18.0,
  ridgeSharpness: 0.35,
  erosionStrength: 0.25,
  biomeScale: 0.0035,
  seaLevel: -3.0,
};

export const BIOMES: Record<BiomeType, BiomeConfig> = {
  VERDANT_HIGHLANDS: {
    id: 'VERDANT_HIGHLANDS',
    name: 'Verdant Highlands',
    primaryColor: new THREE.Color('#2d6a4f'), // Lush emerald
    secondaryColor: new THREE.Color('#40916c'),
    accentColor: new THREE.Color('#52b788'),
    fogColor: new THREE.Color('#102a24'),
    skyColor: new THREE.Color('#0d1f1c'),
    roughness: 0.85,
    vegetationDensity: 0.9,
    crystalDensity: 0.15,
    boulderDensity: 0.5,
    ambientFreq: 174.6, // F3
  },
  CRYSTALLINE_TUNDRA: {
    id: 'CRYSTALLINE_TUNDRA',
    name: 'Crystalline Tundra',
    primaryColor: new THREE.Color('#1f3a52'), // Deep frosted slate
    secondaryColor: new THREE.Color('#38bdf8'), // Glowing glacial cyan
    accentColor: new THREE.Color('#bae6fd'),
    fogColor: new THREE.Color('#0b1d2e'),
    skyColor: new THREE.Color('#081624'),
    roughness: 0.45,
    vegetationDensity: 0.1,
    crystalDensity: 0.9,
    boulderDensity: 0.7,
    ambientFreq: 220.0, // A3
  },
  OBSIDIAN_RIFT: {
    id: 'OBSIDIAN_RIFT',
    name: 'Obsidian Rift',
    primaryColor: new THREE.Color('#1c1917'), // Scorched charcoal
    secondaryColor: new THREE.Color('#ea580c'), // Molten orange
    accentColor: new THREE.Color('#f97316'),
    fogColor: new THREE.Color('#1c0c08'),
    skyColor: new THREE.Color('#180a06'),
    roughness: 0.95,
    vegetationDensity: 0.05,
    crystalDensity: 0.4,
    boulderDensity: 0.85,
    ambientFreq: 130.8, // C3
  },
  CYBER_AETHER: {
    id: 'CYBER_AETHER',
    name: 'Cyber Aether Dunes',
    primaryColor: new THREE.Color('#2e1065'), // Deep neon violet
    secondaryColor: new THREE.Color('#a855f7'), // Radiant magenta/purple
    accentColor: new THREE.Color('#facc15'), // Golden energy trace
    fogColor: new THREE.Color('#1a0833'),
    skyColor: new THREE.Color('#120524'),
    roughness: 0.65,
    vegetationDensity: 0.25,
    crystalDensity: 0.8,
    boulderDensity: 0.3,
    ambientFreq: 261.6, // C4
  },
};

export class BiomeSystem {
  public noise: SimplexNoise;
  public params: TerrainParameters;

  constructor(params: TerrainParameters = DEFAULT_TERRAIN_PARAMS) {
    this.params = { ...params };
    this.noise = new SimplexNoise(this.params.seed);
  }

  public updateParams(newParams: Partial<TerrainParameters>): void {
    const seedChanged = newParams.seed !== undefined && newParams.seed !== this.params.seed;
    this.params = { ...this.params, ...newParams };
    if (seedChanged) {
      this.noise.reseed(this.params.seed);
    }
  }

  /**
   * Evaluates continental temperature and moisture to determine biome classification
   * and blending weights.
   */
  public getBiomeWeights(x: number, z: number): {
    primaryBiome: BiomeConfig;
    weights: Record<BiomeType, number>;
    temp: number;
    moisture: number;
  } {
    const scale = this.params.biomeScale;
    const temp = (this.noise.noise2D(x * scale, z * scale) + 1.0) * 0.5; // [0, 1]
    const moisture = (this.noise.noise2D((x + 1000) * scale, (z + 1000) * scale) + 1.0) * 0.5; // [0, 1]

    // Distance metrics in 2D Temp-Moisture space:
    // Verdant: moderate temp (0.4-0.8), high moisture (>0.5)
    // Crystalline: low temp (<0.4), moderate-high moisture
    // Obsidian: high temp (>0.6), low moisture (<0.4)
    // Cyber: low-moderate temp, low-moderate moisture
    const centers: Record<BiomeType, [number, number]> = {
      VERDANT_HIGHLANDS: [0.65, 0.75],
      CRYSTALLINE_TUNDRA: [0.2, 0.7],
      OBSIDIAN_RIFT: [0.85, 0.2],
      CYBER_AETHER: [0.35, 0.25],
    };

    let totalWeight = 0;
    const rawWeights: Record<BiomeType, number> = {
      VERDANT_HIGHLANDS: 0,
      CRYSTALLINE_TUNDRA: 0,
      OBSIDIAN_RIFT: 0,
      CYBER_AETHER: 0,
    };

    let maxWeight = -1;
    let primaryBiomeKey: BiomeType = 'VERDANT_HIGHLANDS';

    for (const key of Object.keys(centers) as BiomeType[]) {
      const [ct, cm] = centers[key];
      const dt = temp - ct;
      const dm = moisture - cm;
      const distSq = dt * dt + dm * dm;
      // Gaussian kernel for smooth organic biome blending
      const w = Math.exp(-distSq / 0.12);
      rawWeights[key] = w;
      totalWeight += w;

      if (w > maxWeight) {
        maxWeight = w;
        primaryBiomeKey = key;
      }
    }

    const weights: Record<BiomeType, number> = {
      VERDANT_HIGHLANDS: rawWeights.VERDANT_HIGHLANDS / totalWeight,
      CRYSTALLINE_TUNDRA: rawWeights.CRYSTALLINE_TUNDRA / totalWeight,
      OBSIDIAN_RIFT: rawWeights.OBSIDIAN_RIFT / totalWeight,
      CYBER_AETHER: rawWeights.CYBER_AETHER / totalWeight,
    };

    return {
      primaryBiome: BIOMES[primaryBiomeKey],
      weights,
      temp,
      moisture,
    };
  }

  /**
   * Returns procedural terrain height at coordinate (x, z)
   */
  public getHeight(x: number, z: number): number {
    const { weights } = this.getBiomeWeights(x, z);
    const p = this.params;

    // Base continental roll
    const baseFbm = this.noise.fbm2D(
      x * p.scale,
      z * p.scale,
      p.octaves,
      p.persistence,
      p.lacunarity,
      1.0
    );

    // Sharp mountain ridges (especially prominent in Tundra and Rift)
    const ridged = this.noise.ridged2D(
      x * p.scale * 1.5,
      z * p.scale * 1.5,
      p.octaves,
      p.persistence,
      p.lacunarity,
      1.0
    );

    // Cellular basalt step plateaus for Obsidian Rift
    const cell = this.noise.cellular2D(x * p.scale * 2.0, z * p.scale * 2.0);
    const basaltStep = (cell.f2 - cell.f1) * 0.8;

    // Biome-specific height modifier
    const verdantH = baseFbm * 0.8 + 0.2;
    const tundraH = baseFbm * 0.5 + ridged * (0.8 + p.ridgeSharpness * 0.5);
    const riftH = baseFbm * 0.4 + basaltStep * 0.9 + ridged * 0.3;
    const cyberH = Math.sin(x * p.scale * 3.0 + baseFbm * 2.0) * 0.3 + baseFbm * 0.7;

    const blended =
      weights.VERDANT_HIGHLANDS * verdantH +
      weights.CRYSTALLINE_TUNDRA * tundraH +
      weights.OBSIDIAN_RIFT * riftH +
      weights.CYBER_AETHER * cyberH;

    // Hydraulic erosion pseudo-factor: smooth out high slope drops
    const rawHeight = blended * p.heightMultiplier;
    return rawHeight < p.seaLevel ? p.seaLevel : rawHeight;
  }

  /**
   * Computes surface normal and slope gradient vector at (x, z)
   */
  public getNormalAndGradient(x: number, z: number): {
    normal: THREE.Vector3;
    gradient: THREE.Vector2;
    slope: number;
  } {
    const eps = 0.4;
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    const dhdx = (hR - hL) / (2 * eps);
    const dhdz = (hU - hD) / (2 * eps);

    const normal = new THREE.Vector3(-dhdx, 1.0, -dhdz).normalize();
    const gradient = new THREE.Vector2(dhdx, dhdz);
    const slope = Math.sqrt(dhdx * dhdx + dhdz * dhdz);

    return { normal, gradient, slope };
  }

  /**
   * Computes vertex color based on height, slope, and biome blending
   */
  public getColorAt(x: number, z: number, height: number, slope: number): THREE.Color {
    const { weights } = this.getBiomeWeights(x, z);
    const outColor = new THREE.Color(0, 0, 0);
    const tempColor = new THREE.Color();

    for (const [biomeKey, weight] of Object.entries(weights) as [BiomeType, number][]) {
      if (weight <= 0.01) continue;
      const biome = BIOMES[biomeKey];

      // Blend between primary ground, rock face (steep slope), and accent peaks
      if (slope > 0.8) {
        // Steep rock cliff
        tempColor.copy(biome.primaryColor).lerp(new THREE.Color('#374151'), 0.5);
      } else if (height > 12.0) {
        // High peak accent
        tempColor.copy(biome.accentColor);
      } else {
        // Valley / plain
        tempColor.copy(biome.primaryColor).lerp(biome.secondaryColor, (height + 5) / 18.0);
      }

      outColor.r += tempColor.r * weight;
      outColor.g += tempColor.g * weight;
      outColor.b += tempColor.b * weight;
    }

    return outColor;
  }
}
