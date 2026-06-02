'use client';

import { useState, useEffect, useRef } from 'react';
import { Star, Loader2, Play, Lock, ChevronRight, Shuffle, Swords, User, Bot, Coins, ArrowLeft, RefreshCcw } from 'lucide-react';
import GomokuBoard from '@/components/GomokuBoard';
import { createEmptyBoard, checkWin, isBoardFull, Player, getAvailableMoves, BoardState } from '@/lib/gomoku';
import { GomokuAI } from '@/lib/ai';
import confetti from 'canvas-confetti';
import { useTokens } from '@/hooks/useTokens';

type HubView = 'list' | 'battle';
type BattleMode = 'me_vs_hubai' | 'myai_vs_hubai';

interface Model {
  id: number;
  name: string;
  author: string;
  winrate: number;
  downloads: number;
}

export default function HubPage() {
  const tokens = useTokens();
  
  // Hub List State
  const [view, setView] = useState<HubView>('list');
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Battle State
  const [selectedEnemy, setSelectedEnemy] = useState<Model | null>(null);
  const [battleMode, setBattleMode] = useState<BattleMode>('me_vs_hubai');
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1); 
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [matchRunning, setMatchRunning] = useState(false);
  const [scores, setScores] = useState({ me: 0, ai: 0, myai: 0, hubai: 0 });

  // AIs
  const myAiRef = useRef<GomokuAI | null>(null);
  const hubAiRef = useRef<GomokuAI | null>(null);
  const matchHistoryRef = useRef<{board: number[], player: Player}[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        setModels(data);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setLoading(false);
      }

      // Load My AI in background for battles
      myAiRef.current = new GomokuAI();
      await myAiRef.current.loadMemory();
    }
    init();
  }, []);

  const openContinueTraining = (model: Model) => {
    setSelectedEnemy(model);
    setPasswordInput('');
    setErrorMsg('');
    setShowPasswordModal(true);
  };

  const handleVerify = async () => {
    if (!selectedEnemy || !passwordInput.trim()) return;
    
    setVerifying(true);
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/models/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEnemy.id,
          password: passwordInput
        })
      });
      
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('gomoku-ai-brainSize', 'standard'); 
        alert(`인증 성공! 스튜디오로 이동합니다.`);
        window.location.href = '/studio';
      } else {
        setErrorMsg('비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      setErrorMsg('비밀번호 확인 중 오류가 발생했습니다.');
    } finally {
      setVerifying(false);
    }
  };

  const startBattle = (model: Model) => {
    setSelectedEnemy(model);
    hubAiRef.current = new GomokuAI('standard'); 
    resetMatch();
    setView('battle');
  };

  const handleRandomMatch = () => {
    if (models.length === 0) return;
    const randomModel = models[Math.floor(Math.random() * models.length)];
    startBattle(randomModel);
  };

  const resetMatch = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(1);
    setGameOver(false);
    setWinner(null);
    setMatchRunning(false);
    matchHistoryRef.current = [];
  };

  const leaveBattle = () => {
    setView('list');
    setSelectedEnemy(null);
  };

  const handleHumanMove = async (row: number, col: number) => {
    if (gameOver || board[row][col] !== 0 || currentPlayer !== 1 || matchRunning || battleMode === 'myai_vs_hubai') return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 1;
    setBoard(newBoard);

    if (checkWin(newBoard, row, col, 1)) {
      setGameOver(true);
      setWinner(1);
      setScores(s => ({ ...s, me: s.me + 1 }));
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      return;
    } else if (isBoardFull(newBoard)) {
      setGameOver(true);
      return;
    }

    setCurrentPlayer(2);
    setMatchRunning(true);
    
    setTimeout(async () => {
      if (!hubAiRef.current) return;
      const aiMove = await hubAiRef.current.predictMove(newBoard, 2);
      
      if (aiMove.row !== -1) {
        const afterAiBoard = newBoard.map(r => [...r]);
        afterAiBoard[aiMove.row][aiMove.col] = 2;
        setBoard(afterAiBoard);

        if (checkWin(afterAiBoard, aiMove.row, aiMove.col, 2)) {
          setGameOver(true);
          setWinner(2);
          setScores(s => ({ ...s, ai: s.ai + 1 }));
        } else if (isBoardFull(afterAiBoard)) {
          setGameOver(true);
        } else {
          setCurrentPlayer(1);
        }
      }
      setMatchRunning(false);
    }, 100);
  };

  const runAutoMatch = async () => {
    if (!myAiRef.current || !hubAiRef.current || matchRunning || battleMode !== 'myai_vs_hubai') return;

    if (!tokens.consumeArenaToken()) {
      alert("아레나 토큰이 부족합니다! 스튜디오에서 수동 플레이를 통해 토큰을 획득하세요.");
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
          if (turn === 1) {
            setScores(s => ({ ...s, myai: s.myai + 1 }));
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          } else {
            setScores(s => ({ ...s, hubai: s.hubai + 1 }));
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

  // ---------------------------------------------------------------------------
  // LIST VIEW
  // ---------------------------------------------------------------------------
  if (view === 'list') {
    return (
      <div className="max-w-4xl mx-auto relative px-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">모델 허브 & 대결장</h1>
            <p className="text-slate-400">커뮤니티 AI를 발견하고 즉시 대결해보세요.</p>
          </div>
          <button 
            onClick={handleRandomMatch}
            disabled={models.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 px-6 rounded-xl font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Shuffle className="w-5 h-5" /> 랜덤 대결
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* My AI Card */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col border-2 border-emerald-500/30">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="overflow-hidden">
                  <h2 className="text-xl font-bold text-emerald-400 truncate">내 AI (로컬)</h2>
                  <p className="text-slate-400 text-sm truncate">스튜디오에서 훈련중인 AI</p>
                </div>
                <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 whitespace-nowrap shrink-0">
                  <Bot className="w-4 h-4" /> 내 파트너
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button 
                  onClick={() => {
                    setSelectedEnemy({ id: 0, name: '내 AI', author: '', winrate: 0, downloads: 0 });
                    hubAiRef.current = myAiRef.current;
                    resetMatch();
                    setView('battle');
                  }}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-3 px-3 rounded-xl font-bold text-sm text-center flex items-center justify-center gap-1 transition-colors"
                >
                  <Play className="w-4 h-4" /> 연습 게임하기
                </button>
                <button 
                  onClick={() => window.location.href='/studio'}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-colors"
                >
                  스튜디오 가기
                </button>
              </div>
            </div>

            {/* Community Models */}
            {models.map(model => (
              <div key={model.id} className="glass-panel p-6 rounded-2xl flex flex-col">
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="overflow-hidden">
                    <h2 className="text-xl font-bold truncate">{model.name}</h2>
                  </div>
                  <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 whitespace-nowrap shrink-0">
                    <Star className="w-4 h-4" /> {Math.round(model.winrate)}% 승률
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 mt-6">
                  <button 
                    onClick={() => startBattle(model)}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-3 px-3 rounded-xl font-bold text-sm text-center flex items-center justify-center gap-1 transition-colors"
                  >
                    <Play className="w-4 h-4" /> 대결하기
                  </button>
                  <button 
                    onClick={() => openContinueTraining(model)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-colors"
                  >
                    <Lock className="w-4 h-4" /> 이어서 학습하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Password Modal */}
        {showPasswordModal && selectedEnemy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-2">이어서 학습하기</h3>
              <p className="text-slate-400 text-sm mb-6 break-words">스튜디오로 불러오려면 <strong className="text-white">{selectedEnemy.name}</strong> 의 비밀번호를 입력하세요.</p>
              
              <input 
                type="password"
                placeholder="비밀번호..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white mb-2 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {errorMsg && <p className="text-red-400 text-sm mb-4">{errorMsg}</p>}
              
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 px-4 rounded-xl font-bold transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleVerify}
                  disabled={verifying || !passwordInput.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : '확인'} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // BATTLE VIEW
  // ---------------------------------------------------------------------------
  let p1Label = battleMode === 'me_vs_hubai' ? "나 (흑)" : "내 AI (흑)";
  let p2Label = selectedEnemy ? `${selectedEnemy.name} (백)` : 'AI (백)';
  let p1Score = battleMode === 'me_vs_hubai' ? scores.me : scores.myai;
  let p2Score = battleMode === 'me_vs_hubai' ? scores.ai : scores.hubai;

  // If fighting against own local AI for practice
  if (selectedEnemy?.id === 0) {
    p2Label = "내 AI (백)";
    p2Score = scores.ai;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start justify-center max-w-6xl mx-auto px-2">
      <div className="flex-1 w-full max-w-md mx-auto xl:mx-0">
        <div className="glass-panel p-6 rounded-2xl relative">
          <button 
            onClick={leaveBattle}
            className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex justify-between items-start mt-8 mb-6">
            <h1 className="text-2xl font-bold truncate">vs {selectedEnemy?.name}</h1>
            <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 border border-amber-500/30 shrink-0">
              <Coins className="w-4 h-4" /> 토큰: {tokens.arenaTokens}
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-8 bg-black/30 p-2 rounded-xl">
            <button 
              onClick={() => setBattleMode('me_vs_hubai')}
              disabled={matchRunning}
              className={`py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-between transition-colors flex-wrap gap-2 ${battleMode === 'me_vs_hubai' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-300'}`}
            >
              <div className="flex items-center gap-2"><User className="w-4 h-4 shrink-0"/> 나 vs {selectedEnemy?.name}</div>
              <span className="text-xs font-normal opacity-70 shrink-0">무료 (연습)</span>
            </button>
            {selectedEnemy?.id !== 0 && (
              <button 
                onClick={() => setBattleMode('myai_vs_hubai')}
                disabled={matchRunning}
                className={`py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-between transition-colors flex-wrap gap-2 ${battleMode === 'myai_vs_hubai' ? 'bg-emerald-600 text-white' : 'hover:bg-white/5 text-slate-300'}`}
              >
                <div className="flex items-center gap-2"><Bot className="w-4 h-4 shrink-0"/> 내 AI vs {selectedEnemy?.name}</div>
                <span className="text-xs font-normal opacity-70 flex items-center gap-1 shrink-0">비용: 1 <Coins className="w-3 h-3"/> (관전 학습)</span>
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 p-4 rounded-xl text-center border-2 border-blue-500/30 overflow-hidden">
              <div className="text-blue-400 font-bold mb-1 truncate">{p1Label}</div>
              <div className="text-2xl font-bold text-white">{p1Score} 승</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl text-center border-2 border-slate-500/30 overflow-hidden">
              <div className="text-slate-400 font-bold mb-1 truncate">{p2Label}</div>
              <div className="text-2xl font-bold text-white">{p2Score} 승</div>
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-xl mb-6 text-center h-24 flex items-center justify-center">
            {gameOver ? (
              <div className="text-xl font-bold text-white">
                {winner === 1 ? `🎉 ${p1Label.replace(' (흑)', '')} 승리!` : winner === 2 ? `💀 ${p2Label.replace(' (백)', '')} 승리!` : '🤝 무승부'}
              </div>
            ) : (
              <div className="text-lg font-medium text-slate-300">
                {matchRunning ? (
                  currentPlayer === 1 ? `${p1Label}가 생각 중...` : `${p2Label}가 생각 중...`
                ) : (
                  battleMode === 'myai_vs_hubai' ? '시작 버튼을 눌러 관전하세요!' : '당신의 차례입니다!'
                )}
              </div>
            )}
          </div>

          {battleMode === 'myai_vs_hubai' && selectedEnemy?.id !== 0 ? (
            <button 
              onClick={runAutoMatch}
              disabled={matchRunning || tokens.arenaTokens <= 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors relative overflow-hidden group flex-wrap"
            >
               <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay group-hover:opacity-30 transition-opacity"></div>
              <Swords className="w-5 h-5 shrink-0" /> 자동 전투 시작 (비용: 1 <Coins className="w-4 h-4 inline" />)
            </button>
          ) : (
            <button 
              onClick={resetMatch}
              disabled={matchRunning && currentPlayer === 2}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCcw className="w-5 h-5 shrink-0" /> 바둑판 초기화
            </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center w-full md:w-auto">
        <GomokuBoard 
          board={board} 
          onMove={battleMode !== 'myai_vs_hubai' ? handleHumanMove : undefined} 
          disabled={gameOver || matchRunning || (battleMode !== 'myai_vs_hubai' && currentPlayer !== 1)} 
        />
      </div>
    </div>
  );
}
