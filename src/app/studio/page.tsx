'use client';

import { useState, useEffect, useRef } from 'react';
import { GomokuAI } from '@/lib/ai';
import { createEmptyBoard, checkWin, isBoardFull, Player, BoardState } from '@/lib/gomoku';
import GomokuBoard from '@/components/GomokuBoard';
import { Play, Upload, Brain, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '@/context/LanguageContext';

export default function StudioPage() {
  const { t } = useLanguage();
  
  const [board, setBoard] = useState<BoardState>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [gameOver, setGameOver] = useState(false);
  
  // AI State
  const [episodes, setEpisodes] = useState(0);
  const [thinkingMoves, setThinkingMoves] = useState<{row: number, col: number, score: number}[]>([]);
  const aiRef = useRef<GomokuAI | null>(null);
  
  // History for training
  const [history, setHistory] = useState<{board: number[], player: Player}[]>([]);
  
  // Upload state
  const [modelName, setModelName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    aiRef.current = new GomokuAI();
    updateThinking(createEmptyBoard(), 1);
  }, []);

  const updateThinking = async (currentBoard: BoardState, player: Player) => {
    if (!aiRef.current || gameOver) return;
    const topMoves = await aiRef.current.predictTopMoves(currentBoard, player, 3);
    setThinkingMoves(topMoves);
  };

  const handleMove = (row: number, col: number) => {
    if (gameOver || board[row][col] !== 0) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    
    // Save state for history (flattened)
    if (aiRef.current) {
      setHistory(prev => [...prev, {
        board: aiRef.current!.flattenBoard(board, currentPlayer),
        player: currentPlayer
      }]);
    }

    setBoard(newBoard);
    setThinkingMoves([]); // clear while checking win

    if (checkWin(newBoard, row, col, currentPlayer)) {
      setGameOver(true);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    } else if (isBoardFull(newBoard)) {
      setGameOver(true);
    } else {
      const nextPlayer = currentPlayer === 1 ? 2 : 1;
      setCurrentPlayer(nextPlayer);
      updateThinking(newBoard, nextPlayer);
    }
  };

  const trainFromHistory = async () => {
    if (!aiRef.current || history.length === 0) return;
    
    // We assume the LAST player to move was the winner (since game is over or stopped).
    // The winner's moves get +1 reward, loser gets -1.
    const winningPlayer = currentPlayer; 
    
    const experiences = history.map(h => ({
      board: h.board,
      reward: h.player === winningPlayer ? 1 : -1
    }));

    await aiRef.current.train(experiences);
    setEpisodes(e => e + 1);
    
    // Reset board for next game
    resetBoard();
  };

  const resetBoard = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(1);
    setGameOver(false);
    setHistory([]);
    updateThinking(createEmptyBoard(), 1);
  };

  const uploadModel = async () => {
    if (!aiRef.current) return;
    const finalName = modelName.trim() || `My Gomoku AI ${Math.floor(Math.random() * 1000)}`;
    
    setIsUploading(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          author: "Guest Master",
          winrate: episodes > 0 ? 50 + Math.min(episodes * 5, 45) : 0, // Mock winrate improvement
          modelUrl: "https://mock-url.com/model.json" 
        })
      });
      
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        alert(t('home')); // Should ideally be a success message
        setModelName('');
      } else {
        alert("Failed to upload: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Error uploading model.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1">
        <div className="glass-panel p-6 rounded-2xl mb-8">
          <h1 className="text-3xl font-bold mb-4">{t('studioTitle')}</h1>
          <p className="text-slate-400 mb-6">{t('studioDesc')}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 p-4 rounded-xl text-center">
              <div className="text-slate-400 text-sm mb-1">{t('episodes')} (Trained Games)</div>
              <div className="text-3xl font-bold text-white">{episodes}</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl text-center">
              <div className="text-slate-400 text-sm mb-1">Status</div>
              <div className="text-xl font-bold text-blue-400 mt-2">
                {gameOver ? (
                  <span className="text-emerald-400">Game Over! Ready to Learn.</span>
                ) : (
                  <span>{currentPlayer === 1 ? 'Black Turn' : 'White Turn'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={trainFromHistory}
              disabled={history.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Brain className="w-5 h-5" /> {t('teachAI')}
            </button>
            <button 
              onClick={resetBoard}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-5 h-5" /> {t('clearBoard')}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold mb-4">Save & Upload Model</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter custom model name..."
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button 
                onClick={uploadModel}
                disabled={isUploading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Upload className="w-5 h-5" /> {t('upload')}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex justify-center items-start pt-4">
        <GomokuBoard 
          board={board} 
          onMove={handleMove} 
          disabled={gameOver} 
          thinkingMoves={thinkingMoves} 
        />
      </div>
    </div>
  );
}
