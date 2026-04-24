import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";

type GamesFeatureShellProps = {
  title: string;
  children: ReactNode;
};

export default function GamesFeatureShell({ title, children }: GamesFeatureShellProps) {
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-4 sm:px-2">
          <Link href="/" className="relative block h-11 w-[min(100%,280px)] shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="Studiosis Lab — home"
              fill
              className="object-contain object-left"
              sizes="280px"
              priority
            />
          </Link>
          <HomeHeaderAuth />
        </header>

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-4 pb-16 pt-4 text-center sm:pt-6">
          <h1 className="text-3xl font-semibold font-heading tracking-tight text-zinc-900 md:text-4xl">
            {title}
          </h1>
          {children}
          <Link
            href="/games"
            className="mt-10 inline-flex shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            Back to games
          </Link>
        </div>
      </div>
    </main>
  );
}
