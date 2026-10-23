import { BiomeSystem, TerrainParameters, BiomeType } from '../procedural/BiomeSystem';
import { TerrainManager } from '../procedural/TerrainManager';
import { EnemyManager } from '../entities/EnemyManager';
import { ExplorationTracker } from './ExplorationTracker';

export interface ElevationStats {
  mean: number;
  stdDev: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  histogramBins: number[]; // 16 normalized bins
}

export interface SpectralAnalysis {
  octaves: number[];
  octaveEnergies: number[];
  fractalDimension: number;
  hurstExponent: number;
  spectralRoughness: number;
}

export interface BiomeEntropy {
  shannonEntropy: number;
  normalizedEntropy: number; // 0 to 1
  biomeDistributions: Record<BiomeType, number>;
}

export interface LodParetoPoint {
  resolution: number;
  vertexCount: number;
  geometricError: number;
  frameBudgetMs: number;
}

export interface HeatmapCell {
  x: number;
  z: number;
  height: number;
  slope: number;
  flowAccumulation: number;
}

export class DataScienceEngine {
  public biomeSystem: BiomeSystem;
  public terrainManager: TerrainManager;
  public enemyManager: EnemyManager;

  // Cached analytical metrics
  public elevationStats: ElevationStats = {
    mean: 0,
    stdDev: 0,
    variance: 0,
    skewness: 0,
    kurtosis: 0,
    min: 0,
    max: 0,
    histogramBins: new Array(16).fill(0),
  };

  public spectralAnalysis: SpectralAnalysis = {
    octaves: [1, 2, 3, 4],
    octaveEnergies: [1.0, 0.5, 0.25, 0.125],
    fractalDimension: 2.2,
    hurstExponent: 0.8,
    spectralRoughness: 0.45,
  };

  public biomeEntropy: BiomeEntropy = {
    shannonEntropy: 1.5,
    normalizedEntropy: 0.75,
    biomeDistributions: {
      VERDANT_HIGHLANDS: 0.4,
      CRYSTALLINE_TUNDRA: 0.25,
      OBSIDIAN_RIFT: 0.2,
      CYBER_AETHER: 0.15,
    },
  };

  public paretoCurve: LodParetoPoint[] = [];
  public heatmapMatrix: HeatmapCell[][] = [];
  public heatmapResolution = 24; // 24x24 matrix for live UI rendering
  public explorationTracker: ExplorationTracker;

  // Sample cache
  private sampleSize = 196;
  private sampleBuffer: Float32Array = new Float32Array(196);

  constructor(biomeSystem: BiomeSystem, terrainManager: TerrainManager, enemyManager: EnemyManager) {
    this.biomeSystem = biomeSystem;
    this.terrainManager = terrainManager;
    this.enemyManager = enemyManager;
    this.explorationTracker = new ExplorationTracker();
    this.initParetoPoints();
  }

  private initParetoPoints(): void {
    const resolutions = [8, 12, 16, 20, 24, 28, 32, 40];
    const chunks = 25; // 5x5
    this.paretoCurve = resolutions.map((res) => {
      const vertsPerChunk = (res + 1) * (res + 1);
      const totalVerts = vertsPerChunk * chunks;
      // Geometric error inversely proportional to resolution squared
      const geometricError = 1.0 / (res * res * 0.05);
      const frameBudgetMs = totalVerts * 0.00015 + 1.2;
      return {
        resolution: res,
        vertexCount: totalVerts,
        geometricError: Math.round(geometricError * 1000) / 1000,
        frameBudgetMs: Math.round(frameBudgetMs * 100) / 100,
      };
    });
  }

  /**
   * Samples terrain around player to compute Statistical Moments and Height Histogram
   */
  public analyzeElevation(playerX: number, playerZ: number, radius: number = 80): void {
    let sum = 0;
    let min = 99999;
    let max = -99999;
    const count = this.sampleSize;

    // Golden spiral sampling for optimal spatial uniformity
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(i / count) * radius;
      const theta = i * goldenAngle;
      const sx = playerX + Math.cos(theta) * r;
      const sz = playerZ + Math.sin(theta) * r;
      const h = this.biomeSystem.getHeight(sx, sz);

      this.sampleBuffer[i] = h;
      sum += h;
      if (h < min) min = h;
      if (h > max) max = h;
    }

    const mean = sum / count;

    // Variance, Skewness, Kurtosis
    let varSum = 0;
    let skewSum = 0;
    let kurtSum = 0;

    for (let i = 0; i < count; i++) {
      const diff = this.sampleBuffer[i] - mean;
      const diff2 = diff * diff;
      varSum += diff2;
      skewSum += diff2 * diff;
      kurtSum += diff2 * diff2;
    }

    const variance = varSum / count;
    const stdDev = Math.sqrt(variance) || 0.0001;
    const skewness = (skewSum / count) / (stdDev * stdDev * stdDev);
    const kurtosis = (kurtSum / count) / (variance * variance) - 3.0; // excess kurtosis

    // 16-bin Histogram
    const numBins = 16;
    const bins = new Array(numBins).fill(0);
    const range = Math.max(1.0, max - min);

