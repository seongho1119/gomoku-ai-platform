/**
 * trainingWorker.ts — 병렬 멀티코어 학습 조율자
 *
 * 아키텍처:
 *   selfPlayWorker (CPU 코어 N개) → 경험 버퍼 → GPU 학습 (WebGPU/WASM)
 *
 * - N개의 Web Worker가 동시에 자가 대국을 진행
 * - 경험 재플레이 버퍼(최대 REPLAY_MAX)에 수집
 * - 버퍼가 충분하면 GPU에서 랜덤 배치 학습
 */

import { GomokuAI } from './ai';
import { BoardState, createEmptyBoard } from './gomoku';

// ─── 상수 & 런타임 제한 ────────────────────────────────────────────────────────
const BOARD_CELLS = 15 * 15;
let _replayMax = 100_000;       // 최대 경험 버퍼 크기 (동적 RAM 제한)
const GAMES_PER_BATCH = 5;     // 워커 1개가 한 번에 처리할 게임 수

let _gpuThrottleMs = 300;       // GPU 학습 최소 주기 (ms)
let _lastTrainTime = 0;
let _throttleTimer: any = null;

// ─── 모듈 상태 ────────────────────────────────────────────────────────────────
let _running  = false;
let _episodes = 0;        // 완료된 학습 게임 수
let _visualize = false;
let _batchSize = 128;
let _numWorkers = 1;

// 경험 재플레이 버퍼 (Float32 연속 배열 — GC 부담 최소화)
let _replayBoards:  Float32Array = new Float32Array(0);
let _replayRewards: Float32Array = new Float32Array(0);
let _replayHead  = 0;   // 다음 쓸 위치 (링 버퍼)
let _replaySize  = 0;   // 현재 저장된 수

// EPS 추적
let _epsWindowStart = Date.now();
let _epsWindowCount = 0;
let _currentEps     = 0;

// 워커 목록
let _workers: Worker[] = [];

export interface WorkerState {
  id: number;
  sps: number;
  active: boolean;
}
let _workerStates: WorkerState[] = [];

// 콜백
type ProgressCb = (episodes: number) => void;
type CompleteCb = () => void;
type BoardCb    = (board: BoardState) => void;
type EpsCb      = (eps: number) => void;
export type WorkerStatesCb = (states: WorkerState[]) => void;

let _onProgress: ProgressCb = () => {};
let _onComplete: CompleteCb = () => {};
let _onBoard:    BoardCb    = () => {};
let _onEps:      EpsCb      = () => {};
let _onWorkerStates: WorkerStatesCb = () => {};

// ─── 공개 API ────────────────────────────────────────────────────────────────

export function isTrainingRunning():   boolean { return _running; }
export function getTrainingEpisodes(): number  { return _episodes; }
export function getCurrentEps():       number  { return _currentEps; }
export function getNumWorkers():       number  { return _numWorkers; }
export function getReplaySize():       number  { return _replaySize; }

export function updateTrainingCallbacks(
  onProgress: ProgressCb, onComplete: CompleteCb,
  onBoard?: BoardCb, onEps?: EpsCb,
  onWorkerStates?: WorkerStatesCb
) {
  _onProgress = onProgress;
  _onComplete = onComplete;
  if (onBoard) _onBoard = onBoard;
  if (onEps)   _onEps   = onEps;
  if (onWorkerStates) _onWorkerStates = onWorkerStates;
}

export function setVisualizationMode(enabled: boolean) { _visualize = enabled; }
export function isVisualizationOn(): boolean { return _visualize; }

export function setHardwareParams(_yield: number, batchSize: number) {
  _batchSize = batchSize;
}
export function getHardwareParams() {
  return { yieldEvery: 0, batchSize: _batchSize, gpuThrottle: _gpuThrottleMs, replayMax: _replayMax };
}

// ─── 경험 재플레이 버퍼 ──────────────────────────────────────────────────────

function initReplayBuffer(maxSize?: number) {
  if (maxSize) _replayMax = maxSize;
  _replayBoards  = new Float32Array(_replayMax * BOARD_CELLS);
  _replayRewards = new Float32Array(_replayMax);
  _replayHead = 0;
  _replaySize = 0;
}

function addToReplay(boards: Float32Array, rewards: Float32Array) {
  const n = rewards.length;
  for (let i = 0; i < n; i++) {
    _replayBoards.set(boards.subarray(i * BOARD_CELLS, (i + 1) * BOARD_CELLS), _replayHead * BOARD_CELLS);
    _replayRewards[_replayHead] = rewards[i];
    _replayHead = (_replayHead + 1) % _replayMax;
    if (_replaySize < _replayMax) _replaySize++;
  }
}

