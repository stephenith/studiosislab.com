import Image from "next/image";
import Link from "next/link";

const DASHBOARD_ILLUSTRATION_SRC =
  "/illustrations/" + encodeURIComponent("Dashboard illustration.png");

const ILLUSTRATION_FRAME =
  "relative h-[min(40vh,460px)] w-full max-w-3xl shrink-0";

const CTA_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-100 px-5 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-colors duration-200 hover:bg-blue-200";

export default function HomeSectionDashboard() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 text-center sm:gap-6">
      <div className={ILLUSTRATION_FRAME}>
        <Image
          src={DASHBOARD_ILLUSTRATION_SRC}
          alt="Live dashboard illustration"
          fill
          className="object-contain object-center"
          sizes="(max-width: 768px) 100vw, 896px"
        />
      </div>
      <Link href="/dashboard/login" className={CTA_CLASS}>
        Login
      </Link>
      <div className="flex w-full max-w-xl flex-col items-center">
        <h2 className="text-2xl font-semibold font-heading tracking-tight text-zinc-900 md:text-3xl">
          Live dashboard
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 md:text-base">
          Real-time reporting for approved ad tech partners and clients. With issued credentials, your
          team can monitor live performance in one place while we operate and maintain the platform in
          the background—clear visibility when transparency matters.
        </p>
      </div>
    </div>
  );
}
