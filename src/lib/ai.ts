import * as tf from '@tensorflow/tfjs';
import { BoardState, BOARD_SIZE, getAvailableMoves, checkWin, Player, createEmptyBoard } from './gomoku';

/**
 * 기존 돌 주변 2칸 이내의 빈 셀만 후보로 반환합니다.
 * 빈 보드라면 중앙 셀을 반환합니다.
 * 평균 후보 수: 225개 → ~20-35개로 감소
 */
function getCandidateMoves(board: BoardState): {row: number, col: number}[] {
  const RADIUS = 2;
  const center = Math.floor(BOARD_SIZE / 2);
  const candidates = new Set<string>();
  let hasStones = false;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) {
        hasStones = true;
        // 이 돌 주변 RADIUS 범위 내 빈 셀 추가
        for (let dr = -RADIUS; dr <= RADIUS; dr++) {
          for (let dc = -RADIUS; dc <= RADIUS; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) {
              candidates.add(`${nr},${nc}`);
            }
          }
        }
      }
    }
  }

  if (!hasStones) {
    // 빈 보드: 중앙 주변만 반환
    return [{ row: center, col: center }];
  }

  if (candidates.size === 0) {
    // 후보가 없으면 전체 빈 셀 fallback
    return getAvailableMoves(board);
  }

  return Array.from(candidates).map(key => {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c };
  });
}

export type BrainSize = 'shallow' | 'standard' | 'deep';

export class GomokuAI {
  model: tf.LayersModel;
  brainSize: BrainSize;
  storageKey: string;
  
  // Personality Traits
  personality = {
    aggression: 1.0,
    defense: 1.0,
    creativity: 1.0
  };

  constructor(brainSize: BrainSize = 'standard', storageKey = 'gomoku-ai-brain') {
    this.brainSize = brainSize;
    this.storageKey = storageKey;
    this.model = this.createModel(brainSize);
  }

