"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="w-full bg-white">

      {/* ------------------------------ */}
      {/* HERO SECTION */}
      {/* ------------------------------ */}
      <section
        className="
          relative w-full h-[520px] flex flex-col items-center justify-center 
          text-center bg-cover bg-center
        "
        style={{ backgroundImage: "url('/homebg.jpg')" }}
      >

        {/* Top Right Login / Signup */}
        <div className="absolute top-4 right-6 flex gap-4">
          <Link
            href="/login"
            className="px-4 py-1 text-white font-medium rounded-full bg-black/40 backdrop-blur hover:bg-black/60 transition"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="px-4 py-1 bg-white text-black rounded-full text-sm font-semibold shadow hover:bg-gray-200 transition"
          >
            Sign up
          </Link>
        </div>

        {/* Logo Bubble */}
        <div className="bg-white/60 backdrop-blur-xl w-32 h-32 rounded-full flex items-center justify-center shadow-lg mb-4">
          <span className="text-4xl font-semibold text-black">Lab</span>
        </div>

        {/* Tagline */}
        <h1 className="text-white text-3xl md:text-4xl font-bold max-w-2xl leading-tight drop-shadow-lg">
          Build Stunning Resume & Projects <br />
          for <span className="text-blue-200">Free – in Minutes!</span>
        </h1>

        {/* CTA Buttons */}
        <div className="mt-6 flex gap-4">
          <Link
            href="/app"
            className="
              px-5 py-2 bg-white/80 backdrop-blur text-black font-semibold rounded-md shadow 
              hover:bg-white transition
            "
          >
            Start Building Resume
          </Link>

          <Link
            href="/tools"
            className="
              px-5 py-2 border border-white text-white font-semibold rounded-md 
              hover:bg-white hover:text-black transition
            "
          >
            Explore Free Tools
          </Link>
        </div>
      </section>

      {/* --------------------------------------- */}
      {/* QUICK ACCESS TILES */}
      {/* --------------------------------------- */}
      <section className="w-full max-w-5xl mx-auto mt-10 px-4 pb-16">

        <h2 className="text-center text-2xl font-bold">
          <span className="text-blue-600">Quick Access</span> Tiles
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-8 text-center">

          {/* Resume Builder */}
          <Link
            href="/app"
            className="bg-white border rounded-2xl p-4 shadow hover:shadow-lg transition flex flex-col items-center"
          >
            <img src="/icons/resume.svg" className="w-10 h-10 mb-2 opacity-80" />
            <p className="text-sm font-semibold">Resume Builder</p>
          </Link>

          {/* Project Templates */}
          <Link
            href="/projects"
            className="bg-white border rounded-2xl p-4 shadow hover:shadow-lg transition flex flex-col items-center"
          >
            <img src="/icons/project.svg" className="w-10 h-10 mb-2 opacity-80" />
            <p className="text-sm font-semibold">Project Templates</p>
          </Link>

          {/* Quick Tools */}
          <Link
            href="/tools"
            className="bg-white border rounded-2xl p-4 shadow hover:shadow-lg transition flex flex-col items-center"
          >
            <img src="/icons/tools.svg" className="w-10 h-10 mb-2 opacity-80" />
            <p className="text-sm font-semibold">Quick Tools</p>
          </Link>

          {/* Colleges */}
          <Link
            href="/colleges"
            className="bg-white border rounded-2xl p-4 shadow hover:shadow-lg transition flex flex-col items-center"
          >
            <img src="/icons/college.svg" className="w-10 h-10 mb-2 opacity-80" />
            <p className="text-sm font-semibold">Colleges</p>
          </Link>

          {/* Partner With Us */}
          <Link
            href="/partner"
            className="bg-white border rounded-2xl p-4 shadow hover:shadow-lg transition flex flex-col items-center"
          >
            <img src="/icons/partner.svg" className="w-10 h-10 mb-2 opacity-80" />
            <p className="text-sm font-semibold">Partner With Us</p>
          </Link>
        </div>
      </section>
    </main>
  );
}