import type { ButtonHTMLAttributes, ReactNode } from "react";

type Base = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
};

function sizeClass(size: Base["size"]) {
  if (size === "sm") return " ds-btn-sm";
  if (size === "lg") return " ds-btn-lg";
  return "";
}

export function PrimaryButton({
  children,
  size = "md",
  className = "",
  ...rest
}: Base) {
  return (
    <button
      type="button"
      className={`ds-btn ds-btn-primary${sizeClass(size)}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  size = "md",
  className = "",
  ...rest
}: Base) {
  return (
    <button
      type="button"
      className={`ds-btn ds-btn-secondary${sizeClass(size)}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  size = "md",
  className = "",
  ...rest
}: Base) {
  return (
    <button
      type="button"
      className={`ds-btn ds-btn-danger${sizeClass(size)}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
