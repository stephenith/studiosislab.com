/**
 * Section ordering — deterministic order from Mock + ATS defaults.
 */
import type { BrainPlanningOutput, SectionOrdering } from "./types.js";

const CANONICAL = [
  "header",
  "summary",
  "experience",
  "skills",
  "education",
  "certifications",
  "projects",
  "languages",
] as const;

const REQUIRED_DEFAULT = ["header", "summary", "experience", "skills", "education"];

export function buildSectionOrdering(output: BrainPlanningOutput): SectionOrdering {
  const incoming = (output.sections ?? []).map((s) => String(s).toLowerCase().trim());
  const known = incoming.filter((s) =>
    (CANONICAL as readonly string[]).includes(s),
  );
  const order =
    known.length > 0
      ? [
          ...known,
          ...CANONICAL.filter((c) => !known.includes(c) && REQUIRED_DEFAULT.includes(c)),
        ]
      : [...REQUIRED_DEFAULT];

  // Deduplicate preserve order
  const seen = new Set<string>();
  const deduped = order.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  const required = REQUIRED_DEFAULT.filter((r) => deduped.includes(r));
  const optional = deduped.filter((s) => !REQUIRED_DEFAULT.includes(s));
  const omitted = CANONICAL.filter((c) => !deduped.includes(c));

  return { order: deduped, required, optional, omitted };
}
