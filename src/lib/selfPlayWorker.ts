/**
 * selfPlayWorker.ts
 * CPU 코어 1개를 전담으로 사용하는 자가 대국 워커.
 * TF.js 없이 순수 JS 휴리스틱으로 빠르게 게임을 생성하고
 * 경험 데이터를 메인 스레드로 전송합니다.
 */

const BOARD_SIZE = 15;
const WIN = 5;

// ─── 게임 로직 (자체 포함) ──────────────────────────────────────────────────

type Board = number[][];
type Player = 1 | 2;
type Exp = { board: number[]; reward: number };

function mkBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(0));
}

function checkWin(board: Board, r: number, c: number, p: Player): boolean {
  const dirs: [number, number][] = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let cnt = 1;
    for (let d = 1; d < WIN; d++) {
      const nr = r + dr * d, nc = c + dc * d;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === p) cnt++;
      else break;
    }
    for (let d = 1; d < WIN; d++) {
      const nr = r - dr * d, nc = c - dc * d;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === p) cnt++;
      else break;
    }
    if (cnt >= WIN) return true;
  }
  return false;
}

/** 기존 돌 주변 2칸 이내의 빈 칸만 후보로 반환 */
function getCandidates(board: Board): [number, number][] {
  const set = new Set<number>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) {
            set.add(nr * BOARD_SIZE + nc);
          }
        }
      }
    }
  }
  if (set.size === 0) return [[7, 7]];
  return [...set].map(k => [Math.floor(k / BOARD_SIZE), k % BOARD_SIZE] as [number, number]);
}

/** 방향별 연속 수 계산 */
function lineScore(board: Board, r: number, c: number, dr: number, dc: number, p: Player): number {
  let cnt = 0;
  for (let d = 1; d < WIN; d++) {
    const nr = r + dr * d, nc = c + dc * d;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === p) cnt++;
    else break;
  }
  for (let d = 1; d < WIN; d++) {
    const nr = r - dr * d, nc = c - dc * d;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === p) cnt++;
    else break;
  }
  return cnt;
}

/** 휴리스틱 점수 계산 */
function scoreCell(board: Board, r: number, c: number, p: Player): number {
  const opp = (p === 1 ? 2 : 1) as Player;
  const dirs: [number, number][] = [[0,1],[1,0],[1,1],[1,-1]];
  let score = 0;
  for (const [dr, dc] of dirs) {
    const my = lineScore(board, r, c, dr, dc, p);
    const op = lineScore(board, r, c, dr, dc, opp);
    if (my >= 4) score += 1_000_000;
    else if (op >= 4) score += 900_000;
    else if (my === 3) score += 10_000;
    else if (op === 3) score +=  9_000;
    else if (my === 2) score +=    200;
    else if (op === 2) score +=    180;
    score += my * 10;
  }
  // 중앙 선호
  score -= (Math.abs(r - 7) + Math.abs(c - 7)) * 3;
  return score;
}

/** 다음 수 선택 (20% 탐험) */
function pickMove(board: Board, p: Player, exploreRate = 0.2): [number, number] {
  const moves = getCandidates(board);
  if (Math.random() < exploreRate) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  let best = -Infinity, bestMove = moves[0];
  for (const [r, c] of moves) {
    const s = scoreCell(board, r, c, p);
    if (s > best) { best = s; bestMove = [r, c]; }
  }
  return bestMove;
}

/** 보드를 1D float 배열로 변환 */
function flatten(board: Board, p: Player): number[] {
  const arr = new Array(BOARD_SIZE * BOARD_SIZE);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = board[r][c];
      arr[r * BOARD_SIZE + c] = v === p ? 1 : v === 0 ? 0 : -1;
    }
  }
  return arr;
}

