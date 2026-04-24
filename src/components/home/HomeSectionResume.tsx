import Image from "next/image";
import Link from "next/link";

const RESUME_ILLUSTRATION_SRC =
  "/illustrations/" + encodeURIComponent("Resume illustration.png");

const ILLUSTRATION_FRAME =
  "relative h-[min(44vh,520px)] w-full max-w-4xl shrink-0";

const CTA_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-100 px-5 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-colors duration-200 hover:bg-blue-200";

export default function HomeSectionResume() {
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-5 px-4 text-center sm:gap-6">
      <div className={ILLUSTRATION_FRAME}>
        <Image
          src={RESUME_ILLUSTRATION_SRC}
          alt="Resume editor illustration"
          fill
          className="object-contain object-center"
          sizes="(max-width: 768px) 100vw, 1024px"
        />
      </div>
      <Link href="/resume" className={CTA_CLASS}>
        Choose template
      </Link>
      <div className="flex w-full max-w-xl flex-col items-center">
        <h2 className="text-2xl font-semibold font-heading tracking-tight text-zinc-900 md:text-3xl">
          Resume editor
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 md:text-base">
          A free resume builder you can rely on—create, refine, and download as many times as you like.
          Fast, modern editing keeps the experience smooth, and your progress is saved so you can step
          away and return whenever you are ready to keep polishing.
        </p>
      </div>
    </div>
  );
}
