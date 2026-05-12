import type { ReactNode } from "react";

type SectionBlockProps = {
  title: string;
  children: ReactNode;
};

export default function SectionBlock({ title, children }: SectionBlockProps) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6">
      <h2 className="font-heading text-xl font-semibold tracking-tight text-zinc-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700 sm:text-base">{children}</div>
    </section>
  );
}
