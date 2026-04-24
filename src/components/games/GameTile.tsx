import Link from "next/link";
import type { ReactNode } from "react";

type GameTileProps = {
  title: string;
  description: string;
  href: string;
  thumb: ReactNode;
};

export default function GameTile({ title, description, href, thumb }: GameTileProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/90 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100/90 text-zinc-800">
        {thumb}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h2 className="text-lg font-semibold font-heading tracking-tight text-zinc-900 sm:text-xl">
          {title}
        </h2>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">{description}</p>
        <Link
          href={href}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          Play now
        </Link>
      </div>
    </article>
  );
}
