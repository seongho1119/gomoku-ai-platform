'use client';

import { useState, useEffect } from 'react';
import { GomokuAI } from '@/lib/ai';
import { createEmptyBoard, checkWin, isBoardFull, Player } from '@/lib/gomoku';
import { Trophy, Swords, Crown, Loader2, Play, Star, TrendingUp, Shield, Medal, Zap, ChevronRight } from 'lucide-react';
import { useTraining } from '@/context/TrainingContext';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

interface Model {
  id: number;
  name: string;
  author: string;
  winrate: number;
}

interface RankedEntry {
  id: number;
  name: string;
  baseWinrate: number;
  isMyAI: boolean;
  wins: number;
  losses: number;
  draws: number;
}

async function runSingleGame(ai1: GomokuAI, ai2: GomokuAI): Promise<1 | 2 | 0> {
  const board = createEmptyBoard();
  let turn: Player = 1;
  for (let i = 0; i < 225; i++) {
    const ai = turn === 1 ? ai1 : ai2;
    const move = await ai.predictMove(board, turn);
    if (move.row === -1) return 0;
    board[move.row][move.col] = turn;
    if (checkWin(board, move.row, move.col, turn)) return turn;
    if (isBoardFull(board)) return 0;
    turn = turn === 1 ? 2 : 1;
  }
  return 0;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-slate-500 font-bold text-sm w-5 text-center">{rank}</span>;
}

function getScore(entry: RankedEntry) {
  const total = entry.wins + entry.losses + entry.draws;
  if (total === 0) return entry.baseWinrate;
  const battleWinrate = (entry.wins / total) * 100;
  return Math.round(entry.baseWinrate * 0.4 + battleWinrate * 0.6);
}

