import { HomeCtaLink } from "@/components/analytics/HomeCtaLink";

const RESUME_ILLUSTRATION_SRC = "/dock/resume.svg";

const ILLUSTRATION_FRAME =
  "relative h-[min(40vh,460px)] w-full max-w-3xl shrink-0";

const CTA_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-100 px-5 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-colors duration-200 hover:bg-blue-200";

export default function HomeSectionResume() {
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-5 px-4 text-center sm:gap-6">
      <div className={ILLUSTRATION_FRAME}>
        <img
          src={RESUME_ILLUSTRATION_SRC}
          alt="Illustration of a resume page"
          className="h-full w-full object-contain object-center"
        />
      </div>
      <HomeCtaLink href="/resume" surface="home_resume" className={CTA_CLASS}>
        Browse templates
      </HomeCtaLink>
      <div className="flex w-full max-w-xl flex-col items-center">
        <h2 className="text-2xl font-semibold font-heading tracking-tight text-zinc-900 md:text-3xl">
          Resume builder
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 md:text-base">
          Build and edit your resume in the desktop or laptop browser. Start from a Resume Template or a blank page. Sign in with Google to save it within your account.
        </p>
      </div>
    </div>
  );
}
