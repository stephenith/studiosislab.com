"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export default function HomeSnapScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [hasOverflow, setHasOverflow] = useState(false);
  const [thumbHeightPct, setThumbHeightPct] = useState(12);
  const [thumbTopPct, setThumbTopPct] = useState(0);

  const flushScrollMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 1) {
      setHasOverflow(false);
      setThumbHeightPct(100);
      setThumbTopPct(0);
      return;
    }
    setHasOverflow(true);
    const viewRatio = el.clientHeight / el.scrollHeight;
    const thumbH = Math.min(100, Math.max(6, viewRatio * 100));
    setThumbHeightPct(thumbH);
    const progress = el.scrollTop / maxScroll;
    setThumbTopPct(progress * (100 - thumbH));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushScrollMetrics();
    });
  }, [flushScrollMetrics]);

  useLayoutEffect(() => {
    flushScrollMetrics();
  }, [flushScrollMetrics]);

  useEffect(() => {
    const el = scrollRef.current;
    const inner = contentRef.current;
    if (!el) return;

    flushScrollMetrics();
    const ro = new ResizeObserver(() => scheduleFlush());
    ro.observe(el);
    if (inner) ro.observe(inner);

    return () => {
      ro.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [flushScrollMetrics, scheduleFlush]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={scheduleFlush}
        className="home-snap-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain snap-y snap-mandatory pb-5"
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {hasOverflow ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[25] w-2 sm:w-2.5"
          aria-hidden
        >
          <div className="absolute inset-y-3 right-1 w-2 sm:right-1.5">
            <div className="relative h-full w-full">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-900/15" />
              <div
                className="motion-reduce:transition-none absolute left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-zinc-900 transition-[top,height] duration-100 ease-out"
                style={{
                  height: `${thumbHeightPct}%`,
                  top: `${thumbTopPct}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
