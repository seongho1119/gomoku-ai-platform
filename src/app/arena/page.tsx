'use client';

import { useState, useEffect } from 'react';
import GomokuBoard from '@/components/GomokuBoard';
import { createEmptyBoard, checkWin, isBoardFull, Player, getAvailableMoves } from '@/lib/gomoku';
import { RefreshCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ArenaPage() {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1); // 1: Human (Black), 2: AI (White)
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  const handleMove = (row: number, col: number) => {
    if (gameOver || board[row][col] !== 0 || currentPlayer !== 1) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 1;
    setBoard(newBoard);

    if (checkWin(newBoard, row, col, 1)) {
      setGameOver(true);
      setWinner(1);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      return;
    }

    if (isBoardFull(newBoard)) {
      setGameOver(true);
      return;
    }

    setCurrentPlayer(2);
  };

  // Simple Random AI fallback for Arena
  useEffect(() => {
    if (currentPlayer === 2 && !gameOver) {
      const timeout = setTimeout(() => {
        const moves = getAvailableMoves(board);
        if (moves.length > 0) {
          const move = moves[Math.floor(Math.random() * moves.length)];
          const newBoard = board.map(r => [...r]);
          newBoard[move.row][move.col] = 2;
          setBoard(newBoard);

          if (checkWin(newBoard, move.row, move.col, 2)) {
            setGameOver(true);
            setWinner(2);
          } else if (isBoardFull(newBoard)) {
            setGameOver(true);
          } else {
            setCurrentPlayer(1);
          }
        }
      }, 500); // 500ms delay for realism
      return () => clearTimeout(timeout);
    }
  }, [currentPlayer, board, gameOver]);

  const resetGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(1);
    setGameOver(false);
    setWinner(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <div className="flex-1 max-w-md">
        <div className="glass-panel p-6 rounded-2xl">
          <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
          <p className="text-slate-400 mb-8">You are playing as Black. Match 5 stones in a row to win.</p>
          
          <div className="bg-slate-800/50 p-6 rounded-xl mb-6 text-center">
            {gameOver ? (
              <div className="text-2xl font-bold text-white">
                {winner === 1 ? '🎉 You Win!' : winner === 2 ? '🤖 AI Wins!' : '🤝 Draw'}
              </div>
            ) : (
              <div className="text-xl font-medium text-slate-300">
                {currentPlayer === 1 ? 'Your Turn (Black)' : 'AI is thinking...'}
              </div>
            )}
          </div>

          <button 
            onClick={resetGame}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCcw className="w-5 h-5" /> Restart Game
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex justify-center">
        <GomokuBoard board={board} onMove={handleMove} disabled={gameOver || currentPlayer !== 1} />
      </div>
    </div>
  );
}
