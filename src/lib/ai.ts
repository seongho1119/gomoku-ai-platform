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

  async predictTopMoves(board: BoardState, player: Player, topN: number = 3): Promise<{row: number, col: number, score: number}[]> {
    const moves = getAvailableMoves(board);
    if (moves.length === 0) return [];

    // Create a batch of inputs
    const inputsArray = [];
    for (const move of moves) {
      board[move.row][move.col] = player;
      inputsArray.push(this.flattenBoard(board, player));
      board[move.row][move.col] = 0; // undo
    }

    const inputTensor = tf.tensor2d(inputsArray);
    const predictions = this.model.predict(inputTensor) as tf.Tensor;
    const scores = await predictions.data();

    inputTensor.dispose();
    predictions.dispose();

    const scoredMoves = moves.map((move, i) => ({
      row: move.row,
      col: move.col,
      // Convert tanh output (-1 to 1) to a pseudo-probability score (0 to 1) for visualization
      score: (scores[i] + 1) / 2 
    }));

    // Sort by descending score
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
