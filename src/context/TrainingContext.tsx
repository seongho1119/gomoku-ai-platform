'use client';

import React, {
  createContext, useContext, useState, useRef, useEffect, ReactNode,
} from 'react';
import { GomokuAI, BrainSize } from '@/lib/ai';
import { BoardState, createEmptyBoard } from '@/lib/gomoku';
import {
  isTrainingRunning, getTrainingEpisodes, startBackgroundTraining,
  stopBackgroundTraining, updateTrainingCallbacks,
  setVisualizationMode, isVisualizationOn,
  setHardwareParams, getHardwareParams, getCurrentEps,
  getNumWorkers, getReplaySize, adjustWorkerCount, WorkerState,
  setGpuThrottle, setReplayMax
} from '@/lib/trainingWorker';
import {
  TFBackend, setTFBackend, getCurrentBackend,
  checkBackendAvailability, BACKEND_OPTIONS, BackendOption,
  autoSelectBestBackend,
} from '@/lib/tfBackend';
import { useAuth } from '@/hooks/useAuth';

// ─── 하드웨어 프리셋 ──────────────────────────────────────────────────────────
export interface HwPreset {
  id: string;
  label: string;
  icon: string;
  desc: string;
  yieldEvery: number;
  batchSize: number;
}

export const HW_PRESETS: HwPreset[] = [
  { id: 'eco',      label: '절약',  icon: '🐢', desc: '배치 64 (메모리 절약)',   yieldEvery: 0, batchSize: 64  },
  { id: 'balanced', label: '균형',  icon: '⚖️', desc: '배치 256 (기본값)',       yieldEvery: 0, batchSize: 256  },
  { id: 'perf',     label: '성능',  icon: '⚡', desc: '배치 1024 (GPU 효율)',     yieldEvery: 0, batchSize: 1024  },
  { id: 'max',      label: '최대',  icon: '🔥', desc: '배치 4096 (풀 로드)',    yieldEvery: 0, batchSize: 4096 },
];

// ─── 기기 성능 자동 감지 ───────────────────────────────────────────────────────
function detectHwPreset(): HwPreset {
  if (typeof window === 'undefined') return HW_PRESETS[1]; // SSR fallback
  const cores = navigator.hardwareConcurrency ?? 2;
  const memory = (navigator as any).deviceMemory ?? 2; // GB (일부 브라우저만)
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const hasWebGPU = 'gpu' in navigator;

  if (isMobile || memory <= 2 || cores <= 2) {
    return HW_PRESETS[0]; // 🐢 절약 (배치 16)
  } else if (hasWebGPU || (cores >= 8 && memory >= 8)) {
    return HW_PRESETS[3]; // 🔥 최대 (배치 128)
  } else if (cores >= 4 && memory >= 4) {
    return HW_PRESETS[2]; // ⚡ 성능 (배치 64)
  } else {
    return HW_PRESETS[1]; // ⚖️ 균형 (배치 32)
  }
}

// ─── 컨텍스트 타입 ────────────────────────────────────────────────────────────
interface TrainingContextType {
  aiRef: React.MutableRefObject<GomokuAI | null>;
  isInitializing: boolean;
  brainSize: BrainSize;
  isAutoTraining: boolean;
  sessionAutoEpisodes: number;
  liveBoard: BoardState;
  isVisualize: boolean;
  eps: number;
  hwPresetId: string;
  batchSize: number;
  numWorkers: number;
  workerStates: WorkerState[];
  maxCores: number;
  setNumWorkers: (n: number) => void;
  replaySize: number;
  gpuThrottle: number;
  setGpuThrottle: (ms: number) => void;
  replayMax: number;
  setReplayMax: (size: number) => void;
  currentBackend: TFBackend;
  availableBackends: Record<TFBackend, boolean>;
  backendOptions: BackendOption[];
  setHwPreset: (preset: HwPreset) => void;
  setCustomBatch: (n: number) => void;
  changeBackend: (backend: TFBackend) => Promise<void>;
  startAutoTraining: () => Promise<boolean>;
  stopAutoTraining: () => void;
  toggleVisualize: () => void;
  resetAI: (newSize: BrainSize) => Promise<void>;
  deleteAI: () => Promise<void>;
}

