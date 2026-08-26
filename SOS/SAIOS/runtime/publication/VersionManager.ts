/**
 * Version manager — template versioning for catalog entries.
 */
export function initialVersion(): string {
  return "1.0.0";
}

export function bumpPatch(version: string): string {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "1.0.0";
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join(".");
}
