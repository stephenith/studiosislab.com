"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

const DOCK_ICON_SRC = {
  resume: "/dock/resume.png",
  esign: "/dock/esign.png",
  docs: "/dock/docs.png",
  games: "/dock/games.png",
  settings: "/dock/settings.png",
} as const;

function DockPng({ src, label }: { src: string; label: string }) {
  return (
    <img
      src={src}
      alt={label}
      draggable={false}
      className="pointer-events-none h-full w-full object-contain"
    />
  );
}

type DockItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
};

const ITEMS: DockItem[] = [
  {
    id: "resume",
    label: "Resume",
    path: "/resume",
    icon: <DockPng src={DOCK_ICON_SRC.resume} label="Resume" />,
  },
  {
    id: "esign",
    label: "E‑Sign",
    path: "/tools",
    icon: <DockPng src={DOCK_ICON_SRC.esign} label="E‑Sign" />,
  },
  {
    id: "tools",
    label: "Dashboard",
    icon: <DockPng src={DOCK_ICON_SRC.docs} label="Dashboard" />,
  },
  {
    id: "games",
    label: "Games",
    icon: <DockPng src={DOCK_ICON_SRC.games} label="Games" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <DockPng src={DOCK_ICON_SRC.settings} label="Settings" />,
  },
];

/** Narrow range so only the hovered index (integer) scales; neighbors stay at scale 1. */
const COSINE_RANGE = 0.42;
const MAX_SCALE_BOOST = 1.06;

function scaleAndLiftForIndex(index: number, hoverIndex: number | null): [number, number] {
  if (hoverIndex == null) return [1, 0];
  const d = Math.abs(index - hoverIndex);
  const t = Math.min(d / COSINE_RANGE, 1);
  const scale = 1 + MAX_SCALE_BOOST * Math.cos((t * Math.PI) / 2);
  const lift = -30 * (scale - 1);
  return [scale, lift];
}

const DOCK_ITEM_SPRING = {
  type: "spring" as const,
  stiffness: 440,
  damping: 24,
  mass: 0.52,
};

/** Soft layered glow only while this item is the hover target (follows scale + lift). */
const DOCK_ICON_HOVER_FILTER =
  "drop-shadow(0 6px 14px rgba(0,0,0,0.2)) drop-shadow(0 12px 26px rgba(0,0,0,0.28)) drop-shadow(0 20px 42px rgba(0,0,0,0.14))";

export default function MacDock() {
  const router = useRouter();
  const { user, authReady, signInWithGoogle } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const flushPointer = useCallback(() => {
    rafRef.current = null;
    const el = containerRef.current;
    const px = pendingXRef.current;
    if (!el || px == null) {
      setHoverIndex(null);
      return;
    }
    const w = el.getBoundingClientRect().width || 1;
    const ratio = Math.max(0, Math.min(1, px / w));
    const discrete = Math.round(ratio * (ITEMS.length - 1));
    setHoverIndex(discrete);
  }, []);

  const schedulePointerUpdate = useCallback(
    (clientXRelative: number | null) => {
      pendingXRef.current = clientXRelative;
      if (clientXRelative == null) {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setHoverIndex(null);
        return;
      }
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        flushPointer();
      });
    },
    [flushPointer]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const navigateWithAuth = useCallback(
    async (path: string) => {
      if (!authReady) return;
      if (!user) {
        try {
          await signInWithGoogle();
        } catch {
          alert("Login failed");
          return;
        }
      }
      router.push(path);
    },
    [authReady, user, signInWithGoogle, router]
  );

  const handleItem = useCallback(
    (item: DockItem) => {
      if (item.id === "tools") {
        router.push("/dashboard/login");
        return;
      }
      if (item.id === "games") {
        router.push("/games");
        return;
      }
      if (item.id === "settings") {
        router.push("/settings");
        return;
      }
      if (item.path) {
        void navigateWithAuth(item.path);
      }
    },
    [navigateWithAuth, router]
  );

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      schedulePointerUpdate(event.clientX - rect.left);
    },
    [schedulePointerUpdate]
  );

  const onMouseLeave = useCallback(() => {
    pendingXRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHoverIndex(null);
  }, []);

  return (
    <div className="relative mx-auto w-max max-w-full">
      <div className="pointer-events-none absolute -bottom-1 left-1/2 z-0 w-[min(100%,28rem)] max-w-[calc(100%-0.25rem)] -translate-x-1/2" aria-hidden>
        <div className="mx-auto h-3.5 w-[92%] rounded-[999px] bg-gradient-to-b from-black/38 via-black/12 to-transparent opacity-80 blur-[14px]" />
        <div className="mx-auto -mt-2 h-1.5 w-[78%] rounded-[999px] bg-black/22 opacity-70 blur-[8px]" />
      </div>
      <motion.div
        ref={containerRef}
        role="toolbar"
        aria-label="App dock"
        className="relative z-10 mx-auto flex max-w-full cursor-default items-end justify-center gap-1 overflow-visible rounded-2xl border border-white/10 bg-zinc-900/70 px-2.5 pb-0.5 pt-0.5 shadow-[0_12px_32px_-14px_rgba(0,0,0,0.48),0_28px_56px_-20px_rgba(0,0,0,0.32),0_1px_0_0_rgba(255,255,255,0.08)_inset] backdrop-blur-xl sm:gap-1.5 sm:px-3 sm:pb-0.5 sm:pt-1"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {ITEMS.map((item, index) => {
          const [scale, lift] = scaleAndLiftForIndex(index, hoverIndex);
          const isHovered = hoverIndex != null && index === hoverIndex;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!authReady}
              onClick={() => void handleItem(item)}
              className="flex min-w-0 flex-col items-center gap-0.5 pb-0.5 text-[10px] text-zinc-200 disabled:pointer-events-none disabled:opacity-50 sm:gap-0.5 sm:pb-0.5"
            >
              <div className="relative z-10 flex h-[52px] w-[52px] shrink-0 -translate-y-[4px] items-center justify-center overflow-visible sm:h-[56px] sm:w-[56px] sm:-translate-y-[5px]">
                <motion.div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    transformOrigin: "50% 100%",
                    // Apply filter outside `animate` so Framer Motion does not tween `none` ↔
                    // multi-drop-shadow (invalid keyframes in Chromium).
                    filter: isHovered ? DOCK_ICON_HOVER_FILTER : "none",
                  }}
                  animate={{
                    scale,
                    y: lift,
                  }}
                  whileTap={{
                    scale: scale * 0.86,
                    transition: { type: "spring", stiffness: 520, damping: 14 },
                  }}
                  transition={{
                    scale: DOCK_ITEM_SPRING,
                    y: DOCK_ITEM_SPRING,
                  }}
                >
                  {item.icon}
                </motion.div>
              </div>
              <motion.span
                className="max-w-[4.5rem] truncate text-[9px] font-medium text-zinc-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]"
                animate={{ y: lift }}
                transition={DOCK_ITEM_SPRING}
              >
                {item.label}
              </motion.span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
