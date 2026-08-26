import type { CursorParsedResult, CursorProcessResult } from "./types.js";

const PREVIEW_MAX = 2000;

function extractFilesMentioned(stdout: string, stderr: string): string[] {
  const combined = `${stdout}\n${stderr}`;
  const paths = new Set<string>();
  const patterns = [
    /(?:created|wrote|updated|saved)\s+[`'"]?([^\s`'"]+\.(?:md|ts|tsx|js|json|txt))[`'"]?/gi,
    /(SOS\/07_LOGS\/[^\s`'"]+)/gi,
    /([A-Za-z0-9_./-]+\/hello\.md)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) {
      const path = match[1]?.trim();
      if (path) paths.add(path);
    }
  }
  return [...paths];
}

export class CursorResultParser {
  parse(process: CursorProcessResult): CursorParsedResult {
    const ok = process.launched && process.exit_code === 0 && !process.error;
    const output_preview = (process.stdout || process.stderr).trim().slice(0, PREVIEW_MAX);

    return {
      ok,
      exit_code: process.exit_code,
      stdout: process.stdout,
      stderr: process.stderr,
      duration_ms: process.duration_ms,
      output_preview,
      files_mentioned: extractFilesMentioned(process.stdout, process.stderr),
      error: process.error,
    };
  }
}
