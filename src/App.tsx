import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Zap } from 'lucide-react';
import { GameEngine, GameState } from './game/Engine';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const engine = new GameEngine(canvasRef.current, {
      onScore: setScore,
      onState: setGameState,
      onCombo: setCombo
    });
    
    engineRef.current = engine;
    
    return () => {
      engine.destroy();
    };
  }, []);

  const startGame = () => {
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  };

  const isBerserk = combo >= 10;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100 overflow-hidden touch-none select-none">
      
      {/* Header Info */}
      <div className="w-full max-w-4xl flex justify-between items-end mb-4 px-2">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent italic flex items-center gap-2">
            Block Berserkr
            {isBerserk && <Zap className="w-6 h-6 text-yellow-400 animate-pulse" fill="currentColor" />}
          </h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide">EXHILARATING BLOCK ACTION</p>
        </div>
        
        <div className="text-right flex gap-6">
          <div className="flex flex-col items-end">
            <span className="text-slate-500 text-xs font-bold tracking-widest uppercase">Combo</span>
            <span className={`text-2xl font-mono font-bold transition-colors ${isBerserk ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
              {combo}x
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-500 text-xs font-bold tracking-widest uppercase">Score</span>
            <span className="text-2xl font-mono font-bold text-white">{score.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Game Stage */}
      <div className="relative w-full max-w-4xl aspect-[4/3] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800 shadow-orange-900/20 ring-1 ring-white/5">
        
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain block cursor-crosshair touch-none"
        />

        {/* Overlays */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-8 animate-pulse">
              <Zap className="w-12 h-12 text-red-500" fill="currentColor" />
            </div>
            <h2 className="text-4xl font-black italic tracking-tight mb-2">READY TO GO BERSERK?</h2>
            <p className="text-slate-400 mb-8 max-w-md text-center">Swipe or move your mouse to control the paddle. Build your combo to enter Berserk Mode.</p>
            <button 
              onClick={startGame}
              className="flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-full font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-600/30"
            >
              <Play className="w-6 h-6" fill="currentColor" />
              START GAME
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center z-10">
            <h2 className="text-6xl font-black italic tracking-tight mb-2 text-red-500 drop-shadow-lg">GAME OVER</h2>
            <p className="text-red-200 mb-2 font-mono text-xl">FINAL SCORE: {score.toLocaleString()}</p>
            <p className="text-red-400/60 mb-10 text-sm font-medium">YOUR RAGE WAS EXTINGUISHED</p>
            <button 
              onClick={startGame}
              className="flex items-center gap-3 bg-white text-red-950 px-8 py-4 rounded-full font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-900/50"
            >
              <RotateCcw className="w-6 h-6" />
              TRY AGAIN
            </button>
          </div>
        )}

        {gameState === 'CLEAR' && (
          <div className="absolute inset-0 bg-blue-950/90 backdrop-blur-md flex flex-col items-center justify-center z-10">
            <h2 className="text-6xl font-black italic tracking-tight mb-2 text-blue-400 drop-shadow-lg">STAGE CLEARED</h2>
            <p className="text-blue-200 mb-2 font-mono text-xl">FINAL SCORE: {score.toLocaleString()}</p>
            <p className="text-blue-400/60 mb-10 text-sm font-medium">TOTAL ANNIHILATION ACHIEVED</p>
            <button 
              onClick={startGame}
              className="flex items-center gap-3 bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-full font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-900/50"
            >
              <Play className="w-6 h-6" fill="currentColor" />
              PLAY AGAIN
            </button>
          </div>
        )}

      </div>
      
      {/* Mobile Hint */}
      <div className="mt-6 text-slate-500 text-sm font-medium">
        Works perfectly on mobile devices.
      </div>

    </div>
  );
}
