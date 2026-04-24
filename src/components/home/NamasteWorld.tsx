"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function NamasteWorld() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mb-4 mt-1 flex w-full flex-col items-center px-2">
      <motion.p
        className="text-center text-sm font-medium tracking-tight text-zinc-600 sm:text-base"
        initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.42,
          ease: "easeOut",
          delay: reduceMotion ? 0 : 0.06,
        }}
      >
        Namaste World!
      </motion.p>
      <svg
        className="mt-1.5 h-px w-[min(11rem,calc(100vw-3rem))] text-zinc-400"
        viewBox="0 0 200 1"
        preserveAspectRatio="none"
        aria-hidden
      >
        <motion.path
          d="M0 0.5 L200 0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: {
              duration: reduceMotion ? 0 : 0.52,
              ease: [0.4, 0, 0.2, 1],
              delay: reduceMotion ? 0 : 0.18,
            },
            opacity: {
              duration: reduceMotion ? 0 : 0.2,
              delay: reduceMotion ? 0 : 0.18,
            },
          }}
        />
      </svg>
    </div>
  );
}
