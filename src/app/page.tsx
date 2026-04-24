import Image from "next/image";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import HomeSectionDashboard from "@/components/home/HomeSectionDashboard";
import HomeSectionEsign from "@/components/home/HomeSectionEsign";
import HomeSectionResume from "@/components/home/HomeSectionResume";
import HomeSnapScroll from "@/components/home/HomeSnapScroll";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";
import HeroSection from "@/components/HeroSection";

export default function HomePage() {
  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
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

        <HomeSnapScroll>
          <section className="flex min-h-[100dvh] shrink-0 snap-start flex-col">
            <HeroSection />
          </section>

          <section className="flex min-h-[calc(100dvh-6rem)] shrink-0 snap-center snap-always flex-col items-center justify-center px-4 py-6 sm:min-h-[calc(100dvh-6.5rem)] sm:py-8">
            <HomeSectionResume />
          </section>

          <section className="flex min-h-[calc(100dvh-6rem)] shrink-0 snap-center snap-always flex-col items-center justify-center px-4 py-6 sm:min-h-[calc(100dvh-6.5rem)] sm:py-8">
            <HomeSectionEsign />
          </section>

          <section className="flex min-h-[calc(100dvh-6rem)] shrink-0 snap-center snap-always flex-col items-center justify-center px-4 py-6 sm:min-h-[calc(100dvh-6.5rem)] sm:py-8">
            <HomeSectionDashboard />
          </section>
        </HomeSnapScroll>
      </div>
    </main>
  );
}
