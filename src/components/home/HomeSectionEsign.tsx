import Image from "next/image";
import Link from "next/link";

const ESIGN_ILLUSTRATION_SRC =
  "/illustrations/" + encodeURIComponent("E-signing illustration.png");

const ILLUSTRATION_FRAME =
  "relative h-[min(40vh,460px)] w-full max-w-3xl shrink-0";

const CTA_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-100 px-5 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-colors duration-200 hover:bg-blue-200";

export default function HomeSectionEsign() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center sm:gap-6">
      <div className={ILLUSTRATION_FRAME}>
        <Image
          src={ESIGN_ILLUSTRATION_SRC}
          alt="E-Sign workflow illustration"
          fill
          className="object-contain object-center"
          sizes="(max-width: 768px) 100vw, 896px"
        />
      </div>
      <Link href="/tools" className={CTA_CLASS}>
        Sign a document
      </Link>
      <div className="flex w-full max-w-xl flex-col items-center">
        <h2 className="text-2xl font-semibold font-heading tracking-tight text-zinc-900 md:text-3xl">
          E‑Sign
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 md:text-base">
          A straightforward digital signing flow—upload documents, sign with confidence, and keep
          everything organized from first draft to final file. Built to save time versus manual
          paperwork and stay pleasant when you come back again and again.
        </p>
      </div>
    </div>
  );
}
