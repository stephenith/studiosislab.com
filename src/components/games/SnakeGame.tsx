"use client";

import { useCallback, useEffect, useState } from "react";

const W = 12;
const H = 12;
const TICK_MS = 158;

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };

type GameState = {
  snake: Point[];
  dir: Dir;
  food: Point;
  over: boolean;
  score: number;
};

const vec: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const opposite: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function randomFood(snake: Point[]): Point {
  const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    if (!taken.has(`${x},${y}`)) return { x, y };
  }
  return { x: 0, y: 0 };
}

function initState(): GameState {
  const snake = [
    { x: 4, y: 6 },
    { x: 3, y: 6 },
    { x: 2, y: 6 },
  ];
  return {
    snake,
    dir: "right",
    food: randomFood(snake),
    over: false,
    score: 0,
  };
}

function step(s: GameState): GameState {
  if (s.over) return s;
  const head = s.snake[0];
  const d = vec[s.dir];
  const nh = { x: head.x + d.x, y: head.y + d.y };
  if (nh.x < 0 || nh.x >= W || nh.y < 0 || nh.y >= H) {
    return { ...s, over: true };
  }
  const ate = nh.x === s.food.x && nh.y === s.food.y;
  if (!ate && s.snake.slice(0, -1).some((p) => p.x === nh.x && p.y === nh.y)) {
    return { ...s, over: true };
  }
  const newSnake = ate ? [nh, ...s.snake] : [nh, ...s.snake.slice(0, -1)];
  const newFood = ate ? randomFood(newSnake) : s.food;
  const newScore = ate ? s.score + 1 : s.score;
  return { ...s, snake: newSnake, food: newFood, score: newScore };
}

export default function SnakeGame() {
  const [state, setState] = useState<GameState>(initState);

  const restart = useCallback(() => {
    setState(initState());
  }, []);

  useEffect(() => {
    if (state.over) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (prev.over) return prev;
        return step(prev);
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.over]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      setState((prev) => {
        if (prev.over) return prev;
        if (opposite[nd] === prev.dir) return prev;
        return { ...prev, dir: nd };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cells = new Map<string, "head" | "body" | "food">();
  cells.set(`${state.food.x},${state.food.y}`, "food");
  for (let i = 0; i < state.snake.length; i++) {
    const p = state.snake[i];
    cells.set(`${p.x},${p.y}`, i === 0 ? "head" : "body");
  }

  return (
    <div className="mt-8 flex w-full max-w-md flex-col items-center">
      <p className="text-sm text-zinc-600">
        Score: <span className="font-semibold text-zinc-900">{state.score}</span>
        {state.over ? (
          <span className="ml-2 font-medium text-zinc-800">— Game over</span>
        ) : (
          <span className="ml-2 text-zinc-500">— Arrow keys to steer</span>
        )}
      </p>

      <div
        className="mt-4 grid aspect-square w-full max-w-[min(100%,320px)] gap-px rounded-xl border border-zinc-200 bg-zinc-200 p-px shadow-inner"
        style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` }}
        role="img"
        aria-label="Snake game board"
      >
        {Array.from({ length: W * H }).map((_, i) => {
          const x = i % W;
          const y = Math.floor(i / W);
          const kind = cells.get(`${x},${y}`);
          return (
            <div
              key={`${x},${y}`}
              className={`aspect-square rounded-[1px] ${
                kind === "head"
                  ? "bg-zinc-900"
                  : kind === "body"
                    ? "bg-zinc-600"
                    : kind === "food"
                      ? "bg-zinc-400"
                      : "bg-white"
              }`}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={restart}
        className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-100"
      >
        Restart
      </button>
    </div>
  );
}
