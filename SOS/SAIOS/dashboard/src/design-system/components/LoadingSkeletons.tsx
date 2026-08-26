import { Skeleton } from "./Skeleton";

type Props = {
  variant?: "cards" | "list" | "page";
  count?: number;
  className?: string;
};

export function LoadingSkeletons({
  variant = "cards",
  count = 4,
  className = "",
}: Props) {
  if (variant === "list") {
    return (
      <div className={`ds-skel-pack${className ? ` ${className}` : ""}`} aria-busy>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} variant="line" height={48} />
        ))}
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className={`ds-skel-pack${className ? ` ${className}` : ""}`} aria-busy>
        <Skeleton variant="line" width="40%" height={28} />
        <Skeleton variant="line" width="60%" height={14} />
        <div className="ds-skel-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="ds-skel-card" variant="block" height={110} />
          ))}
        </div>
        <Skeleton variant="block" height={200} />
      </div>
    );
  }

  return (
    <div className={`ds-skel-row${className ? ` ${className}` : ""}`} aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="ds-skel-card" variant="block" height={110} />
      ))}
    </div>
  );
}
