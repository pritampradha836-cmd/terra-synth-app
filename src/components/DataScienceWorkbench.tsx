import React, { useState } from 'react';
import { GameEngine, GameTelemetrySnapshot } from '../game/GameEngine';
import { BIOMES, BiomeType } from '../game/procedural/BiomeSystem';
import { Activity, BarChart2, Cpu, Database, Eye, Maximize2, Sliders, Sparkles, X, Footprints, Download } from 'lucide-react';
import { D3ExplorationHeatmap } from './D3ExplorationHeatmap';

interface DataScienceWorkbenchProps {
  engine: GameEngine;
  telemetry: GameTelemetrySnapshot | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DataScienceWorkbench: React.FC<DataScienceWorkbenchProps> = ({
  engine,
  telemetry,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'D3_EXPLORATION' | 'SPECTRUM' | 'ENTROPY' | 'PARETO' | 'HEATMAP' | 'LAB'>('D3_EXPLORATION');

  // Local state for hyperparameter sliders
  const [params, setParams] = useState({ ...engine.biomeSystem.params });
  const [resolution, setResolution] = useState(engine.terrainManager.resolution);
  const [viewDistance, setViewDistance] = useState(engine.terrainManager.viewDistance);

  if (!isOpen) return null;

  const ds = engine.dsEngine;
  const elev = ds.elevationStats;
  const spec = ds.spectralAnalysis;
  const entropy = ds.biomeEntropy;
  const heatmap = ds.heatmapMatrix;
  const pareto = ds.paretoCurve;
  const hashTelemetry = engine.enemyManager.telemetry;

  const handleParamChange = (key: keyof typeof params, value: number) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    engine.updateTerrainParams(updated);
  };

  const handleResolutionChange = (val: number) => {
    setResolution(val);
    engine.terrainManager.setResolution(val);
  };

  const handleViewDistChange = (val: number) => {
    setViewDistance(val);
    engine.terrainManager.setViewDistance(val);
  };

  const handleAutoTune = () => {
    const optimized = engine.dsEngine.autoOptimizeParameters();
    setParams({ ...optimized });
    setResolution(24);
  };

  const handleDownloadCSV = () => {
    const tracker = engine.dsEngine.explorationTracker;
    const biomeStats = tracker.getBiomeStats();
    const playerPos = engine.player.position;
    const currentBiomeName = telemetry ? BIOMES[telemetry.biome]?.name : 'Verdant Highlands';
    const timestamp = new Date().toISOString();

    // 1. Build CSV string with structured telemetry & density sections
    let csv = '';

    // Metadata & General Telemetry
    csv += '# ============================================================\n';
    csv += '# TERRA-SYNTH PROCEDURAL ENGINE: SYSTEM & SIMULATION TELEMETRY\n';
    csv += '# ============================================================\n';
    csv += 'Timestamp,CurrentFPS,FrameTimeMs,DrawCalls,RenderedTriangles,ActiveBiome,PlayerX,PlayerY,PlayerZ,TerritorySurveyed_m2,ExplorationSectorsCount,TotalDwellTimeSec,TotalDistanceTraveled_m,Resolution,ViewDistanceChunks,SpatialHashPruningPct\n';
    csv += `${timestamp},${telemetry?.fps ?? 60},${telemetry?.frameTimeMs ?? 16.6},${telemetry?.drawCalls ?? 0},${telemetry?.triangles ?? 0},"${currentBiomeName}",${Math.round(playerPos.x * 10) / 10},${Math.round(playerPos.y * 10) / 10},${Math.round(playerPos.z * 10) / 10},${tracker.densityMap.size * 64},${tracker.densityMap.size},${Math.round(tracker.totalDwellTimeSec * 10) / 10},${Math.round(tracker.totalDistanceTraveled * 10) / 10},${resolution},${viewDistance},${hashTelemetry.pruningEfficiencyPct}%\n\n`;

    // Statistical Moments & Terrain Spectral Analysis
    csv += '# ============================================================\n';
    csv += '# PROCEDURAL TERRAIN STATISTICAL MOMENTS & SPECTRAL ANALYSIS\n';
    csv += '# ============================================================\n';
    csv += 'MeanElevation_m,StdDev_m,Variance,Skewness,ExcessKurtosis,MinElevation_m,MaxElevation_m,HurstExponent_H,FractalDimension_D,SpectralRoughness,ShannonEntropy_bits,EcosystemDiversityPct\n';
    csv += `${elev.mean},${elev.stdDev},${elev.variance},${elev.skewness},${elev.kurtosis},${elev.min},${elev.max},${spec.hurstExponent},${spec.fractalDimension},${spec.spectralRoughness},${entropy.shannonEntropy},${Math.round(entropy.normalizedEntropy * 100)}%\n\n`;

    // Biome Dwell & Density Distribution
    csv += '# ============================================================\n';
    csv += '# BIOME DWELL TIME & DENSITY DISTRIBUTION\n';
    csv += '# ============================================================\n';
    csv += 'BiomeID,BiomeName,DwellTimeSeconds,SectorsVisited,PercentageOfTotalExploration\n';
    biomeStats.forEach(b => {
      csv += `${b.biome},"${b.name}",${b.dwellTimeSec},${b.cellsVisited},${b.percentage}%\n`;
    });
    csv += '\n';

    // Spatial Density Grid Cells
    csv += '# ============================================================\n';
    csv += '# DETAILED SPATIAL DENSITY GRID CELLS (EXPLORED SECTORS)\n';
    csv += '# ============================================================\n';
    csv += 'GridCellKey,GridX,GridZ,WorldX,WorldZ,BiomeID,Height_m,VisitsCount,DwellTimeSeconds\n';
    for (const [key, cell] of tracker.densityMap.entries()) {
      csv += `"${key}",${cell.gx},${cell.gz},${cell.worldX},${cell.worldZ},${cell.biome},${cell.height},${cell.visits},${Math.round(cell.dwellTimeSec * 10) / 10}\n`;
    }
    csv += '\n';

    // FPS Dip Incidents
    csv += '# ============================================================\n';
    csv += '# RECORDED FPS DIPS & ASSET BOTTLENECK INCIDENTS\n';
    csv += '# ============================================================\n';
    csv += 'IncidentID,WorldX,WorldZ,Elevation_m,FPS,FrameTimeMs,Severity,BiomeID,DiagnosedLagSourceAsset,Timestamp\n';
    tracker.fpsDips.forEach(dip => {
      csv += `${dip.id},${dip.x},${dip.z},${dip.y},${dip.fps},${dip.frameTimeMs},${dip.severity},${dip.biome},"${dip.lagSource}",${new Date(dip.timestamp).toISOString()}\n`;
    });

    // 2. Trigger browser download of CSV blob
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `terra_synth_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 md:p-6 bg-black/75 pointer-events-auto">
      <div className="w-full max-w-5xl h-[88vh] bg-slate-950/95 border border-cyan-500/30 rounded-lg shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold tracking-wider text-cyan-300 uppercase">
                Data Science Telemetry & Optimization Workbench
              </h2>
              <div className="flex items-center gap-4 text-xs font-mono-code text-slate-400">
                <span>FPS: <strong className="text-emerald-400">{telemetry?.fps ?? 60}</strong></span>
                <span>FrameTime: <strong className="text-emerald-400">{telemetry?.frameTimeMs ?? 16.6} ms</strong></span>
                <span>Active Verts: <strong className="text-cyan-400">{((resolution + 1) * (resolution + 1) * 25).toLocaleString()}</strong></span>
                <span>Spatial Hash Pruning: <strong className="text-sky-400">{hashTelemetry.pruningEfficiencyPct}%</strong></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadCSV}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-slate-950 font-mono-code font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5 transition-all shadow-md shadow-cyan-900/30 cursor-pointer"
              title="Export current telemetry snapshot and biome density data as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Data (CSV)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-cyan-500/20 bg-slate-900/40 text-xs font-mono-code overflow-x-auto">
          <button
            onClick={() => setActiveTab('D3_EXPLORATION')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'D3_EXPLORATION'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Footprints className="w-4 h-4 text-cyan-400" /> D3 Biome Density Heatmap
          </button>

          <button
            onClick={() => setActiveTab('SPECTRUM')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
              activeTab === 'SPECTRUM'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Elevation & Spectral FFT
          </button>

          <button
            onClick={() => setActiveTab('ENTROPY')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'ENTROPY'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" /> Shannon Biome Entropy
          </button>

          <button
            onClick={() => setActiveTab('PARETO')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'PARETO'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" /> Pareto LOD Optimizer
          </button>

          <button
            onClick={() => setActiveTab('HEATMAP')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'HEATMAP'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" /> Topological Gradient Heatmap
          </button>

          <button
            onClick={() => setActiveTab('LAB')}
            className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'LAB'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" /> Hyperparameter Lab
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 overflow-y-auto">
          {/* TAB 0: D3 EXPLORATION DENSITY HEATMAP */}
          {activeTab === 'D3_EXPLORATION' && (
            <D3ExplorationHeatmap engine={engine} onDownloadData={handleDownloadCSV} />
          )}

          {/* TAB 1: SPECTRUM & HISTOGRAM */}
          {activeTab === 'SPECTRUM' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Elevation Histogram */}
              <div className="bg-slate-900/60 border border-slate-800 rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Elevation Distribution P(h) [16-Bin Sample]
                  </h3>
                  <span className="text-[10px] font-mono-code text-slate-400">N = 196 Samples</span>
                </div>
                {/* Histogram Bars */}
                <div className="h-40 flex items-end gap-1.5 pt-4 pb-2 border-b border-slate-800">
                  {elev.histogramBins.map((binVal, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div
                        className="w-full bg-cyan-500/80 rounded-t hover:bg-cyan-300 transition-all"
                        style={{ height: `${Math.max(4, binVal * 100)}%` }}
                      />
                      <span className="text-[9px] font-mono-code text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {Math.round(binVal * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-mono-code text-slate-400 mt-1">
                  <span>Min: {elev.min}m</span>
                  <span>Mean: {elev.mean}m</span>
                  <span>Max: {elev.max}m</span>
                </div>

                {/* Statistical Moments */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs font-mono-code">
                  <div className="p-2 bg-slate-950/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Mean Elevation μ</span>
                    <strong className="text-cyan-300">{elev.mean}m</strong>
                  </div>
                  <div className="p-2 bg-slate-950/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Std Dev σ</span>
                    <strong className="text-cyan-300">{elev.stdDev}m</strong>
                  </div>
                  <div className="p-2 bg-slate-950/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Variance σ²</span>
                    <strong className="text-cyan-300">{elev.variance}</strong>
                  </div>
                  <div className="p-2 bg-slate-950/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Skewness γ₁</span>
                    <strong className="text-emerald-400">{elev.skewness}</strong>
                  </div>
                  <div className="p-2 bg-slate-950/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Kurtosis β₂</span>
                    <strong className="text-emerald-400">{elev.kurtosis}</strong>
                  </div>
                  <div className="p-2 bg-slate-950/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Fractal Dim D</span>
                    <strong className="text-amber-400">{spec.fractalDimension}</strong>
                  </div>
                </div>
              </div>

              {/* Spectral Octaves */}
              <div className="bg-slate-900/60 border border-slate-800 rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Fourier Octave Energy Decomposition
                  </h3>
                  <span className="text-[10px] font-mono-code text-amber-300">Hurst H: {spec.hurstExponent}</span>
                </div>

                <div className="space-y-3 pt-2">
                  {spec.octaves.map((octave, idx) => {
                    const energy = spec.octaveEnergies[idx] ?? 0;
                    return (
                      <div key={octave} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono-code text-slate-300">
                          <span>Octave {octave} ({octave === 1 ? 'Macro Continental' : octave === 2 ? 'Ridges & Hills' : octave === 3 ? 'Boulders' : 'Micro Surface'})</span>
                          <span className="text-cyan-400">{Math.round(energy * 100)}% Power</span>
                        </div>
                        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                            style={{ width: `${Math.max(2, energy * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 p-3 bg-cyan-950/30 border border-cyan-800/40 rounded text-xs text-slate-300 space-y-1">
                  <strong className="text-cyan-300 block">Data Science Insight:</strong>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    The Hurst exponent <strong>H = {spec.hurstExponent}</strong> implies a fractal roughness of <strong>{spec.spectralRoughness}</strong>. Higher persistence creates self-similar craggy peaks, while lower persistence produces rolling gentle topography.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BIOME SHANNON ENTROPY */}
          {activeTab === 'ENTROPY' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded text-center">
                  <span className="text-xs text-slate-400 font-mono-code uppercase block">Shannon Entropy H(X)</span>
                  <strong className="text-3xl font-extrabold text-cyan-400 tracking-tight font-mono-code block mt-1">
                    {entropy.shannonEntropy}
                  </strong>
                  <span className="text-[11px] text-slate-500">Max theoretical: 2.0 bits</span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded text-center">
                  <span className="text-xs text-slate-400 font-mono-code uppercase block">Ecosystem Diversity Index</span>
                  <strong className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono-code block mt-1">
                    {Math.round(entropy.normalizedEntropy * 100)}%
                  </strong>
                  <span className="text-[11px] text-slate-500">Normalized H(X) / log₂(K)</span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded text-center">
                  <span className="text-xs text-slate-400 font-mono-code uppercase block">Active Primary Biome</span>
                  <strong className="text-xl font-bold text-amber-300 tracking-tight block mt-2">
                    {telemetry ? BIOMES[telemetry.biome]?.name : 'Verdant Highlands'}
                  </strong>
                  <span className="text-[11px] text-slate-500">Dynamic 2D Perlin coordinate</span>
                </div>
              </div>

              {/* Biome Distribution Bars */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Regional Biome Coverage in Active Streaming Zone
                </h3>

                {(Object.keys(entropy.biomeDistributions) as BiomeType[]).map((bKey) => {
                  const bConfig = BIOMES[bKey];
                  const pct = entropy.biomeDistributions[bKey] ?? 0;
                  return (
                    <div key={bKey} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono-code">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: `#${bConfig.primaryColor.getHexString()}` }}
                          />
                          {bConfig.name}
                        </span>
                        <span className="text-cyan-400">{Math.round(pct * 100)}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(2, pct * 100)}%`,
                            backgroundColor: `#${bConfig.secondaryColor.getHexString()}`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: PARETO LOD OPTIMIZER */}
          {activeTab === 'PARETO' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                    Vertex Budget vs Geometric Error Pareto Frontier
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time mesh optimization curve minimizing geometric displacement error E(d) within the 16.6ms frame budget.
                  </p>
                </div>
                <button
                  onClick={handleAutoTune}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Auto-Optimize for 60 FPS
                </button>
              </div>

              {/* Pareto Curve Visualization */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded">
                <div className="h-48 flex items-end gap-3 pt-6 pb-2 border-b border-slate-800">
                  {pareto.map((pt) => {
                    const isCurrent = pt.resolution === resolution;
                    return (
                      <div key={pt.resolution} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <span className="text-[9px] font-mono-code text-cyan-400 mb-1 opacity-80">
                          {pt.geometricError}
                        </span>
                        <div
                          className={`w-full rounded-t transition-all ${
                            isCurrent
                              ? 'bg-amber-400 shadow-lg shadow-amber-400/30'
                              : 'bg-cyan-600/70 hover:bg-cyan-400'
                          }`}
                          style={{ height: `${Math.min(100, (pt.vertexCount / 50000) * 100)}%` }}
                        />
                        <span
                          className={`text-[10px] font-mono-code mt-1 ${
                            isCurrent ? 'text-amber-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {pt.resolution}²
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs font-mono-code text-slate-400 mt-2">
                  <span>Lower Geometry (8x8)</span>
                  <span className="text-amber-300">Selected: {resolution}x{resolution} Subdivisions</span>
                  <span>High Fidelity (40x40)</span>
                </div>
              </div>

              {/* Dynamic Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-2">
                  <div className="flex justify-between text-xs font-mono-code">
                    <span className="text-slate-300">Chunk Subdivision Resolution</span>
                    <strong className="text-cyan-400">{resolution}x{resolution}</strong>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="36"
                    step="4"
                    value={resolution}
                    onChange={(e) => handleResolutionChange(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500 block">Higher values yield sharper terrain crests.</span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-2">
                  <div className="flex justify-between text-xs font-mono-code">
                    <span className="text-slate-300">Chunk View Radius</span>
                    <strong className="text-cyan-400">{viewDistance} Chunks ({(viewDistance * 2 + 1) ** 2} active)</strong>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="4"
                    step="1"
                    value={viewDistance}
                    onChange={(e) => handleViewDistChange(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500 block">Expands horizon draw radius around player.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TOPOLOGICAL GRADIENT HEATMAP */}
          {activeTab === 'HEATMAP' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Real-time Surface Gradient ∇h & Flow Drainage Matrix [24x24]
                </h3>
                <span className="text-xs font-mono-code text-slate-400">
                  Player: ({telemetry?.playerCoords.x}, {telemetry?.playerCoords.z})
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                {/* 2D Heatmap Grid */}
                <div className="grid grid-cols-24 gap-0.5 bg-slate-950 p-2 border border-slate-800 rounded">
                  {heatmap.flatMap((row, rIdx) =>
                    row.map((cell, cIdx) => {
                      // Player is at center cell (12, 12)
                      const isCenter = rIdx === 12 && cIdx === 12;
                      const slopeNorm = Math.min(1.0, cell.slope);
                      // Color: green (low slope) to red/amber (high cliff)
                      const hue = (1.0 - slopeNorm) * 120; // 120 (green) down to 0 (red)

                      return (
                        <div
                          key={`${rIdx}-${cIdx}`}
                          className="w-3.5 h-3.5 rounded-[1px] relative group"
                          style={{
                            backgroundColor: isCenter ? '#38bdf8' : `hsl(${hue}, 80%, ${25 + cell.height * 1.5}%)`,
                          }}
                          title={`(x: ${Math.round(cell.x)}, z: ${Math.round(cell.z)}) Elev: ${cell.height}m Slope: ${cell.slope}`}
                        >
                          {isCenter && (
                            <div className="w-1.5 h-1.5 bg-white rounded-full absolute inset-0 m-auto" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Heatmap Legend */}
                <div className="space-y-3 text-xs font-mono-code text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-cyan-400 rounded-sm" />
                    <span>Player Position (Origin)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-600 rounded-sm" />
                    <span>Gentle Valley / Walkable (Slope &lt; 0.3)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-amber-500 rounded-sm" />
                    <span>Moderate Incline (Slope 0.3 - 0.7)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-rose-600 rounded-sm" />
                    <span>Steep Escarpment / Cliff (Slope &gt; 0.7)</span>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded mt-4">
                    <strong className="text-cyan-300 block mb-1">Spatial Broadphase Telemetry:</strong>
                    <div className="space-y-0.5 text-[11px] text-slate-400">
                      <div>Active Cells: {hashTelemetry.cellsOccupied}</div>
                      <div>Tested Pairs: {hashTelemetry.broadphasePairsTested} / {hashTelemetry.bruteForcePairsTotal}</div>
                      <div>Efficiency: <span className="text-emerald-400 font-bold">{hashTelemetry.pruningEfficiencyPct}% avoided</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HYPERPARAMETER LAB */}
          {activeTab === 'LAB' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                    Procedural Synthesis Hyperparameters
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live mathematical parameter tuning for multi-octave Simplex, ridged multifractal, and erosion operators.
                  </p>
                </div>
                <button
                  onClick={handleAutoTune}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Genetic Auto-Tune
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-code">
                {/* Octaves */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Noise Octaves</span>
                    <strong className="text-cyan-400">{params.octaves}</strong>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="6"
                    step="1"
                    value={params.octaves}
                    onChange={(e) => handleParamChange('octaves', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Persistence */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Persistence (Amplitude Multiplier)</span>
                    <strong className="text-cyan-400">{params.persistence}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.75"
                    step="0.02"
                    value={params.persistence}
                    onChange={(e) => handleParamChange('persistence', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Lacunarity */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Lacunarity (Frequency Gap)</span>
                    <strong className="text-cyan-400">{params.lacunarity}</strong>
                  </div>
                  <input
                    type="range"
                    min="1.6"
                    max="2.8"
                    step="0.05"
                    value={params.lacunarity}
                    onChange={(e) => handleParamChange('lacunarity', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Height Multiplier */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Elevation Multiplier</span>
                    <strong className="text-cyan-400">{params.heightMultiplier}m</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="28"
                    step="1"
                    value={params.heightMultiplier}
                    onChange={(e) => handleParamChange('heightMultiplier', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Ridge Sharpness */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Ridge Multifractal Sharpness</span>
                    <strong className="text-cyan-400">{params.ridgeSharpness}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={params.ridgeSharpness}
                    onChange={(e) => handleParamChange('ridgeSharpness', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Biome Scale */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Biome Transition Scale</span>
                    <strong className="text-cyan-400">{params.biomeScale}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.002"
                    max="0.007"
                    step="0.0005"
                    value={params.biomeScale}
                    onChange={(e) => handleParamChange('biomeScale', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
