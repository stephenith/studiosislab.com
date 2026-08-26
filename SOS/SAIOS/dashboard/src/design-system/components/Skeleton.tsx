type Props = {
  variant?: "line" | "block";
  width?: string | number;
  height?: string | number;
  className?: string;
};

export function Skeleton({
  variant = "line",
  width,
  height,
  className = "",
}: Props) {
  return (
    <div
      className={`ds-skeleton ${variant === "block" ? "ds-skeleton-block" : "ds-skeleton-line"}${className ? ` ${className}` : ""}`}
      style={{ width, height }}
      aria-hidden
    />
  );
}