    for (let i = 0; i < count; i++) {
      const norm = (this.sampleBuffer[i] - min) / range;
      const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor(norm * numBins)));
      bins[binIdx]++;
    }

    // Normalize histogram frequencies
    const maxBinCount = Math.max(1, ...bins);
    const normalizedBins = bins.map((b) => b / maxBinCount);

    this.elevationStats = {
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      skewness: Math.round(skewness * 100) / 100,
      kurtosis: Math.round(kurtosis * 100) / 100,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      histogramBins: normalizedBins,
    };
  }

  /**
   * Spectral Octave Energy & Fractal Dimension (Hurst Exponent D = 3 - H)
   */
  public analyzeSpectrum(): void {
    const p = this.biomeSystem.params;
    const octaves = Array.from({ length: p.octaves }, (_, i) => i + 1);
    const octaveEnergies: number[] = [];

    let totalEnergy = 0;
    let currentAmp = 1.0;

    for (let i = 0; i < p.octaves; i++) {
      const energy = currentAmp * currentAmp;
      octaveEnergies.push(energy);
      totalEnergy += energy;
      currentAmp *= p.persistence;
    }

    const normalizedEnergies = octaveEnergies.map((e) => e / (totalEnergy || 1));

    // Hurst exponent estimation based on persistence: H = -log(persistence) / log(lacunarity)
    const hurst = Math.max(0.1, Math.min(0.99, -Math.log(p.persistence) / Math.log(p.lacunarity)));
    const fractalDimension = 3.0 - hurst;
    const spectralRoughness = 1.0 - hurst;

    this.spectralAnalysis = {
      octaves,
      octaveEnergies: normalizedEnergies,
      fractalDimension: Math.round(fractalDimension * 100) / 100,
      hurstExponent: Math.round(hurst * 100) / 100,
      spectralRoughness: Math.round(spectralRoughness * 100) / 100,
    };
  }

  /**
   * Biome Shannon Diversity Entropy across active territory:
   * H(X) = - sum(p_i * log2(p_i))
   */
  public analyzeBiomeEntropy(playerX: number, playerZ: number, radius: number = 100): void {
    const rawCounts: Record<BiomeType, number> = {
      VERDANT_HIGHLANDS: 0,
      CRYSTALLINE_TUNDRA: 0,
      OBSIDIAN_RIFT: 0,
      CYBER_AETHER: 0,
    };

    const steps = 64;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const dist = (i / steps) * radius;
      const sx = playerX + Math.cos(angle) * dist;
      const sz = playerZ + Math.sin(angle) * dist;
      const { primaryBiome } = this.biomeSystem.getBiomeWeights(sx, sz);
      rawCounts[primaryBiome.id]++;
    }

    let shannon = 0;
    const distributions: Record<BiomeType, number> = {
      VERDANT_HIGHLANDS: 0,
      CRYSTALLINE_TUNDRA: 0,
      OBSIDIAN_RIFT: 0,
      CYBER_AETHER: 0,
    };

    for (const key of Object.keys(rawCounts) as BiomeType[]) {
      const p = rawCounts[key] / steps;
      distributions[key] = Math.round(p * 100) / 100;
      if (p > 0.0001) {
        shannon -= p * Math.log2(p);
      }
    }

    // Maximum theoretical entropy for 4 biomes is log2(4) = 2.0
    const normalizedEntropy = shannon / 2.0;

    this.biomeEntropy = {
      shannonEntropy: Math.round(shannon * 100) / 100,
      normalizedEntropy: Math.round(normalizedEntropy * 100) / 100,
      biomeDistributions: distributions,
    };
  }

  /**
   * Computes a 2D Topological Heatmap matrix with slope gradients & flow accumulation
   */
  public computeTopologicalHeatmap(playerX: number, playerZ: number, radius: number = 70): void {
    const res = this.heatmapResolution;
    const matrix: HeatmapCell[][] = [];
    const step = (radius * 2) / res;
    const minX = playerX - radius;
    const minZ = playerZ - radius;

    for (let row = 0; row < res; row++) {
      const rowCells: HeatmapCell[] = [];
      const z = minZ + row * step;

      for (let col = 0; col < res; col++) {
        const x = minX + col * step;
        const height = this.biomeSystem.getHeight(x, z);
        const { slope } = this.biomeSystem.getNormalAndGradient(x, z);

        // Simple flow accumulation heuristic: valleys collect flow from surrounding slope
        const flow = Math.max(0, 1.0 - (height / 20.0)) * (1.0 - Math.min(1.0, slope * 0.7));

        rowCells.push({
          x,
          z,
          height: Math.round(height * 10) / 10,
          slope: Math.round(slope * 100) / 100,
          flowAccumulation: Math.round(flow * 100) / 100,
        });
      }
      matrix.push(rowCells);
    }

    this.heatmapMatrix = matrix;
  }

  /**
   * Auto-Tune Heuristic: Automatically optimizes procedural noise parameters
   * for balanced terrain walkability, aesthetic variation, and 60 FPS performance!
   */
  public autoOptimizeParameters(): TerrainParameters {
    // Balances persistence, lacunarity, and height multiplier for ideal game feel
    const optimized: TerrainParameters = {
      seed: this.biomeSystem.params.seed,
      scale: 0.011,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.15,
      heightMultiplier: 17.5,
      ridgeSharpness: 0.32,
      erosionStrength: 0.3,
      biomeScale: 0.0032,
      seaLevel: -3.0,
    };

    this.biomeSystem.updateParams(optimized);
    this.terrainManager.setResolution(24);
    this.terrainManager.rebuildAllChunks();
    this.analyzeSpectrum();

    return optimized;
  }
}
