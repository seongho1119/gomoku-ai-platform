export type Player = 1 | 2; // 1: Black, 2: White
export type Cell = Player | 0; // 0: Empty
export type BoardState = Cell[][];

export const BOARD_SIZE = 15;

export function createEmptyBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

export function checkWin(board: BoardState, row: number, col: number, player: Player): boolean {
  const directions = [
    [1, 0],   // Horizontal
    [0, 1],   // Vertical
    [1, 1],   // Diagonal \
    [1, -1]   // Diagonal /
  ];

  for (const [dx, dy] of directions) {
    let count = 1;
    
    // Check in the positive direction
    let r = row + dy;
    let c = col + dx;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
      count++;
      r += dy;
      c += dx;
    }

    // Check in the negative direction
    r = row - dy;
    c = col - dx;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
      count++;
      r -= dy;
      c -= dx;
    }

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

export function getAvailableMoves(board: BoardState): {row: number, col: number}[] {
  const moves: {row: number, col: number}[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

export function isBoardFull(board: BoardState): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  return true;
}
