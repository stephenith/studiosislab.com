"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

type DockIconProps = {
  label: string;
  href: string;
  icon: ReactNode;
  scale: number;
  lift: number;
};

export default function DockIcon({ label, href, icon, scale, lift }: DockIconProps) {
  const router = useRouter();

  return (
    <motion.button
      type="button"
      onClick={() => router.push(href)}
      className="flex flex-col items-center gap-1 text-[10px] text-zinc-700"
      style={{ transformOrigin: "50% 100%" }}
      animate={{ scale, y: lift }}
      whileHover={{ scale: scale * 1.15, y: lift - 4 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
    >
      <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[12px] bg-[#e2e2e2] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.08)]">
        {icon}
      </div>
      <span className="mt-0.5 px-1 rounded-full bg-black/80 text-[9px] font-medium text-white shadow-sm">
        {label}
      </span>
    </motion.button>
  );
}

