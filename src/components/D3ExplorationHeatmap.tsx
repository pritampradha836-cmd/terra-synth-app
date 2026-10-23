import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GameEngine } from '../game/GameEngine';
import { BIOMES, BiomeType } from '../game/procedural/BiomeSystem';
import { Compass, Footprints, Layers, RefreshCw, ZoomIn, Eye, Sparkles, AlertTriangle, Gauge, Download } from 'lucide-react';

interface D3ExplorationHeatmapProps {
  engine: GameEngine;
  onDownloadData?: () => void;
}

export const D3ExplorationHeatmap: React.FC<D3ExplorationHeatmapProps> = ({ engine, onDownloadData }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [selectedBiomeFilter, setSelectedBiomeFilter] = useState<BiomeType | 'ALL'>('ALL');
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showFpsDipsOverlay, setShowFpsDipsOverlay] = useState(true);
  const [gridResolution, setGridResolution] = useState<number>(28);
  const [colorScheme, setColorScheme] = useState<'TURBO' | 'PLASMA' | 'INFERNO' | 'CYBER'>('TURBO');

  // Trigger state refresh for live rendering
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(Date.now());
    }, 400); // 2.5 FPS update for D3 chart
    return () => clearInterval(interval);
  }, []);

  // Main D3 Rendering Effect
  useEffect(() => {
    if (!svgRef.current) return;

    const tracker = engine.dsEngine.explorationTracker;
    const biomeSystem = engine.biomeSystem;
    const playerPos = engine.player.position;

    // Retrieve density data from tracker
    const densityData = tracker.getDensityGrid(gridResolution, gridResolution, biomeSystem);
    const trajectory = tracker.trajectory;
    const bounds = densityData.bounds;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean redraw

    const width = 640;
    const height = 480;
    const margin = { top: 25, right: 35, bottom: 45, left: 55 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Define defs (Glow filters and gradients)
    const defs = svg.append('defs');

    // Glow filter
    const glowFilter = defs.append('filter')
      .attr('id', 'heatGlow')
      .attr('x', '-30%')
      .attr('y', '-30%')
      .attr('width', '160%')
      .attr('height', '160%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Color Scales
    let interpolator = d3.interpolateTurbo;
    if (colorScheme === 'PLASMA') interpolator = d3.interpolatePlasma;
    else if (colorScheme === 'INFERNO') interpolator = d3.interpolateInferno;
    else if (colorScheme === 'CYBER') interpolator = (t: number) => d3.interpolateCool(1 - t);

    const maxDensity = Math.max(1, densityData.maxDensity);
    const colorScale = d3.scaleSequential(interpolator).domain([0, maxDensity]);

    // Spatial Scales
    const xScale = d3.scaleLinear()
      .domain([bounds.minX, bounds.maxX])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([bounds.minZ, bounds.maxZ])
      .range([innerHeight, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Background cartographic gridlines
    const xGrid = d3.axisBottom(xScale)
      .ticks(7)
      .tickSize(-innerHeight)
      .tickFormat(() => '');

    const yGrid = d3.axisLeft(yScale)
      .ticks(7)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid x-grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xGrid)
      .selectAll('line')
      .attr('stroke', 'rgba(51, 65, 85, 0.4)')
      .attr('stroke-dasharray', '2,3');

    g.append('g')
      .attr('class', 'grid y-grid')
      .call(yGrid)
      .selectAll('line')
      .attr('stroke', 'rgba(51, 65, 85, 0.4)')
      .attr('stroke-dasharray', '2,3');

    g.selectAll('.domain').attr('stroke', '#334155');

    // Filter density cells if a biome filter is selected
    const cellsToRender = selectedBiomeFilter === 'ALL'
      ? densityData.grid
      : densityData.grid.filter(c => c.biome === selectedBiomeFilter);

    const cellW = innerWidth / gridResolution;
    const cellH = innerHeight / gridResolution;

    // Tooltip helper
    const tooltip = d3.select(tooltipRef.current);

    // 1. Render Heatmap Cells
    g.selectAll('.heat-cell')
      .data(cellsToRender)
      .enter()
      .append('rect')
      .attr('class', 'heat-cell')
      .attr('x', d => xScale(d.x) - cellW / 2)
      .attr('y', d => yScale(d.z) - cellH / 2)
      .attr('width', Math.max(1, cellW - 1))
      .attr('height', Math.max(1, cellH - 1))
      .attr('rx', 2)
      .attr('fill', d => {
        if (d.density === 0) {
          // Unexplored territory shows subtle procedural biome ground tint
          const b = BIOMES[d.biome];
          return `#${b.primaryColor.getHexString()}`;
        }
        return colorScale(d.density);
      })
      .attr('opacity', d => (d.density === 0 ? 0.35 : 0.88))
      .attr('stroke', d => (d.density > 0 ? 'rgba(255,255,255,0.15)' : 'none'))
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const b = BIOMES[d.biome];
        tooltip
          .style('opacity', 1)
          .html(`
            <div class="font-bold text-cyan-300 text-xs">${b.name}</div>
            <div class="text-[11px] text-slate-300 mt-0.5">Coords: [${d.x}m, ${d.z}m]</div>
            <div class="text-[11px] text-slate-300">Elevation: <span class="text-amber-400 font-bold">${d.height}m</span></div>
            <div class="text-[11px] text-slate-300">Exploration Visits: <span class="text-emerald-400 font-bold">${d.density}</span></div>
            <div class="text-[10px] text-slate-400 mt-1">${d.density === 0 ? 'Uncharted Territory' : 'Surveyed Sector'}</div>
          `);
      })
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, svgRef.current);
        tooltip
          .style('left', `${mx + 15}px`)
          .style('top', `${my + 15}px`);
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0);
      });

    // 2. Trajectory Path (Catmull-Rom Spline)
    if (showTrajectory && trajectory.length > 1) {
      const lineGenerator = d3.line<{ x: number; z: number }>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.z))
        .curve(d3.curveCatmullRom.alpha(0.5));

      g.append('path')
        .datum(trajectory)
        .attr('class', 'trajectory-path')
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2.0)
        .attr('stroke-dasharray', '4,2')
        .attr('opacity', 0.85)
        .attr('d', lineGenerator);

      // Trajectory breadcrumb nodes
      g.selectAll('.trail-dot')
        .data(trajectory.filter((_, i) => i % 6 === 0))
        .enter()
        .append('circle')
        .attr('class', 'trail-dot')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.z))
        .attr('r', 2)
        .attr('fill', '#bae6fd')
        .attr('opacity', 0.6);
    }

    // 3. Shrines on the exploration map
    const shrines = Array.from(engine.shrineManager.shrines.values());
    g.selectAll('.shrine-marker')
      .data(shrines)
      .enter()
      .append('polygon')
      .attr('points', d => {
        const cx = xScale(d.x);
        const cy = yScale(d.z);
        return `${cx},${cy - 6} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`;
      })
      .attr('fill', d => (d.isActivated ? '#38bdf8' : '#f59e0b'))
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`
            <div class="font-bold text-amber-300 text-xs">${d.isActivated ? 'Uplinked Ancient Relic' : 'Dormant Relic'}</div>
            <div class="text-[11px] text-slate-300">Coords: [${Math.round(d.x)}, ${Math.round(d.z)}]</div>
            <div class="text-[10px] text-slate-400">Status: ${d.isActivated ? 'Active' : 'Awaiting Uplink'}</div>
          `);
      })
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, svgRef.current);
        tooltip.style('left', `${mx + 15}px`).style('top', `${my + 15}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', 0));

    // 3.5. Real-Time FPS Dips Overlay (Lag-Inducing Procedural Asset Markers)
    if (showFpsDipsOverlay && tracker.fpsDips.length > 0) {
      const dipsGroup = g.append('g').attr('class', 'fps-dips-overlay');

      // Outer pulsating danger aura for FPS dips
      dipsGroup.selectAll('.fps-dip-pulse')
        .data(tracker.fpsDips)
        .enter()
        .append('circle')
        .attr('class', 'fps-dip-pulse')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.z))
        .attr('r', d => (d.severity === 'CRITICAL' ? 14 : d.severity === 'HEAVY' ? 11 : 8))
        .attr('fill', d => (
          d.severity === 'CRITICAL'
            ? 'rgba(244, 63, 94, 0.25)'
            : d.severity === 'HEAVY'
            ? 'rgba(249, 115, 22, 0.25)'
            : 'rgba(234, 179, 8, 0.2)'
        ))
        .attr('stroke', d => (
          d.severity === 'CRITICAL' ? '#f43f5e' : d.severity === 'HEAVY' ? '#f97316' : '#eab308'
        ))
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2');

      // Core FPS dip warning point
      dipsGroup.selectAll('.fps-dip-marker')
        .data(tracker.fpsDips)
        .enter()
        .append('circle')
        .attr('class', 'fps-dip-marker')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.z))
        .attr('r', 4.5)
        .attr('fill', d => (
          d.severity === 'CRITICAL' ? '#f43f5e' : d.severity === 'HEAVY' ? '#f97316' : '#eab308'
        ))
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.5)
        .attr('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const b = BIOMES[d.biome];
          tooltip
            .style('opacity', 1)
            .html(`
              <div class="flex items-center gap-1.5 font-bold text-rose-400 text-xs uppercase">
                <span>⚠ FPS DIP DETECTED</span>
                <span class="px-1 py-0.5 text-[9px] rounded bg-rose-950/80 border border-rose-500/50">${d.severity}</span>
              </div>
              <div class="text-[11px] text-slate-200 mt-1 font-bold">
                <span class="text-rose-300 font-mono-code">${d.fps} FPS</span>
                <span class="text-slate-400 font-normal"> · </span>
                <span class="text-amber-300 font-mono-code">${d.frameTimeMs} ms</span>
              </div>
              <div class="text-[11px] text-slate-300 mt-1">Coords: [${d.x}m, ${d.z}m] (Elev: ${d.y}m)</div>
              <div class="text-[11px] text-slate-300">Biome: <span class="text-cyan-300 font-semibold">${b?.name ?? d.biome}</span></div>
              <div class="mt-1.5 pt-1 border-t border-slate-700/60">
                <span class="text-[10px] text-slate-400 uppercase tracking-wide block">Suspected Lag Cause:</span>
                <span class="text-[11px] text-rose-300 font-bold block">${d.lagSource}</span>
              </div>
            `);
        })
        .on('mousemove', (event) => {
          const [mx, my] = d3.pointer(event, svgRef.current);
          tooltip.style('left', `${mx + 15}px`).style('top', `${my + 15}px`);
        })
        .on('mouseleave', () => tooltip.style('opacity', 0));
    }

    // 4. Current Player Position Marker (Radar Ping)
    const px = xScale(playerPos.x);
    const py = yScale(playerPos.z);

    // Radar ping ring
    g.append('circle')
      .attr('cx', px)
      .attr('cy', py)
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.7);

    // Center dot
    g.append('circle')
      .attr('cx', px)
      .attr('cy', py)
      .attr('r', 4.5)
      .attr('fill', '#ffffff')
      .attr('stroke', '#0284c7')
      .attr('stroke-width', 2);

    // Heading indicator tick
    const headingAngle = engine.player.rotationY;
    const headX = px + Math.sin(headingAngle) * 9;
    const headY = py - Math.cos(headingAngle) * 9;
    g.append('line')
      .attr('x1', px)
      .attr('y1', py)
      .attr('x2', headX)
      .attr('y2', headY)
      .attr('stroke', '#facc15')
      .attr('stroke-width', 2);

    // 5. Axes & Styling
    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat(d => `${d}m`);

    const yAxis = d3.axisLeft(yScale)
      .ticks(6)
      .tickFormat(d => `${d}m`);

    const xAxisGroup = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', "'JetBrains Mono', monospace");

    xAxisGroup.selectAll('line').attr('stroke', '#475569');

    const yAxisGroup = g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    yAxisGroup.selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', "'JetBrains Mono', monospace");

    yAxisGroup.selectAll('line').attr('stroke', '#475569');

    // Axis Labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', "'JetBrains Mono', monospace")
      .text('WORLD X COORDINATE (METERS)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', "'JetBrains Mono', monospace")
      .text('WORLD Z COORDINATE (METERS)');

    // 6. Color Legend Bar
    const legendWidth = 140;
    const legendHeight = 8;
    const legendX = innerWidth - legendWidth;
    const legendY = -15;

    const legendGrad = defs.append('linearGradient')
      .attr('id', 'heatLegendGrad')
      .attr('x1', '0%')
      .attr('x2', '100%');

    legendGrad.append('stop').attr('offset', '0%').attr('stop-color', interpolator(0));
    legendGrad.append('stop').attr('offset', '50%').attr('stop-color', interpolator(0.5));
    legendGrad.append('stop').attr('offset', '100%').attr('stop-color', interpolator(1));

    const legendG = g.append('g').attr('transform', `translate(${legendX},${legendY})`);
    legendG.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('rx', 2)
      .attr('fill', 'url(#heatLegendGrad)');

    legendG.append('text')
      .attr('x', 0)
      .attr('y', -3)
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .attr('font-family', "'JetBrains Mono', monospace")
      .text('0 Visits');

    legendG.append('text')
      .attr('x', legendWidth)
      .attr('y', -3)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .attr('font-family', "'JetBrains Mono', monospace")
      .text(`${maxDensity} Max Density`);

  }, [engine, lastUpdated, gridResolution, colorScheme, selectedBiomeFilter, showTrajectory, showFpsDipsOverlay]);

  // Exploration Summary Metrics
  const tracker = engine.dsEngine.explorationTracker;
  const biomeStats = tracker.getBiomeStats();
  const surveyedSectors = tracker.densityMap.size;
  const territoryM2 = surveyedSectors * (tracker.cellSize * tracker.cellSize);

  return (
    <div className="space-y-4">
      {/* Visual Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded border border-slate-800 text-xs font-mono-code">
        <div className="flex items-center gap-2">
          <Footprints className="w-4 h-4 text-cyan-400" />
          <span className="font-bold uppercase tracking-wider text-cyan-300">
            D3.js Real-time Exploration Density Heatmap
          </span>
        </div>

        {/* Options Toolbar */}
        <div className="flex items-center gap-3">
          {/* Biome Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Filter:</span>
            <select
              value={selectedBiomeFilter}
              onChange={(e) => setSelectedBiomeFilter(e.target.value as BiomeType | 'ALL')}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 outline-none cursor-pointer"
            >
              <option value="ALL">All Biomes</option>
              <option value="VERDANT_HIGHLANDS">Verdant Highlands</option>
              <option value="CRYSTALLINE_TUNDRA">Crystalline Tundra</option>
              <option value="OBSIDIAN_RIFT">Obsidian Rift</option>
              <option value="CYBER_AETHER">Cyber Aether</option>
            </select>
          </div>

          {/* Color Scheme */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Palette:</span>
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 outline-none cursor-pointer"
            >
              <option value="TURBO">Turbo Thermal</option>
              <option value="PLASMA">Plasma Glow</option>
              <option value="INFERNO">Inferno Core</option>
              <option value="CYBER">Cyber Matrix</option>
            </select>
          </div>

          {/* Trajectory Toggle */}
          <button
            onClick={() => setShowTrajectory(!showTrajectory)}
            className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
              showTrajectory
                ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-950 border-slate-700 text-slate-400'
            }`}
          >
            {showTrajectory ? 'Trail: ON' : 'Trail: OFF'}
          </button>

          {/* FPS Dips Overlay Checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-950 px-2.5 py-1 rounded border border-rose-500/40 hover:border-rose-400 text-rose-300 transition-colors select-none">
            <input
              type="checkbox"
              checked={showFpsDipsOverlay}
              onChange={(e) => setShowFpsDipsOverlay(e.target.checked)}
              className="accent-rose-500 w-3.5 h-3.5 cursor-pointer rounded"
            />
            <span className="font-semibold text-xs flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              FPS Dips Overlay
            </span>
          </label>

          {/* Download CSV Data */}
          {onDownloadData && (
            <button
              onClick={onDownloadData}
              className="px-2.5 py-1 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export Telemetry & Biome Density as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          )}

          {/* Reset Tracker */}
          <button
            onClick={() => tracker.clear()}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Clear Exploration History & Dips"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Heatmap Visualization Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* D3 Heatmap SVG Container (3/4 cols) */}
        <div className="lg:col-span-3 bg-slate-950 p-3 rounded border border-slate-800 relative flex items-center justify-center overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 640 480"
            className="w-full max-h-[440px] h-auto drop-shadow-md select-none"
          />

          {/* Interactive D3 Tooltip */}
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none bg-slate-900/95 border border-cyan-500/50 p-2.5 rounded shadow-xl text-left font-mono-code transition-opacity duration-150 opacity-0 z-30 min-w-[170px]"
          />
        </div>

        {/* Biome Dwell Distribution & Territory Stats (1/4 cols) */}
        <div className="space-y-4">
          {/* Territory Stats Cards */}
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-2 font-mono-code text-xs">
            <span className="text-slate-400 uppercase text-[10px] block">Exploration Coverage</span>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-300">Surveyed Area:</span>
              <strong className="text-cyan-300 font-bold">{territoryM2.toLocaleString()} m²</strong>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-300">Grid Sectors:</span>
              <strong className="text-emerald-400 font-bold">{surveyedSectors}</strong>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-300">Total Dwell Time:</span>
              <strong className="text-amber-300 font-bold">{Math.round(tracker.totalDwellTimeSec)}s</strong>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-300">Distance Traversed:</span>
              <strong className="text-indigo-300 font-bold">{Math.round(tracker.totalDistanceTraveled)}m</strong>
            </div>
          </div>

          {/* Real-time FPS Dip & Asset Bottleneck Card */}
          <div className="p-3 bg-slate-900/60 border border-rose-500/30 rounded space-y-2.5 font-mono-code text-xs">
            <div className="flex items-center justify-between">
              <span className="text-rose-400 uppercase text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> FPS Dips & Asset Audit
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/40 text-rose-300 font-bold">
                {tracker.fpsDips.length} Incidents
              </span>
            </div>

            {tracker.fpsDips.length === 0 ? (
              <div className="space-y-1.5 py-1">
                <p className="text-[11px] text-slate-400 leading-tight">
                  No frame rate drops detected. Engine simulation running smoothly at ~60 FPS.
                </p>
                <button
                  onClick={() => {
                    const p = engine.player.position;
                    const b = engine.biomeSystem.getBiomeWeights(p.x, p.z).primaryBiome.id;
                    tracker.simulateFpsDip(p.x, p.y, p.z, b, 36);
                  }}
                  className="w-full py-1.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-700/50 text-rose-300 rounded text-[11px] transition-colors cursor-pointer"
                >
                  + Simulate Asset Stress Test
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {tracker.fpsDips.slice(-4).reverse().map((dip) => (
                    <div
                      key={dip.id}
                      className="p-1.5 rounded bg-slate-950/80 border border-rose-900/40 text-[10px] space-y-0.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-rose-400 font-bold">{dip.fps} FPS ({dip.frameTimeMs}ms)</span>
                        <span className="text-slate-500">[{dip.x}m, {dip.z}m]</span>
                      </div>
                      <div className="text-slate-300 truncate font-sans text-[11px]">
                        {dip.lagSource}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const p = engine.player.position;
                    const b = engine.biomeSystem.getBiomeWeights(p.x, p.z).primaryBiome.id;
                    tracker.simulateFpsDip(p.x, p.y, p.z, b, 32);
                  }}
                  className="w-full py-1 bg-slate-950 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-600/50 text-rose-300/80 hover:text-rose-200 rounded text-[10px] transition-colors cursor-pointer"
                >
                  + Record Coordinate Stress Check
                </button>
              </div>
            )}
          </div>

          {/* Biome Breakdown Progress Bars */}
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded space-y-3 font-mono-code text-xs">
            <span className="text-cyan-300 uppercase text-[10px] font-bold block tracking-wider">
              Biome Dwell Distribution
            </span>

            {biomeStats.map((stat) => (
              <div key={stat.biome} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300 truncate max-w-[120px]">{stat.name}</span>
                  <span className="text-cyan-400 font-bold">{stat.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stat.percentage}%`,
                      backgroundColor: stat.colorHex,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{stat.cellsVisited} sectors</span>
                  <span>{stat.dwellTimeSec}s</span>
                </div>
              </div>
            ))}
          </div>

          {/* Legend Guide Note */}
          <div className="p-2.5 bg-cyan-950/20 border border-cyan-800/30 rounded text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Sparkles className="w-3.5 h-3.5" /> Real-time Sampling:
            </div>
            <p className="leading-relaxed">
              D3 spatial kernel aggregates visits across the infinite procedural map. Yellow/red regions designate high tactical dwell clusters; blue dashed line tracks path trajectory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
