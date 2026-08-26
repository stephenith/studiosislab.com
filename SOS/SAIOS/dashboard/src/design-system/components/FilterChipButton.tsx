import type { ReactNode } from "react";

type Props = {
  id: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  role?: string;
  "aria-selected"?: boolean;
};

/** Accessible filter chip for toolbars — Agent #156 / #157 */
export function FilterChipButton({
  id,
  label,
  active = false,
  onClick,
  className = "",
  role,
  "aria-selected": ariaSelected,
}: Props) {
  const chip = active ? "ds-chip active" : "ds-chip";
  return (
    <button
      type="button"
      id={`filter-chip-${id}`}
      className={`${chip}${className ? ` ${className}` : ""}`}
      aria-pressed={active}
      aria-selected={ariaSelected}
      role={role}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

type GroupProps = {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
};

export function FilterChipGroup({
  "aria-label": ariaLabel = "Filters",
  children,
  className = "",
}: GroupProps) {
  return (
    <div
      className={`ds-filter-chip-group${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
