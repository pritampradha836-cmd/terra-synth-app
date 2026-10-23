/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine, GameState, GameTelemetrySnapshot } from './game/GameEngine';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { DataScienceWorkbench } from './components/DataScienceWorkbench';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { audioSystem } from './game/audio/ProceduralAudio';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [telemetry, setTelemetry] = useState<GameTelemetrySnapshot | null>(null);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Engine once
    const engine = new GameEngine(containerRef.current);
    engineRef.current = engine;

    engine.onStateChange = (newState) => {
      setGameState(newState);
    };

    engine.onTelemetryUpdate = (snap) => {
      setTelemetry(snap);
    };

    // Global keyboard listener for Workbench toggle (Tab or Backquote)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab' || e.code === 'Backquote') {
        e.preventDefault();
        setIsWorkbenchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = () => {
    engineRef.current?.startGame();
  };

  const handleRestartGame = () => {
    engineRef.current?.restartGame();
  };

  const handlePause = () => {
    engineRef.current?.setState('PAUSED');
  };

  const handleResume = () => {
    engineRef.current?.setState('PLAYING');
  };

  const handleToggleMute = () => {
    const muted = audioSystem.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 3D WebGL Canvas Container (Mounted once, completely isolated) */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-0 cursor-crosshair"
      />

      {/* Title Screen Overlay */}
      {gameState === 'TITLE' && (
        <TitleScreen
          onStart={handleStartGame}
          onOpenDataScience={() => setIsWorkbenchOpen(true)}
        />
      )}

      {/* Active Playing HUD */}
      {gameState === 'PLAYING' && engineRef.current && (
        <GameHUD
          engine={engineRef.current}
          telemetry={telemetry}
          onOpenDataScience={() => setIsWorkbenchOpen(true)}
          onPause={handlePause}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Simulation Paused Modal */}
      {gameState === 'PAUSED' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestartGame}
          onOpenDataScience={() => setIsWorkbenchOpen(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Game Over Modal */}
      {gameState === 'GAMEOVER' && engineRef.current && (
        <GameOverModal
          stats={engineRef.current.player.stats}
          onRestart={handleRestartGame}
          onOpenDataScience={() => setIsWorkbenchOpen(true)}
        />
      )}

      {/* Data Science Telemetry & Optimization Workbench */}
      {engineRef.current && (
        <DataScienceWorkbench
          engine={engineRef.current}
          telemetry={telemetry}
          isOpen={isWorkbenchOpen}
          onClose={() => setIsWorkbenchOpen(false)}
        />
      )}
    </div>
  );
}
