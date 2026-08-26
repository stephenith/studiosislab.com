const FORBIDDEN_PATTERNS = [
  /^\.env$/,
  /^\.env\./,
  /package-lock\.json$/,
  /node_modules\//,
  /^SOS\/runtime\//,
];

export function isPathInScope(filePath: string, scope: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return scope.some((s) => normalized === s || normalized.endsWith(`/${s}`));
}

export function assertPathEditable(
  filePath: string,
  scope: string[],
): { allowed: boolean; reason?: string } {
  const normalized = filePath.replace(/\\/g, "/");

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized)) {
      return { allowed: false, reason: `Forbidden path: ${normalized}` };
    }
  }

  if (normalized.startsWith("SOS/07_LOGS/developer/")) {
    return { allowed: true };
  }

  const founderPrefixes = ["SOS/07_LOGS/", "SOS/09_REPORTS/", "SOS/01_KNOWLEDGE/"];
  if (founderPrefixes.some((p) => normalized.startsWith(p)) && isPathInScope(normalized, scope)) {
    return { allowed: true };
  }

  if (!isPathInScope(normalized, scope)) {
    return { allowed: false, reason: `Out of scope: ${normalized}` };
  }

  return { allowed: true };
}

export function filterAllowedEdits(
  files: string[],
  scope: string[],
): { allowed: string[]; rejected: Array<{ path: string; reason: string }> } {
  const allowed: string[] = [];
  const rejected: Array<{ path: string; reason: string }> = [];

  for (const file of files) {
    const check = assertPathEditable(file, scope);
    if (check.allowed) allowed.push(file);
    else rejected.push({ path: file, reason: check.reason ?? "rejected" });
  }

  return { allowed, rejected };
}
