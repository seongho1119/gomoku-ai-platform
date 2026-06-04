'use client';

import React, { memo, useCallback } from 'react';
import { BoardState, BOARD_SIZE, Cell } from '@/lib/gomoku';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GomokuBoardProps {
  board: BoardState;
  onMove?: (row: number, col: number) => void;
  disabled?: boolean;
  lastMove?: { row: number; col: number };
}

interface CellProps {
  cell: Cell;
  r: number;
  c: number;
  onMove?: (row: number, col: number) => void;
  disabled: boolean;
  isLast: boolean;
}

/**
 * 셀을 React.memo로 메모이제이션합니다.
 * 돌을 하나 놓을 때 225개 전체가 아닌, 변경된 셀 1개만 리렌더링됩니다.
 * 이것이 핵심 렉 해결 방법입니다.
 */
const BoardCell = memo(function BoardCell({ cell, r, c, onMove, disabled, isLast }: CellProps) {
  const handleClick = useCallback(() => {
    if (!disabled && cell === 0 && onMove) {
      onMove(r, c);
    }
  }, [disabled, cell, onMove, r, c]);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center group',
        !disabled && cell === 0 ? 'cursor-pointer' : 'cursor-default'
      )}
      onClick={handleClick}
    >
      {/* 호버 힌트 */}
      {!disabled && cell === 0 && (
        <div className="absolute w-3 h-3 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      {/* 돌 */}
      {cell !== 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className={cn(
            'relative w-7 h-7 rounded-full shadow-[2px_4px_6px_rgba(0,0,0,0.5)] z-10',
            cell === 1
              ? 'bg-gradient-to-br from-gray-700 to-black'
              : 'bg-gradient-to-br from-white to-gray-300'
          )}
        >
          {/* 마지막 수 표시 (빨간 점) */}
          {isLast && (
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center',
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  cell === 1 ? 'bg-red-400' : 'bg-red-500'
                )}
              />
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
});

export default function GomokuBoard({
  board,
  onMove,
  disabled = false,
  lastMove,
}: GomokuBoardProps) {
  return (
    <div className="relative inline-block bg-[#dcb35c] p-4 rounded-lg shadow-2xl border-4 border-[#8b5a2b]">
      {/* 격자선 SVG */}
      <svg
        className="absolute top-0 left-0 pointer-events-none opacity-60 mix-blend-multiply"
        width={BOARD_SIZE * 32}
        height={BOARD_SIZE * 32}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <React.Fragment key={`line-${i}`}>
            <line
              x1={32} y1={32 + i * 32}
              x2={BOARD_SIZE * 32} y2={32 + i * 32}
              stroke="black" strokeWidth="1"
            />
            <line
              x1={32 + i * 32} y1={32}
              x2={32 + i * 32} y2={BOARD_SIZE * 32}
              stroke="black" strokeWidth="1"
            />
          </React.Fragment>
        ))}
        {/* 화점 (花點) */}
        {[3, 7, 11].flatMap(r =>
          [3, 7, 11].map(c => (
            <circle key={`dot-${r}-${c}`} cx={32 + c * 32} cy={32 + r * 32} r={3} fill="black" />
          ))
        )}
      </svg>

      {/* 교차점 */}
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
          width: `${BOARD_SIZE * 32}px`,
          height: `${BOARD_SIZE * 32}px`,
        }}
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <BoardCell
              key={`${r}-${c}`}
              cell={cell}
              r={r}
              c={c}
              onMove={onMove}
              disabled={disabled}
              isLast={lastMove?.row === r && lastMove?.col === c}
            />
          ))
        )}
      </div>
    </div>
  );
}
