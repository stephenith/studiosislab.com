/**
 * Phase 5T — materialize an isolated workspace that matches the pending Git tree
 * (HEAD + staged/intended publication paths only). Excludes untracked files and
 * unrelated unstaged edits so npm run build mirrors GitHub/Vercel.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PREPUSH_BUILD_SOURCE,
  assertTrackedPublicationClosure,
  type PendingTrackedTreeSource,
} from "./TrackedPublicationClosure.js";

export type IsolatedBuildResult = {
  ok: boolean;
  command: string;
  prepush_build_source: typeof PREPUSH_BUILD_SOURCE;
  workspace: string | null;
  closure_error: string | null;
  error: string | null;
};

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function git(
  cwd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: env ?? process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    status: r.status,
  };
}

/**
 * Build a temp Git index = HEAD + working-tree versions of pendingPaths only.
 * Extract that tree into destRoot (does not mutate the real index/worktree).
 */
export function materializePendingTrackedTree(input: {
  repoRoot: string;
  pendingPaths: string[];
  destRoot: string;
}): { ok: boolean; treeSha: string | null; error: string | null } {
  const indexFile = join(input.destRoot, "pending.index");
  const extractRoot = join(input.destRoot, "tree");
  mkdirSync(extractRoot, { recursive: true });
  const env = {
    ...process.env,
    GIT_INDEX_FILE: indexFile,
  };

  const read = git(input.repoRoot, ["read-tree", "HEAD"], env);
  if (!read.ok) {
    return {
      ok: false,
      treeSha: null,
      error: `git read-tree HEAD failed: ${read.stderr || read.stdout}`,
    };
  }

  for (const raw of input.pendingPaths) {
    const p = normalizeRel(raw);
    const abs = join(input.repoRoot, p);
    if (!existsSync(abs)) {
      return {
        ok: false,
        treeSha: null,
        error: `Pending path missing in working tree: ${p}`,
      };
    }
    // Update temp index only — real index untouched via GIT_INDEX_FILE.
    const add = git(input.repoRoot, ["add", "--", p], env);
    if (!add.ok) {
      return {
        ok: false,
        treeSha: null,
        error: `git add (temp index) failed for ${p}: ${add.stderr || add.stdout}`,
      };
    }
  }

  const written = git(input.repoRoot, ["write-tree"], env);
  if (!written.ok) {
    return {
      ok: false,
      treeSha: null,
      error: `git write-tree failed: ${written.stderr || written.stdout}`,
    };
  }
  const treeSha = written.stdout.trim();

  const archive = spawnSync(
    "git",
    ["archive", "--format=tar", treeSha],
    {
      cwd: input.repoRoot,
      encoding: "buffer",
      maxBuffer: 512 * 1024 * 1024,
    },
  );
  if (archive.status !== 0) {
    return {
      ok: false,
      treeSha: null,
      error: `git archive failed: ${(archive.stderr ?? Buffer.alloc(0)).toString("utf8")}`,
    };
  }

  const tar = spawnSync("tar", ["-xf", "-", "-C", extractRoot], {
    input: archive.stdout as Buffer,
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
  });
  if (tar.status !== 0) {
    return {
      ok: false,
      treeSha: null,
      error: `tar extract failed: ${(tar.stderr ?? Buffer.alloc(0)).toString("utf8")}`,
    };
  }

  // Prefer a real install inside the isolated tree. Symlinked node_modules
  // breaks Turbopack ("points out of the filesystem root").
  // Build-time secrets live outside Git (Vercel project env / VPS .env*).
  // Copy them into the isolated workspace so the gate matches production build
  // environment without letting untracked *source* files satisfy module resolution.
  for (const envName of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ]) {
    const src = join(input.repoRoot, envName);
    if (existsSync(src)) {
      try {
        copyFileSync(src, join(extractRoot, envName));
      } catch {
        /* non-fatal */
      }
    }
  }

  const lock = join(extractRoot, "package-lock.json");
  const pkg = join(extractRoot, "package.json");
  if (existsSync(pkg)) {
    const tryInstall = (args: string[]) =>
      spawnSync("npm", args, {
        cwd: extractRoot,
        encoding: "utf8",
        env: { ...process.env, SOS_AIOS_LIVE: "0" },
        maxBuffer: 64 * 1024 * 1024,
      });
    let install = existsSync(lock)
      ? tryInstall(["ci", "--ignore-scripts"])
      : tryInstall(["install", "--ignore-scripts"]);
    // Some production trees have lock/package drift; fall back so the gate still
    // builds the exact tracked source tree (same as a recoverable Vercel npm install).
    if (install.status !== 0 && existsSync(lock)) {
      install = tryInstall(["install", "--ignore-scripts"]);
    }
    if (install.status !== 0) {
      return {
        ok: false,
        treeSha: null,
        error: `Isolated tree npm install failed: ${(install.stderr || install.stdout || "").slice(0, 2000)}`,
      };
    }
  }

  writeFileSync(
    join(input.destRoot, "meta.json"),
    `${JSON.stringify(
      {
        prepush_build_source: PREPUSH_BUILD_SOURCE,
        tree_sha: treeSha,
        pending_paths: input.pendingPaths.map(normalizeRel).sort(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { ok: true, treeSha, error: null };
}

export function runIsolatedPendingTreeBuild(input: {
  repoRoot: string;
  pendingPaths: string[];
  /** Skip npm build (closure + tree materialize only). */
  skip_npm_build?: boolean;
  keep_workspace?: boolean;
}): IsolatedBuildResult {
  const command = "npm run build";
  const source: PendingTrackedTreeSource = {
    repoRoot: input.repoRoot,
    pendingPaths: input.pendingPaths,
  };

  const closure = assertTrackedPublicationClosure(source);
  if (!closure.ok) {
    return {
      ok: false,
      command,
      prepush_build_source: PREPUSH_BUILD_SOURCE,
      workspace: null,
      closure_error: closure.error,
      error: closure.error,
    };
  }

  const destRoot = mkdtempSync(join(tmpdir(), "aios-pub-pending-tree-"));
  let keep = Boolean(input.keep_workspace);
  try {
    const mat = materializePendingTrackedTree({
      repoRoot: input.repoRoot,
      pendingPaths: input.pendingPaths,
      destRoot,
    });
    if (!mat.ok) {
      return {
        ok: false,
        command,
        prepush_build_source: PREPUSH_BUILD_SOURCE,
        workspace: keep ? destRoot : null,
        closure_error: null,
        error: mat.error,
      };
    }

    const cwd = join(destRoot, "tree");
    if (input.skip_npm_build) {
      return {
        ok: true,
        command,
        prepush_build_source: PREPUSH_BUILD_SOURCE,
        workspace: keep ? destRoot : null,
        closure_error: null,
        error: null,
      };
    }

    const build = spawnSync("npm", ["run", "build"], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, SOS_AIOS_LIVE: "0" },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (build.status !== 0) {
      const detail = [build.stderr, build.stdout].filter(Boolean).join("\n").trim();
      return {
        ok: false,
        command,
        prepush_build_source: PREPUSH_BUILD_SOURCE,
        workspace: keep ? destRoot : null,
        closure_error: null,
        error: `Isolated tracked-tree website build failed (exit ${build.status ?? "null"}): ${detail.slice(0, 4000)}`,
      };
    }
    return {
      ok: true,
      command,
      prepush_build_source: PREPUSH_BUILD_SOURCE,
      workspace: keep ? destRoot : null,
      closure_error: null,
      error: null,
    };
  } finally {
    if (!keep) {
      try {
        rmSync(destRoot, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    }
  }
}
