import React, { useEffect, useRef, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { Play, RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Flame } from 'lucide-react';

interface GameItem {
  id: number;
  label: string;
  category: 'survey' | 'annotation' | 'data-entry' | 'meme';
  x: number;
  y: number;
  speed: number;
  color: string;
}

export const TaskRushGame: React.FC = () => {
  const { completeTask } = useTasks();

  const [gameState, setGameState] = useState<'title' | 'playing' | 'gameover'>('title');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('gideon_rush_highscore') || '420', 10);
    } catch {
      return 420;
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Playfield state ref to avoid React state re-rendering inside loop
  const engineRef = useRef({
    items: [] as GameItem[],
    nextId: 1,
    score: 0,
    combo: 1,
    lives: 3,
    lastSpawn: 0,
    spawnInterval: 1400,
    isPlaying: false
  });

  // Web Audio Synth procedural sounds
  const playSynthSound = (type: 'match' | 'combo' | 'miss' | 'gameover') => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'match') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'combo') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(990, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'miss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Ignore audio failure
    }
  };

  const CATEGORY_CHIPS: { cat: 'survey' | 'annotation' | 'data-entry' | 'meme'; label: string; color: string; key: string }[] = [
    { cat: 'survey', label: 'I Survey [1]', color: '#3b82f6', key: '1' },
    { cat: 'annotation', label: 'AI Annotation [2]', color: '#10b981', key: '2' },
    { cat: 'data-entry', label: 'Data Entry [3]', color: '#f59e0b', key: '3' },
    { cat: 'meme', label: 'Meme Bounty [4]', color: '#ec4899', key: '4' }
  ];

  const TASK_SAMPLES: { label: string; category: 'survey' | 'annotation' | 'data-entry' | 'meme'; color: string }[] = [
    { label: 'Remote Work Survey', category: 'survey', color: '#3b82f6' },
    { label: 'Consumer Tech Poll', category: 'survey', color: '#3b82f6' },
    { label: 'Tag Street Pedestrians', category: 'annotation', color: '#10b981' },
    { label: 'Autonomous Car CV', category: 'annotation', color: '#10b981' },
    { label: 'Invoice Subtotal Digits', category: 'data-entry', color: '#f59e0b' },
    { label: 'Digitize Store Receipt', category: 'data-entry', color: '#f59e0b' },
    { label: 'Publish Relatable Meme', category: 'meme', color: '#ec4899' },
    { label: 'Viral Freelancer Joke', category: 'meme', color: '#ec4899' }
  ];

  const startGame = () => {
    engineRef.current = {
      items: [],
      nextId: 1,
      score: 0,
      combo: 1,
      lives: 3,
      lastSpawn: Date.now(),
      spawnInterval: 1400,
      isPlaying: true
    };
    setScore(0);
    setCombo(1);
    setLives(3);
    setGameState('playing');
    setRewardClaimed(false);
  };

  const handleClassify = (targetCategory: 'survey' | 'annotation' | 'data-entry' | 'meme') => {
    if (!engineRef.current.isPlaying) return;
    const items = engineRef.current.items;
    if (items.length === 0) return;

    // Triage the lowest item on the screen
    const targetItem = items[0];
    if (targetItem.category === targetCategory) {
      // Correct!
      const newScore = engineRef.current.score + 50 * engineRef.current.combo;
      const newCombo = engineRef.current.combo + 1;
      engineRef.current.score = newScore;
      engineRef.current.combo = newCombo;
      engineRef.current.items.shift();

      setScore(newScore);
      setCombo(newCombo);
      playSynthSound(newCombo > 3 ? 'combo' : 'match');
    } else {
      // Mistake!
      handleMiss();
    }
  };

  const handleMiss = () => {
    engineRef.current.combo = 1;
    engineRef.current.lives -= 1;
    setCombo(1);
    setLives(engineRef.current.lives);
    playSynthSound('miss');

    if (engineRef.current.lives <= 0) {
      engineRef.current.isPlaying = false;
      setGameState('gameover');
      if (engineRef.current.score > highScore) {
        setHighScore(engineRef.current.score);
        try {
          localStorage.setItem('gideon_rush_highscore', engineRef.current.score.toString());
        } catch {
          // ignore
        }
      }
    }
  };

  // Canvas Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      // Clear Canvas
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (engineRef.current.isPlaying) {
        // Spawn items
        const now = Date.now();
        if (now - engineRef.current.lastSpawn > engineRef.current.spawnInterval) {
          const sample = TASK_SAMPLES[Math.floor(Math.random() * TASK_SAMPLES.length)];
          const newItem: GameItem = {
            id: engineRef.current.nextId++,
            label: sample.label,
            category: sample.category,
            x: Math.random() * (canvas.width - 180) + 20,
            y: -30,
            speed: 120 + Math.min(engineRef.current.score / 20, 180),
            color: sample.color
          };
          engineRef.current.items.push(newItem);
          engineRef.current.lastSpawn = now;
          engineRef.current.spawnInterval = Math.max(700, 1400 - engineRef.current.score / 15);
        }

        // Draw and update falling task boxes
        for (let i = engineRef.current.items.length - 1; i >= 0; i--) {
          const item = engineRef.current.items[i];
          item.y += item.speed * dt;

          // Draw item box
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(item.x, item.y, 160, 44, 8);
          ctx.fill();
          ctx.stroke();

          // Text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(item.label, item.x + 80, item.y + 26);

          // Check hit bottom threshold
          if (item.y > canvas.height - 40) {
            engineRef.current.items.splice(i, 1);
            handleMiss();
          }
        }
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);

    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  // Keyboard shortcut listeners (1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        startGame();
      } else if (gameState === 'playing') {
        if (e.key === '1') handleClassify('survey');
        if (e.key === '2') handleClassify('annotation');
        if (e.key === '3') handleClassify('data-entry');
        if (e.key === '4') handleClassify('meme');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="relative w-full h-[560px] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between select-none">
      <canvas
        ref={canvasRef}
        width={700}
        height={560}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Top HUD Cluster */}
      <div className="relative z-10 p-5 flex items-center justify-between text-white pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Score</span>
            <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">{score}</span>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Combo</span>
              <span className="text-sm font-bold font-mono text-amber-400 tabular-nums">{combo}x</span>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lives</span>
            <div className="flex gap-1 mt-0.5">
              {[1, 2, 3].map((l) => (
                <div
                  key={l}
                  className={`w-2.5 h-2.5 rounded-full ${
                    l <= lives ? 'bg-rose-500 shadow-xs' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="text-slate-300 hover:text-white"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <span className="text-xs text-slate-400 font-mono">High: {highScore}</span>
        </div>
      </div>

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-950/80 backdrop-blur-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-2xl mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Gideon Taskmaster Rush
          </h2>
          <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
            Fast-paced micro-task classification! Sort incoming task requests into their correct category before they hit the deadline. Score 500+ points to claim a $1.50 cash bounty!
          </p>

          <button
            type="button"
            onClick={startGame}
            className="mt-6 flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm shadow-xl transition-all hover:scale-105 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Rush (Press Space)</span>
          </button>

          <div className="text-[11px] text-slate-500 mt-4 font-mono">
            Keys: [1] Survey · [2] Annotation · [3] Data Entry · [4] Meme
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-950/85 backdrop-blur-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <Trophy className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold">Shift Completed!</h2>
          <div className="text-3xl font-mono font-extrabold text-emerald-400 mt-1 tabular-nums">
            {score} Points
          </div>

          {score >= 500 && !rewardClaimed && (
            <button
              type="button"
              onClick={() => {
                completeTask('task-game-rush', 1.50, 'Taskmaster Rush 500+ High Score Bounty');
                setRewardClaimed(true);
              }}
              className="mt-3 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
            >
              Claim $1.50 Bonus to Wallet!
            </button>
          )}

          {rewardClaimed && (
            <span className="text-xs text-emerald-400 font-semibold mt-2">
              ✓ $1.50 credited to your Gideon Global Wallet!
            </span>
          )}

          <button
            type="button"
            onClick={startGame}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Play Again</span>
          </button>
        </div>
      )}

      {/* Bottom Category Triage Bar (Interactive Touch & Click) */}
      <div className="relative z-10 p-5 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
        <div className="grid grid-cols-4 gap-2.5 max-w-2xl mx-auto">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.cat}
              type="button"
              onClick={() => handleClassify(chip.cat)}
              className="p-3 rounded-xl border text-xs font-bold text-white transition-all active:scale-95 flex flex-col items-center justify-center shadow-lg"
              style={{
                backgroundColor: `${chip.color}25`,
                borderColor: chip.color
              }}
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
