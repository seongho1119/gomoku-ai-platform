import * as tf from '@tensorflow/tfjs';
import { BoardState, BOARD_SIZE, getAvailableMoves, checkWin, Player } from './gomoku';

// A simple neural network model for Gomoku evaluation
export class GomokuAI {
  model: tf.LayersModel;

  constructor() {
    this.model = this.createModel();
  }

  createModel() {
    const model = tf.sequential();
    
    // Input: 15x15 board state flattened
    model.add(tf.layers.dense({ units: 128, activation: 'relu', inputShape: [BOARD_SIZE * BOARD_SIZE] }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    
    // Output: 1 value representing the evaluation of the board for the current player
    model.add(tf.layers.dense({ units: 1, activation: 'tanh' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
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

  async predictMove(board: BoardState, player: Player): Promise<{row: number, col: number}> {
    const moves = getAvailableMoves(board);
    if (moves.length === 0) return { row: -1, col: -1 };

    let bestMove = moves[Math.floor(Math.random() * moves.length)];
    let bestValue = -Infinity;

    // Evaluate a subset of moves for performance in browser
    const movesToEvaluate = moves.sort(() => 0.5 - Math.random()).slice(0, 10);

    for (const move of movesToEvaluate) {
      // Simulate move
      board[move.row][move.col] = player;
      
      const input = tf.tensor2d([this.flattenBoard(board, player)]);
      const pred = this.model.predict(input) as tf.Tensor;
      const value = (await pred.data())[0];
      
      input.dispose();
      pred.dispose();

      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }

      // Undo move
      board[move.row][move.col] = 0;
    }

    return bestMove;
  }

  async train(experiences: {board: number[], reward: number}[]) {
    if (experiences.length === 0) return;

    const xs = tf.tensor2d(experiences.map(e => e.board));
    const ys = tf.tensor2d(experiences.map(e => [e.reward]));

    await this.model.fit(xs, ys, {
      epochs: 1,
      batchSize: 32,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }
}
