"use client";

import Link from "next/link";
import EditorLayout from "@/components/editor/EditorLayout";
export default function HomePage() {
  return (
    <main className="w-full bg-white">

      <section
        className="
          relative w-full h-[520px] flex flex-col items-center justify-center 
          text-center bg-cover bg-center
        "
        style={{ backgroundImage: "url('/homebg.jpg')" }}
      >

        {/* Login + Signup */}
        <div className="absolute top-6 flex gap-3 justify-center w-full z-20">
          <Link
            href="/login"
            className="
              px-5 py-1.5 
              bg-black text-white 
              rounded-full 
              text-sm font-medium 
              shadow-md hover:bg-neutral-800 
              transition
            "
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="
              px-5 py-1.5 
              bg-white text-black 
              rounded-full 
              text-sm font-semibold 
              shadow-md hover:bg-gray-100 
              transition
            "
          >
            Sign up
          </Link>
        </div>

        {/* Logo Bubble */}
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute w-40 h-40 bg-white/20 blur-3xl rounded-full"></div>
          <div className="absolute w-32 h-32 bg-white/40 rounded-full backdrop-blur-xl"></div>
          <div className="absolute w-28 h-28 bg-white/70 rounded-full backdrop-blur-2xl shadow-xl"></div>
          <span className="relative text-4xl font-semibold text-black">Lab</span>
        </div>

        {/* Tagline */}
        <h1 className="text-white text-3xl md:text-4xl font-bold max-w-2xl leading-tight drop-shadow-lg">
          Build Stunning Resume & Projects <br />
          for <span className="text-blue-200">Free – in Minutes!</span>
        </h1>

        {/* CTA Buttons */}
        <div className="mt-6 flex gap-4">
          <Link
            href="/editor/new"
            className="px-5 py-2 bg-white/80 backdrop-blur text-black font-semibold rounded-md shadow hover:bg-white transition"
          >
            Start Building Resume
          </Link>

          <Link
            href="/docusign"
            className="px-5 py-2 border border-white text-white font-semibold rounded-md hover:bg-white hover:text-black transition"
          >
            DocuSign Tool
          </Link>
        </div>
      </section>

      {/* Quick Access */}
      <section className="w-full max-w-5xl mx-auto mt-14 px-4 pb-20">
        <h2 className="text-center text-2xl font-semibold tracking-wide">
          <span className="text-blue-600">Quick Access</span> Tiles
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-10">

          {/* Resume Builder Tile */}
          <Link 
            href="/editor/new" 
            className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white"
          >
            <img src="/resume.svg" className="w-12 h-12" alt="Resume Builder" />
            <p className="text-sm font-semibold text-center">Resume Builder</p>
          </Link>

          <Link href="/projects" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/project.svg" className="w-12 h-12" alt="Project Templates" />
            <p className="text-sm font-semibold text-center">Project Templates</p>
          </Link>

          <Link href="/docusign" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/tools.svg" className="w-12 h-12" alt="DocuSign Tool" />
            <p className="text-sm font-semibold text-center">DocuSign</p>
          </Link>

          <Link href="#" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/college.svg" className="w-12 h-12" alt="Colleges" />
            <p className="text-sm font-semibold text-center">Colleges</p>
          </Link>

          <Link href="#" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/partner.svg" className="w-12 h-12" alt="Partner With Us" />
            <p className="text-sm font-semibold text-center">Partner With Us</p>
          </Link>

        </div>
      </section>

    </main>
  );
}