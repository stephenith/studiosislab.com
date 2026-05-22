import Image from "next/image";

const RESUME_ILLUSTRATION_SRC =
  "/illustrations/" + encodeURIComponent("Resume illustration.webp");

export default function ResumeBuilderIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white/70 shadow-sm">
      <div className="relative aspect-[16/9] w-full">
        <Image
          src={RESUME_ILLUSTRATION_SRC}
          alt="Resume builder illustration"
          fill
          className="object-contain p-6 sm:p-8"
          sizes="(max-width: 768px) 92vw, 720px"
        />
      </div>
    </div>
  );
}
