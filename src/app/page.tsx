"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="w-full">

      {/* HERO SECTION */}
      <section
        className="
          relative w-full h-[520px] flex flex-col items-center justify-center 
          text-center bg-cover bg-center
        "
        style={{ backgroundImage: "url('/homebg.jpg')" }}
      >
        {/* Login + Signup */}
        <div className="absolute top-4 right-6 flex gap-4">
          <Link href="/login" className="text-white font-medium">
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1 bg-white text-black rounded-full text-sm font-semibold shadow"
          >
            Sign up
          </Link>
        </div>

        {/* Logo */}
        <div className="bg-white/90 w-28 h-28 rounded-full flex items-center justify-center shadow-lg mb-4">
          <span className="text-3xl font-bold">Lab</span>
        </div>

        {/* Tagline */}
        <h1 className="text-white text-2xl md:text-3xl font-bold max-w-md leading-tight">
          Build Stunning Resume & Projects <br />
          for <span className="text-blue-200">Free – in Minutes!</span>
        </h1>

        {/* CTA Buttons */}
        <div className="mt-6 flex gap-4">
          <Link
            href="/app"
            className="
              px-5 py-2 bg-white text-black font-semibold rounded-md shadow 
              hover:bg-gray-200 transition
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

      {/* QUICK ACCESS SECTION */}
      <section className="w-full max-w-4xl mx-auto mt-10 px-4 pb-16">
        <h2 className="text-center text-lg font-semibold">
          <span className="text-blue-600">Quick Access</span> Tiles
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">

          {/* Resume Builder */}
          <Link
            href="/app"
            className="
              bg-white border rounded-xl p-4 flex flex-col items-center 
              shadow hover:shadow-md transition
            "
          >
            <div className="w-12 h-12 bg-gray-200 rounded-md" />
            <p className="mt-2 text-sm font-semibold">Resume Builder</p>
          </Link>

          {/* Project Templates */}
          <Link
            href="/projects"
            className="
              bg-white border rounded-xl p-4 flex flex-col items-center 
              shadow hover:shadow-md transition
            "
          >
            <div className="w-12 h-12 bg-gray-200 rounded-md" />
            <p className="mt-2 text-sm font-semibold">Project Templates</p>
          </Link>

          {/* Quick Tools */}
          <Link
            href="/tools"
            className="
              bg-white border rounded-xl p-4 flex flex-col items-center 
              shadow hover:shadow-md transition
            "
          >
            <div className="w-12 h-12 bg-gray-200 rounded-md" />
            <p className="mt-2 text-sm font-semibold">Quick Tools</p>
          </Link>

          {/* Colleges */}
          <Link
            href="/colleges"
            className="
              bg-white border rounded-xl p-4 flex flex-col items-center 
              shadow hover:shadow-md transition
            "
          >
            <div className="w-12 h-12 bg-gray-200 rounded-md" />
            <p className="mt-2 text-sm font-semibold">Colleges</p>
          </Link>

          {/* Partner With Us */}
          <Link
            href="/partner"
            className="
              bg-white border rounded-xl p-4 flex flex-col items-center 
              shadow hover:shadow-md transition
            "
          >
            <div className="w-12 h-12 bg-gray-200 rounded-md" />
            <p className="mt-2 text-sm font-semibold">Partner With Us</p>
          </Link>
        </div>
      </section>

    </main>
  );
}