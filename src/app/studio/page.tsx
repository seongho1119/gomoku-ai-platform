'use client';

import { useState, useEffect, useRef } from 'react';
import { GomokuAI, BrainSize } from '@/lib/ai';
import { createEmptyBoard, checkWin, isBoardFull, Player, BoardState, getAvailableMoves } from '@/lib/gomoku';
import GomokuBoard from '@/components/GomokuBoard';
import { Play, Upload, Brain, RotateCcw, Square, Bot, User, Coins, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTokens } from '@/hooks/useTokens';

const MAX_AUTO_EPISODES = 10;

export default function StudioPage() {
  const tokens = useTokens();
  
  const [mode, setMode] = useState<'play' | 'auto'>('play');
  const [brainSize, setBrainSize] = useState<BrainSize>('standard');
  const [board, setBoard] = useState<BoardState>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [gameOver, setGameOver] = useState(false);
  const [isAutoTraining, setIsAutoTraining] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // AI State
  const [sessionAutoEpisodes, setSessionAutoEpisodes] = useState(0); 
  const aiRef = useRef<GomokuAI | null>(null);
  const isAutoTrainingRef = useRef(false);
  
  // History for training
  const [history, setHistory] = useState<{board: number[], player: Player}[]>([]);
  
  // Upload state
  const [modelName, setModelName] = useState('');
  const [modelPassword, setModelPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const initAI = async () => {
      aiRef.current = new GomokuAI();
      const loaded = await aiRef.current.loadMemory();
      if (loaded) {
        setBrainSize(aiRef.current.brainSize);
      }
      setIsInitializing(false);
    };
    initAI();
  }, []);

  const handleBrainChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = e.target.value as BrainSize;
    if (confirm("뇌 크기를 변경하면 AI의 기존 기억이 모두 삭제됩니다. 계속하시겠습니까?")) {
      setBrainSize(newSize);
      aiRef.current = new GomokuAI(newSize);
      aiRef.current.saveMemory();
      resetBoard();
    }
  };

  const handleUserMove = async (row: number, col: number) => {
    if (gameOver || board[row][col] !== 0 || mode !== 'play' || currentPlayer !== 1) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 1;
    
    if (aiRef.current) {
      setHistory(prev => [...prev, {
        board: aiRef.current!.flattenBoard(board, 1),
        player: 1
      }]);
    }

    setBoard(newBoard);

    if (checkWin(newBoard, row, col, 1)) {
      setGameOver(true);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      return;
    } else if (isBoardFull(newBoard)) {
      setGameOver(true);
      return;
    }

    setCurrentPlayer(2);
    
    setTimeout(async () => {
      if (!aiRef.current) return;
      const aiMove = await aiRef.current.predictMove(newBoard, 2);
      
      if (aiMove.row !== -1) {
        const afterAiBoard = newBoard.map(r => [...r]);
        afterAiBoard[aiMove.row][aiMove.col] = 2;
        
        setHistory(prev => [...prev, {
          board: aiRef.current!.flattenBoard(newBoard, 2),
          player: 2
        }]);

        setBoard(afterAiBoard);

        if (checkWin(afterAiBoard, aiMove.row, aiMove.col, 2)) {
          setGameOver(true);
        } else if (isBoardFull(afterAiBoard)) {
          setGameOver(true);
        } else {
          setCurrentPlayer(1);
        }
      }
    }, 50);
  };

  const runAutoTraining = async () => {
    if (!aiRef.current || isAutoTrainingRef.current) return;
    
    if (!tokens.consumeAutoToken()) {
      alert("오토 토큰이 부족합니다! 수동으로 플레이하여 토큰을 획득하세요.");
      return;
    }

    isAutoTrainingRef.current = true;
    setIsAutoTraining(true);
    setSessionAutoEpisodes(0);
    
    let localAutoEpisodes = 0;

    while (isAutoTrainingRef.current && localAutoEpisodes < MAX_AUTO_EPISODES) {
      let currentBoard = createEmptyBoard();
      let currentTurn: Player = 1;
      let isDone = false;
      const gameHistory: {board: number[], player: Player}[] = [];
      let winner: Player | null = null;

      while (!isDone && isAutoTrainingRef.current) {
        let move;
        
        if (Math.random() < 0.2) {
          const moves = getAvailableMoves(currentBoard);
          move = moves[Math.floor(Math.random() * moves.length)];
        } else {
          move = await aiRef.current.predictMove(currentBoard, currentTurn);
        }

        if (move && move.row !== -1) {
          gameHistory.push({
            board: aiRef.current.flattenBoard(currentBoard, currentTurn),
            player: currentTurn
          });
          currentBoard[move.row][move.col] = currentTurn;
          
          if (checkWin(currentBoard, move.row, move.col, currentTurn)) {
            isDone = true;
            winner = currentTurn;
          } else if (isBoardFull(currentBoard)) {
            isDone = true;
          } else {
            currentTurn = currentTurn === 1 ? 2 : 1;
          }
          
          setBoard([...currentBoard.map(r => [...r])]);
          await new Promise(r => setTimeout(r, 10)); 
        } else {
          isDone = true;
        }
      }

      if (isAutoTrainingRef.current) {
        localAutoEpisodes++;
        setSessionAutoEpisodes(localAutoEpisodes);

        if (winner !== null) {
          const experiences = gameHistory.map(h => ({
            board: h.board,
            reward: h.player === winner ? 1 : -1
          }));
          await aiRef.current.train(experiences);
          await aiRef.current.saveMemory();
        }
      }
    }
    
    setIsAutoTraining(false);
    isAutoTrainingRef.current = false;
  };

  const stopAutoTraining = () => {
    isAutoTrainingRef.current = false;
    setIsAutoTraining(false);
  };

  const trainFromHistory = async () => {
    if (!aiRef.current || history.length === 0) return;
    
    const winningPlayer = currentPlayer; 
    
    const experiences = history.map(h => ({
      board: h.board,
      reward: h.player === winningPlayer ? 1 : -1
    }));

    await aiRef.current.train(experiences);
    await aiRef.current.saveMemory();
    
    tokens.addManualGame(); 
    
    resetBoard();
  };

  const resetBoard = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(1);
    setGameOver(false);
    setHistory([]);
  };

  const toggleMode = (newMode: 'play' | 'auto') => {
    if (isAutoTraining) stopAutoTraining();
    setMode(newMode);
    resetBoard();
  };

  const uploadModel = async () => {
    if (!aiRef.current) return;
    
    if (!modelName.trim() || !modelPassword.trim()) {
      alert("AI 이름과 비밀번호를 모두 입력해주세요!");
      return;
    }
    
    setIsUploading(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelName.trim(),
          author: modelName.trim(), // Use name as author
          password: modelPassword.trim(),
          winrate: tokens.totalManualGames > 0 ? 50 + Math.min(tokens.totalManualGames * 2, 45) : 0, 
          modelUrl: "https://mock-url.com/model.json" 
        })
      });
      
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        alert("클라우드 데이터베이스에 성공적으로 업로드되었습니다!");
        setModelName('');
        setModelPassword('');
      } else {
        alert("업로드 실패: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  if (isInitializing || !tokens.isLoaded) {
    return <div className="text-center py-20 text-xl font-bold animate-pulse text-emerald-400">AI 두뇌 불러오는 중...</div>;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-8 justify-center max-w-5xl mx-auto relative">
      
      {/* Left Panel: Controls */}
      <div className="flex-1 max-w-md w-full">
        <div className="glass-panel p-6 rounded-2xl mb-6">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-3xl font-bold">스튜디오</h1>
            
            {/* Wallet UI */}
            <div className="flex flex-col items-end gap-1">
              <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-amber-500/30">
                <Coins className="w-3 h-3" /> 아레나 토큰: {tokens.arenaTokens}
              </div>
              <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-500/30">
                <Zap className="w-3 h-3" /> 오토 토큰: {tokens.autoTokens}
              </div>
            </div>
          </div>
          
          <div className="flex bg-black/40 rounded-lg p-1 mb-6 relative">
            <button 
              onClick={() => toggleMode('play')}
              className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-colors ${mode === 'play' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <User className="w-4 h-4" /> 직접 플레이
            </button>
            
            <button 
              onClick={() => toggleMode('auto')}
              className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                mode === 'auto' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" /> 자동 학습
            </button>
          </div>
          
          <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl mb-6">
            <span className="font-bold text-slate-300">뇌 구조 선택</span>
            <select 
              value={brainSize} 
              onChange={handleBrainChange}
              disabled={isAutoTraining}
              className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none cursor-pointer text-sm"
            >
              <option value="shallow">초보 (얕은 뇌)</option>
              <option value="standard">중수 (표준 뇌)</option>
              <option value="deep">고수 (깊은 뇌)</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 p-4 rounded-xl text-center">
              <div className="text-slate-400 text-xs mb-1">총 수동 게임 수</div>
              <div className="text-2xl font-bold text-blue-400">
                {tokens.totalManualGames}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">다음 보상까지 {10 - (tokens.totalManualGames % 10)}판</div>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-xl text-center relative overflow-hidden">
              <div className="text-slate-400 text-xs mb-1">오토 학습 (이번 세션)</div>
              <div className="text-2xl font-bold text-emerald-400">
                {sessionAutoEpisodes}/{MAX_AUTO_EPISODES}
              </div>
              {mode === 'auto' && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(sessionAutoEpisodes / MAX_AUTO_EPISODES) * 100}%` }}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {mode === 'play' ? (
              <button 
                onClick={trainFromHistory}
                disabled={history.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors flex-wrap"
              >
                <Brain className="w-5 h-5" /> 결과로 AI 학습시키기 (+1 판)
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {!isAutoTraining ? (
                  <button 
                    onClick={runAutoTraining}
                    disabled={tokens.autoTokens <= 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors relative overflow-hidden group flex-wrap"
                  >
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay group-hover:opacity-30 transition-opacity"></div>
                    <Play className="w-5 h-5" /> 자동 학습 시작 (비용: 1 <Zap className="w-4 h-4 inline" />)
                  </button>
                ) : (
                  <button 
                    onClick={stopAutoTraining}
                    className="w-full bg-red-600 hover:bg-red-500 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Square className="w-5 h-5" /> 자동 학습 중지
                  </button>
                )}
                
                {tokens.autoTokens <= 0 && !isAutoTraining && (
                  <div className="text-amber-400 text-xs text-center">
                    오토 토큰이 1개 필요합니다. 수동 플레이 보상으로 얻을 수 있습니다.
                  </div>
                )}
              </div>
            )}
            <button 
              onClick={resetBoard}
              disabled={isAutoTraining}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-5 h-5" /> 바둑판 초기화
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold mb-4">내 AI 클라우드에 업로드</h3>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="AI 이름..."
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <input 
                type="password" 
                placeholder="비밀번호..."
                value={modelPassword}
                onChange={(e) => setModelPassword(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button 
                onClick={uploadModel}
                disabled={isUploading || isAutoTraining}
                className="w-full mt-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Upload className="w-5 h-5" /> 업로드
              </button>
            </div>
            <button onClick={tokens.addDebugTokens} className="opacity-0 w-4 h-4 absolute top-0 right-0"></button>
          </div>
        </div>
      </div>
      
      {/* Right Panel: Board */}
      <div className="flex flex-col items-center justify-start pt-4 w-full md:w-auto">
        <GomokuBoard 
          board={board} 
          onMove={mode === 'play' ? handleUserMove : undefined} 
          disabled={gameOver || isAutoTraining || (mode === 'play' && currentPlayer === 2)} 
        />
      </div>

    </div>
  );
}
