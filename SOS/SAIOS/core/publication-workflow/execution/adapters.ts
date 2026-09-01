/**
 * Injectable adapters for publication execution (simulate / execute / dry calc).
 */
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import type { PublicationRoots } from "../paths.js";
import {
  expectedGeneratedFilesForCatalogue,
  isPathAllowedForPublicationGit,
} from "../paths.js";
import { atomicWriteJson } from "./atomicWrite.js";
import type { ExecutionEntryState, PublicationExecution } from "./types.js";
import {
  readPlanReservationLedger,
  writePlanReservationLedger,
  type PlanReservationEntry,
} from "./PlanReservationLedger.js";

export type ReserveResult = {
  ok: boolean;
  reservation_id: string | null;
  catalogue_id: string;
  created: boolean;
  error: string | null;
};

export type ExportEntryResult = {
  ok: boolean;
  export_package_id: string | null;
  generated_files: string[];
  file_checksums: Record<string, string>;
  error: string | null;
};

export type WebsitePrepareResult = {
  ok: boolean;
  intended_writes: string[];
  write_set_checksums: Record<string, string>;
  prepared_root: string | null;
  error: string | null;
};

export type WebsiteApplyResult = {
  ok: boolean;
  applied_paths: string[];
  rollback_manifest_path: string | null;
  error: string | null;
  rolled_back: boolean;
};

export type GitCommitResult = {
  ok: boolean;
  commit_sha: string | null;
  reused_existing: boolean;
  staged_paths: string[];
  error: string | null;
};

export type GitPushResult = {
  ok: boolean;
  already_pushed: boolean;
  remote: string | null;
  branch: string | null;
  error: string | null;
};

export type DeployVerifyResult = {
  ok: boolean;
  deployment_id: string | null;
  live_urls: Record<string, string>;
  per_entry: Record<string, { ok: boolean; url: string | null; error: string | null }>;
  error: string | null;
};

export type LifecycleUpdateResult = {
  ok: boolean;
  per_entry: Record<string, { ok: boolean; error: string | null }>;
  history_written: string[];
  error: string | null;
};

export type WorkingTreeCheck = {
  ok: boolean;
  conflicting_paths: string[];
  error: string | null;
};

export type WebsiteBuildResult = {
  ok: boolean;
  command: string;
  error: string | null;
};

export type ExecutionAdapters = {
  reserveAll(input: {
    plan_id: string;
    execution_id: string;
    entries: ExecutionEntryState[];
  }): Promise<ReserveResult[]>;
  exportEntry(input: {
    entry: ExecutionEntryState;
    execution: PublicationExecution;
  }): Promise<ExportEntryResult>;
  prepareWebsiteWrites(input: {
    execution: PublicationExecution;
  }): Promise<WebsitePrepareResult>;
  applyWebsiteWrites(input: {
    execution: PublicationExecution;
    prepared: WebsitePrepareResult;
    fail_verify?: boolean;
  }): Promise<WebsiteApplyResult>;
  rollbackWebsiteWrites(input: {
    execution: PublicationExecution;
  }): Promise<{ ok: boolean; error: string | null }>;
  /** After website writes, before Git commit/push. Uses pending tracked tree. */
  verifyWebsiteBuild(input: {
    execution: PublicationExecution;
  }): Promise<WebsiteBuildResult>;
  checkWorkingTree(input: {
    intended_paths: string[];
  }): Promise<WorkingTreeCheck>;
  commit(input: {
    execution: PublicationExecution;
    paths: string[];
  }): Promise<GitCommitResult>;
  push(input: {
    execution: PublicationExecution;
  }): Promise<GitPushResult>;
  verifyDeployment(input: {
    execution: PublicationExecution;
  }): Promise<DeployVerifyResult>;
  updateLifecycle(input: {
    execution: PublicationExecution;
  }): Promise<LifecycleUpdateResult>;
  releaseReservations(input: {
    plan_id: string;
    execution_id: string;
  }): Promise<void>;
};

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

type FixtureReservation = {
  reservation_id: string;
  reserved_catalogue_id: string;
  candidate_id: string;
  staging_package_id: string;
  plan_id: string;
  execution_id: string;
  status: string;
};

function loadFixtureReservations(roots: PublicationRoots): FixtureReservation[] {
  if (!existsSync(roots.reservationsPath)) return [];
  const doc = JSON.parse(readFileSync(roots.reservationsPath, "utf8")) as {
    reservations?: FixtureReservation[];
  };
  return doc.reservations ?? [];
}

