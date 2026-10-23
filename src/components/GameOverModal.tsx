import React from 'react';
import { RotateCcw, Trophy, Award, Sliders } from 'lucide-react';
import { PlayerStats } from '../game/entities/Player';

interface GameOverModalProps {
  stats: PlayerStats;
  onRestart: () => void;
  onOpenDataScience: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  onRestart,
  onOpenDataScience,
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 pointer-events-auto">
      <div className="w-full max-w-md bg-slate-950/95 border border-rose-500/40 rounded-xl p-6 shadow-2xl text-center space-y-6">
        <div>
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-400">
            <RotateCcw className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black tracking-widest text-rose-400 uppercase">
            HULL BREACHED
          </h2>
          <p className="text-xs font-mono-code text-slate-400 mt-1">
            EXPLORATION CONCLUDED // TELEMETRY PRESERVED
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs font-mono-code">
          <div className="p-2">
            <span className="text-slate-400 text-[10px] block">TOTAL SCORE</span>
            <strong className="text-emerald-400 text-sm block mt-0.5">{stats.score.toLocaleString()}</strong>
          </div>
          <div className="p-2">
            <span className="text-slate-400 text-[10px] block">CORES EXTRACTED</span>
            <strong className="text-cyan-400 text-sm block mt-0.5">{stats.cores}</strong>
          </div>
          <div className="p-2">
            <span className="text-slate-400 text-[10px] block">SHRINES UPLINKED</span>
            <strong className="text-amber-400 text-sm block mt-0.5">{stats.shrinesActivated}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onRestart}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-sm tracking-wider uppercase rounded-lg shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 fill-slate-950" /> RECONSTITUTE PROBE
          </button>

          <button
            onClick={onOpenDataScience}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-mono-code text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-cyan-400" /> INSPECT TELEMETRY ARCHIVE
          </button>
        </div>
      </div>
    </div>
  );
};
