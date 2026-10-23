import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Sliders } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenDataScience: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenDataScience,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/75 pointer-events-auto">
      <div className="w-full max-w-sm bg-slate-950/95 border border-cyan-500/30 rounded-xl p-6 shadow-2xl text-center space-y-5">
        <div>
          <h2 className="text-xl font-extrabold tracking-widest text-cyan-300 uppercase">
            SIMULATION PAUSED
          </h2>
          <p className="text-xs font-mono-code text-slate-400 mt-1">
            EXPLORATION STATE FROZEN
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onResume}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm tracking-wider uppercase rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" /> RESUME SIMULATION
          </button>

          <button
            onClick={onOpenDataScience}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-mono-code text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-cyan-400" /> DATA SCIENCE WORKBENCH
          </button>

          <button
            onClick={onToggleMute}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono-code text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            {isMuted ? 'UNMUTE AUDIO (M)' : 'MUTE AUDIO (M)'}
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 bg-slate-900/60 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 font-mono-code text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> RESTART FROM ORIGIN
          </button>
        </div>
      </div>
    </div>
  );
};
