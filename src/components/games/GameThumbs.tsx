/** Minimal monochrome SVG thumbnails for the Games hub tiles. */

export function TicTacToeThumb() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-[72%] w-[72%] max-w-[180px] text-zinc-800"
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round">
        <line x1="35" y1="15" x2="35" y2="85" />
        <line x1="65" y1="15" x2="65" y2="85" />
        <line x1="15" y1="35" x2="85" y2="35" />
        <line x1="15" y1="65" x2="85" y2="65" />
        <path d="M22 22 L48 48 M48 22 L22 48" strokeWidth={2.5} />
        <circle cx="72" cy="72" r="10" strokeWidth={2} />
      </g>
    </svg>
  );
}

export function SnakeThumb() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-[72%] w-[72%] max-w-[180px] text-zinc-800"
      aria-hidden
    >
      <g fill="currentColor">
        <rect x="58" y="18" width="10" height="10" rx="2" opacity="0.9" />
        <rect x="48" y="28" width="10" height="10" rx="2" opacity="0.85" />
        <rect x="38" y="38" width="10" height="10" rx="2" opacity="0.8" />
        <rect x="28" y="48" width="10" height="10" rx="2" opacity="0.75" />
        <rect x="28" y="58" width="10" height="10" rx="2" opacity="0.7" />
        <rect x="38" y="68" width="10" height="10" rx="2" opacity="0.65" />
        <rect x="48" y="68" width="10" height="10" rx="2" opacity="0.55" />
        <rect x="58" y="58" width="10" height="10" rx="2" opacity="0.45" />
      </g>
      <circle cx="72" cy="24" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function MemoryMatchThumb() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-[72%] w-[72%] max-w-[180px] text-zinc-800"
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="14" y="18" width="32" height="40" rx="4" fill="rgba(0,0,0,0.04)" />
        <rect x="54" y="18" width="32" height="40" rx="4" fill="rgba(0,0,0,0.04)" />
        <rect x="14" y="62" width="32" height="22" rx="4" fill="rgba(0,0,0,0.04)" />
        <rect x="54" y="62" width="32" height="22" rx="4" fill="rgba(0,0,0,0.04)" />
        <line x1="22" y1="26" x2="38" y2="42" opacity="0.35" />
        <line x1="38" y1="26" x2="22" y2="42" opacity="0.35" />
        <line x1="62" y1="26" x2="78" y2="42" opacity="0.35" />
        <line x1="78" y1="26" x2="62" y2="42" opacity="0.35" />
      </g>
    </svg>
  );
}

export function BreakoutThumb() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-[72%] w-[72%] max-w-[180px] text-zinc-800"
      aria-hidden
    >
      <g fill="currentColor">
        <rect x="12" y="16" width="10" height="6" rx="1" opacity="0.85" />
        <rect x="26" y="16" width="10" height="6" rx="1" opacity="0.85" />
        <rect x="40" y="16" width="10" height="6" rx="1" opacity="0.85" />
        <rect x="54" y="16" width="10" height="6" rx="1" opacity="0.85" />
        <rect x="68" y="16" width="10" height="6" rx="1" opacity="0.85" />
        <rect x="19" y="26" width="10" height="6" rx="1" opacity="0.65" />
        <rect x="33" y="26" width="10" height="6" rx="1" opacity="0.65" />
        <rect x="47" y="26" width="10" height="6" rx="1" opacity="0.65" />
        <rect x="61" y="26" width="10" height="6" rx="1" opacity="0.65" />
      </g>
      <circle cx="52" cy="56" r="4" fill="currentColor" />
      <rect x="36" y="78" width="28" height="5" rx="1.5" fill="currentColor" opacity="0.9" />
    </svg>
  );
}
