export const SKILL_BAR_ROLE = "skill-bar" as const;

export const SKILL_BAR_CHILD_ROLES = {
  label: "skill-bar-label",
  track: "skill-bar-track",
  fill: "skill-bar-fill",
} as const;

export type SkillBarModel = {
  label: string;
  value: number;
  max: number;
  fillColor: string;
  trackColor: string;
  trackWidth: number;
  trackHeight: number;
  showLabel: boolean;
  labelColor: string;
  labelFontSize: number;
};

export const DEFAULT_SKILL_BAR_MODEL: SkillBarModel = {
  label: "Skill",
  value: 65,
  max: 100,
  fillColor: "#22c55e",
  trackColor: "#d1d5db",
  trackWidth: 240,
  trackHeight: 8,
  showLabel: true,
  labelColor: "#374151",
  labelFontSize: 14,
};

export function clampSkillBarValue(value: number, max: number): number {
  const safeMax = Math.max(1, Math.floor(max));
  return Math.max(0, Math.min(safeMax, Math.round(Number(value) || 0)));
}

export function normalizeSkillBarModel(raw: Partial<SkillBarModel> | null | undefined): SkillBarModel {
  const max = Math.max(1, Number(raw?.max ?? DEFAULT_SKILL_BAR_MODEL.max));
  return {
    label: String(raw?.label ?? DEFAULT_SKILL_BAR_MODEL.label),
    value: clampSkillBarValue(raw?.value ?? DEFAULT_SKILL_BAR_MODEL.value, max),
    max,
    fillColor: String(raw?.fillColor ?? DEFAULT_SKILL_BAR_MODEL.fillColor),
    trackColor: String(raw?.trackColor ?? DEFAULT_SKILL_BAR_MODEL.trackColor),
    trackWidth: Math.max(40, Number(raw?.trackWidth ?? DEFAULT_SKILL_BAR_MODEL.trackWidth)),
    trackHeight: Math.max(4, Number(raw?.trackHeight ?? DEFAULT_SKILL_BAR_MODEL.trackHeight)),
    showLabel: raw?.showLabel !== false,
    labelColor: String(raw?.labelColor ?? DEFAULT_SKILL_BAR_MODEL.labelColor),
    labelFontSize: Math.max(8, Number(raw?.labelFontSize ?? DEFAULT_SKILL_BAR_MODEL.labelFontSize)),
  };
}
