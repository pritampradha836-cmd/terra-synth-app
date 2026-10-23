import React from 'react';
import { GameEngine, GameTelemetrySnapshot } from '../game/GameEngine';
import { BIOMES } from '../game/procedural/BiomeSystem';
import { audioSystem } from '../game/audio/ProceduralAudio';
import { Volume2, VolumeX, Sliders, Shield, Zap, Heart, Compass, Sparkles, Pause } from 'lucide-react';

interface GameHUDProps {
  engine: GameEngine;
  telemetry: GameTelemetrySnapshot | null;
  onOpenDataScience: () => void;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  engine,
  telemetry,
  onOpenDataScience,
  onPause,
  isMuted,
  onToggleMute,
}) => {
  const player = engine.player;
  const stats = player.stats;
  const nearbyShrine = engine.shrineManager.nearbyShrine;

  const currentBiome = telemetry ? BIOMES[telemetry.biome] : BIOMES.VERDANT_HIGHLANDS;

  const hpPct = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, (stats.shield / stats.maxShield) * 100));
  const energyPct = Math.max(0, Math.min(100, (stats.energy / stats.maxEnergy) * 100));

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-4 md:p-6">
      {/* Top Perimeter Status Cluster */}
      <div className="flex items-start justify-between w-full">
        {/* Left Cluster: Player Vital telemetry */}
        <div className="w-64 space-y-2 bg-slate-950/80 border border-slate-800/80 p-3 rounded-lg shadow-lg">
          {/* Health */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono-code text-slate-300">
              <span className="flex items-center gap-1.5 text-rose-400">
                <Heart className="w-3.5 h-3.5 fill-rose-500" /> HULL
              </span>
              <span className="tabular-nums font-bold text-slate-100">
                {Math.round(stats.hp)} / {stats.maxHp}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Shield */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono-code text-slate-300">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Shield className="w-3.5 h-3.5 fill-cyan-500" /> SHIELD
              </span>
              <span className="tabular-nums font-bold text-slate-100">
                {Math.round(stats.shield)} / {stats.maxShield}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-150"
                style={{ width: `${shieldPct}%` }}
              />
            </div>
          </div>

          {/* Energy */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono-code text-slate-300">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Zap className="w-3.5 h-3.5 fill-amber-500" /> REACTOR
              </span>
              <span className="tabular-nums font-bold text-slate-100">
                {Math.round(stats.energy)} / {stats.maxEnergy}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-150"
                style={{ width: `${energyPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Cluster: Biome, Coordinates & Cores */}
        <div className="flex flex-col items-end gap-2">
          {/* Biome Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 shadow-lg text-xs font-mono-code">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: `#${currentBiome.secondaryColor.getHexString()}` }}
            />
            <span className="text-slate-200 font-bold uppercase">{currentBiome.name}</span>
          </div>

          {/* Coordinates & Uplinks */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg text-right font-mono-code text-xs space-y-1 shadow-lg">
            <div className="text-slate-400 flex items-center justify-end gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="tabular-nums text-slate-200">
                X:{telemetry?.playerCoords.x ?? 0} Y:{telemetry?.playerCoords.y ?? 0} Z:{telemetry?.playerCoords.z ?? 0}
              </span>
            </div>
            <div className="text-slate-400">
              QUANTUM CORES: <span className="tabular-nums font-bold text-cyan-300">{stats.cores}</span>
            </div>
            <div className="text-slate-400">
              RELIC UPLINKS: <span className="tabular-nums font-bold text-amber-300">{stats.shrinesActivated}</span>
            </div>
            <div className="text-slate-400">
              SCORE: <span className="tabular-nums font-bold text-emerald-400">{stats.score.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Interactive Toast (When near Shrine) */}
      {nearbyShrine && !nearbyShrine.isActivated && (
        <div className="my-auto mx-auto px-5 py-2.5 bg-slate-950/90 border border-amber-500/60 rounded-lg shadow-2xl text-center space-y-0.5 animate-bounce">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            ANCIENT RELIC DETECTED
          </div>
          <p className="text-xs font-mono-code text-slate-200">
            PRESS <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 rounded font-bold text-amber-300">E</span> TO UPLINK TELEMETRY &amp; GAIN PERK
          </p>
        </div>
      )}

      {/* Unified Bottom Dock (Three.js skill directive: bottom dock, zero viewport occlusion) */}
      <div className="w-full flex items-center justify-between">
        <div className="hidden md:flex items-center gap-3 text-xs font-mono-code text-slate-400 bg-slate-950/80 border border-slate-800/80 px-3 py-1.5 rounded-lg shadow-lg">
          <span>WASD: Move</span>
          <span>·</span>
          <span>Click/J: Combo Attack</span>
          <span>·</span>
          <span>Shift: Dash</span>
          <span>·</span>
          <span>Q: Shockwave</span>
          <span>·</span>
          <span>E: Parry</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto ml-auto">
          <button
            onClick={onOpenDataScience}
            className="px-3.5 py-2 bg-slate-900/90 hover:bg-cyan-950/80 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 font-mono-code text-xs font-semibold rounded-lg flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>DATA SCIENCE BENCH [TAB]</span>
          </button>

          <button
            onClick={onToggleMute}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg shadow-lg transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={onPause}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg shadow-lg transition-colors cursor-pointer"
            title="Pause Game (Esc / P)"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
