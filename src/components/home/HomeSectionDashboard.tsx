import { HomeCtaLink } from "@/components/analytics/HomeCtaLink";

const DASHBOARD_ILLUSTRATION_SRC = "/dock/docs.svg";

const ILLUSTRATION_FRAME =
  "relative h-[min(40vh,460px)] w-full max-w-3xl shrink-0";

const CTA_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-100 px-5 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-colors duration-200 hover:bg-blue-200";

export default function HomeSectionDashboard() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center sm:gap-6">
      <div className={ILLUSTRATION_FRAME}>
        <img
          src={DASHBOARD_ILLUSTRATION_SRC}
          alt="Illustration of a dashboard"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain object-center"
          style={{ transform: "scale(0.9) translateZ(0)" }}
        />
      </div>
      <HomeCtaLink href="/dashboard/login" surface="home_publishers" className={CTA_CLASS}>
        Publisher login
      </HomeCtaLink>
      <div className="flex w-full max-w-xl flex-col items-center">
        <h2 className="text-2xl font-semibold font-heading tracking-tight text-zinc-900 md:text-3xl">
          Publisher dashboard
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 md:text-base">
          Publisher is for approved partners with issued credentials.
        </p>
      </div>
    </div>
  );
}