/** 한 게임 플레이 → 경험 목록 반환 */
function playGame(exploreRate: number): Exp[] {
  const board = mkBoard();
  let turn: Player = 1;
  const history: { board: number[]; player: Player }[] = [];

  for (let step = 0; step < BOARD_SIZE * BOARD_SIZE; step++) {
    const [r, c] = pickMove(board, turn, exploreRate);
    history.push({ board: flatten(board, turn), player: turn });
    board[r][c] = turn;

    if (checkWin(board, r, c, turn)) {
      const winner = turn;
      return history.map(h => ({
        board: h.board,
        reward: h.player === winner ? 1.0 : -1.0,
      }));
    }

    // 무승부
    const candidates = getCandidates(board);
    if (candidates.length === 0) break;
    turn = turn === 1 ? 2 : 1;
  }

  return history.map(h => ({ board: h.board, reward: 0 }));
}

// ─── 메시지 핸들러 & 무한 루프 ──────────────────────────────────────────────────

let active = false;
let exploreRate = 0.2;
let gamesPerBatch = 10;
let yieldMs = 10;
let isVisualize = false;
let localStepsAccum = 0;
let lastReportTime = Date.now();

// MessageChannel을 이용해 최소 4ms의 setTimeout 딜레이를 회피 (0ms 양보)
const channel = new MessageChannel();

function runInfiniteLoop() {
  active = true;
  localStepsAccum = 0;
  lastReportTime = Date.now();

  channel.port1.onmessage = () => {
    if (!active) return;

    // 동적으로 조율된 gamesPerBatch 만큼 대국을 시뮬레이션
    const experiences: Exp[] = [];
    let lastBoard: number[] | null = null;
    
    for (let g = 0; g < gamesPerBatch; g++) {
      const exp = playGame(exploreRate);
      experiences.push(...exp);
      localStepsAccum += exp.length;
      if (isVisualize && g === gamesPerBatch - 1 && exp.length > 0) {
        lastBoard = exp[exp.length - 1].board;
      }
    }

    // 경험 전송 (Transferable)
    if (experiences.length > 0) {
      const flatBoards  = new Float32Array(experiences.length * BOARD_SIZE * BOARD_SIZE);
      const flatRewards = new Float32Array(experiences.length);

      for (let i = 0; i < experiences.length; i++) {
        flatBoards.set(experiences[i].board, i * BOARD_SIZE * BOARD_SIZE);
        flatRewards[i] = experiences[i].reward;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (self as any).postMessage(
        { type: 'episode_complete', count: experiences.length, boards: flatBoards, rewards: flatRewards },
        [flatBoards.buffer, flatRewards.buffer]
      );
    }

    // 60ms 주기 성능 보고 (시각화 보드 포함 가능)
    const now = Date.now();
    if (now - lastReportTime > 60) {
      const msg: any = { type: 'performance', processedSteps: localStepsAccum };
      if (isVisualize && lastBoard) {
        msg.board = lastBoard; // 1D 배열
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (self as any).postMessage(msg);
      localStepsAccum = 0;
      lastReportTime = now;
    }

    // 설정된 yieldMs 만큼 대기
    if (yieldMs <= 1) {
      // 0~1ms일 경우 MessageChannel을 통해 즉각 이벤트 루프의 다음 틱으로 넘겨 100% CPU 활용
      channel.port2.postMessage(null);
    } else {
      setTimeout(() => channel.port2.postMessage(null), yieldMs);
    }
  };

  // 루프 시작
  channel.port2.postMessage(null);
}


self.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (data.type === 'init') {
    exploreRate = data.exploreRate ?? 0.2;
    gamesPerBatch = data.gamesPerBatch ?? 10;
    yieldMs = data.yieldMs ?? 10;
    isVisualize = data.isVisualize ?? false;
    active = false;
  } else if (data.type === 'update_params') {
    exploreRate = data.exploreRate ?? exploreRate;
    gamesPerBatch = data.gamesPerBatch ?? gamesPerBatch;
    yieldMs = data.yieldMs ?? yieldMs;
    isVisualize = data.isVisualize ?? isVisualize;
  } else if (data.type === 'start') {
    if (!active) {
      runInfiniteLoop();
    }
  } else if (data.type === 'stop') {
    active = false;
  }
};


