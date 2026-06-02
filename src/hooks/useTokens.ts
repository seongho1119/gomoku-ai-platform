import { useState, useEffect } from 'react';

export function useTokens() {
  const [totalManualGames, setTotalManualGames] = useState(0);
  const [arenaTokens, setArenaTokens] = useState(0);
  const [autoTokens, setAutoTokens] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedManual = parseInt(localStorage.getItem('gomoku_manual_games') || '0');
    const savedArena = parseInt(localStorage.getItem('gomoku_arena_tokens') || '0');
    const savedAuto = parseInt(localStorage.getItem('gomoku_auto_tokens') || '0');
    
    setTotalManualGames(savedManual);
    setArenaTokens(savedArena);
    setAutoTokens(savedAuto);
    setIsLoaded(true);
  }, []);

  const saveState = (manual: number, arena: number, auto: number) => {
    localStorage.setItem('gomoku_manual_games', manual.toString());
    localStorage.setItem('gomoku_arena_tokens', arena.toString());
    localStorage.setItem('gomoku_auto_tokens', auto.toString());
    setTotalManualGames(manual);
    setArenaTokens(arena);
    setAutoTokens(auto);
  };

  const addManualGame = () => {
    const newManual = totalManualGames + 1;
    let newArena = arenaTokens;
    let newAuto = autoTokens;

    if (newManual % 10 === 0) {
      newArena += 1;
      newAuto += 1000;
      alert("🎉 10판 달성 보상!\n아레나 토큰 1개와 오토 토큰 1000개를 획득하셨습니다!");
    }

    saveState(newManual, newArena, newAuto);
  };

  const consumeArenaToken = () => {
    if (arenaTokens > 0) {
      saveState(totalManualGames, arenaTokens - 1, autoTokens);
      return true;
    }
    return false;
  };

  const consumeAutoToken = () => {
    if (autoTokens > 0) {
      saveState(totalManualGames, arenaTokens, autoTokens - 1);
      return true;
    }
    return false;
  };

  const addDebugTokens = () => {
    saveState(totalManualGames, arenaTokens + 5, autoTokens + 1000);
  };

  return {
    totalManualGames,
    arenaTokens,
    autoTokens,
    isLoaded,
    addManualGame,
    consumeArenaToken,
    consumeAutoToken,
    addDebugTokens
  };
}
