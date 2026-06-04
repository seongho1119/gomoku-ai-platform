/**
 * 토큰 시스템 제거됨 — 제한 없이 모든 기능 사용 가능
 * 하위 호환성을 위해 훅 구조는 유지하되 토큰은 항상 무한
 */
export function useTokens() {
  return {
    totalManualGames: 0,
    arenaTokens: Infinity,
    autoTokens: Infinity,
    isLoaded: true,
    addManualGame: () => {},
    consumeArenaToken: () => true,
    consumeAutoToken: () => true,
    addDebugTokens: () => {},
  };
}
