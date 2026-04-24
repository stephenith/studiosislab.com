type NoiseBackgroundProps = {
  /** Defaults to light for all existing call sites. */
  tone?: "light" | "dark";
};

/**
 * Subtle dot texture fixed to the viewport.
 * Light: white base + low-contrast dots. Dark: deep base + soft light dots.
 */
export default function NoiseBackground({ tone = "light" }: NoiseBackgroundProps) {
  const isDark = tone === "dark";
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 ${isDark ? "bg-zinc-950" : "bg-white"}`}
      style={{
        backgroundImage: isDark
          ? "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.06) 1px, transparent 0)"
          : "radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}
