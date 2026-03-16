"use client";

import { motion } from "framer-motion";
import Dock from "./Dock";

export default function HeroSection() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex flex-col items-center text-center"
      >
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute h-44 w-44 rounded-full bg-white/40 blur-3xl" />
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-black text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <span className="text-lg font-semibold tracking-[0.24em] uppercase">
              StudiosisLab
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold font-heading tracking-tight text-zinc-900">
            A design studio
          </h1>
          <p className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal text-zinc-900">
            <span className="italic font-serif tracking-tight">with a twist</span>
          </p>
        </div>

        <p className="mt-4 max-w-md text-xs sm:text-sm text-zinc-500">
          Minimal tools for resumes, documents, and playful experiments — all in
          a single calm workspace.
        </p>
      </motion.div>

      <div className="mt-10">
        <Dock />
      </div>

      <motion.div
        className="mt-10 w-full max-w-[900px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      >
        <div className="mx-auto overflow-hidden rounded-[32px] border border-white/80 bg-gradient-to-b from-white to-zinc-100 shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
          <img
            src="/home-editor-illustration.png"
            alt="StudiosisLab editor preview"
            className="mx-auto h-full w-full max-h-[520px] object-cover"
          />
        </div>
      </motion.div>
    </section>
  );
}