/** 랜덤 배치 샘플링 → AI.train() 호환 형식 */
function sampleBatch(batchSize: number): { board: number[]; reward: number }[] {
  const n = Math.min(batchSize, _replaySize);
  const batch: { board: number[]; reward: number }[] = [];
  const used = new Set<number>();

  while (batch.length < n) {
    const idx = Math.floor(Math.random() * _replaySize);
    if (used.has(idx)) continue;
    used.add(idx);

    const offset = idx * BOARD_CELLS;
    batch.push({
      board:  Array.from(_replayBoards.subarray(offset, offset + BOARD_CELLS)),
      reward: _replayRewards[idx],
    });
  }
  return batch;
}

// ─── 학습 루프 ────────────────────────────────────────────────────────────────

let _pendingTrain = false;

async function maybeTrainOnReplay(ai: GomokuAI) {
  if (_pendingTrain || _replaySize < _batchSize * 2) return;

  // GPU 학습 주기 제어 (Throttle)
  const now = Date.now();
  if (now - _lastTrainTime < _gpuThrottleMs) return;

  _pendingTrain = true;
  try {
    const batch = sampleBatch(_batchSize);
    await ai.train(batch, _batchSize);
    _lastTrainTime = Date.now();
  } finally {
    _pendingTrain = false;
  }
}

// ─── 워커 관리 ────────────────────────────────────────────────────────────────

function makeWorker(id: number, ai: GomokuAI): Worker {
  const w = new Worker(
    new URL('./selfPlayWorker.ts', import.meta.url),
    { type: 'module' }
  );

  w.onmessage = async (e: MessageEvent) => {
    if (!_running) return;

    const data = e.data;

    // 실시간 성능 지표 수신 (로컬 메모리만 갱신, 콜백 호출은 스로틀링 타이머가 담당)
    if (data.type === 'performance') {
      const processed = data.processedSteps;
      if (_workerStates[id]) {
        _workerStates[id].sps = processed;
        _workerStates[id].active = true;
      }
      return;
    }

    // 게임 완료 및 경험 수집 수신
    if (data.type === 'episode_complete') {
      const { count, boards, rewards } = data as {
        count: number;
        boards: Float32Array;
        rewards: Float32Array;
      };

      // 버퍼에 추가
      addToReplay(boards, rewards);

      // 에피소드 카운트 (경험 수 / 평균 게임 길이 ~45)
      const gamesCompleted = Math.round(count / 45);
      _episodes += gamesCompleted;
      _epsWindowCount += gamesCompleted;

      // EPS 계산 (콜백 업데이트는 500ms 스로틀러 타이머에서 일괄 처리)
      const now = Date.now();
      const elapsed = (now - _epsWindowStart) / 1000;
      if (elapsed >= 1.0) {
        _currentEps = Math.round(_epsWindowCount / elapsed);
        _epsWindowCount = 0;
        _epsWindowStart = now;
      }

      // GPU 학습
      await maybeTrainOnReplay(ai);

      // 주기적 저장 (500 게임마다)
      if (_episodes % 500 < _numWorkers) {
        await ai.saveMemory();
      }
    }
  };

  w.onerror = (err) => {
    console.error(`[Worker ${id} Error]`, err);
  };

  return w;
}

// ─── 공개: 학습 시작/중지 ────────────────────────────────────────────────────

async function setupWorkerCores(ai: GomokuAI) {
  // 기존 워커 완전 종료
  _workers.forEach(w => { try { w.terminate(); } catch {} });
  _workers = [];

  _workerStates = Array.from({ length: _numWorkers }, (_, i) => ({
    id: i,
    sps: 0,
    active: false,
  }));
  _onWorkerStates([..._workerStates]);

  // CPU 코어 수에 따라 한 틱당 도는 게임 수(gamesPerBatch)와 CPU 양보 시간(yieldMs)을 동적으로 조절
  // 메인 스레드 프리징은 Worker가 보내는 잦은 메시지(postMessage) 오버헤드에서 발생합니다.
  // 코어가 많을수록 한 번에 많은 게임을 묶어서 처리(Batch 증가)하여 메시지 송신 빈도를 대폭 줄임과 동시에 
  // yieldMs를 0 또는 1로 최소화하여 CPU를 100% 한계까지 갈구는 극한의 SPS 성능을 끌어냅니다.
  let gamesPerBatch = 10;
  let yieldMs = 1;
  
  if (_numWorkers >= 24) {
    gamesPerBatch = 40; // 32코어 등 극한 환경에서는 한 번에 40게임씩 묶어 보고
  } else if (_numWorkers >= 12) {
    gamesPerBatch = 30;
  } else if (_numWorkers >= 6) {
    gamesPerBatch = 20;
  }

  for (let i = 0; i < _numWorkers; i++) {
    // 30ms 간격을 두고 워커를 하나씩 순차적으로 생성하여 브라우저 컴파일 병목/프리징 현상을 차단
    await new Promise(resolve => setTimeout(resolve, 30));
    
    // 루프 도중 정지되었으면 중단
    if (!_running && i > 0) break;

    try {
      const w = makeWorker(i, ai);
      w.postMessage({
        type: 'init',
        exploreRate: 0.2,
        gamesPerBatch,
        yieldMs
      });
      _workers.push(w);

      if (_running) {
        w.postMessage({ type: 'start' });
      }
    } catch (err) {
      console.error(`[Training] 워커 ${i} 생성 실패:`, err);
    }
  }

  if (_workers.length === 0 && _running) {
    console.warn('[Training] 워커 생성 실패 — 단일 스레드 폴백');
    _runFallback(ai);
  }
}

