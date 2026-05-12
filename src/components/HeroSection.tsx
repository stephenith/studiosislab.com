"use client";

import Image from "next/image";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import NamasteWorld from "@/components/home/NamasteWorld";
import dynamic from "next/dynamic";

const Dock = dynamic(() => import("./Dock"), {
  ssr: false,
});

export default function HeroSection() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6 flex h-48 w-full max-w-[336px] shrink-0 items-center justify-center">
          <Image
            src={HOME_LOGOS_LIGHT.heroLab}
            alt="Studiosis Lab"
            fill
            priority
            quality={70}
            className="object-contain object-center"
            sizes="(max-width: 768px) 90vw, 336px"
          />
        </div>

        <NamasteWorld />

        <div className="mt-1 flex flex-col items-center text-center">
          <h1 className="flex max-w-[min(100%,22rem)] flex-col gap-1.5 font-heading text-xl font-medium leading-[1.08] tracking-tight text-zinc-900 sm:max-w-none sm:text-2xl md:text-3xl lg:text-4xl">
            <span className="block">
              <span className="text-violet-600">Designs</span> made easier.
            </span>

            <span className="block">
              What will you <span className="text-violet-600">create</span> today?
            </span>
          </h1>

          <p className="mt-4 max-w-lg text-xs sm:text-sm text-zinc-500">
            Simple tools for resumes, e-signs and everyday creative work.
            We&apos;ve just started, stay tuned for more upcoming free tools.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <Dock />
      </div>
    </div>
  );
}