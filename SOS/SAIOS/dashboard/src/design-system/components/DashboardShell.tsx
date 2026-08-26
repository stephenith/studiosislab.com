import type { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  toolbar: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  inspectorOpen?: boolean;
  className?: string;
  "data-aios-dashboard"?: string;
  "data-live"?: string;
  "data-readonly"?: string;
};

export function DashboardShell({
  sidebar,
  toolbar,
  children,
  inspector,
  inspectorOpen = false,
  className = "",
  ...dataAttrs
}: Props) {
  return (
    <div
      className={`ds-shell${inspectorOpen ? " has-inspector" : ""}${className ? ` ${className}` : ""}`}
      {...dataAttrs}
    >
      {sidebar}
      {toolbar}
      <main className="ds-shell-main" id="main">
        {children}
      </main>
      {inspectorOpen && inspector ? (
        <aside className="ds-inspector" aria-label="Inspector">
          {inspector}
        </aside>
      ) : null}
    </div>
  );
}
