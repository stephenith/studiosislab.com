import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import SiteFooter from "@/components/layout/SiteFooter";

type LegalPageShellProps = {
  title: string;
  intro?: string;
  children: ReactNode;
};

export default function LegalPageShell({ title, intro, children }: LegalPageShellProps) {
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-6 sm:px-2">
          <Link href="/" className="relative block h-11 w-[min(100%,280px)] shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="StudiosisLab — home"
              fill
              className="object-contain object-left"
              sizes="280px"
              priority
            />
          </Link>
        </header>

        <div className="mx-auto w-full max-w-5xl pb-16">
          <article className="mx-auto w-full max-w-3xl pt-2 text-zinc-900 sm:pt-4">
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
            {intro ? <p className="mt-4 text-base leading-relaxed text-zinc-600">{intro}</p> : null}
            <div className="mt-8 space-y-8">{children}</div>
          </article>
          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
