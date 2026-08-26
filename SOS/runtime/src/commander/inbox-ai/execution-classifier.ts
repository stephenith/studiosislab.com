function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Product/feature requests that belong on the roadmap, not immediate execution. */
export function isPlanningFeatureRequest(text: string): boolean {
  const n = normalize(text);
  if (/\b(future work|roadmap|invoice generator|invoice system|ats templates?|seo|analytics)\b/.test(n)) {
    return true;
  }
  if (/\bbuild\b/.test(n) && /\b(generator|system|module|feature|templates?|hub|dashboard|platform)\b/.test(n)) {
    return true;
  }
  if (/\b(improve|add)\b/.test(n) && !/\b(file|folder)\b/.test(n)) {
    return true;
  }
  return false;
}

/**
 * CLASS 1 — EXECUTE NOW: concrete founder actions that bypass roadmap planning.
 */
export function classifyExecuteNow(raw: string): boolean {
  const n = normalize(raw);

  if (isPlanningFeatureRequest(raw)) return false;

  if (/\bbuild now\b/.test(n)) return true;
  if (/\b(create file|write file|create folder)\b/.test(n)) return true;
  if (/\b(generate report|generate a report)\b/.test(n)) return true;
  if (/\b(containing|with content)\b/.test(n)) return true;

  if (/(?:^|\s)(run|execute|test|verify|fix|perform)\b/.test(n)) {
    return true;
  }

  if (/\b(create|write)\b/.test(n) && /(?:SOS|src)\/[\w./-]+/.test(raw)) {
    return true;
  }

  if (/\.(txt|md|json|ts|tsx)\b/i.test(raw) && /\b(create|write|file)\b/.test(n)) {
    return true;
  }

  return false;
}
