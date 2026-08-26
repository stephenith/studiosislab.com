/** Lightweight SVG pulse — near-still when idle. */
export function SystemPulse({ active }: { active: boolean }) {
  return (
    <svg
      className="pulse-svg"
      viewBox="0 0 720 64"
      role="img"
      aria-label={
        active
          ? "System pulse active: Resume to Mock path executing"
          : "System pulse idle"
      }
    >
      <path
        id="aios-pulse-path"
        className={`pulse-path${active ? " active" : ""}`}
        d="M20 32 H120 H220 H340 H460 H580 H700"
      />
      {[
        [20, "Resume"],
        [120, "Knowledge"],
        [220, "Skill"],
        [340, "Brain"],
        [460, "Mock"],
        [580, "Response"],
      ].map(([x, label]) => (
        <g key={String(label)}>
          <circle cx={Number(x)} cy={32} r={4} fill={active ? "#0a0a0a" : "#bdbdbd"} />
          <text
            x={Number(x)}
            y={52}
            textAnchor="middle"
            fontSize="10"
            fill="#6b6b6b"
          >
            {label}
          </text>
        </g>
      ))}
      <circle
        className={`pulse-token${active ? " active" : ""}`}
        r="3"
        style={
          active
            ? { offsetPath: "path('M20 32 H700')" }
            : undefined
        }
        cx={active ? undefined : 20}
        cy={active ? undefined : 32}
      >
        {active ? (
          <animateMotion dur="2.4s" repeatCount="indefinite" path="M20 32 H700" />
        ) : null}
      </circle>
    </svg>
  );
}
