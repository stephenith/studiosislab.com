/**
 * Competitive benchmark principles — design thinking only, never layout copying.
 */
import type { CompetitiveBenchmark } from "./types.js";

export const COMPETITIVE_SET: CompetitiveBenchmark[] = [
  {
    source: "Resume.io",
    design_thinking: [
      "Strong thumbnail-first first impression",
      "Recruiter-friendly one-column scan path",
      "Paid-tier polish through structure not decoration",
    ],
    premium_signals: ["clear header hero", "calm spacing", "predictable section order"],
    anti_patterns: ["flat section rhythm", "generic builder feel"],
  },
  {
    source: "Novorésumé",
    design_thinking: [
      "Trust through restraint and consistency",
      "Executive calm instead of expressive noise",
    ],
    premium_signals: ["predictable hierarchy", "low decoration", "visual reliability"],
    anti_patterns: ["over-designed accents", "novice typography mismatch"],
  },
  {
    source: "Canva Resume Templates",
    design_thinking: [
      "Emotional thumbnail appeal matters before ATS reasoning",
      "Distinctive signature helps click-through",
    ],
    premium_signals: ["memorable silhouette", "high first-impression confidence"],
    anti_patterns: ["commodity sameness", "decorative clutter"],
  },
  {
    source: "Enhancv",
    design_thinking: [
      "Experience can be visually focal while staying readable",
      "Modernity comes from flow and tension, not gimmicks",
    ],
    premium_signals: ["experience emphasis", "clean modern hierarchy"],
    anti_patterns: ["wall-of-text experience", "flat bullets"],
  },
  {
    source: "Kickresume",
    design_thinking: ["Commercial premium means high clarity at thumbnail scale"],
    premium_signals: ["clear roles", "controlled density"],
    anti_patterns: ["over-compression", "weak header identity"],
  },
  {
    source: "Adobe Express",
    design_thinking: ["Premium creative systems balance expression with alignment"],
    premium_signals: ["shape consistency", "clean visual confidence"],
    anti_patterns: ["inconsistent motif language"],
  },
  {
    source: "Microsoft Create",
    design_thinking: ["Professional trust comes from conservatism plus readability"],
    premium_signals: ["print safety", "corporate discipline"],
    anti_patterns: ["weak hierarchy", "dated rhythm"],
  },
  {
    source: "Google Docs resume templates",
    design_thinking: ["Utility and clarity can still feel polished if rhythm is clean"],
    premium_signals: ["effortless scan speed", "minimal friction"],
    anti_patterns: ["plainness without brand recall"],
  },
  {
    source: "Swiss editorial layouts",
    design_thinking: ["Hierarchy, grid, and optical balance create timeless authority"],
    premium_signals: ["strong axis", "precise weight contrast", "negative space discipline"],
    anti_patterns: ["unresolved alignment", "visual wobble"],
  },
  {
    source: "Modern corporate annual reports",
    design_thinking: ["Perceived value rises when data-rich pages still breathe"],
    premium_signals: ["premium density", "section pacing", "executive confidence"],
    anti_patterns: ["crowded dense pages", "no focal story"],
  },
];

export const COMPETITIVE_SOURCES = COMPETITIVE_SET.map((b) => b.source);
