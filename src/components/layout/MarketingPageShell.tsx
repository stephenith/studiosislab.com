import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import SiteFooter from "@/components/layout/SiteFooter";

type MarketingPageShellProps = {
  children: ReactNode;
};

export default function MarketingPageShell({ children }: MarketingPageShellProps) {
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-6 sm:px-2">
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
        </header>

        <div className="mx-auto w-full max-w-5xl pb-16">
          {children}
          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
