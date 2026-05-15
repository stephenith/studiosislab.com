import Image from "next/image";
import Link from "next/link";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";

export default function DashboardLoginPage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-4 sm:px-2">
          <Link href="/" className="relative block h-11 w-[min(100%,280px)] shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="StudiosisLab"
              fill
              className="object-contain object-left"
              sizes="280px"
              priority
            />
          </Link>
          <HomeHeaderAuth />
        </header>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-12 pt-4">
          <div className="relative mb-8 flex h-40 w-full max-w-[280px] shrink-0 items-center justify-center sm:mb-10 sm:h-48 sm:max-w-[336px]">
            <Image
              src={HOME_LOGOS_LIGHT.heroLab}
              alt="StudiosisLab"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 90vw, 336px"
              priority
            />
          </div>

          <div className="w-full max-w-lg rounded-2xl border border-zinc-200/90 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <h1 className="text-center font-heading text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
              Publisher partners (invite only)
            </h1>
            <p className="mt-4 text-center text-sm leading-relaxed text-zinc-600">
              This space is reserved for approved Studiosis publishing and ad-tech partners. Access is
              invite-only: credentials are issued manually after onboarding and approval—not through
              public sign-up.
            </p>
            <p className="mt-4 text-center text-sm leading-relaxed text-zinc-600">
              If you are exploring a partnership or need help with StudiosisLab, reach our team through
              the contact page—we will route your message to the right inbox.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
              >
                Contact StudiosisLab
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                Back to home
              </Link>
            </div>
            <p className="mt-6 text-center text-xs text-zinc-500">
              Business inquiries:{" "}
              <a className="font-medium text-zinc-700 underline" href="mailto:business@studiosislab.com">
                business@studiosislab.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