export default function ArenaPage() {
  const training = useTraining();
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<RankedEntry[]>([]);
  const [battling, setBattling] = useState<number | null>(null);
  const [battleLog, setBattleLog] = useState<{ msg: string; type: 'win' | 'lose' | 'draw' | 'info' }[]>([]);

  useEffect(() => {
    async function load() {
      let models: Model[] = [];
      try {
        const res = await fetch('/api/models');
        models = await res.json();
      } catch (_) {}

      const entries: RankedEntry[] = [
        { id: -1, name: '내 AI', baseWinrate: 50, isMyAI: true, wins: 0, losses: 0, draws: 0 },
        ...models.map(m => ({ id: m.id, name: m.name, baseWinrate: m.winrate, isMyAI: false, wins: 0, losses: 0, draws: 0 })),
        ...(models.length === 0 ? [
          { id: -2, name: 'AlphaBot', baseWinrate: 85, isMyAI: false, wins: 0, losses: 0, draws: 0 },
          { id: -3, name: 'DefenseBot', baseWinrate: 68, isMyAI: false, wins: 0, losses: 0, draws: 0 },
          { id: -4, name: 'RandomBot', baseWinrate: 32, isMyAI: false, wins: 0, losses: 0, draws: 0 },
        ] : [])
      ];

      entries.sort((a, b) => b.baseWinrate - a.baseWinrate);
      setRanking(entries);
      setLoading(false);
    }
    load();
  }, []);

  const challenge = async (opponent: RankedEntry) => {
    if (!training.aiRef.current || battling !== null) return;
    setBattling(opponent.id);
    setBattleLog(prev => [{ msg: `⚔️ ${opponent.name}에게 도전 중...`, type: 'info' }, ...prev.slice(0, 9)]);

    const opponentAI = new GomokuAI('standard');
    const result = await runSingleGame(training.aiRef.current, opponentAI);
    const myWon = result === 1;
    const isDraw = result === 0;

    setRanking(prev => {
      const updated = prev.map(e => {
        if (e.isMyAI) return { ...e, wins: e.wins + (myWon ? 1 : 0), losses: e.losses + (!myWon && !isDraw ? 1 : 0), draws: e.draws + (isDraw ? 1 : 0) };
        if (e.id === opponent.id) return { ...e, wins: e.wins + (!myWon && !isDraw ? 1 : 0), losses: e.losses + (myWon ? 1 : 0), draws: e.draws + (isDraw ? 1 : 0) };
        return e;
      });
      return [...updated].sort((a, b) => getScore(b) - getScore(a));
    });

    if (myWon) {
      setBattleLog(prev => [{ msg: `🏆 승리! 내 AI가 ${opponent.name}을(를) 이겼습니다!`, type: 'win' }, ...prev.slice(0, 9)]);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    } else if (isDraw) {
      setBattleLog(prev => [{ msg: `🤝 무승부. ${opponent.name}과(와) 비겼습니다.`, type: 'draw' }, ...prev.slice(0, 9)]);
    } else {
      setBattleLog(prev => [{ msg: `💀 패배. ${opponent.name}에게 졌습니다.`, type: 'lose' }, ...prev.slice(0, 9)]);
    }

    setBattling(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-3 flex items-center justify-center gap-3">
          <Trophy className="w-10 h-10 text-yellow-400" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-amber-500">AI 랭킹</span>
          <Trophy className="w-10 h-10 text-yellow-400" />
        </h1>
        <p className="text-slate-400">내 AI와 허브 AI들의 랭킹. 도전해서 순위를 올려보세요!</p>
        {/* 학습량 배지 */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${training.isAutoTraining ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            내 AI 학습량: <span className="font-bold">{training.sessionAutoEpisodes.toLocaleString()}판</span>
            {training.isAutoTraining && <span className="text-xs text-emerald-300 animate-pulse">학습 중</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 랭킹 테이블 */}
        <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            <h2 className="font-bold text-lg">현재 순위</h2>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
          ) : (
            <div className="divide-y divide-white/5">
              {ranking.map((entry, idx) => {
                const rank = idx + 1;
                const score = getScore(entry);
                const total = entry.wins + entry.losses + entry.draws;
                const isBattling = battling === entry.id;

                return (
                  <motion.div key={entry.id} layout
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors ${entry.isMyAI ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'hover:bg-white/2'}`}
                  >
                    <div className="w-8 flex justify-center flex-shrink-0">{getRankIcon(rank)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold truncate ${entry.isMyAI ? 'text-blue-400' : 'text-white'}`}>{entry.name}</span>
                        {entry.isMyAI && <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/30 flex-shrink-0">나</span>}
                      </div>
                      {total > 0 && <div className="text-xs text-slate-500 mt-0.5">{entry.wins}승 {entry.losses}패 {entry.draws}무</div>}
                    </div>
                    <div className="w-28 flex-shrink-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">점수</span>
                        <span className={`font-bold ${entry.isMyAI ? 'text-blue-400' : 'text-white'}`}>{score}</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }}
                          transition={{ duration: 0.6, delay: idx * 0.05 }}
                          className={`h-full rounded-full ${rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-slate-400' : rank === 3 ? 'bg-amber-600' : entry.isMyAI ? 'bg-blue-400' : 'bg-slate-500'}`} />
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-20">
                      {!entry.isMyAI ? (
                        <button onClick={() => challenge(entry)} disabled={battling !== null}
                          className="w-full flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-1.5 px-2 rounded-lg text-xs font-bold transition-colors">
                          {isBattling ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Swords className="w-3 h-3" />도전</>}
                        </button>
                      ) : (
                        <div className="text-center"><Shield className="w-5 h-5 text-blue-400 mx-auto" /></div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* 오른쪽 패널 */}
        <div className="flex flex-col gap-4">
          {/* 내 AI 전적 */}
          {(() => {
            const myEntry = ranking.find(e => e.isMyAI);
            if (!myEntry) return null;
            const total = myEntry.wins + myEntry.losses + myEntry.draws;
            const wr = total > 0 ? Math.round((myEntry.wins / total) * 100) : 0;
            return (
              <div className="glass-panel p-5 rounded-2xl">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-blue-400" /> 내 AI 전적</h3>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-emerald-500/10 rounded-xl p-2 border border-emerald-500/20">
                    <div className="text-lg font-bold text-emerald-400">{myEntry.wins}</div>
                    <div className="text-xs text-slate-400">승</div>
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-2 border border-red-500/20">
                    <div className="text-lg font-bold text-red-400">{myEntry.losses}</div>
                    <div className="text-xs text-slate-400">패</div>
                  </div>
                  <div className="bg-slate-500/10 rounded-xl p-2 border border-slate-500/20">
                    <div className="text-lg font-bold text-slate-400">{myEntry.draws}</div>
                    <div className="text-xs text-slate-400">무</div>
                  </div>
                </div>
                {total > 0 ? (
                  <div className="text-center text-sm text-slate-400">승률 <span className="font-bold text-white">{wr}%</span></div>
                ) : (
                  <p className="text-xs text-slate-500 text-center">도전 버튼으로 다른 AI와 대결하세요!</p>
                )}
              </div>
            );
          })()}

          {/* 배틀 로그 */}
          <div className="glass-panel p-5 rounded-2xl flex-1">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> 배틀 로그</h3>
            {battleLog.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">아직 대결 기록이 없습니다</p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {battleLog.map((log, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className={`text-xs px-3 py-2 rounded-lg ${log.type === 'win' ? 'bg-emerald-500/15 text-emerald-300' : log.type === 'lose' ? 'bg-red-500/15 text-red-300' : log.type === 'draw' ? 'bg-slate-500/15 text-slate-300' : 'bg-violet-500/10 text-violet-300'}`}>
                      {log.msg}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
