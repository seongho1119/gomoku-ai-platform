'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import GomokuBoard from '@/components/GomokuBoard';
import { createEmptyBoard, checkWin, isBoardFull, Player, getAvailableMoves, BoardState } from '@/lib/gomoku';
import { GomokuAI } from '@/lib/ai';
import { RefreshCcw, Swords, User, Bot, Coins, Search, Shuffle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '@/context/LanguageContext';
import { useTokens } from '@/hooks/useTokens';

type ArenaMode = 'me_vs_myai' | 'me_vs_hubai' | 'myai_vs_hubai';

interface Model {
  id: number;
  name: string;
  author: string;
  winrate: number;
}

function ArenaContent() {
  const { t } = useLanguage();
  const tokens = useTokens();
  const searchParams = useSearchParams();
  
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1); 
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  
  // AI DB State
  const [models, setModels] = useState<Model[]>([]);
  const [selectedEnemy, setSelectedEnemy] = useState<Model | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBox, setShowSearchBox] = useState(false);

  // Modes
  const [arenaMode, setArenaMode] = useState<ArenaMode>('me_vs_myai');
  const [isInitializing, setIsInitializing] = useState(true);
  const [matchRunning, setMatchRunning] = useState(false);

  // Score tracking
  const [scores, setScores] = useState({
    me_vs_myai: { me: 0, ai: 0 },
    me_vs_hubai: { me: 0, ai: 0 },
    myai_vs_hubai: { myai: 0, hubai: 0 }
  });

  // AIs
  const myAiRef = useRef<GomokuAI | null>(null);
  const hubAiRef = useRef<GomokuAI | null>(null);
  const matchHistoryRef = useRef<{board: number[], player: Player}[]>([]);

  useEffect(() => {
    const initAIs = async () => {
      // 1. Fetch Models
      let fetchedModels: Model[] = [];
      try {
        const res = await fetch('/api/models');
        fetchedModels = await res.json();
        setModels(fetchedModels);
      } catch (err) {
        console.error("Failed to fetch models", err);
      }

      // 2. Determine Initial Opponent from Query Param
      const modelParam = searchParams.get('model');
      if (modelParam && fetchedModels.length > 0) {
        const found = fetchedModels.find(m => m.id.toString() === modelParam);
        if (found) {
          setSelectedEnemy(found);
          setArenaMode('me_vs_hubai'); // Auto switch to hub mode
        }
      } else if (fetchedModels.length > 0) {
        // Default to a random one if exists
        setSelectedEnemy(fetchedModels[0]);
      }

      // 3. Load My AI
      myAiRef.current = new GomokuAI();
      await myAiRef.current.loadMemory();

      // 4. Create Enemy AI
      hubAiRef.current = new GomokuAI('standard'); 
      
      setIsInitializing(false);
    };
    initAIs();
  }, [searchParams]);

  useEffect(() => {
    resetMatch();
  }, [arenaMode, selectedEnemy]);

  const resetMatch = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(1);
    setGameOver(false);
    setWinner(null);
    setMatchRunning(false);
    matchHistoryRef.current = [];
  };

  const selectRandomEnemy = () => {
    if (models.length > 0) {
      const random = models[Math.floor(Math.random() * models.length)];
      setSelectedEnemy(random);
      setSearchQuery('');
      setShowSearchBox(false);
    }
  };

  const filteredModels = models.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.author.toLowerCase().includes(searchQuery.toLowerCase()));

  // Human Move Handler
  const handleHumanMove = async (row: number, col: number) => {
    if (gameOver || board[row][col] !== 0 || currentPlayer !== 1 || matchRunning) return;
    if (arenaMode === 'myai_vs_hubai') return; 

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 1;
    setBoard(newBoard);

    if (checkWin(newBoard, row, col, 1)) {
      setGameOver(true);
      setWinner(1);
      updateScore(1);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      return;
    } else if (isBoardFull(newBoard)) {
      setGameOver(true);
      return;
    }

    setCurrentPlayer(2);
    setMatchRunning(true);
    
    setTimeout(async () => {
      const activeAi = arenaMode === 'me_vs_myai' ? myAiRef.current : hubAiRef.current;
      if (!activeAi) return;

      const aiMove = await activeAi.predictMove(newBoard, 2);
      
      if (aiMove.row !== -1) {
        const afterAiBoard = newBoard.map(r => [...r]);
        afterAiBoard[aiMove.row][aiMove.col] = 2;
        setBoard(afterAiBoard);

        if (checkWin(afterAiBoard, aiMove.row, aiMove.col, 2)) {
          setGameOver(true);
          setWinner(2);
          updateScore(2);
        } else if (isBoardFull(afterAiBoard)) {
          setGameOver(true);
        } else {
          setCurrentPlayer(1);
        }
      }
      setMatchRunning(false);
    }, 100);
  };

  // Spectator Mode
  const runAutoMatch = async () => {
    if (!myAiRef.current || !hubAiRef.current || matchRunning) return;
    if (arenaMode !== 'myai_vs_hubai') return;

    if (!tokens.consumeArenaToken()) {
      alert("Not enough Arena Tokens! Play 10 Manual Games in the Studio to earn 1 Arena Token.");
      return;
    }
    
    resetMatch();
    setMatchRunning(true);
    
    let currentBoard = createEmptyBoard();
    let turn: Player = 1;
    let isDone = false;

    while (!isDone) {
      const activeAi = turn === 1 ? myAiRef.current : hubAiRef.current;
      
      let move;
      if (Math.random() < 0.1) {
        const moves = getAvailableMoves(currentBoard);
        move = moves[Math.floor(Math.random() * moves.length)];
      } else {
        move = await activeAi.predictMove(currentBoard, turn);
      }

      if (move && move.row !== -1) {
        matchHistoryRef.current.push({
          board: activeAi.flattenBoard(currentBoard, turn),
          player: turn
        });
        
        currentBoard[move.row][move.col] = turn;
        
        if (checkWin(currentBoard, move.row, move.col, turn)) {
          isDone = true;
          setWinner(turn);
          setGameOver(true);
          updateScore(turn);
          if (turn === 1) {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          }
        } else if (isBoardFull(currentBoard)) {
          isDone = true;
          setGameOver(true);
        } else {
          turn = turn === 1 ? 2 : 1;
          setCurrentPlayer(turn);
        }
        
        setBoard([...currentBoard.map(r => [...r])]);
        await new Promise(r => setTimeout(r, 100));
      } else {
        isDone = true;
        setGameOver(true);
      }
    }
    
    if (winner !== null && myAiRef.current) {
      const experiences = matchHistoryRef.current.map(h => ({
        board: h.board,
        reward: h.player === winner ? 1 : -1
      }));
      await myAiRef.current.train(experiences);
      await myAiRef.current.saveMemory();
    }

    setMatchRunning(false);
  };

  const updateScore = (winPlayer: Player) => {
    setScores(prev => {
      const newScores = { ...prev };
      if (arenaMode === 'me_vs_myai') {
        if (winPlayer === 1) newScores.me_vs_myai.me++;
        else newScores.me_vs_myai.ai++;
      } else if (arenaMode === 'me_vs_hubai') {
        if (winPlayer === 1) newScores.me_vs_hubai.me++;
        else newScores.me_vs_hubai.ai++;
      } else if (arenaMode === 'myai_vs_hubai') {
        if (winPlayer === 1) newScores.myai_vs_hubai.myai++;
        else newScores.myai_vs_hubai.hubai++;
      }
      return newScores;
    });
  };

  if (isInitializing || !tokens.isLoaded) {
    return <div className="text-center py-20 text-xl font-bold animate-pulse text-emerald-400">Loading Arena...</div>;
  }

  const enemyName = selectedEnemy ? selectedEnemy.name : 'Unknown Hub AI';

  let p1Label = "Me (Black)";
  let p2Label = "AI (White)";
  let p1Score = 0;
  let p2Score = 0;

  if (arenaMode === 'me_vs_myai') {
    p2Label = "My AI (White)";
    p1Score = scores.me_vs_myai.me;
    p2Score = scores.me_vs_myai.ai;
  } else if (arenaMode === 'me_vs_hubai') {
    p2Label = `${enemyName} (White)`;
    p1Score = scores.me_vs_hubai.me;
    p2Score = scores.me_vs_hubai.ai;
  } else if (arenaMode === 'myai_vs_hubai') {
    p1Label = "My AI (Black)";
    p2Label = `${enemyName} (White)`;
    p1Score = scores.myai_vs_hubai.myai;
    p2Score = scores.myai_vs_hubai.hubai;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start justify-center max-w-6xl mx-auto">
      <div className="flex-1 max-w-md w-full">
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-3xl font-bold">{t('arenaTitle')}</h1>
            <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 border border-amber-500/30">
              <Coins className="w-4 h-4" /> Tokens: {tokens.arenaTokens}
            </div>
          </div>

          {/* AI Search & Randomizer */}
          <div className="mb-6 relative">
            <div className="flex gap-2">
              <button 
                onClick={() => setShowSearchBox(!showSearchBox)}
                className="flex-1 bg-black/40 border border-white/10 hover:border-emerald-500/50 py-3 px-4 rounded-lg text-left text-sm font-medium flex items-center gap-2 transition-colors text-slate-300"
              >
                <Search className="w-4 h-4 text-emerald-400" />
                {selectedEnemy ? selectedEnemy.name : 'Search Opponent AI...'}
              </button>
              <button 
                onClick={selectRandomEnemy}
                className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 hover:border-emerald-500 text-emerald-400 hover:text-white p-3 rounded-lg transition-all"
                title="Random Opponent"
              >
                <Shuffle className="w-5 h-5" />
              </button>
            </div>
            
            {showSearchBox && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto overflow-hidden">
                <div className="p-2 sticky top-0 bg-slate-800 border-b border-white/10">
                  <input 
                    type="text" 
                    placeholder="Type AI Name or Author..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col p-1">
                  {filteredModels.map(m => (
                    <button 
                      key={m.id}
                      onClick={() => { setSelectedEnemy(m); setShowSearchBox(false); }}
                      className="text-left px-4 py-3 hover:bg-white/5 rounded-lg transition-colors flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{m.name}</div>
                        <div className="text-xs text-slate-400">by {m.author}</div>
                      </div>
                      <div className="text-xs text-emerald-400 font-bold">{Math.round(m.winrate)}% WR</div>
                    </button>
                  ))}
                  {filteredModels.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">No AIs found</div>}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2 mb-8 bg-black/30 p-2 rounded-xl">
            <button 
              onClick={() => setArenaMode('me_vs_myai')}
              disabled={matchRunning}
              className={`py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-between transition-colors ${arenaMode === 'me_vs_myai' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-300'}`}
            >
              <div className="flex items-center gap-2"><User className="w-4 h-4"/> Me vs My AI</div>
              <span className="text-xs font-normal opacity-70">Free (Play)</span>
            </button>
            <button 
              onClick={() => setArenaMode('me_vs_hubai')}
              disabled={matchRunning || !selectedEnemy}
              className={`py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-between transition-colors ${arenaMode === 'me_vs_hubai' ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-slate-300'}`}
            >
              <div className="flex items-center gap-2"><User className="w-4 h-4"/> Me vs {enemyName}</div>
              <span className="text-xs font-normal opacity-70">Free (Play)</span>
            </button>
            <button 
              onClick={() => setArenaMode('myai_vs_hubai')}
              disabled={matchRunning || !selectedEnemy}
              className={`py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-between transition-colors ${arenaMode === 'myai_vs_hubai' ? 'bg-emerald-600 text-white' : 'hover:bg-white/5 text-slate-300'}`}
            >
              <div className="flex items-center gap-2"><Bot className="w-4 h-4"/> My AI vs {enemyName}</div>
              <span className="text-xs font-normal opacity-70 flex items-center gap-1">Cost: 1 <Coins className="w-3 h-3"/> (Spectate & Learn)</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 p-4 rounded-xl text-center border-2 border-blue-500/30">
              <div className="text-blue-400 font-bold mb-1 line-clamp-1">{p1Label}</div>
              <div className="text-3xl font-bold text-white">{p1Score} Wins</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl text-center border-2 border-slate-500/30">
              <div className="text-slate-400 font-bold mb-1 line-clamp-1">{p2Label}</div>
              <div className="text-3xl font-bold text-white">{p2Score} Wins</div>
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl mb-6 text-center h-24 flex items-center justify-center">
            {gameOver ? (
              <div className="text-xl font-bold text-white">
                {winner === 1 ? `🎉 ${p1Label.replace(' (Black)', '')} Wins!` : winner === 2 ? `💀 ${p2Label.replace(' (White)', '')} Wins!` : '🤝 Draw'}
              </div>
            ) : (
              <div className="text-lg font-medium text-slate-300">
                {matchRunning ? (
                  currentPlayer === 1 ? `${p1Label} is thinking...` : `${p2Label} is thinking...`
                ) : (
                  arenaMode === 'myai_vs_hubai' ? 'Click Start to spectate Bot Battle!' : 'Your turn! Click the board to start.'
                )}
              </div>
            )}
          </div>

          {arenaMode === 'myai_vs_hubai' ? (
            <button 
              onClick={runAutoMatch}
              disabled={matchRunning || tokens.arenaTokens <= 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors relative overflow-hidden group"
            >
               <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay group-hover:opacity-30 transition-opacity"></div>
              <Swords className="w-5 h-5" /> Start Auto Battle (Cost: 1 <Coins className="w-4 h-4 inline" />)
            </button>
          ) : (
            <button 
              onClick={resetMatch}
              disabled={matchRunning && currentPlayer === 2}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCcw className="w-5 h-5" /> Reset Board
            </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col justify-center">
        <GomokuBoard 
          board={board} 
          onMove={arenaMode !== 'myai_vs_hubai' ? handleHumanMove : undefined} 
          disabled={gameOver || matchRunning || (arenaMode !== 'myai_vs_hubai' && currentPlayer !== 1)} 
        />
      </div>
    </div>
  );
}

export default function ArenaPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>}>
      <ArenaContent />
    </Suspense>
  );
}
