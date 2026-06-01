'use client';

import { useState, useEffect, useRef } from 'react';
import { GomokuAI } from '@/lib/ai';
import { createEmptyBoard, checkWin, isBoardFull, Player, getAvailableMoves } from '@/lib/gomoku';
import GomokuBoard from '@/components/GomokuBoard';
import { Play, Square, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function StudioPage() {
  const [isTraining, setIsTraining] = useState(false);
  const [episodes, setEpisodes] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [wins, setWins] = useState(0);
  const [currentBoard, setCurrentBoard] = useState(createEmptyBoard());
  
  const aiRef = useRef<GomokuAI | null>(null);
  const isTrainingRef = useRef(false);

  useEffect(() => {
    aiRef.current = new GomokuAI();
  }, []);

  const runTrainingLoop = async () => {
    if (!aiRef.current) return;
    
    isTrainingRef.current = true;
    setIsTraining(true);
    
    let localEpisodes = episodes;
    let localWins = wins;

    while (isTrainingRef.current) {
      const board = createEmptyBoard();
      const experiences: {board: number[], reward: number}[] = [];
      let currentPlayer: Player = 1; // 1 is AI, 2 is Random
      let gameOver = false;
      let aiWon = false;

      while (!gameOver && isTrainingRef.current) {
        if (currentPlayer === 1) {
          // AI Turn
          const move = await aiRef.current.predictMove(board, 1);
          if (move.row !== -1) {
            board[move.row][move.col] = 1;
            experiences.push({
              board: aiRef.current.flattenBoard(board, 1),
              reward: 0 // Will be updated at end of game
            });
            if (checkWin(board, move.row, move.col, 1)) {
              gameOver = true;
              aiWon = true;
              localWins++;
            }
          } else { gameOver = true; }
        } else {
          // Random Agent Turn
          const moves = getAvailableMoves(board);
          if (moves.length > 0) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            board[move.row][move.col] = 2;
            if (checkWin(board, move.row, move.col, 2)) {
              gameOver = true;
            }
          } else { gameOver = true; }
        }

        if (!gameOver && isBoardFull(board)) gameOver = true;

        setCurrentBoard([...board.map(r => [...r])]);
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        
        // Small delay to make it visible
        await new Promise(r => setTimeout(r, 50));
      }

      if (isTrainingRef.current) {
        localEpisodes++;
        setEpisodes(localEpisodes);
        setWins(localWins);
        setWinRate(Math.round((localWins / localEpisodes) * 100));

        // Assign rewards and train
        const finalReward = aiWon ? 1 : -1;
        experiences.forEach(e => e.reward = finalReward);
        await aiRef.current.train(experiences);
      }
    }
    
    setIsTraining(false);
  };

  const stopTraining = () => {
    isTrainingRef.current = false;
    setIsTraining(false);
  };

  const uploadModel = async () => {
    if (!aiRef.current) return;
    
    // In a real app we'd extract tf.js weights here.
    // For this demo, we will simulate the file upload to our API
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `My Gomoku AI ${Math.floor(Math.random() * 1000)}`,
          author: "Guest Player",
          winrate: winRate,
          modelUrl: "https://mock-url.com/model.json" 
        })
      });
      
      const data = await res.json();
      if (data.success) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        alert("Model successfully saved to Cloud Database!");
      } else {
        alert("Failed to upload: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Error uploading model.");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1">
        <div className="glass-panel p-6 rounded-2xl mb-8">
          <h1 className="text-3xl font-bold mb-4">AI Studio</h1>
          <p className="text-slate-400 mb-6">Train your Gomoku AI by having it play against a random baseline. The AI will adjust its weights based on wins and losses.</p>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 p-4 rounded-xl text-center">
              <div className="text-slate-400 text-sm mb-1">Episodes</div>
              <div className="text-3xl font-bold text-white">{episodes}</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl text-center">
              <div className="text-slate-400 text-sm mb-1">Wins</div>
              <div className="text-3xl font-bold text-blue-400">{wins}</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl text-center">
              <div className="text-slate-400 text-sm mb-1">Win Rate</div>
              <div className="text-3xl font-bold text-emerald-400">{winRate}%</div>
            </div>
          </div>

          <div className="flex gap-4">
            {!isTraining ? (
              <button 
                onClick={runTrainingLoop}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-5 h-5" /> Start Training
              </button>
            ) : (
              <button 
                onClick={stopTraining}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Square className="w-5 h-5" /> Stop Training
              </button>
            )}
            <button 
              onClick={uploadModel}
              disabled={episodes === 0 || isTraining}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-5 h-5" /> Upload
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex justify-center items-start pt-4">
        <GomokuBoard board={currentBoard} disabled={true} />
      </div>
    </div>
  );
}
