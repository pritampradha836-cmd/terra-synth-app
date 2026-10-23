import React, { useEffect } from 'react';
import { Play, Sparkles, Sliders, Shield, Zap } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  onOpenDataScience: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, onOpenDataScience }) => {
  // Listen for Enter or Space to start
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between p-6 md:p-12 pointer-events-none select-none">
      {/* Top Bar Spec Badges */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-xs font-mono-code text-cyan-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>PROCL-SYS v4.8 // INFINITE TERRAIN ENGINE</span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono-code text-slate-400">
          <span className="hidden md:inline">QUADTREE STREAMING // 60 FPS SIMULATION</span>
          <button
            onClick={onOpenDataScience}
            className="px-3 py-1.5 rounded bg-slate-900/80 border border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-white pointer-events-auto transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" /> DATA SCIENCE BENCH
          </button>
        </div>
      </div>

      {/* Hero Centerpiece: Bespoke inline SVG Title Lockup */}
      <div className="flex flex-col items-center justify-center text-center my-auto max-w-3xl mx-auto space-y-6">
        <div className="w-full max-w-xl px-4">
          <svg
            viewBox="0 0 640 120"
            className="w-full h-auto drop-shadow-[0_0_35px_rgba(56,189,248,0.45)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
              <linearGradient id="glowLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            {/* Tech grid markings */}
            <path d="M 40 10 L 600 10" stroke="url(#glowLine)" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
            <path d="M 40 110 L 600 110" stroke="url(#glowLine)" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />

            {/* Main Title typography */}
            <text
              x="50%"
              y="74"
              textAnchor="middle"
              fill="url(#titleGrad)"
              fontFamily="'Rajdhani', sans-serif"
              fontWeight="800"
              fontSize="68"
              letterSpacing="7"
            >
              TERRA-SYNTH
            </text>

            <text
              x="50%"
              y="102"
              textAnchor="middle"
              fill="#94a3b8"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="600"
              fontSize="12"
              letterSpacing="10"
            >
              PROCEDURAL FRONTIER &amp; TELEMETRY
            </text>
          </svg>
        </div>

        <p className="text-sm md:text-base text-slate-300 max-w-lg mx-auto font-medium leading-relaxed drop-shadow">
          Traverse an evolving, boundless world generated in real-time. Battle cybernetic constructs, uplink ancient data shrines, and calibrate procedural mathematics with live data science tools.
        </p>

        {/* Primary Start CTA */}
        <div className="pt-2">
          <button
            onClick={onStart}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-extrabold text-base tracking-widest uppercase rounded-lg shadow-xl shadow-cyan-500/25 flex items-center gap-3 pointer-events-auto transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>COMMENCE SCAN (ENTER / SPACE)</span>
          </button>
        </div>
      </div>

      {/* Bottom Flat Control-Hint Line (Game Craft Guideline) */}
      <div className="flex flex-col md:flex-row items-center justify-between text-xs font-mono-code text-slate-400 border-t border-slate-800/80 pt-4 px-2">
        <span className="text-cyan-300/90 font-medium">
          WASD Move · Click/J Attack · Space Jump · Shift Dash · Q Shockwave · E Parry/Uplink · Tab Workbench · Esc Pause
        </span>
        <span className="text-slate-500 hidden md:inline">
          AUTONOMOUS SPATIAL HASHING // SIMPLEX MULTIFRACTAL
        </span>
      </div>
    </div>
  );
};
