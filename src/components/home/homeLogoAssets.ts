/**
 * Homepage-only logo paths (`public/`). Use LIGHT on white/dot background;
 * swap to DARK when a homepage theme toggle is added.
 */
export const HOME_LOGOS_LIGHT = {
  header: "/Studiosis.Lab%20Black%20logo.png",
  heroLab: "/Lab%20Black%20logo.png",
} as const;

/** Reserved for dark homepage background — wire when theme is implemented. */
export const HOME_LOGOS_DARK = {
  header: "/Studiosis.Lab%20White%20logo.png",
  heroLab: "/Lab%20White%20logo.png",
} as const;
