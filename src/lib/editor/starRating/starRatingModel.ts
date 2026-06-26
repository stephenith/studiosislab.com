export const STAR_RATING_ROLE = "star-rating" as const;

export const STAR_RATING_CHILD_ROLES = {
  label: "star-rating-label",
  star: "star-rating-star",
} as const;

export type StarRatingModel = {
  label: string;
  value: number;
  max: number;
  filledColor: string;
  emptyColor: string;
  showLabel: boolean;
  labelGap: number;
  starGap: number;
  starSize: number;
};

export const DEFAULT_STAR_RATING_MODEL: StarRatingModel = {
  label: "Skill",
  value: 4,
  max: 5,
  filledColor: "#ca8a04",
  emptyColor: "#6b7280",
  showLabel: true,
  labelGap: 8,
  starGap: 20,
  starSize: 14.63,
};

export function clampStarRatingValue(value: number, max: number): number {
  const safeMax = Math.max(1, Math.floor(max));
  return Math.max(1, Math.min(safeMax, Math.round(Number(value) || 1)));
}

export function normalizeStarRatingModel(
  raw: Partial<StarRatingModel> | null | undefined
): StarRatingModel {
  const max = Math.max(1, Math.floor(Number(raw?.max ?? DEFAULT_STAR_RATING_MODEL.max)));
  return {
    label: String(raw?.label ?? DEFAULT_STAR_RATING_MODEL.label),
    value: clampStarRatingValue(raw?.value ?? DEFAULT_STAR_RATING_MODEL.value, max),
    max,
    filledColor: String(raw?.filledColor ?? DEFAULT_STAR_RATING_MODEL.filledColor),
    emptyColor: String(raw?.emptyColor ?? DEFAULT_STAR_RATING_MODEL.emptyColor),
    showLabel: raw?.showLabel !== false,
    labelGap: Math.max(0, Number(raw?.labelGap ?? DEFAULT_STAR_RATING_MODEL.labelGap)),
    starGap: Math.max(4, Number(raw?.starGap ?? DEFAULT_STAR_RATING_MODEL.starGap)),
    starSize: Math.max(4, Number(raw?.starSize ?? DEFAULT_STAR_RATING_MODEL.starSize)),
  };
}
