import AccountAvatar from "@/components/AccountAvatar";
import HeroSection from "@/components/HeroSection";

export default function HomePage() {
  // For now we keep this UI‑only and pass no user; wiring real auth can reuse this component.
  const user = null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f3f3] px-5 py-6">
      <div className="relative flex h-[780px] w-full max-w-[100vw] flex-col overflow-hidden rounded-[20px] border border-white/80 bg-gradient-to-b from-[#f8f8f8] to-[#ececec] shadow-[0_40px_120px_rgba(15,23,42,0.25)]">
        <header className="flex items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-[11px] font-semibold tracking-[0.1em] uppercase text-white shadow-md">
              SL
            </div>
            <span className="text-xs font-medium tracking-[0.2em] text-zinc-700 uppercase">
              StudiosisLab
            </span>
          </div>
          <AccountAvatar user={user} />
        </header>

        <HeroSection />
      </div>
    </main>
  );
}
