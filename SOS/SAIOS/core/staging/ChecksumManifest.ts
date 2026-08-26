/**
 * Shared staging checksum manifest parser + verifier.
 * Canonical schema (StagingService): { algorithm, generated_at, files }
 * Legacy flat map (test fixtures only): { "<rel>": "<sha256 hex>" }
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SUPPORTED_CHECKSUM_ALGORITHMS = ["sha256"] as const;

export type StagingChecksumManifest = {
  algorithm: string;
  generated_at: string | null;
  files: Record<string, string>;
  schema: "canonical" | "legacy_flat";
};

export type ParseChecksumResult =
  | { ok: true; manifest: StagingChecksumManifest }
  | { ok: false; error: string };

export type VerifyChecksumResult = {
  ok: boolean;
  errors: string[];
  verified_files: string[];
  algorithm: string | null;
  schema: "canonical" | "legacy_flat" | null;
};

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export const CORE_STAGING_CHECKSUM_FILES = [
  "canvas.json",
  "preview-source.png",
  "thumbnail-source.png",
] as const;

/**
 * StagingService writes staging-manifest.json / validation-report.json into the
 * checksum map, then may finalize those meta files without re-sealing the map
 * (see StagingService post-write re-read skip). Content files remain authoritative.
 */
export const CHECKSUM_META_FILES_SKIP_HASH = new Set([
  "staging-manifest.json",
  "validation-report.json",
]);

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function looksLikeFlatLegacyMap(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  if ("algorithm" in obj || "files" in obj || "generated_at" in obj) {
    return false;
  }
  return keys.every((k) => typeof obj[k] === "string" && SHA256_HEX.test(String(obj[k])));
}

/**
 * Parse checksums.json raw JSON into a normalized manifest.
 * Fail closed on malformed / unsupported shapes.
 */
export function parseStagingChecksumManifest(raw: unknown): ParseChecksumResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "checksums.json must be a JSON object" };
  }

  // Canonical: { algorithm, generated_at?, files }
  if (isPlainObject(raw.files)) {
    const algorithm = String(raw.algorithm ?? "").trim().toLowerCase();
    if (!algorithm) {
      return { ok: false, error: "checksums.json missing algorithm" };
    }
    if (
      !(SUPPORTED_CHECKSUM_ALGORITHMS as readonly string[]).includes(algorithm)
    ) {
      return {
        ok: false,
        error: `unsupported checksum algorithm: ${algorithm}`,
      };
    }
    const files: Record<string, string> = {};
    for (const [rel, hash] of Object.entries(raw.files)) {
      if (typeof hash !== "string" || !SHA256_HEX.test(hash)) {
        return {
          ok: false,
          error: `invalid hash for ${rel}`,
        };
      }
      files[rel] = hash.toLowerCase();
    }
    if (Object.keys(files).length === 0) {
      return { ok: false, error: "checksums.json files map is empty" };
    }
    return {
      ok: true,
      manifest: {
        algorithm,
        generated_at:
          typeof raw.generated_at === "string" ? raw.generated_at : null,
        files,
        schema: "canonical",
      },
    };
  }

  // Legacy flat fixture map
  if (looksLikeFlatLegacyMap(raw)) {
    const files: Record<string, string> = {};
    for (const [rel, hash] of Object.entries(raw)) {
      files[rel] = String(hash).toLowerCase();
    }
    return {
      ok: true,
      manifest: {
        algorithm: "sha256",
        generated_at: null,
        files,
        schema: "legacy_flat",
      },
    };
  }

  return {
    ok: false,
    error:
      "malformed checksums.json — expected { algorithm, generated_at, files } or flat path→sha256 map",
  };
}

export function loadStagingChecksumManifest(
  checksumsPath: string,
): ParseChecksumResult {
  if (!existsSync(checksumsPath)) {
    return { ok: false, error: "checksums.json missing" };
  }
  try {
    const raw = JSON.parse(readFileSync(checksumsPath, "utf8")) as unknown;
    return parseStagingChecksumManifest(raw);
  } catch (e) {
    return {
      ok: false,
      error: `checksums.json unreadable: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Verify every listed file exists and matches SHA-256.
 * Optionally require core staging artifacts to be present in the map.
 */
export function verifyStagingChecksumManifest(input: {
  packageDir: string;
  checksumsPath?: string;
  requireCoreFiles?: boolean;
  requiredFiles?: readonly string[];
}): VerifyChecksumResult {
  const checksumsPath =
    input.checksumsPath ?? join(input.packageDir, "checksums.json");
  const parsed = loadStagingChecksumManifest(checksumsPath);
  if (!parsed.ok) {
    return {
      ok: false,
      errors: [parsed.error],
      verified_files: [],
      algorithm: null,
      schema: null,
    };
  }

  const { manifest } = parsed;
  const errors: string[] = [];
  const verified_files: string[] = [];

  if (manifest.algorithm !== "sha256") {
    errors.push(`unsupported checksum algorithm: ${manifest.algorithm}`);
  }

  const required =
    input.requiredFiles ??
    (input.requireCoreFiles === false ? [] : CORE_STAGING_CHECKSUM_FILES);
  for (const rel of required) {
    if (!manifest.files[rel]) {
      errors.push(`required checksum entry missing: ${rel}`);
    }
  }

  for (const [rel, expected] of Object.entries(manifest.files)) {
    const abs = join(input.packageDir, rel);
    if (!existsSync(abs)) {
      errors.push(`checksum file missing: ${rel}`);
      continue;
    }
    // Meta files: require existence, skip hash (StagingService re-seal skip)
    if (CHECKSUM_META_FILES_SKIP_HASH.has(rel)) {
      verified_files.push(rel);
      continue;
    }
    if (manifest.algorithm === "sha256") {
      const actual = sha256File(abs);
      if (actual !== expected) {
        errors.push(`checksum mismatch: ${rel}`);
        continue;
      }
    }
    verified_files.push(rel);
  }

  return {
    ok: errors.length === 0,
    errors,
    verified_files,
    algorithm: manifest.algorithm,
    schema: manifest.schema,
  };
}

/** Build canonical checksums.json payload (for writers / fixtures). */
export function buildCanonicalChecksumManifest(input: {
  files: Record<string, string>;
  generated_at?: string;
}): {
  algorithm: "sha256";
  generated_at: string;
  files: Record<string, string>;
} {
  return {
    algorithm: "sha256",
    generated_at: input.generated_at ?? new Date().toISOString(),
    files: input.files,
  };
}
