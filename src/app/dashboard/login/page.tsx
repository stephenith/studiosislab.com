import Image from "next/image";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";

export default function DashboardLoginPage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-4 sm:px-2">
          <div className="relative h-11 w-[min(100%,280px)] shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="Studiosis Lab"
              fill
              className="object-contain object-left"
              sizes="280px"
              priority
            />
          </div>
          <HomeHeaderAuth />
        </header>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-12 pt-4">
          <div className="relative mb-8 flex h-48 w-full max-w-[336px] shrink-0 items-center justify-center">
            <Image
              src={HOME_LOGOS_LIGHT.heroLab}
              alt="Studiosis Lab"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 90vw, 336px"
              priority
            />
          </div>

          <div className="w-full max-w-md rounded-2xl border border-zinc-200/90 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <h1 className="text-center text-xl font-semibold font-heading tracking-tight text-zinc-900 md:text-2xl">
              Login to your publisher side dashboard
            </h1>

            <form className="mt-8 space-y-4" action="#" method="post">
              <div className="text-left">
                <label htmlFor="dashboard-user-id" className="mb-1.5 block text-xs font-medium text-zinc-600">
                  User ID
                </label>
                <input
                  id="dashboard-user-id"
                  name="userId"
                  type="text"
                  autoComplete="username"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-900/10 transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2"
                  placeholder="Enter your user ID"
                />
              </div>
              <div className="text-left">
                <label htmlFor="dashboard-password" className="mb-1.5 block text-xs font-medium text-zinc-600">
                  Password
                </label>
                <input
                  id="dashboard-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-900/10 transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2"
                  placeholder="Enter your password"
                />
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
