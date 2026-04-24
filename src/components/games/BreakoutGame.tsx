"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CANVAS_W = 360;
const CANVAS_H = 420;
const PADDLE_W = 72;
const PADDLE_H = 10;
const PADDLE_Y = CANVAS_H - 36;
const BALL_R = 5;
const BRICK_ROWS = 5;
const BRICK_COLS = 9;
const BRICK_H = 14;
const BRICK_GAP = 4;
const BRICK_TOP = 48;
const BRICK_W = (CANVAS_W - (BRICK_COLS + 1) * BRICK_GAP) / BRICK_COLS;

type Brick = boolean;

function initBricks(): Brick[] {
  return Array.from({ length: BRICK_ROWS * BRICK_COLS }, () => true);
}

function initBall() {
  return { x: CANVAS_W / 2, y: PADDLE_Y - 40, vx: 2.0, vy: -2.15 };
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  bricks: Brick[],
  paddleX: number,
  ball: { x: number; y: number }
) {
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const i = r * BRICK_COLS + c;
      if (!bricks[i]) continue;
      const x = BRICK_GAP + c * (BRICK_W + BRICK_GAP);
      const y = BRICK_TOP + r * (BRICK_H + BRICK_GAP / 2);
      ctx.fillStyle = "#3f3f46";
      ctx.strokeStyle = "#d4d4d8";
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, BRICK_W, BRICK_H);
      ctx.strokeRect(x + 0.5, y + 0.5, BRICK_W - 1, BRICK_H - 1);
    }
  }

  ctx.fillStyle = "#18181b";
  ctx.fillRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);

  ctx.beginPath();
  ctx.fillStyle = "#18181b";
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
}

export default function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const keysRef = useRef({ left: false, right: false });
  const paddleXRef = useRef(CANVAS_W / 2 - PADDLE_W / 2);
  const ballRef = useRef(initBall());
  const bricksRef = useRef<Brick[]>(initBricks());
  const playingRef = useRef(true);
  const [session, setSession] = useState(0);
  const [score, setScore] = useState(0);
  const [overlay, setOverlay] = useState<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keysRef.current.left = true;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        keysRef.current.right = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    playingRef.current = true;
    setOverlay(null);
    paddleXRef.current = CANVAS_W / 2 - PADDLE_W / 2;
    ballRef.current = initBall();
    bricksRef.current = initBricks();
    setScore(0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      if (!playingRef.current) return;

      const keys = keysRef.current;
      let px = paddleXRef.current;
      const ps = 6.25;
      if (keys.left) px -= ps;
      if (keys.right) px += ps;
      px = Math.max(8, Math.min(CANVAS_W - PADDLE_W - 8, px));
      paddleXRef.current = px;

      const b = ballRef.current;
      b.x += b.vx;
      b.y += b.vy;

      if (b.x < BALL_R) {
        b.x = BALL_R;
        b.vx *= -1;
      } else if (b.x > CANVAS_W - BALL_R) {
        b.x = CANVAS_W - BALL_R;
        b.vx *= -1;
      }
      if (b.y < BALL_R) {
        b.y = BALL_R;
        b.vy *= -1;
      }

      if (b.y > CANVAS_H - BALL_R) {
        playingRef.current = false;
        setOverlay("Game over");
        drawScene(ctx, bricksRef.current, paddleXRef.current, b);
        return;
      }

      if (
        b.vy > 0 &&
        b.y + BALL_R >= PADDLE_Y &&
        b.y - BALL_R <= PADDLE_Y + PADDLE_H &&
        b.x >= px &&
        b.x <= px + PADDLE_W
      ) {
        b.y = PADDLE_Y - BALL_R;
        const hit = (b.x - (px + PADDLE_W / 2)) / (PADDLE_W / 2);
        b.vy = -Math.abs(b.vy);
        b.vx += hit * 1.8;
        b.vx = Math.max(-4.1, Math.min(4.1, b.vx));
      }

      const bricks = bricksRef.current;
      let hitIdx = -1;
      outer: for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const i = r * BRICK_COLS + c;
          if (!bricks[i]) continue;
          const bx = BRICK_GAP + c * (BRICK_W + BRICK_GAP);
          const by = BRICK_TOP + r * (BRICK_H + BRICK_GAP / 2);
          if (
            b.x + BALL_R >= bx &&
            b.x - BALL_R <= bx + BRICK_W &&
            b.y + BALL_R >= by &&
            b.y - BALL_R <= by + BRICK_H
          ) {
            hitIdx = i;
            break outer;
          }
        }
      }

      if (hitIdx >= 0) {
        bricks[hitIdx] = false;
        b.vy *= -1;
        setScore((s) => s + 1);
        if (!bricks.some(Boolean)) {
          playingRef.current = false;
          setOverlay("You cleared the board");
          drawScene(ctx, bricks, paddleXRef.current, b);
          return;
        }
      }

      drawScene(ctx, bricks, paddleXRef.current, b);
      rafRef.current = requestAnimationFrame(loop);
    };

    drawScene(ctx, bricksRef.current, paddleXRef.current, ballRef.current);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      playingRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [session]);

  const restart = useCallback(() => {
    setSession((s) => s + 1);
  }, []);

  return (
    <div className="mt-8 flex w-full max-w-md flex-col items-center">
      <p className="text-center text-sm text-zinc-600">
        Score: <span className="font-semibold text-zinc-900">{score}</span>
        <span className="mt-1 block text-zinc-500">← → to move the paddle</span>
      </p>

      <div className="relative mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-2 shadow-inner">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block max-h-[70vh] w-full max-w-[360px] rounded-lg bg-white"
        />
        {overlay ? (
          <div className="absolute inset-2 flex items-center justify-center rounded-lg bg-white/90 px-4 text-center">
            <p className="text-sm font-medium text-zinc-900">{overlay}</p>
          </div>
        ) : null}
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
