"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PAIRS = 8;
const N = PAIRS * 2;

type Card = { id: number; value: number };

function shuffleCards(): Card[] {
  const values: number[] = [];
  for (let v = 0; v < PAIRS; v++) {
    values.push(v, v);
  }
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values.map((value, id) => ({ id, value }));
}

function initMatched() {
  return Array.from({ length: N }, () => false);
}

export default function MemoryMatchGame() {
  const [cards, setCards] = useState<Card[]>(() => shuffleCards());
  const [matched, setMatched] = useState<boolean[]>(() => initMatched());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [lock, setLock] = useState(false);
  // Browser `setTimeout` / `clearTimeout` use `number` handles; Node's `setTimeout` typing is `NodeJS.Timeout`.
  // "use client" + `window` APIs → store the timer id as `number` so it matches Vercel/DOM tsc.
  const flipTimerRef = useRef<number | null>(null);

  const clearFlipTimer = useCallback(() => {
    if (flipTimerRef.current != null) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearFlipTimer();
  }, [clearFlipTimer]);

  const restart = useCallback(() => {
    clearFlipTimer();
    setCards(shuffleCards());
    setMatched(initMatched());
    setFlipped([]);
    setLock(false);
  }, [clearFlipTimer]);

  const matchesDone = matched.filter(Boolean).length / 2;

  const onCardClick = (index: number) => {
    if (lock || matched[index] || flipped.includes(index)) return;
    if (flipped.length >= 2) return;
    if (flipped.length === 0) {
      setFlipped([index]);
      return;
    }
    if (flipped.length === 1) {
      const first = flipped[0];
      if (first === index) return;
      const second = index;
      setFlipped([first, second]);
      const v1 = cards[first].value;
      const v2 = cards[second].value;
      if (v1 === v2) {
        setMatched((m) => {
          const next = m.slice();
          next[first] = true;
          next[second] = true;
          return next;
        });
        setFlipped([]);
        return;
      }
      setLock(true);
      clearFlipTimer();
      flipTimerRef.current = window.setTimeout(() => {
        flipTimerRef.current = null;
        setFlipped([]);
        setLock(false);
      }, 800);
    }
  };

  const complete = matched.every(Boolean);

  return (
    <div className="mt-8 flex w-full max-w-lg flex-col items-center">
      <p className="text-sm text-zinc-600">
        Pairs found:{" "}
        <span className="font-semibold text-zinc-900">
          {matchesDone}/{PAIRS}
        </span>
        {complete ? <span className="ml-2 font-medium text-zinc-800">— Complete!</span> : null}
      </p>

      <div
        className="mt-4 grid w-full max-w-[360px] grid-cols-4 gap-2 sm:gap-3"
        role="grid"
        aria-label="Memory cards"
      >
        {cards.map((card, index) => {
          const isUp = matched[index] || flipped.includes(index);
          const show = isUp;
          return (
            <button
              key={card.id}
              type="button"
              role="gridcell"
              aria-label={show ? `Card ${card.value + 1}` : "Hidden card"}
              aria-pressed={show}
              disabled={lock || matched[index]}
              onClick={() => onCardClick(index)}
              className={`flex aspect-square items-center justify-center rounded-xl border text-lg font-semibold shadow-sm transition-colors disabled:cursor-default ${
                matched[index]
                  ? "border-zinc-300 bg-zinc-100 text-zinc-800"
                  : show
                    ? "border-zinc-300 bg-white text-zinc-900"
                    : "border-zinc-200 bg-zinc-800 text-zinc-800 hover:border-zinc-300"
              }`}
            >
              <span className={show ? "text-zinc-900" : "text-transparent"}>{card.value + 1}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={restart}
        className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-100"
      >
        Shuffle & restart
      </button>
    </div>
  );
}