  createModel(size: BrainSize) {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [BOARD_SIZE * BOARD_SIZE] }));
    
    if (size === 'shallow') {
      model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    } else if (size === 'standard') {
      model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    } else if (size === 'deep') {
      model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    }
    
    model.add(tf.layers.dense({ units: 1, activation: 'tanh' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
  }

  async saveMemory() {
    try {
      await this.model.save(`localstorage://${this.storageKey}`);
      localStorage.setItem(`${this.storageKey}-personality`, JSON.stringify(this.personality));
      localStorage.setItem(`${this.storageKey}-brainSize`, this.brainSize);
      return true;
    } catch (e) {
      console.error('Failed to save AI memory:', e);
      return false;
    }
  }

  async loadMemory() {
    try {
      const savedModel = await tf.loadLayersModel(`localstorage://${this.storageKey}`);
      this.model = savedModel as tf.LayersModel;
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });
      
      const savedPersonality = localStorage.getItem(`${this.storageKey}-personality`);
      if (savedPersonality) {
        this.personality = JSON.parse(savedPersonality);
      }
      
      const savedBrainSize = localStorage.getItem(`${this.storageKey}-brainSize`);
      if (savedBrainSize) {
        this.brainSize = savedBrainSize as BrainSize;
      }
      
      return true;
    } catch (e) {
      console.log(`No saved memory found for key '${this.storageKey}', using fresh brain.`);
      return false;
    }
  }

  chat(message: string, language: 'en' | 'ko' = 'ko'): string {
    const msg = message.toLowerCase();
    let reply = '';

    if (language === 'ko') {
      if (msg.includes('공격') || msg.includes('돌격') || msg.includes('압박')) {
        this.personality.aggression += 0.5;
        reply = "알겠습니다 마스터! 앞으로는 내 돌을 연결하는 공격적인 수를 더 선호하겠습니다! ⚔️";
      } else if (msg.includes('수비') || msg.includes('방어') || msg.includes('조심') || msg.includes('막아')) {
        this.personality.defense += 0.5;
        reply = "네 마스터! 상대방의 맹공을 막아내는 수비 위주로 가중치를 변경합니다! 🛡️";
      } else if (msg.includes('창의') || msg.includes('변칙') || msg.includes('랜덤')) {
        this.personality.creativity += 0.5;
        reply = "좋아요! 예상치 못한 곳에 돌을 두는 변칙적인 플레이를 해보겠습니다! 🎨";
      } else if (msg.includes('초기화') || msg.includes('원래대로')) {
        this.personality = { aggression: 1.0, defense: 1.0, creativity: 1.0 };
        reply = "성향을 모두 기본값으로 초기화했습니다. 🤖";
      } else {
        reply = "말씀하신 명령을 이해하지 못했어요. '공격', '수비', '창의적' 같은 단어를 사용해 명령을 내려주세요!";
      }
    } else {
      if (msg.includes('attack') || msg.includes('aggress') || msg.includes('press')) {
        this.personality.aggression += 0.5;
        reply = "Yes Master! I will prioritize aggressive moves and focus on connecting my stones! ⚔️";
      } else if (msg.includes('defend') || msg.includes('defens') || msg.includes('block') || msg.includes('careful')) {
        this.personality.defense += 0.5;
        reply = "Understood Master! I will focus on blocking the opponent's attacks! 🛡️";
      } else if (msg.includes('creat') || msg.includes('random') || msg.includes('unpredict')) {
        this.personality.creativity += 0.5;
        reply = "Got it! I will try exploring unpredictable and creative moves! 🎨";
      } else if (msg.includes('reset') || msg.includes('default')) {
        this.personality = { aggression: 1.0, defense: 1.0, creativity: 1.0 };
        reply = "All personality traits have been reset to default. 🤖";
      } else {
        reply = "I didn't quite catch that. Try using keywords like 'attack', 'defend', or 'creative'!";
      }
    }

    return reply;
  }

  flattenBoard(board: BoardState, player: Player): number[] {
    const flat = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === player) flat.push(1);
        else if (board[r][c] !== 0) flat.push(-1);
        else flat.push(0);
      }
    }
    return flat;
  }

  // Heuristic evaluation to apply personality
  evaluateHeuristic(board: BoardState, r: number, c: number, player: Player): number {
    const opponent = player === 1 ? 2 : 1;
    let score = 0;

    // Check adjacent cells
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (board[nr][nc] === player) {
            // Found own stone -> Aggression bonus
            score += 0.1 * this.personality.aggression;
          } else if (board[nr][nc] === opponent) {
            // Found enemy stone -> Defense bonus
            score += 0.1 * this.personality.defense;
          }
        }
      }
    }
    
    // Add creativity noise
    score += (Math.random() - 0.5) * 0.1 * this.personality.creativity;
    
    return score;
  }

  async predictTopMoves(board: BoardState, player: Player, topN: number = 3): Promise<{row: number, col: number, score: number}[]> {
    // 승리/즉시 차단 수 우선 확인 (필승 수 항상 선택)
    const allMoves = getAvailableMoves(board);
    for (const move of allMoves) {
      board[move.row][move.col] = player;
      if (checkWin(board, move.row, move.col, player)) {
        board[move.row][move.col] = 0;
        return [{ row: move.row, col: move.col, score: 1.0 }];
      }
      board[move.row][move.col] = 0;
    }
    const opponent = player === 1 ? 2 : 1;
    for (const move of allMoves) {
      board[move.row][move.col] = opponent;
      if (checkWin(board, move.row, move.col, opponent)) {
        board[move.row][move.col] = 0;
        return [{ row: move.row, col: move.col, score: 0.9 }];
      }
      board[move.row][move.col] = 0;
    }

    const moves = getCandidateMoves(board);
    if (moves.length === 0) return [];

    const inputsArray = [];
    for (const move of moves) {
      board[move.row][move.col] = player;
      inputsArray.push(this.flattenBoard(board, player));
      board[move.row][move.col] = 0; // undo
    }

    const inputTensor = tf.tensor2d(inputsArray);
    const predictions = this.model.predict(inputTensor) as tf.Tensor;
    const nnScores = await predictions.data();

    inputTensor.dispose();
    predictions.dispose();

    const scoredMoves = moves.map((move, i) => {
      let baseScore = (nnScores[i] + 1) / 2; // Normalize tanh (-1,1) to (0,1)
      let heuristicBonus = this.evaluateHeuristic(board, move.row, move.col, player);
      
      return {
        row: move.row,
        col: move.col,
        score: Math.max(0, Math.min(1, baseScore + heuristicBonus)) // Clamp 0 to 1
      };
    });

    scoredMoves.sort((a, b) => b.score - a.score);

    return scoredMoves.slice(0, topN);
  }

  async predictMove(board: BoardState, player: Player): Promise<{row: number, col: number}> {
    const topMoves = await this.predictTopMoves(board, player, 1);
    if (topMoves.length > 0) {
      return { row: topMoves[0].row, col: topMoves[0].col };
    }
    return { row: -1, col: -1 };
  }

  async train(experiences: {board: number[], reward: number}[], batchSize = 32) {
    if (experiences.length === 0) return;

    const xs = tf.tensor2d(experiences.map(e => e.board));
    const ys = tf.tensor2d(experiences.map(e => [e.reward]));

    await this.model.fit(xs, ys, {
      epochs: 1,
      batchSize,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }

  /**
   * 신규 AI에게 오목의 기본 규칙을 주입합니다.
   * "5개 연속 = 승리" 패턴을 synthetic 데이터로 사전 학습시켜
   * AI가 무작위 수가 아닌 방향성 있는 수를 두도록 합니다.
   */
  async teachBasicRules() {
    console.log('[AI] 기본 규칙 주입 시작: 5개 연속 = 승리');
    const experiences: {board: number[], reward: number}[] = [];
    const directions = [[0,1],[1,0],[1,1],[1,-1]] as const;

    for (const [dr, dc] of directions) {
      for (let startR = 0; startR < BOARD_SIZE; startR += 2) {
        for (let startC = 0; startC < BOARD_SIZE; startC += 2) {
          // 5칸 위치 계산
          const pos5: [number, number][] = [];
          let valid = true;
          for (let i = 0; i < 5; i++) {
            const r = startR + dr * i;
            const c = startC + dc * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { valid = false; break; }
            pos5.push([r, c]);
          }
          if (!valid || pos5.length < 5) continue;

          // ① 내가 5개 연속 → 최고 보상 (+1.0)
          const bWin = createEmptyBoard();
          pos5.forEach(([r,c]) => bWin[r][c] = 1);
          experiences.push({ board: this.flattenBoard(bWin, 1), reward: 1.0 });

          // ② 상대가 5개 연속 → 최악 (-1.0)
          const bLose = createEmptyBoard();
          pos5.forEach(([r,c]) => bLose[r][c] = 2);
          experiences.push({ board: this.flattenBoard(bLose, 1), reward: -1.0 });

          // ③ 내가 4개 연속 (한 칸 열려 있음) → 거의 승리 (+0.75)
          const b4 = createEmptyBoard();
          pos5.slice(0, 4).forEach(([r,c]) => b4[r][c] = 1);
          experiences.push({ board: this.flattenBoard(b4, 1), reward: 0.75 });

          // ④ 상대가 4개 연속 → 즉시 차단 필요 (-0.75)
          const b4opp = createEmptyBoard();
          pos5.slice(0, 4).forEach(([r,c]) => b4opp[r][c] = 2);
          experiences.push({ board: this.flattenBoard(b4opp, 1), reward: -0.75 });

          // ⑤ 내가 3개 연속 → 좋은 형태 (+0.4)
          const b3 = createEmptyBoard();
          pos5.slice(0, 3).forEach(([r,c]) => b3[r][c] = 1);
          experiences.push({ board: this.flattenBoard(b3, 1), reward: 0.4 });

          // ⑥ 상대가 3개 연속 → 견제 필요 (-0.4)
          const b3opp = createEmptyBoard();
          pos5.slice(0, 3).forEach(([r,c]) => b3opp[r][c] = 2);
          experiences.push({ board: this.flattenBoard(b3opp, 1), reward: -0.4 });
        }
      }
    }

    // 여러 에폭 반복 학습 (규칙 주입)
    for (let epoch = 0; epoch < 5; epoch++) {
      const shuffled = [...experiences].sort(() => Math.random() - 0.5);
      await this.train(shuffled);
    }

    await this.saveMemory();
    console.log(`[AI] 기본 규칙 주입 완료: ${experiences.length}개 예시, 5 에폭`);
  }
}

