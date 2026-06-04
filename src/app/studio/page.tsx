'use client';

import { useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { createEmptyBoard, checkWin, isBoardFull, Player, BoardState } from '@/lib/gomoku';
import { BrainSize } from '@/lib/ai';
import GomokuBoard from '@/components/GomokuBoard';
import {
  Play, Upload, RotateCcw, Square, Bot, User,
  Eye, EyeOff, Circle, Cpu, Zap, Flame, LogIn, CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTraining, HW_PRESETS } from '@/context/TrainingContext';
import { useAuth } from '@/hooks/useAuth';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

export default function StudioPage() {
  const training = useTraining();
  const { user } = useAuth();

  const [mode, setMode] = useState<'play' | 'auto'>('play');
  const [myPlayer, setMyPlayer] = useState<Player>(1);
  const [board, setBoard] = useState<BoardState>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [gameOver, setGameOver] = useState(false);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | undefined>();
  const [history, setHistory] = useState<{ board: number[]; player: Player }[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // ─── AI 먼저 두기 ──────────────────────────────────────────────────────
  const startGameWithAI = useCallback(async (newBoard: BoardState, aiPlayer: Player) => {
    if (!training.aiRef.current) return;
    setIsAiThinking(true);
    await new Promise(r => requestAnimationFrame(r));
    const aiMove = await training.aiRef.current.predictMove(newBoard, aiPlayer);
    if (aiMove.row !== -1) {
      const after = newBoard.map(r => [...r]);
      after[aiMove.row][aiMove.col] = aiPlayer;
      setBoard(after);
      setLastMove({ row: aiMove.row, col: aiMove.col });
      setCurrentPlayer(aiPlayer === 1 ? 2 : 1);
      if (training.aiRef.current)
        setHistory([{ board: training.aiRef.current.flattenBoard(newBoard, aiPlayer), player: aiPlayer }]);
    }
    setIsAiThinking(false);
  }, [training.aiRef]);

  const handleColorChange = async (player: Player) => {
    setMyPlayer(player);
    const fresh = createEmptyBoard();
    setBoard(fresh); setCurrentPlayer(1); setGameOver(false);
    setLastMove(undefined); setHistory([]);
    if (player === 2) await startGameWithAI(fresh, 1);
  };

  const handleUserMove = useCallback(async (row: number, col: number) => {
    if (gameOver || currentPlayer !== myPlayer || !training.aiRef.current || isAiThinking) return;
    if (board[row][col] !== 0) return;
    const newBoard = board.map(r => [...r]) as BoardState;
    newBoard[row][col] = myPlayer;
    const aiPlayer = myPlayer === 1 ? 2 : 1;
    setHistory(prev => [...prev, { board: training.aiRef.current!.flattenBoard(board, myPlayer), player: myPlayer }]);
    setBoard(newBoard); setLastMove({ row, col }); setCurrentPlayer(aiPlayer);
    if (checkWin(newBoard, row, col, myPlayer)) {
      setGameOver(true);
      const exp = history.map(h => ({ board: h.board, reward: h.player === myPlayer ? 1 : -1 }));
      exp.push({ board: training.aiRef.current.flattenBoard(newBoard, myPlayer), reward: 1 });
      await training.aiRef.current.train(exp);
      await training.aiRef.current.saveMemory();
      setTotalGames(n => n + 1);
      return;
    }
    if (isBoardFull(newBoard)) { setGameOver(true); setTotalGames(n => n + 1); return; }
    setIsAiThinking(true);
    await new Promise(r => requestAnimationFrame(r));
    const aiMove = await training.aiRef.current.predictMove(newBoard, aiPlayer);
    if (aiMove.row !== -1) {
      const after = newBoard.map(r => [...r]) as BoardState;
      after[aiMove.row][aiMove.col] = aiPlayer;
      if (training.aiRef.current)
        setHistory(prev => [...prev, { board: training.aiRef.current!.flattenBoard(newBoard, aiPlayer), player: aiPlayer }]);
      setBoard(after); setLastMove({ row: aiMove.row, col: aiMove.col }); setCurrentPlayer(myPlayer);
      if (checkWin(after, aiMove.row, aiMove.col, aiPlayer)) {
        setGameOver(true);
        const exp = history.map(h => ({ board: h.board, reward: h.player === aiPlayer ? 1 : -1 }));
        exp.push({ board: training.aiRef.current.flattenBoard(after, aiPlayer), reward: 1 });
        await training.aiRef.current.train(exp);
        await training.aiRef.current.saveMemory();
        setTotalGames(n => n + 1);
      }
    }
    setIsAiThinking(false);
  }, [gameOver, currentPlayer, myPlayer, training.aiRef, board, history, isAiThinking]);

  const resetBoard = useCallback(async () => {
    const fresh = createEmptyBoard();
    setBoard(fresh); setCurrentPlayer(1); setGameOver(false);
    setLastMove(undefined); setHistory([]);
    if (myPlayer === 2) await startGameWithAI(fresh, 1);
  }, [myPlayer, startGameWithAI]);

  const toggleMode = (newMode: 'play' | 'auto') => {
    if (training.isAutoTraining) training.stopAutoTraining();
    setMode(newMode);
  };

  // ─── 원클릭 업로드 (로그인 시) ──────────────────────────────────────────
  const uploadModel = async () => {
    if (!training.aiRef.current || !user) return;
    setIsUploading(true);
    setUploadDone(false);
    try {
      let modelUrl = '';
      try {
        let capturedFD: FormData | null = null;
        await training.aiRef.current.model.save(tf.io.withSaveHandler(async (artifacts) => {
          const fd = new FormData();
          fd.append('modelName', user.username);
          fd.append('files', new File([JSON.stringify({
            modelTopology: artifacts.modelTopology,
            weightsManifest: [{ paths: ['model.weights.bin'], weights: artifacts.weightSpecs }],
          })], 'model.json', { type: 'application/json' }));
          if (artifacts.weightData)
            fd.append('files', new File([artifacts.weightData as ArrayBuffer], 'model.weights.bin', { type: 'application/octet-stream' }));
          capturedFD = fd;
          return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
        }));
        if (capturedFD) {
          const up = await fetch('/api/models/upload', { method: 'POST', body: capturedFD });
          const upData = await up.json();
          if (upData.success && upData.modelUrl) modelUrl = upData.modelUrl;
        }
      } catch (_) {}

      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          winrate: Math.min(50 + totalGames * 2, 95),
          modelUrl: modelUrl || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setUploadDone(true);
        setTimeout(() => setUploadDone(false), 3000);
      } else {
        alert('업로드 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch { alert('업로드 중 오류가 발생했습니다.'); }
    finally { setIsUploading(false); }
  };

  if (training.isInitializing) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="text-xl font-bold animate-pulse text-emerald-400">AI 두뇌 불러오는 중...</div>
        <div className="text-sm text-slate-400">신규 브레인을 구성하거나 이전 학습 데이터를 로드하는 중입니다</div>
      </div>
    );
  }

  return (
    <>
      {/* ── 모바일: 세로 / 데스크탑: 가로 ── */}
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-8 justify-center max-w-5xl mx-auto px-2">

        {/* ── 왼쪽 패널 ────────────────────────────────────────────────── */}
        <div className="w-full xl:flex-1 xl:max-w-md">
          <div className="glass-panel p-4 sm:p-6 rounded-2xl mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">스튜디오</h1>

            {/* 모드 탭 */}
            <div className="flex bg-black/40 rounded-lg p-1 mb-4">
              <button onClick={() => toggleMode('play')}
                className={`flex-1 py-2.5 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-colors ${mode === 'play' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <User className="w-4 h-4" /> 직접 학습
              </button>
              <button onClick={() => toggleMode('auto')}
                className={`flex-1 py-2.5 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-colors ${mode === 'auto' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Bot className="w-4 h-4" /> 자동 학습
              </button>
            </div>

            {/* 흑/백 선택 */}
            {mode === 'play' && (
              <div className="flex bg-black/20 rounded-xl p-1 mb-4 border border-white/5">
                <button onClick={() => handleColorChange(1)}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${myPlayer === 1 ? 'bg-slate-800 shadow-lg border border-white/10' : 'text-slate-400 hover:text-white'}`}>
                  <Circle className="w-4 h-4 fill-black text-black" /> 흑 (선공)
                </button>
                <button onClick={() => handleColorChange(2)}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${myPlayer === 2 ? 'bg-slate-100 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                  <Circle className="w-4 h-4 fill-white text-white" /> 백 (후공)
                </button>
              </div>
            )}

            {/* 연산 장치 */}
            <div className="bg-slate-800/50 p-3 sm:p-4 rounded-xl mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-300 text-sm flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" /> 연산 장치
                </span>
                {/* 현재 상태 배지 */}
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  training.currentBackend === 'webgpu'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {training.currentBackend === 'webgpu' ? '🔥 GPU+CPU' : '⚡ CPU 전코어'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {training.backendOptions.map(opt => {
                  const available = training.availableBackends[opt.id];
                  const active = training.currentBackend === opt.id;
                  return (
                    <button key={opt.id} onClick={() => training.changeBackend(opt.id)}
                      disabled={!available || training.isAutoTraining}
                      className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        active
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-200'
                          : available
                            ? 'bg-slate-700/40 border-slate-600/40 text-slate-300 hover:border-slate-500'
                            : 'opacity-25 cursor-not-allowed border-transparent'
                      }`}>
                      <span className="text-base">{opt.icon}</span>
                      <span className="font-bold">{opt.label}</span>
                      <span className="text-[10px] font-normal text-slate-400 leading-tight">{opt.sublabel}</span>
                      {!available && <span className="text-[9px] text-red-400">미지원</span>}
                    </button>
                  );
                })}
              </div>
            </div>


            {/* 성능 설정 */}
            <div className="bg-slate-800/50 p-3 sm:p-4 rounded-xl mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-300 text-sm flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-yellow-400" /> 성능 설정
                </span>
                {training.isAutoTraining && training.eps > 0 && (
                  <span className="text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded">
                    {training.eps} eps
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {HW_PRESETS.map(preset => (
                  <button key={preset.id} onClick={() => training.setHwPreset(preset)} title={preset.desc}
                    className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-bold transition-all border ${
                      training.hwPresetId === preset.id
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                        : 'bg-slate-700/30 border-slate-600/30 text-slate-400 hover:bg-slate-700'
                    }`}>
                    <span className="text-base">{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                <span>🤖 기기 맞춤 자동 설정됨</span>
                <span>배치: {training.batchSize}</span>
              </div>
            </div>

            {/* GPU & RAM 사용량 제한 조절기 */}
            {mode === 'auto' && (
              <div className="bg-slate-800/50 p-3 sm:p-4 rounded-xl mb-4 border border-violet-500/20">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-slate-300 text-sm flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-violet-400" /> GPU & RAM 세부 제한
                  </span>
                  <span className="text-[9px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                    하드웨어 조율
                  </span>
                </div>

                <div className="space-y-3.5">
                  {/* GPU 학습 주기 제어 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">GPU 학습 연산 주기</span>
                      <span className="text-violet-400 font-mono font-bold">{training.gpuThrottle}ms</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="2000"
                      step="1"
                      value={training.gpuThrottle}
                      onChange={(e) => training.setGpuThrottle(Number(e.target.value))}
                      className="w-full accent-violet-500 bg-slate-700 rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 leading-tight">
                      <span>1ms (최대 가속)</span>
                      <span>2000ms (최소 점유)</span>
                    </div>
                  </div>

                  {/* RAM 버퍼 크기 제어 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">경험 재플레이 버퍼 (RAM)</span>
                      <span className="text-violet-400 font-mono font-bold">{(training.replayMax / 1000).toFixed(0)}k</span>
                    </div>
                    <input
                      type="range"
                      min="10000"
                      max="300000"
                      step="10000"
                      value={training.replayMax}
                      onChange={(e) => training.setReplayMax(Number(e.target.value))}
                      className="w-full accent-violet-500 bg-slate-700 rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 leading-tight">
                      <span>10k (RAM 절약)</span>
                      <span>300k (최대 효율)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CPU 멀티코어 분산 스레드 모니터 */}
            {mode === 'auto' && (
              <div className="bg-slate-800/50 p-3 sm:p-4 rounded-xl mb-4 border border-rose-500/20">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-slate-300 text-sm flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-rose-500 animate-pulse" /> CPU 멀티코어 분산 스레드
                  </span>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950/40 border border-rose-900/40 px-2 py-0.5 rounded">
                    액티브: {training.numWorkers} Cores
                  </span>
                </div>

                {/* 각 코어별 연산 그래프/에너지 흐름 바 */}
                <div className="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-lg border border-slate-900 mb-3 max-h-[160px] overflow-y-auto">
                  {training.workerStates.map((w) => {
                    const sps = w.sps;
                    const percent = Math.min((sps / 8000) * 100, 100); // 8000 SPS를 기준 100% 로드로 매핑
                    return (
                      <div key={w.id} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[8px] text-slate-500 font-mono">THREAD_#0{w.id + 1}</span>
                          <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${w.active && sps > 0 ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-slate-750'}`}></span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono">
                            <span className="text-rose-400 font-bold">LOAD</span>
                            <span className="text-slate-300 font-bold">{sps.toLocaleString()} SPS</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1">
                            <div className="bg-rose-500 h-1 rounded-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">스레드 개수 조절</span>
                    <span className="text-slate-500 text-[10px]">최대 코어 수: {training.maxCores}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={Math.max(16, training.maxCores * 2)}
                    value={training.numWorkers}
                    onChange={(e) => training.setNumWorkers(Number(e.target.value))}
                    className="w-full accent-rose-500 bg-slate-700 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* 뇌 구조 */}
            <div className="flex items-center justify-between bg-slate-800/50 p-3 sm:p-4 rounded-xl mb-4">
              <span className="font-bold text-slate-300 text-sm">뇌 구조</span>
              <select value={training.brainSize}
                onChange={async (e) => {
                  if (confirm('뇌 크기 변경 시 기존 기억이 삭제됩니다.')) {
                    await training.resetAI(e.target.value as BrainSize); resetBoard();
                  }
                }}
                disabled={training.isAutoTraining}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none text-sm cursor-pointer">
                <option value="shallow">초보 (얕은 뇌)</option>
                <option value="standard">중수 (표준 뇌)</option>
                <option value="deep">고수 (깊은 뇌)</option>
              </select>
            </div>


            {/* 통계 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-slate-800/50 p-3 rounded-xl text-center">
                <div className="text-slate-400 text-xs mb-1">직접 학습</div>
                <div className="text-2xl font-bold text-blue-400">{totalGames}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">판</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl text-center relative overflow-hidden">
                <div className="text-slate-400 text-xs mb-1">자동 학습</div>
                <div className="text-2xl font-bold text-emerald-400">{training.sessionAutoEpisodes.toLocaleString()}</div>
                {training.isAutoTraining && training.eps > 0
                  ? <div className="text-[10px] text-emerald-500 mt-0.5">{training.eps} eps</div>
                  : <div className="text-[10px] text-slate-500 mt-0.5">에피소드</div>
                }
                {training.isAutoTraining && mode !== 'auto' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500/40 overflow-hidden">
                    <div className="h-full bg-emerald-400 animate-[shimmer_1.5s_infinite]" style={{ width: '40%' }} />
                  </div>
                )}
              </div>
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex flex-col gap-2">
              {mode === 'play' ? (
                <>
                  <button onClick={resetBoard} disabled={isAiThinking}
                    className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-3 px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                    <RotateCcw className="w-4 h-4" /> 새 게임
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  {!training.isAutoTraining ? (
                    <div className="flex flex-col gap-2">
                      {/* 🔥 최고 성능 */}
                      <button
                        onClick={async () => {
                          const best = training.availableBackends.webgpu ? 'webgpu' : 'wasm';
                          if (training.currentBackend !== best) await training.changeBackend(best as any);
                          // 스레드 개수를 탐지된 물리 최대 코어 수로 자동 조정
                          training.setNumWorkers(training.maxCores);
                          const maxPreset = HW_PRESETS.find(p => p.id === 'max')!;
                          training.setHwPreset(maxPreset);
                          training.startAutoTraining();
                        }}
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-3 px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/30">
                        <Flame className="w-5 h-5" /> 🔥 최고 성능으로 학습
                      </button>
                      <button onClick={() => training.startAutoTraining()}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                        <Play className="w-4 h-4" /> 자동 학습 시작
                      </button>
                    </div>
                  ) : (
                    <button onClick={training.stopAutoTraining}
                      className="w-full bg-red-600 hover:bg-red-500 text-white py-3 px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                      <Square className="w-4 h-4" /> 자동 학습 중지
                    </button>
                  )}

                  {/* 시각화 토글 */}
                  <button onClick={training.toggleVisualize}
                    className={`w-full py-2.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors border ${
                      training.isVisualize
                        ? 'bg-violet-600/20 border-violet-500/50 text-violet-300 hover:bg-violet-600/30'
                        : 'bg-slate-700/30 border-slate-600/30 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {training.isVisualize ? <><Eye className="w-4 h-4" /> 시각화 켜짐</> : <><EyeOff className="w-4 h-4" /> 시각화 꺼짐</>}
                  </button>
                </div>
              )}

              {/* ─── 업로드 ─────────────────────────────────────────── */}
              <div className="mt-2 pt-4 border-t border-white/10">
                {user ? (
                  /* 로그인 시: 원클릭 업로드 */
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-sm text-slate-300">
                        <span className="font-bold text-emerald-400">{user.username}</span> 계정으로 업로드
                      </span>
                    </div>
                    <button onClick={uploadModel} disabled={isUploading || training.isAutoTraining}
                      className={`w-full py-3 px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        uploadDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white'
                      }`}>
                      {isUploading ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 업로드 중...</>
                      ) : uploadDone ? (
                        <><CheckCircle2 className="w-4 h-4" /> 업로드 완료!</>
                      ) : (
                        <><Upload className="w-4 h-4" /> 내 AI 업로드</>
                      )}
                    </button>
                  </div>
                ) : (
                  /* 미로그인: 로그인 유도 */
                  <div className="text-center">
                    <p className="text-slate-400 text-sm mb-3">허브에 업로드하려면 로그인하세요</p>
                    <button onClick={() => setShowAuth(true)}
                      className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                      <LogIn className="w-4 h-4" /> 로그인 / 회원가입
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 보드 / 학습 시각화 ──────────────────────────── */}
        <div className="flex flex-col items-center justify-start pt-0 xl:pt-2 gap-3">

          {mode === 'auto' && training.isAutoTraining && training.isVisualize ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                AI 자기 대결 관전 중
                <span className="font-mono font-bold text-emerald-400 text-base">
                  {training.sessionAutoEpisodes.toLocaleString()} 판
                </span>
              </div>
              <GomokuBoard board={training.liveBoard} disabled={true} />
            </div>

          ) : mode === 'auto' && training.isAutoTraining && !training.isVisualize ? (
            <div className="w-full max-w-[480px] bg-slate-800/60 rounded-2xl flex flex-col items-center justify-center border border-rose-500/20 p-8 gap-6 shadow-2xl">
              {/* SPS Performance Dashboard */}
              <div className="w-full bg-black/40 rounded-xl p-4 border border-rose-500/10 text-center relative overflow-hidden">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-rose-400 font-bold uppercase tracking-wider font-mono">SPS Performance Engine</span>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                </div>
                <div className="flex items-baseline gap-1.5 justify-center py-4">
                  <span className="text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-rose-400 tabular-nums">
                    {training.workerStates.reduce((acc, w) => acc + w.sps, 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Steps / Sec</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  여러 개의 CPU 코어가 병렬로 연산을 연동하며 학습 수렴속도가 폭발적으로 올라갑니다.
                </p>
              </div>

              {/* 에피소드 카운터 */}
              <div className="text-center w-full">
                <div className="text-slate-400 text-xs mb-1 font-medium">누적 학습 에피소드</div>
                <div className="text-4xl font-extrabold text-emerald-400 tabular-nums font-mono">
                  {training.sessionAutoEpisodes.toLocaleString()}
                </div>
                {training.eps > 0 && (
                  <div className="text-emerald-300 text-base font-mono mt-1 font-bold">
                    {training.eps} <span className="text-xs font-normal text-slate-400">게임/초 (EPS)</span>
                  </div>
                )}
              </div>

              {/* 시스템 통계 그리드 */}
              <div className="grid grid-cols-3 gap-3 w-full text-center">
                <div className="bg-black/30 rounded-xl p-3 border border-white/5 relative overflow-hidden flex flex-col justify-center">
                  <div className="text-[10px] text-slate-400 mb-1 z-10">CPU 점유율</div>
                  <div className="text-lg font-black text-rose-400 font-mono z-10">
                    {Math.round((training.numWorkers / Math.max(1, training.maxCores)) * 100)}%
                  </div>
                  <div className="text-[9px] text-slate-500 z-10">{training.numWorkers} / {training.maxCores} 코어</div>
                  <div className="absolute bottom-0 left-0 h-1 bg-rose-500/20 w-full">
                    <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${(training.numWorkers / Math.max(1, training.maxCores)) * 100}%` }} />
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-xl p-3 border border-white/5 relative overflow-hidden flex flex-col justify-center">
                  <div className="text-[10px] text-slate-400 mb-1 z-10">RAM 점유율</div>
                  <div className="text-lg font-black text-violet-400 font-mono z-10">
                    {Math.min(100, Math.round((training.replaySize / Math.max(1, training.replayMax)) * 100))}%
                  </div>
                  <div className="text-[9px] text-slate-500 z-10">
                    {(training.replaySize/1000).toFixed(0)}k / {(training.replayMax/1000).toFixed(0)}k
                  </div>
                  <div className="absolute bottom-0 left-0 h-1 bg-violet-500/20 w-full">
                    <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${Math.min(100, (training.replaySize / Math.max(1, training.replayMax)) * 100)}%` }} />
                  </div>
                </div>
                
                <div className="bg-black/30 rounded-xl p-3 border border-white/5 relative overflow-hidden flex flex-col justify-center">
                  <div className="text-[10px] text-slate-400 mb-1 z-10">GPU 점유율</div>
                  <div className="text-lg font-black text-orange-400 font-mono z-10">
                    {training.currentBackend === 'webgpu' 
                      ? `${Math.round(Math.max(1, 100 - (training.gpuThrottle / 2000) * 100))}%` 
                      : 'N/A'}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase z-10">
                    {training.currentBackend === 'webgpu' ? 'WebGPU 가속' : '미지원 (CPU)'}
                  </div>
                  {training.currentBackend === 'webgpu' && (
                    <div className="absolute bottom-0 left-0 h-1 bg-orange-500/20 w-full">
                      <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${Math.max(1, 100 - (training.gpuThrottle / 2000) * 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-500 animate-[shimmer_2s_infinite]" style={{ width: '100%' }} />
              </div>

              <p className="text-slate-500 text-[10px] text-center leading-normal">
                본 창을 닫거나 다른 탭을 오가도 백그라운드 멀티코어 연산은 멈추지 않고 지속됩니다.
              </p>
            </div>


          ) : mode === 'auto' && !training.isAutoTraining ? (
            <div className="w-full max-w-[480px] aspect-square bg-slate-800/40 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50 gap-4">
              <Bot className="w-16 h-16 text-slate-600" />
              <div className="text-center">
                <div className="text-slate-400 text-base font-semibold">자동 학습 준비됨</div>
                <div className="text-slate-500 text-sm mt-1">시작 버튼을 눌러 AI 자기 대결을 시작하세요</div>
              </div>
            </div>

          ) : (
            <GomokuBoard
              board={board}
              onMove={mode === 'play' ? handleUserMove : undefined}
              disabled={gameOver || isAiThinking || (mode === 'play' && currentPlayer !== myPlayer)}
              lastMove={lastMove}
            />
          )}

          {mode === 'play' && (
            <div className="text-sm text-slate-400">
              {myPlayer === 1 ? '⚫ 흑으로 학습 중' : '⚪ 백으로 학습 중'}
            </div>
          )}
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