function saveFixtureReservations(
  roots: PublicationRoots,
  reservations: FixtureReservation[],
): void {
  atomicWriteJson(roots.reservationsPath, {
    schema_version: 1,
    reservations,
  });
}

export type SimulateHooks = {
  fail_export_after_index?: number;
  fail_website_verify?: boolean;
  fail_website_build?: boolean;
  fail_commit?: boolean;
  fail_push?: boolean;
  fail_deploy?: boolean;
  fail_lifecycle_catalogue_ids?: string[];
  crash_after_phase?: string;
  dirty_paths?: string[];
  reject_paths?: string[];
};

/**
 * Full in-fixture adapters for tests — never touches production website/git remotes.
 */
export function createSimulateAdapters(
  roots: PublicationRoots,
  hooks: SimulateHooks = {},
): ExecutionAdapters {
  const gitStatePath = join(roots.executionsRoot, "_sim_git_state.json");
  const websiteRoot = roots.websiteTargetRoot;

  function readGitState(): {
    commits: Array<{ sha: string; message: string; paths: string[]; execution_id: string }>;
    pushed_shas: string[];
    branch: string;
    remote: string;
  } {
    if (!existsSync(gitStatePath)) {
      return {
        commits: [],
        pushed_shas: [],
        branch: "main",
        remote: "origin",
      };
    }
    return JSON.parse(readFileSync(gitStatePath, "utf8"));
  }

  function writeGitState(state: ReturnType<typeof readGitState>): void {
    atomicWriteJson(gitStatePath, state);
  }

  return {
    async reserveAll(input) {
      const existing = loadFixtureReservations(roots);
      const results: ReserveResult[] = [];
      const ledgerEntries: PlanReservationEntry[] = [];
      const priorLedger = readPlanReservationLedger(input.plan_id, roots);

      if (
        priorLedger &&
        priorLedger.execution_id === input.execution_id &&
        !priorLedger.released &&
        priorLedger.entries.length === input.entries.length
      ) {
        return priorLedger.entries.map((e) => ({
          ok: true,
          reservation_id: e.reservation_id,
          catalogue_id: e.catalogue_id,
          created: false,
          error: null,
        }));
      }

      for (const entry of input.entries) {
        const collision = existing.find(
          (r) =>
            r.reserved_catalogue_id === entry.catalogue_id &&
            r.status !== "CANCELLED" &&
            r.status !== "ROLLED_BACK" &&
            !(
              r.plan_id === input.plan_id &&
              r.execution_id === input.execution_id
            ),
        );
        if (collision) {
          results.push({
            ok: false,
            reservation_id: null,
            catalogue_id: entry.catalogue_id,
            created: false,
            error: `Catalogue ${entry.catalogue_id} already reserved by ${collision.candidate_id}`,
          });
          continue;
        }

        const same = existing.find(
          (r) =>
            r.plan_id === input.plan_id &&
            r.execution_id === input.execution_id &&
            r.reserved_catalogue_id === entry.catalogue_id,
        );
        if (same) {
          results.push({
            ok: true,
            reservation_id: same.reservation_id,
            catalogue_id: entry.catalogue_id,
            created: false,
            error: null,
          });
          ledgerEntries.push({
            catalogue_id: entry.catalogue_id,
            candidate_id: entry.candidate_id,
            staging_package_id: entry.staging_package_id,
            reservation_id: same.reservation_id,
            reserved_at: new Date().toISOString(),
          });
          continue;
        }

        const reservation_id = `rsv-sim-${randomUUID().slice(0, 8)}`;
        existing.push({
          reservation_id,
          reserved_catalogue_id: entry.catalogue_id,
          candidate_id: entry.candidate_id,
          staging_package_id: entry.staging_package_id,
          plan_id: input.plan_id,
          execution_id: input.execution_id,
          status: "RESERVED",
        });
        results.push({
          ok: true,
          reservation_id,
          catalogue_id: entry.catalogue_id,
          created: true,
          error: null,
        });
        ledgerEntries.push({
          catalogue_id: entry.catalogue_id,
          candidate_id: entry.candidate_id,
          staging_package_id: entry.staging_package_id,
          reservation_id,
          reserved_at: new Date().toISOString(),
        });
      }

      if (results.every((r) => r.ok)) {
        saveFixtureReservations(roots, existing);
        writePlanReservationLedger(
          {
            schema_version: "plan-reservation-ledger-1.0.0",
            plan_id: input.plan_id,
            execution_id: input.execution_id,
            reserved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            entries: ledgerEntries,
            released: false,
          },
          roots,
        );
      }
      return results;
    },

    async exportEntry(input) {
      const idx = input.execution.entries.findIndex(
        (e) => e.candidate_id === input.entry.candidate_id,
      );
      if (
        hooks.fail_export_after_index != null &&
        idx === hooks.fail_export_after_index
      ) {
        return {
          ok: false,
          export_package_id: null,
          generated_files: [],
          file_checksums: {},
          error: `Simulated export failure for ${input.entry.candidate_id}`,
        };
      }
      if (input.entry.export_package_id) {
        return {
          ok: true,
          export_package_id: input.entry.export_package_id,
          generated_files: input.entry.generated_files,
          file_checksums: input.entry.file_checksums,
          error: null,
        };
      }
      const export_package_id = `exp-sim-${randomUUID().slice(0, 8)}`;
      const pkg = join(roots.exportPackagesRoot, export_package_id);
      mkdirSync(pkg, { recursive: true });
      const template = JSON.stringify({
        id: input.entry.catalogue_id,
        title: input.entry.title,
      });
      writeFileSync(join(pkg, "template.json"), template);
      writeFileSync(
        join(pkg, "manifest-entry.json"),
        JSON.stringify({
          id: input.entry.catalogue_id,
          title: input.entry.title,
          categoryId: "general",
          thumbnailPath: `/templates/${input.entry.catalogue_id}.png`,
          jsonPath: `src/data/template-json/${input.entry.catalogue_id}.json`,
          status: "draft",
        }),
      );
      mkdirSync(join(pkg, "assets"), { recursive: true });
      writeFileSync(join(pkg, "assets", "thumbnail.png"), "png");
      writeFileSync(join(pkg, "assets", "thumbnail.webp"), "webp");
      const generated = expectedGeneratedFilesForCatalogue(
        input.entry.catalogue_id,
      );
      const checksums: Record<string, string> = {};
      for (const f of generated) checksums[f] = sha256(`${export_package_id}:${f}`);
      return {
        ok: true,
        export_package_id,
        generated_files: generated,
        file_checksums: checksums,
        error: null,
      };
    },

    async prepareWebsiteWrites(input) {
      const intended = new Set<string>();
      const checksums: Record<string, string> = {};
      for (const e of input.execution.entries) {
        for (const f of e.generated_files) {
          if (!isPathAllowedForPublicationGit(f)) {
            return {
              ok: false,
              intended_writes: [],
              write_set_checksums: {},
              prepared_root: null,
              error: `Unexpected git path rejected: ${f}`,
            };
          }
          intended.add(f);
          checksums[f] = e.file_checksums[f] ?? sha256(f);
        }
      }
      if (hooks.reject_paths?.length) {
        return {
          ok: false,
          intended_writes: [],
          write_set_checksums: {},
          prepared_root: null,
          error: `Unexpected git path rejected: ${hooks.reject_paths.join(", ")}`,
        };
      }
      const prepared_root = join(
        roots.executionsRoot,
        input.execution.execution_id,
        "prepared-website",
      );
      mkdirSync(prepared_root, { recursive: true });
      for (const rel of intended) {
        const dest = join(prepared_root, rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, `prepared:${rel}:${checksums[rel]}`);
      }
      // Ensure both catalogue IDs appear in prepared manifest
      const manifestPath = join(prepared_root, "templates.manifest.json");
      const templates = input.execution.entries.map((e) => ({
        id: e.catalogue_id,
        title: e.title,
        status: "published",
      }));
      writeFileSync(manifestPath, JSON.stringify({ templates }, null, 2));
      return {
        ok: true,
        intended_writes: [...intended].sort(),
        write_set_checksums: checksums,
        prepared_root,
        error: null,
      };
    },

    async applyWebsiteWrites(input) {
      const prepared = input.prepared;
      if (!prepared.prepared_root) {
        return {
          ok: false,
          applied_paths: [],
          rollback_manifest_path: null,
          error: "No prepared root",
          rolled_back: false,
        };
      }
      const rollbackDir = join(
        roots.executionsRoot,
        input.execution.execution_id,
        "rollback",
      );
      mkdirSync(rollbackDir, { recursive: true });
      const rollbackManifest: Record<string, string | null> = {};
      for (const rel of prepared.intended_writes) {
        const live = join(websiteRoot, rel);
        const bak = join(rollbackDir, rel);
        if (existsSync(live)) {
          mkdirSync(dirname(bak), { recursive: true });
          copyFileSync(live, bak);
          rollbackManifest[rel] = bak;
        } else {
          rollbackManifest[rel] = null;
        }
      }
      const rollback_manifest_path = join(
        roots.executionsRoot,
        input.execution.execution_id,
        "rollback-manifest.json",
      );
      atomicWriteJson(rollback_manifest_path, {
        created_at: new Date().toISOString(),
        files: rollbackManifest,
      });

      const applied: string[] = [];
      for (const rel of prepared.intended_writes) {
        const src = join(prepared.prepared_root, rel);
        const dest = join(websiteRoot, rel);
        mkdirSync(dirname(dest), { recursive: true });
        if (existsSync(src)) copyFileSync(src, dest);
        else writeFileSync(dest, `applied:${rel}`);
        applied.push(rel);
      }

      // Write combined manifest with all catalogue IDs
      const manifestPath = join(websiteRoot, "templates.manifest.json");
      const templates = input.execution.entries.map((e) => ({
        id: e.catalogue_id,
        title: e.title,
        status: "published",
      }));
      writeFileSync(manifestPath, JSON.stringify({ templates }, null, 2));

      if (hooks.fail_website_verify || input.fail_verify) {
        // restore
        for (const [rel, bak] of Object.entries(rollbackManifest)) {
          const dest = join(websiteRoot, rel);
          if (bak && existsSync(bak)) {
            mkdirSync(dirname(dest), { recursive: true });
            copyFileSync(bak, dest);
          } else if (existsSync(dest)) {
            rmSync(dest, { force: true });
          }
        }
        return {
          ok: false,
          applied_paths: applied,
          rollback_manifest_path,
          error: "Local verification failed — restored pre-apply state",
          rolled_back: true,
        };
      }

      // Verify catalogues present
      const man = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        templates: Array<{ id: string }>;
      };
      for (const e of input.execution.entries) {
        if (!man.templates.some((t) => t.id === e.catalogue_id)) {
          return {
            ok: false,
            applied_paths: applied,
            rollback_manifest_path,
            error: `Manifest missing ${e.catalogue_id}`,
            rolled_back: false,
          };
        }
      }

      return {
        ok: true,
        applied_paths: applied,
        rollback_manifest_path,
        error: null,
        rolled_back: false,
      };
    },

    async rollbackWebsiteWrites(input) {
      const p = input.execution.rollback_manifest_path;
      if (!p || !existsSync(p)) {
        return { ok: false, error: "No rollback manifest" };
      }
      const doc = JSON.parse(readFileSync(p, "utf8")) as {
        files: Record<string, string | null>;
      };
      for (const [rel, bak] of Object.entries(doc.files)) {
        const dest = join(websiteRoot, rel);
        if (bak && existsSync(bak)) {
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(bak, dest);
        } else if (existsSync(dest)) {
          rmSync(dest, { force: true });
        }
      }
      return { ok: true, error: null };
    },

    async verifyWebsiteBuild() {
      if (hooks.fail_website_build) {
        return {
          ok: false,
          command: "npm run build",
          error: "Simulated website build failure",
        };
      }
      return {
        ok: true,
        command: "npm run build",
        error: null,
      };
    },

    async checkWorkingTree(input) {
      const dirty = hooks.dirty_paths ?? [];
      const conflicting = dirty.filter((p) =>
        input.intended_paths.includes(p),
      );
      if (conflicting.length) {
        return {
          ok: false,
          conflicting_paths: conflicting,
          error: `Dirty working tree conflict: ${conflicting.join(", ")}`,
        };
      }
      return { ok: true, conflicting_paths: [], error: null };
    },

    async commit(input) {
      if (hooks.fail_commit) {
        return {
          ok: false,
          commit_sha: null,
          reused_existing: false,
          staged_paths: [],
          error: "Simulated commit failure",
        };
      }
      const state = readGitState();
      const existing = state.commits.find(
        (c) => c.execution_id === input.execution.execution_id,
      );
      if (existing) {
        return {
          ok: true,
          commit_sha: existing.sha,
          reused_existing: true,
          staged_paths: existing.paths,
          error: null,
        };
      }
      const unexpected = input.paths.filter(
        (p) => !isPathAllowedForPublicationGit(p),
      );
      if (unexpected.length) {
        return {
          ok: false,
          commit_sha: null,
          reused_existing: false,
          staged_paths: [],
          error: `Unexpected git path rejected: ${unexpected.join(", ")}`,
        };
      }
      const sha = sha256(
        `${input.execution.execution_id}:${input.paths.sort().join(",")}`,
      ).slice(0, 40);
      const message = `publish ${input.execution.plan_id} ${input.execution.execution_id} ${input.execution.entries.map((e) => e.catalogue_id).join(" ")}`;
      state.commits.push({
        sha,
        message,
        paths: [...input.paths].sort(),
        execution_id: input.execution.execution_id,
      });
      writeGitState(state);
      return {
        ok: true,
        commit_sha: sha,
        reused_existing: false,
        staged_paths: [...input.paths].sort(),
        error: null,
      };
    },

    async push(input) {
      if (hooks.fail_push) {
        return {
          ok: false,
          already_pushed: false,
          remote: null,
          branch: null,
          error: "Simulated push failure",
        };
      }
      const state = readGitState();
      const sha = input.execution.git_commit_sha;
      if (!sha) {
        return {
          ok: false,
          already_pushed: false,
          remote: null,
          branch: null,
          error: "No commit SHA",
        };
      }
      if (state.pushed_shas.includes(sha)) {
        return {
          ok: true,
          already_pushed: true,
          remote: state.remote,
          branch: state.branch,
          error: null,
        };
      }
      state.pushed_shas.push(sha);
      writeGitState(state);
      return {
        ok: true,
        already_pushed: false,
        remote: state.remote,
        branch: state.branch,
        error: null,
      };
    },

    async verifyDeployment(input) {
      if (hooks.fail_deploy) {
        return {
          ok: false,
          deployment_id: null,
          live_urls: {},
          per_entry: {},
          error: "Deployment timeout",
        };
      }
      const live_urls: Record<string, string> = {};
      const per_entry: DeployVerifyResult["per_entry"] = {};
      for (const e of input.execution.entries) {
        const url = `https://studiosislab.com/templates/${e.catalogue_id}`;
        live_urls[e.catalogue_id] = url;
        per_entry[e.catalogue_id] = { ok: true, url, error: null };
      }
      // Partial live: first ok, second fail if hook lists second
      if (hooks.fail_lifecycle_catalogue_ids?.includes("__live_partial__")) {
        const second = input.execution.entries[1];
        if (second) {
          per_entry[second.catalogue_id] = {
            ok: false,
            url: null,
            error: `${second.catalogue_id} unavailable live`,
          };
          delete live_urls[second.catalogue_id];
          return {
            ok: false,
            deployment_id: `dep-sim-${input.execution.execution_id.slice(-8)}`,
            live_urls,
            per_entry,
            error: `Live verification incomplete: ${second.catalogue_id}`,
          };
        }
      }
      return {
        ok: true,
        deployment_id: `dep-sim-${input.execution.execution_id.slice(-8)}`,
        live_urls,
        per_entry,
        error: null,
      };
    },

    async updateLifecycle(input) {
      const historyPath = roots.releaseHistoryPath;
      mkdirSync(dirname(historyPath), { recursive: true });
      let history: Array<{
        catalogue_id: string;
        execution_id: string;
        release_id: string;
      }> = [];
      if (existsSync(historyPath)) {
        try {
          const raw = JSON.parse(readFileSync(historyPath, "utf8"));
          history = Array.isArray(raw) ? raw : raw.releases ?? [];
        } catch {
          history = [];
        }
      }
      const per_entry: LifecycleUpdateResult["per_entry"] = {};
      const history_written: string[] = [];
      let allOk = true;

      for (const e of input.execution.entries) {
        if (hooks.fail_lifecycle_catalogue_ids?.includes(e.catalogue_id)) {
          per_entry[e.catalogue_id] = {
            ok: false,
            error: `Lifecycle update failed for ${e.catalogue_id}`,
          };
          allOk = false;
          continue;
        }
        const lifePath = join(roots.lifecycleRoot, `${e.candidate_id}.json`);
        mkdirSync(dirname(lifePath), { recursive: true });
        let life: Record<string, unknown> = {};
        if (existsSync(lifePath)) {
          life = JSON.parse(readFileSync(lifePath, "utf8"));
        }
        if (life.lifecycle_status !== "PUBLISHED") {
          life.lifecycle_status = "PUBLISHED";
          life.candidate_id = e.candidate_id;
          life.catalogue_id = e.catalogue_id;
          life.git_commit_sha = input.execution.git_commit_sha;
          life.live_url = input.execution.live_urls[e.catalogue_id] ?? null;
          writeFileSync(lifePath, JSON.stringify(life, null, 2));
        }
        const already = history.some(
          (h) =>
            h.catalogue_id === e.catalogue_id &&
            h.execution_id === input.execution.execution_id,
        );
        if (!already) {
          const release_id = `rel-${e.catalogue_id}-${input.execution.execution_id.slice(-6)}`;
          history.push({
            catalogue_id: e.catalogue_id,
            execution_id: input.execution.execution_id,
            release_id,
          });
          history_written.push(release_id);
        }
        per_entry[e.catalogue_id] = { ok: true, error: null };
      }
      atomicWriteJson(historyPath, history);
      return {
        ok: allOk,
        per_entry,
        history_written,
        error: allOk ? null : "Partial lifecycle update failure",
      };
    },

    async releaseReservations(input) {
      const ledger = readPlanReservationLedger(input.plan_id, roots);
      if (!ledger || ledger.execution_id !== input.execution_id) return;
      const existing = loadFixtureReservations(roots).filter(
        (r) =>
          !(
            r.plan_id === input.plan_id &&
            r.execution_id === input.execution_id
          ),
      );
      saveFixtureReservations(roots, existing);
      writePlanReservationLedger(
        { ...ledger, released: true },
        roots,
      );
    },
  };
}

