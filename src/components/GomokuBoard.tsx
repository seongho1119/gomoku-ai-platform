'use client';

import React from 'react';
import { BoardState, BOARD_SIZE, Cell } from '@/lib/gomoku';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GomokuBoardProps {
  board: BoardState;
  onMove?: (row: number, col: number) => void;
  disabled?: boolean;
  thinkingMoves?: {row: number, col: number, score: number}[];
}

export default function GomokuBoard({ board, onMove, disabled, thinkingMoves = [] }: GomokuBoardProps) {
  return (
    <div className="relative inline-block bg-[#dcb35c] p-4 rounded-lg shadow-2xl border-4 border-[#8b5a2b]">
      {/* Board Grid Lines (Precise SVG) */}
      <svg 
        className="absolute top-0 left-0 pointer-events-none opacity-60 mix-blend-multiply"
        width={BOARD_SIZE * 32} 
        height={BOARD_SIZE * 32}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <React.Fragment key={`line-${i}`}>
            {/* Horizontal lines */}
            <line 
              x1={16} y1={16 + i * 32} 
              x2={BOARD_SIZE * 32 - 16} y2={16 + i * 32} 
              stroke="black" strokeWidth="1" 
            />
            {/* Vertical lines */}
            <line 
              x1={16 + i * 32} y1={16} 
              x2={16 + i * 32} y2={BOARD_SIZE * 32 - 16} 
              stroke="black" strokeWidth="1" 
            />
          </React.Fragment>
        ))}
      </svg>

      {/* Intersections (Clickable Areas) */}
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
            <div
              key={`cell-${r}-${c}`}
              className={cn(
                "relative flex items-center justify-center cursor-pointer group",
                disabled ? "cursor-not-allowed" : ""
              )}
              onClick={() => {
                if (!disabled && cell === 0 && onMove) {
                  onMove(r, c);
                }
              }}
            >
              {/* Hover indicator */}
              {!disabled && cell === 0 && (
                <div className="absolute w-3 h-3 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              
              {/* Thinking Indicator */}
              {cell === 0 && thinkingMoves.find(m => m.row === r && m.col === c) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute z-20 flex flex-col items-center justify-center pointer-events-none"
                >
                  <div className="w-4 h-4 rounded-full border-2 border-emerald-400 bg-emerald-500/20 animate-ping absolute" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500 z-10 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="absolute -top-6 text-[10px] font-bold text-emerald-300 bg-black/70 px-1 rounded whitespace-nowrap backdrop-blur-sm">
                    {Math.round((thinkingMoves.find(m => m.row === r && m.col === c)?.score || 0) * 100)}%
                  </span>
                </motion.div>
              )}

              {/* Pieces */}
              {cell !== 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={cn(
                    "w-7 h-7 rounded-full shadow-[2px_4px_6px_rgba(0,0,0,0.5)] z-10",
                    cell === 1 
                      ? "bg-gradient-to-br from-gray-700 to-black" 
                      : "bg-gradient-to-br from-white to-gray-300"
                  )}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
