'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'ko';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  en: {
    home: "Home",
    studio: "Studio",
    hub: "Hub",
    arena: "Arena",
    heroTitle: "Master",
    heroTitle2: "with AI",
    heroSubtitle: "Train your own Reinforcement Learning model directly in your browser. Upload your best AIs and challenge other players' models in the Arena.",
    studioTitle: "AI Studio (Teach Mode)",
    studioDesc: "Teach the AI by playing a game yourself. The AI will observe your moves and learn the winning strategy.",
    startTraining: "Start Training",
    stopTraining: "Stop Training",
    teachAI: "Teach AI (Train from moves)",
    upload: "Upload",
    hubTitle: "Model Hub",
    hubDesc: "Discover and challenge Gomoku AIs created by the community.",
    challenge: "Challenge",
    arenaTitle: "Battle Arena",
    arenaDesc: "You are playing as Black. Match 5 stones in a row to win.",
    restart: "Restart Game",
    yourTurn: "Your Turn (Black)",
    aiThinking: "AI is thinking...",
    youWin: "🎉 You Win!",
    aiWins: "🤖 AI Wins!",
    draw: "🤝 Draw",
    episodes: "Episodes",
    wins: "Wins",
    winRate: "Win Rate",
    clearBoard: "Clear Board",
  },
  ko: {
    home: "홈",
    studio: "스튜디오",
    hub: "모델 허브",
    arena: "아레나",
    heroTitle: "AI와 함께하는",
    heroTitle2: "마스터하기",
    heroSubtitle: "브라우저에서 직접 강화학습 모델을 훈련시켜 보세요. 최고의 AI를 업로드하고 아레나에서 다른 플레이어의 모델에 도전하세요.",
    studioTitle: "AI 스튜디오 (직접 학습 모드)",
    studioDesc: "오목을 직접 두면서 AI를 가르쳐보세요. AI가 승리 패턴을 분석하여 학습합니다.",
    startTraining: "자동 학습 시작",
    stopTraining: "학습 중지",
    teachAI: "현재 기보로 AI 학습시키기",
    upload: "업로드",
    hubTitle: "모델 허브",
    hubDesc: "커뮤니티가 만든 다양한 오목 AI를 발견하고 도전해보세요.",
    challenge: "도전하기",
    arenaTitle: "배틀 아레나",
    arenaDesc: "당신은 흑(Black)입니다. 5개의 돌을 연속으로 놓으면 승리합니다.",
    restart: "게임 재시작",
    yourTurn: "당신의 차례 (흑)",
    aiThinking: "AI가 생각 중입니다...",
    youWin: "🎉 승리하셨습니다!",
    aiWins: "🤖 AI 승리!",
    draw: "🤝 무승부",
    episodes: "학습 횟수",
    wins: "승리",
    winRate: "승률",
    clearBoard: "보드 초기화",
  }
};

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ko'); // Default to Korean as user requested

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'ko' : 'en'));
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
