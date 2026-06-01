'use client';

import React from 'react';
import { BoardState, BOARD_SIZE, Cell } from '@/lib/gomoku';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GomokuBoardProps {
  board: BoardState;
  onMove?: (row: number, col: number) => void;
  disabled?: boolean;
}

export default function GomokuBoard({ board, onMove, disabled }: GomokuBoardProps) {
  return (
    <div className="relative inline-block bg-[#dcb35c] p-4 rounded-lg shadow-2xl border-4 border-[#8b5a2b]">
      {/* Board Grid Lines */}
      <div 
        className="absolute inset-4 pointer-events-none"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BOARD_SIZE - 1}, 1fr)`,
          gridTemplateRows: `repeat(${BOARD_SIZE - 1}, 1fr)`,
        }}
      >
        {Array.from({ length: (BOARD_SIZE - 1) * (BOARD_SIZE - 1) }).map((_, i) => (
          <div key={`grid-${i}`} className="border-t border-l border-[#000000] opacity-60 mix-blend-multiply" />
        ))}
        {/* Right and Bottom borders for the grid lines */}
        <div className="absolute top-0 right-0 h-full w-[1px] bg-[#000000] opacity-60 mix-blend-multiply" />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#000000] opacity-60 mix-blend-multiply" />
      </div>

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
