import { BiomeType, BiomeSystem, BIOMES } from '../procedural/BiomeSystem';

export interface TrajectoryPoint {
  x: number;
  z: number;
  y: number;
  biome: BiomeType;
  timestamp: number;
}

export interface ExplorationCell {
  gx: number;
  gz: number;
  worldX: number;
  worldZ: number;
  visits: number;
  dwellTimeSec: number;
  biome: BiomeType;
  height: number;
}

export interface BiomeExplorationStats {
  biome: BiomeType;
  name: string;
  dwellTimeSec: number;
  cellsVisited: number;
  percentage: number;
  colorHex: string;
}

export interface FpsDipEvent {
  id: number;
  x: number;
  z: number;
  y: number;
  fps: number;
  frameTimeMs: number;
  biome: BiomeType;
  severity: 'MODERATE' | 'HEAVY' | 'CRITICAL';
  lagSource: string;
  timestamp: number;
}

export class ExplorationTracker {
  public cellSize: number = 8.0; // 8 meters per density cell
  public densityMap: Map<string, ExplorationCell> = new Map();
  public trajectory: TrajectoryPoint[] = [];
  public maxTrajectoryPoints: number = 600;

  // Real-time FPS Dip telemetry mapped to geographic coordinates
  public fpsDips: FpsDipEvent[] = [];
  public maxFpsDips: number = 120;
  private nextDipId: number = 1;

  public totalDwellTimeSec: number = 0;
  public totalDistanceTraveled: number = 0;
  private lastSamplePos: { x: number; z: number } | null = null;
  private sampleAccumulator: number = 0;
  private sampleInterval: number = 0.25; // Sample position every 250ms
  private lastDipTime: number = 0;

  // Bounds of explored territory
  public bounds = {
    minX: -50,
    maxX: 50,
    minZ: -50,
    maxZ: 50,
  };

  public recordPosition(
    x: number,
    y: number,
    z: number,
    dt: number,
    biomeSystem: BiomeSystem,
    fps?: number,
    frameTimeMs?: number
  ): void {
    this.totalDwellTimeSec += dt;
    this.sampleAccumulator += dt;

    // Track distance
    if (this.lastSamplePos) {
      const dist = Math.hypot(x - this.lastSamplePos.x, z - this.lastSamplePos.z);
      this.totalDistanceTraveled += dist;
    }
    this.lastSamplePos = { x, z };

    // Real-time FPS Dip detection mapped to geographic coordinates
    const currentFps = fps ?? 60;
    const currentMs = frameTimeMs ?? 16.6;
    const now = Date.now();

    if (currentFps < 55 && (now - this.lastDipTime > 1500)) {
      this.lastDipTime = now;
      const { primaryBiome } = biomeSystem.getBiomeWeights(x, z);
      const { slope } = biomeSystem.getNormalAndGradient(x, z);

      let severity: 'MODERATE' | 'HEAVY' | 'CRITICAL' = 'MODERATE';
      if (currentFps < 35 || currentMs > 28) severity = 'CRITICAL';
      else if (currentFps < 45 || currentMs > 22) severity = 'HEAVY';

      // Diagnose likely lag-inducing procedural asset based on biome features and slope
      let lagSource = 'Instanced Mesh Draw Call Surge';
      if (primaryBiome.id === 'CRYSTALLINE_TUNDRA') {
        lagSource = 'High Refraction Crystal Spire Clusters';
      } else if (primaryBiome.id === 'OBSIDIAN_RIFT') {
        lagSource = 'Basalt Column Tessellation & Molten Veins';
      } else if (primaryBiome.id === 'VERDANT_HIGHLANDS') {
        lagSource = 'Dense Foliage Conifer Instancing';
      } else if (primaryBiome.id === 'CYBER_AETHER') {
        lagSource = 'Aether Dust Particle Fill & High-Octave Noise';
      }

      if (slope > 0.8) {
        lagSource += ' + Steep Cliff Normal Solver';
      }

      this.fpsDips.push({
        id: this.nextDipId++,
        x: Math.round(x * 10) / 10,
        z: Math.round(z * 10) / 10,
        y: Math.round(y * 10) / 10,
        fps: Math.round(currentFps),
        frameTimeMs: Math.round(currentMs * 10) / 10,
        biome: primaryBiome.id,
        severity,
        lagSource,
        timestamp: now,
      });

      if (this.fpsDips.length > this.maxFpsDips) {
        this.fpsDips.shift();
      }
    }

    if (this.sampleAccumulator < this.sampleInterval) return;
    this.sampleAccumulator = 0;

    const { primaryBiome } = biomeSystem.getBiomeWeights(x, z);
    const biome = primaryBiome.id;

    // Record trajectory point
    this.trajectory.push({
      x: Math.round(x * 10) / 10,
      z: Math.round(z * 10) / 10,
      y: Math.round(y * 10) / 10,
      biome,
      timestamp: Date.now(),
    });

    if (this.trajectory.length > this.maxTrajectoryPoints) {
      this.trajectory.shift();
    }

    // Update dynamic exploration bounds with margin
    this.bounds.minX = Math.min(this.bounds.minX, x - 30);
    this.bounds.maxX = Math.max(this.bounds.maxX, x + 30);
    this.bounds.minZ = Math.min(this.bounds.minZ, z - 30);
    this.bounds.maxZ = Math.max(this.bounds.maxZ, z + 30);

    // Update spatial density cell
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    const key = `${gx},${gz}`;

    let cell = this.densityMap.get(key);
    if (!cell) {
      cell = {
        gx,
        gz,
        worldX: gx * this.cellSize + this.cellSize * 0.5,
        worldZ: gz * this.cellSize + this.cellSize * 0.5,
        visits: 0,
        dwellTimeSec: 0,
        biome,
        height: Math.round(y * 10) / 10,
      };
      this.densityMap.set(key, cell);
    }

    cell.visits += 1;
    cell.dwellTimeSec += this.sampleInterval;
  }