export function adjustWorkerCount(count: number, ai: GomokuAI) {
  _numWorkers = count;
  if (_running) {
    setupWorkerCores(ai);
  }
}

export async function startBackgroundTraining(
  ai:         GomokuAI,
  onProgress: ProgressCb,
  onComplete: CompleteCb,
  onBoard?:   BoardCb,
  onEps?:     EpsCb,
  onWorkerStates?: WorkerStatesCb
): Promise<boolean> {
  if (_running) {
    updateTrainingCallbacks(onProgress, onComplete, onBoard, onEps, onWorkerStates);
    return false;
  }

  _running = true;
  _episodes = 0;
  _epsWindowStart = Date.now();
  _epsWindowCount = 0;
  _currentEps     = 0;
  _onProgress = onProgress;
  _onComplete = onComplete;
  if (onBoard) _onBoard = onBoard;
  if (onEps)   _onEps   = onEps;
  if (onWorkerStates) _onWorkerStates = onWorkerStates;

  // 경험 버퍼 초기화 (동적 버퍼 크기 적용)
  initReplayBuffer(_replayMax);

  // CPU 코어 수 감지 (최대 32개까지 완화)
  _numWorkers = Math.max(1, Math.min(
    (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4),
    32
  ));
  console.log(`[Training] 워커 수: ${_numWorkers}개 코어`);

  setupWorkerCores(ai);

  // React 상태 업데이트 스로틀러 타이머 구동 (500ms 단위로 오버헤드 최적화)
  // 에피소드 수, EPS, 워커 상태들을 한 번에 주기적으로 업데이트
  if (_throttleTimer) clearInterval(_throttleTimer);
  _throttleTimer = setInterval(() => {
    if (_running) {
      _onWorkerStates([..._workerStates]);
      _onProgress(_episodes);
      _onEps(_currentEps);
    }
  }, 500);

  return true;
}

export function stopBackgroundTraining(): void {
  _running = false;
  if (_throttleTimer) {
    clearInterval(_throttleTimer);
    _throttleTimer = null;
  }
  _workers.forEach(w => { try { w.terminate(); } catch {} });
  _workers = [];
  _workerStates = _workerStates.map(s => ({ ...s, active: false, sps: 0 }));
  _onWorkerStates([..._workerStates]);
  _onComplete();
}

export function setGpuThrottle(ms: number) {
  _gpuThrottleMs = ms;
  console.log(`[Training] GPU 학습 스로틀 주기 설정: ${ms}ms`);
}

export function setReplayMax(maxSize: number) {
  _replayMax = maxSize;
  // 메모리 확보를 위해 버퍼 즉시 리사이징 및 클리어
  initReplayBuffer(maxSize);
  console.log(`[Training] RAM 버퍼 크기 재설정: ${maxSize}`);
}

// ─── 폴백: 단일 스레드 학습 ──────────────────────────────────────────────────

import { checkWin, isBoardFull, getAvailableMoves, Player } from './gomoku';

async function _runFallback(ai: GomokuAI) {
  while (_running) {
    const { winner, history } = await _playOneGame(ai);
    if (!_running) break;

    _episodes++;
    _epsWindowCount++;
    _onProgress(_episodes);

    const now = Date.now();
    const elapsed = (now - _epsWindowStart) / 1000;
    if (elapsed >= 1.0) {
      _currentEps = Math.round(_epsWindowCount / elapsed);
      _epsWindowCount = 0;
      _epsWindowStart = now;
      _onEps(_currentEps);
    }

    if (winner !== null) {
      const experiences = history.map(h => ({
        board: h.board,
        reward: h.player === winner ? 1 : -1,
      }));
      await ai.train(experiences, _batchSize);
      if (_episodes % 50 === 0) await ai.saveMemory();
    }
  }
  await ai.saveMemory();
  _running = false;
}

async function _playOneGame(ai: GomokuAI) {
  const board = createEmptyBoard();
  let turn: Player = 1;
  const history: { board: number[]; player: Player }[] = [];
  let winner: Player | null = null;

  for (let step = 0; step < 225 && _running; step++) {
    const moves = getAvailableMoves(board);
    if (!moves.length) break;
    const move = Math.random() < 0.2
      ? moves[Math.floor(Math.random() * moves.length)]
      : await ai.predictMove(board, turn);
    if (!move || move.row === -1) break;
    history.push({ board: ai.flattenBoard(board, turn), player: turn });
    board[move.row][move.col] = turn;
    if (_visualize) _onBoard(board.map(r => [...r]) as BoardState);
    if (checkWin(board, move.row, move.col, turn)) { winner = turn; break; }
    if (isBoardFull(board)) break;
    turn = turn === 1 ? 2 : 1;
  }
  return { winner, history };
}
