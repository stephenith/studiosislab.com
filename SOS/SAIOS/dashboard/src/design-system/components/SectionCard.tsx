import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
};

export function SectionCard({ children, className = "", title }: Props) {
  return (
    <section className={`ds-card${className ? ` ${className}` : ""}`}>
      {title ? <h3 className="ds-card-title">{title}</h3> : null}
      {children}
    </section>
  );
}
