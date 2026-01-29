import Link from "next/link";

export default function HomePage() {
  return (
    <main className="w-full bg-white">

      <section
        className="relative w-full min-h-[560px] flex flex-col items-center justify-center text-center bg-cover bg-center overflow-hidden"
        style={{ backgroundImage: "url('/homebg.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />

        <div className="absolute top-6 z-20 flex w-full justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-1.5 bg-black text-white rounded-full text-sm font-medium shadow-md hover:bg-neutral-800 transition"
          >
            Log in
          </Link>

          <Link
            href="/login"
            className="px-5 py-1.5 bg-white text-black rounded-full text-sm font-semibold shadow-md hover:bg-gray-100 transition"
          >
            Sign up
          </Link>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex items-center justify-center mb-5">
            <div className="absolute w-40 h-40 bg-white/15 blur-3xl rounded-full" />
            <div className="absolute w-32 h-32 bg-white/30 rounded-full backdrop-blur-xl" />
            <div className="absolute w-28 h-28 bg-white/60 rounded-full backdrop-blur-2xl shadow-xl" />
            <span className="relative text-4xl font-semibold text-black">Lab</span>
          </div>

          <h1 className="text-white text-3xl md:text-5xl font-bold max-w-3xl leading-tight drop-shadow-lg">
            Build Stunning Resume & Projects for Free – in Minutes!
          </h1>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/resume"
              className="px-6 py-2.5 bg-white text-black font-semibold rounded-md shadow hover:bg-white/90 transition"
            >
              Start Building Resume
            </Link>

            <Link
              href="/tools"
              className="px-6 py-2.5 border border-white text-white font-semibold rounded-md hover:bg-white hover:text-black transition"
            >
              DocuSign Tool
            </Link>
          </div>
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
            href="/resume" 
            className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white"
          >
            <img src="/resume.svg" className="w-12 h-12" alt="Resume Builder" />
            <p className="text-sm font-semibold text-center">Resume Builder</p>
          </Link>

          <Link href="/projects" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/project.svg" className="w-12 h-12" alt="Project Templates" />
            <p className="text-sm font-semibold text-center">Project Templates</p>
          </Link>

          <Link href="/tools" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/tools.svg" className="w-12 h-12" alt="DocuSign Tool" />
            <p className="text-sm font-semibold text-center">DocuSign</p>
          </Link>

          <Link href="#coming-soon" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/college.svg" className="w-12 h-12" alt="Colleges" />
            <p className="text-sm font-semibold text-center">Colleges</p>
          </Link>

          <Link href="#coming-soon" className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:shadow-lg transition bg-white">
            <img src="/partner.svg" className="w-12 h-12" alt="Partner With Us" />
            <p className="text-sm font-semibold text-center">Partner With Us</p>
          </Link>

        </div>
      </section>

    </main>
  );
}
