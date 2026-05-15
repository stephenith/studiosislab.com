import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import HomeSectionDashboard from "@/components/home/HomeSectionDashboard";
import HomeSectionEsign from "@/components/home/HomeSectionEsign";
import HomeSectionResume from "@/components/home/HomeSectionResume";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";
import HeroSection from "@/components/HeroSection";
import SiteFooter from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "StudiosisLab",
  description:
    "Create resumes, manage documents, and prepare e-sign workflows with StudiosisLab’s simple online productivity tools.",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className="relative z-10 flex flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-4 sm:px-2">
          <Link href="/" className="relative block h-11 w-[min(100%,280px)] shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="StudiosisLab"
              fill
              className="object-contain object-left"
              sizes="280px"
            />
          </Link>
          <HomeHeaderAuth />
        </header>

        <section className="flex min-h-[calc(100dvh-6rem)] flex-col">
          <HeroSection />
        </section>

        <section className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center px-4 py-6 sm:min-h-[calc(100dvh-6.5rem)] sm:py-8">
          <HomeSectionResume />
        </section>

        <section className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center px-4 py-6 sm:min-h-[calc(100dvh-6.5rem)] sm:py-8">
          <HomeSectionEsign />
        </section>

        <section className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center px-4 py-6 sm:min-h-[calc(100dvh-6.5rem)] sm:py-8">
          <HomeSectionDashboard />
        </section>

        <div className="mx-auto w-full max-w-5xl px-1 pb-4 sm:px-2 sm:pb-6">
          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
