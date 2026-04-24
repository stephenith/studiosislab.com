"use client";

import { useCallback, useState } from "react";

type Player = "X" | "O";
type Cell = Player | null;
type Outcome = Player | "draw" | null;

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const emptyBoard = (): Cell[] => Array.from({ length: 9 }, () => null);

function outcomeFor(board: Cell[]): Outcome {
  for (const [a, b, c] of WIN_LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return v;
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

export default function TicTacToeGame() {
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [turn, setTurn] = useState<Player>("X");
  const [result, setResult] = useState<Outcome>(null);

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setTurn("X");
    setResult(null);
  }, []);

  const onCellClick = (index: number) => {
    if (result || board[index]) return;
    const next = board.slice();
    next[index] = turn;
    setBoard(next);
    const nextResult = outcomeFor(next);
    if (nextResult) {
      setResult(nextResult);
    } else {
      setTurn(turn === "X" ? "O" : "X");
    }
  };

  const status =
    result === "draw"
      ? "It’s a draw."
      : result
        ? `${result} wins.`
        : `Current turn: ${turn}`;

  return (
    <div className="mt-8 flex w-full max-w-sm flex-col items-center">
      <p className="min-h-[1.5rem] text-sm font-medium text-zinc-800" aria-live="polite">
        {status}
      </p>

      <div
        className="mt-6 grid w-full max-w-[280px] grid-cols-3 gap-2"
        role="grid"
        aria-label="Tic tac toe board"
      >
        {board.map((cell, i) => (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={cell ? `Cell ${i + 1}, ${cell}` : `Cell ${i + 1}, empty`}
            disabled={Boolean(result) || cell !== null}
            onClick={() => onCellClick(i)}
            className="flex aspect-square items-center justify-center rounded-xl border border-zinc-200 bg-white text-2xl font-semibold text-zinc-900 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:hover:border-zinc-200 disabled:hover:bg-white"
          >
            <span className="text-zinc-900">{cell ?? "\u00a0"}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-100"
      >
        Reset board
      </button>
    </div>
  );
}
