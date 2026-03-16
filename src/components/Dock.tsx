"use client";

import type React from "react";
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import DockIcon from "./DockIcon";

type DockItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const ITEMS: DockItem[] = [
  {
    id: "resume",
    label: "Resume",
    href: "/resume",
    icon: (
      <div className="h-6 w-6 rounded-[10px] bg-gradient-to-br from-[#fefefe] to-[#dedede] shadow-inner" />
    ),
  },
  {
    id: "esign",
    label: "E‑Sign",
    href: "/tools/esign",
    icon: (
      <div className="flex h-6 w-6 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#4952ff] to-[#c24bff]">
        <span className="text-[9px] font-semibold text-white">E</span>
      </div>
    ),
  },
  {
    id: "tools",
    label: "Docs",
    href: "/tools",
    icon: (
      <div className="flex h-6 w-6 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#fbe7c5] to-[#f2b57c]">
        <span className="text-[9px] font-semibold text-zinc-900">D</span>
      </div>
    ),
  },
  {
    id: "games",
    label: "Games",
    href: "/games",
    icon: (
      <div className="flex h-6 w-6 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#7bf3ff] to-[#3c78ff]">
        <span className="text-[9px] font-semibold text-zinc-900">G</span>
      </div>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: (
      <img
        src="/brand/studiosis-logo.svg"
        alt="Studiosis logo"
        className="h-6 w-6 rounded-[10px] object-contain"
      />
    ),
  },
];

export default function Dock() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const ratio = x / rect.width;
      const virtualIndex = ratio * (ITEMS.length - 1);
      setHoverIndex(virtualIndex);
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const getScaleForIndex = (index: number) => {
    if (hoverIndex == null) return 1;
    const distance = Math.abs(index - hoverIndex);

    if (distance <= 0.4) {
      // Peak at hovered icon → scale ~1.8
      return 1.8 - distance * 0.5;
    }
    if (distance <= 1.4) {
      // Gently fall off for neighbours → down to 1.0
      return 1.3 - (distance - 0.4) * 0.3;
    }
    return 1;
  };

  const getLiftForIndex = (index: number) => {
    if (hoverIndex == null) return 0;
    const distance = Math.abs(index - hoverIndex);
    if (distance <= 0.4) return -10;
    if (distance <= 1.4) return -6;
    return 0;
  };

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="mx-auto flex items-end justify-center gap-4 rounded-[18px] border border-[#f5f5f5] px-4 py-3"
      style={{
        background: "linear-gradient(180deg, #e9e9e9, #dcdcdc)",
        boxShadow:
          "0 8px 18px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.6)",
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {ITEMS.map((item, index) => (
        <DockIcon
          key={item.id}
          label={item.label}
          href={item.href}
          icon={item.icon}
          scale={getScaleForIndex(index)}
          lift={getLiftForIndex(index)}
        />
      ))}
    </motion.div>
  );
}