  /**
   * Returns aggregated exploration statistics grouped by procedural biome
   */
  public getBiomeStats(): BiomeExplorationStats[] {
    const biomeTotals: Record<BiomeType, { dwell: number; cells: number }> = {
      VERDANT_HIGHLANDS: { dwell: 0, cells: 0 },
      CRYSTALLINE_TUNDRA: { dwell: 0, cells: 0 },
      OBSIDIAN_RIFT: { dwell: 0, cells: 0 },
      CYBER_AETHER: { dwell: 0, cells: 0 },
    };

    let grandTotalDwell = 0;

    for (const cell of this.densityMap.values()) {
      biomeTotals[cell.biome].dwell += cell.dwellTimeSec;
      biomeTotals[cell.biome].cells += 1;
      grandTotalDwell += cell.dwellTimeSec;
    }

    const result: BiomeExplorationStats[] = [];

    for (const key of Object.keys(biomeTotals) as BiomeType[]) {
      const data = biomeTotals[key];
      const pct = grandTotalDwell > 0 ? (data.dwell / grandTotalDwell) * 100 : 25;
      result.push({
        biome: key,
        name: BIOMES[key].name,
        dwellTimeSec: Math.round(data.dwell * 10) / 10,
        cellsVisited: data.cells,
        percentage: Math.round(pct * 10) / 10,
        colorHex: `#${BIOMES[key].secondaryColor.getHexString()}`,
      });
    }

    return result;
  }

  /**
   * Generates a 2D grid matrix of density samples suitable for D3 2D heatmap rendering
   */
  public getDensityGrid(gridCols: number = 32, gridRows: number = 32, biomeSystem?: BiomeSystem) {
    const width = this.bounds.maxX - this.bounds.minX;
    const height = this.bounds.maxZ - this.bounds.minZ;
    const stepX = width / gridCols;
    const stepZ = height / gridRows;

    let maxDensity = 0;
    const grid: {
      col: number;
      row: number;
      x: number;
      z: number;
      density: number;
      biome: BiomeType;
      height: number;
    }[] = [];

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const x = this.bounds.minX + (c + 0.5) * stepX;
        const z = this.bounds.minZ + (r + 0.5) * stepZ;

        // Check if there are recorded visited cells in this area
        const gx = Math.floor(x / this.cellSize);
        const gz = Math.floor(z / this.cellSize);
        const cell = this.densityMap.get(`${gx},${gz}`);

        let density = cell ? cell.visits : 0;
        let biome: BiomeType = cell?.biome ?? 'VERDANT_HIGHLANDS';
        let h = cell?.height ?? 0;

        if (!cell && biomeSystem) {
          const bInfo = biomeSystem.getBiomeWeights(x, z);
          biome = bInfo.primaryBiome.id;
          h = biomeSystem.getHeight(x, z);
        }

        if (density > maxDensity) {
          maxDensity = density;
        }

        grid.push({
          col: c,
          row: r,
          x: Math.round(x),
          z: Math.round(z),
          density,
          biome,
          height: Math.round(h * 10) / 10,
        });
      }
    }

    return {
      grid,
      gridCols,
      gridRows,
      bounds: { ...this.bounds },
      maxDensity: Math.max(1, maxDensity),
    };
  }

  public clear(): void {
    this.densityMap.clear();
    this.trajectory = [];
    this.fpsDips = [];
    this.totalDwellTimeSec = 0;
    this.totalDistanceTraveled = 0;
    this.lastSamplePos = null;
    this.bounds = {
      minX: -50,
      maxX: 50,
      minZ: -50,
      maxZ: 50,
    };
  }

  public simulateFpsDip(x: number, y: number, z: number, biome: BiomeType, fps: number = 38): void {
    const ms = Math.round((1000 / fps) * 10) / 10;
    let lagSource = 'Instanced Mesh Draw Call Surge';
    if (biome === 'CRYSTALLINE_TUNDRA') lagSource = 'High Refraction Crystal Spire Clusters';
    else if (biome === 'OBSIDIAN_RIFT') lagSource = 'Basalt Column Tessellation & Molten Veins';
    else if (biome === 'VERDANT_HIGHLANDS') lagSource = 'Dense Foliage Conifer Instancing';
    else if (biome === 'CYBER_AETHER') lagSource = 'Aether Dust Particle Fill & High-Octave Noise';

    this.fpsDips.push({
      id: this.nextDipId++,
      x: Math.round(x * 10) / 10,
      z: Math.round(z * 10) / 10,
      y: Math.round(y * 10) / 10,
      fps,
      frameTimeMs: ms,
      biome,
      severity: fps < 35 ? 'CRITICAL' : fps < 45 ? 'HEAVY' : 'MODERATE',
      lagSource,
      timestamp: Date.now(),
    });
  }
}