const TrainingContext = createContext<TrainingContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────
export function TrainingProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: authLoaded } = useAuth();

  const [isInitializing, setIsInitializing] = useState(true);
  const [brainSize, setBrainSize] = useState<BrainSize>('standard');
  const [isAutoTraining, setIsAutoTraining] = useState(isTrainingRunning());
  const [sessionAutoEpisodes, setSessionAutoEpisodes] = useState(getTrainingEpisodes());
  const [liveBoard, setLiveBoard] = useState<BoardState>(createEmptyBoard());
  const [isVisualize, setIsVisualize] = useState(isVisualizationOn());
  const [eps, setEps] = useState(getCurrentEps());
  const [numWorkers, setNumWorkersState] = useState(getNumWorkers());
  const [workerStates, setWorkerStates] = useState<WorkerState[]>([]);
  const [maxCores, setMaxCores] = useState(8);
  const [replaySize, setReplaySize] = useState(0);
  const [gpuThrottle, setGpuThrottleState] = useState(300);
  const [replayMax, setReplayMaxState] = useState(100000);
  const [hwPresetId, setHwPresetId] = useState('balanced');
  const [batchSize, setBatchSize] = useState(getHardwareParams().batchSize);
  const [currentBackend, setCurrentBackend] = useState<TFBackend>('wasm');
  const [availableBackends, setAvailableBackends] = useState<Record<TFBackend, boolean>>(
    { webgpu: false, webgl: true, wasm: true }
  );

  const aiRef = useRef<GomokuAI | null>(null);

  // 기기 성능 감지 후 프리셋 자동 적용
  useEffect(() => {
    const preset = detectHwPreset();
    setHwPresetId(preset.id);
    setBatchSize(preset.batchSize);
    setHardwareParams(0, preset.batchSize);
    if (typeof window !== 'undefined') {
      setMaxCores(navigator.hardwareConcurrency ?? 8);
    }
  }, []);

  // 백엔드 가용성 확인 + 최적 백엔드 자동 선택
  useEffect(() => {
    checkBackendAvailability().then(async avail => {
      setAvailableBackends(avail);
      const best = await autoSelectBestBackend();
      const actual = await setTFBackend(best);
      setCurrentBackend(actual);
      console.log(`[TrainingContext] 자동 선택 백엔드: ${actual}`);
    });
  }, []);

  // 재방문 시 콜백 재연결
  useEffect(() => {
    if (isTrainingRunning()) {
      setIsAutoTraining(true);
      setSessionAutoEpisodes(getTrainingEpisodes());
      updateTrainingCallbacks(
        (n) => setSessionAutoEpisodes(n),
        () => setIsAutoTraining(false),
        (b) => setLiveBoard(b),
        (e) => setEps(e),
        (states) => setWorkerStates(states)
      );
    }
  }, []);

  const setNumWorkers = (n: number) => {
    setNumWorkersState(n);
    if (aiRef.current) {
      adjustWorkerCount(n, aiRef.current);
    }
  };
  // 로그인 상태가 확정되면 해당 계정의 AI를 로드
  // user가 바뀌면(로그인/로그아웃) AI를 해당 계정 것으로 교체
  useEffect(() => {
    if (!authLoaded) return; // localStorage 읽기 완료 대기

    const storageKey = user ? `gomoku-ai-brain-${user.userId}` : 'gomoku-ai-brain';

    const initAI = async () => {
      // 이미 학습 중이면 중지
      if (isTrainingRunning()) {
        stopBackgroundTraining();
        setIsAutoTraining(false);
      }

      setIsInitializing(true);
      const ai = new GomokuAI('standard', storageKey);

      // 업데이트 전 localStorage에서 에피소드 수 도또 읽기 (모델 로드 실패 시에도 유지하기 위해)
      const savedEps = localStorage.getItem(`${storageKey}-episodes`);
      const persistedEpisodes = savedEps ? (parseInt(savedEps, 10) || 0) : 0;

      const loaded = await ai.loadMemory();
      if (!loaded) {
        // 모델은 없지만 에피소드 수는 보존 (업데이트 후에도 유지)
        ai.totalEpisodes = persistedEpisodes;
        console.log(`[AI] '${storageKey}' 신규 브레인 생성 (에피소드 복원: ${persistedEpisodes})`);
      } else {
        setBrainSize(ai.brainSize);
        // loadMemory()가 이미 totalEpisodes를 복원하지만, localStorage 직접 값이 더 클 경우 보정
        if (persistedEpisodes > ai.totalEpisodes) {
          ai.totalEpisodes = persistedEpisodes;
        }
        console.log(`[AI] '${storageKey}' 로드 완료 (에피소드: ${ai.totalEpisodes})`);
      }
      setSessionAutoEpisodes(ai.totalEpisodes);
      aiRef.current = ai;
      setIsInitializing(false);
    };

    initAI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, user?.userId]);

  const resetAI = async (newSize: BrainSize) => {
    if (!authLoaded) return;
    const storageKey = user ? `gomoku-ai-brain-${user.userId}` : 'gomoku-ai-brain';
    stopBackgroundTraining();
    setIsAutoTraining(false);
    setSessionAutoEpisodes(0);
    const newAi = new GomokuAI(newSize, storageKey);
    aiRef.current = newAi;
    setBrainSize(newSize);
  };

  const deleteAI = async () => {
    if (!authLoaded) return;
    const storageKey = user ? `gomoku-ai-brain-${user.userId}` : 'gomoku-ai-brain';

    // 1. 학습 중지
    stopBackgroundTraining();
    setIsAutoTraining(false);
    setSessionAutoEpisodes(0);

    // 2. 로컬스토리지 완전 초기화
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}-personality`);
        localStorage.removeItem(`${storageKey}-brainSize`);
        // tensorflowjs 저장 데이터 삭제
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
          if (k.startsWith(`tensorflowjs_${storageKey}`)) {
            localStorage.removeItem(k);
          }
        });
      } catch (err) {
        console.error('로컬스토리지 초기화 에러:', err);
      }
    }

    // 3. 클라우드 모델 삭제 (로그인 상태일 때)
    if (user) {
      try {
        await fetch('/api/models', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username }),
        });
      } catch (err) {
        console.error('클라우드 모델 삭제 실패:', err);
      }
    }

    // 4. 깨끗한 AI 브레인 재로드
    const freshAi = new GomokuAI('standard', storageKey);
    aiRef.current = freshAi;
    setBrainSize('standard');
  };

  const startAutoTraining = async (): Promise<boolean> => {
    if (!aiRef.current) return false;
    if (isTrainingRunning()) {
      updateTrainingCallbacks(
        (n) => { 
          setSessionAutoEpisodes(n); 
          if (aiRef.current) aiRef.current.totalEpisodes = n; 
        },
        () => setIsAutoTraining(false),
        (b) => setLiveBoard(b),
        (e) => setEps(e),
        (states) => setWorkerStates(states)
      );
      setIsAutoTraining(true);
      return true;
    }
    const started = await startBackgroundTraining(
      aiRef.current,
      aiRef.current.totalEpisodes,
      (n) => { 
        setSessionAutoEpisodes(n);
        if (aiRef.current) aiRef.current.totalEpisodes = n;
        setNumWorkersState(getNumWorkers()); 
        setReplaySize(getReplaySize()); 
      },
      () => setIsAutoTraining(false),
      (b) => setLiveBoard(b),
      (e) => setEps(e),
      (states) => setWorkerStates(states)
    );
    if (started) {
      setIsAutoTraining(true);
      setEps(0);
      setLiveBoard(createEmptyBoard());
    }
    return started;
  };

  const stopAutoTraining = () => {
    stopBackgroundTraining();
    setIsAutoTraining(false);
    setEps(0);
    if (aiRef.current) aiRef.current.saveMemory();
  };

  const toggleVisualize = () => {
    const next = !isVisualize;
    setIsVisualize(next);
    setVisualizationMode(next);
  };

  const changeGpuThrottle = (ms: number) => {
    setGpuThrottleState(ms);
    setGpuThrottle(ms);
  };

  const changeReplayMax = (size: number) => {
    setReplayMaxState(size);
    setReplayMax(size);
  };

  const setHwPreset = (preset: HwPreset) => {
    setHwPresetId(preset.id);
    setBatchSize(preset.batchSize);
    setHardwareParams(0, preset.batchSize);

    // 하드웨어 프리셋에 연동하여 GPU/RAM 값 조율
    if (preset.id === 'eco') {
      changeGpuThrottle(800);
      changeReplayMax(50000);
    } else if (preset.id === 'balanced') {
      changeGpuThrottle(300);
      changeReplayMax(100000);
    } else if (preset.id === 'perf') {
      changeGpuThrottle(50);
      changeReplayMax(150000);
    } else if (preset.id === 'max') {
      changeGpuThrottle(0); // 0ms = 제한 없음, GPU 풀 로드
      changeReplayMax(250000);
    }
  };

  const setCustomBatch = (n: number) => {
    setBatchSize(n);
    setHwPresetId('custom');
    setHardwareParams(0, n);
  };

  const changeBackend = async (backend: TFBackend) => {
    setIsInitializing(true);
    const actual = await setTFBackend(backend);
    setCurrentBackend(actual);
    setIsInitializing(false);
  };

  return (
    <TrainingContext.Provider value={{
      aiRef, isInitializing, brainSize,
      isAutoTraining, sessionAutoEpisodes, liveBoard,
      isVisualize, eps,
      hwPresetId, batchSize,
      numWorkers, workerStates, maxCores, setNumWorkers, replaySize,
      gpuThrottle, setGpuThrottle: changeGpuThrottle,
      replayMax, setReplayMax: changeReplayMax,
      currentBackend, availableBackends, backendOptions: BACKEND_OPTIONS,
      setHwPreset, setCustomBatch,
      changeBackend,
      startAutoTraining, stopAutoTraining, toggleVisualize, resetAI, deleteAI,
    }}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('useTraining must be used within TrainingProvider');
  return ctx;
}