/** Dry-run adapters: compute only, never mutate. */
export function createDryRunAdapters(
  roots: PublicationRoots,
): ExecutionAdapters {
  return {
    async reserveAll(input) {
      return input.entries.map((e) => ({
        ok: true,
        reservation_id: null,
        catalogue_id: e.catalogue_id,
        created: false,
        error: null,
      }));
    },
    async exportEntry(input) {
      const generated = expectedGeneratedFilesForCatalogue(
        input.entry.catalogue_id,
      );
      return {
        ok: true,
        export_package_id: null,
        generated_files: generated,
        file_checksums: Object.fromEntries(
          generated.map((f) => [f, `dry:${f}`]),
        ),
        error: null,
      };
    },
    async prepareWebsiteWrites(input) {
      const intended = new Set<string>();
      for (const e of input.execution.entries) {
        for (const f of e.generated_files.length
          ? e.generated_files
          : expectedGeneratedFilesForCatalogue(e.catalogue_id)) {
          intended.add(f);
        }
      }
      return {
        ok: true,
        intended_writes: [...intended].sort(),
        write_set_checksums: {},
        prepared_root: null,
        error: null,
      };
    },
    async applyWebsiteWrites() {
      return {
        ok: true,
        applied_paths: [],
        rollback_manifest_path: null,
        error: null,
        rolled_back: false,
      };
    },
    async rollbackWebsiteWrites() {
      return { ok: true, error: null };
    },
    async verifyWebsiteBuild() {
      return { ok: true, command: "npm run build", error: null };
    },
    async checkWorkingTree() {
      return { ok: true, conflicting_paths: [], error: null };
    },
    async commit(input) {
      return {
        ok: true,
        commit_sha: null,
        reused_existing: false,
        staged_paths: input.paths,
        error: null,
      };
    },
    async push() {
      return {
        ok: true,
        already_pushed: false,
        remote: null,
        branch: null,
        error: null,
      };
    },
    async verifyDeployment(input) {
      const live_urls: Record<string, string> = {};
      const per_entry: DeployVerifyResult["per_entry"] = {};
      for (const e of input.execution.entries) {
        const url = `https://studiosislab.com/templates/${e.catalogue_id}`;
        live_urls[e.catalogue_id] = url;
        per_entry[e.catalogue_id] = { ok: true, url, error: null };
      }
      return {
        ok: true,
        deployment_id: null,
        live_urls,
        per_entry,
        error: null,
      };
    },
    async updateLifecycle() {
      return { ok: true, per_entry: {}, history_written: [], error: null };
    },
    async releaseReservations() {},
  };
}

void relative;
void renameSync;
void copyFileSync;
