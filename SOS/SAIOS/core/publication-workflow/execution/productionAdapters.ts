/**
 * Production adapters — real export/reserve/git/deploy.
 * Only used when mode=execute AND SOS_AIOS_PUBLICATION_APPLY=1.
 * Website writes reuse ExportPackageReleaseEngine.materializeExportPackageWebsite.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { reserveSpecificCatalogueId } from "../../export/CatalogueReservation.js";
import { exportStagedPackage } from "../../export/ExportService.js";
import { processExportAssets } from "../../assets/AssetProcessingService.js";
import {
  exportReleaseWebsiteRelPaths,
  materializeExportPackageWebsite,
  resolveExportPackageSeoSlug,
  restoreExportWebsiteSnapshot,
} from "../../../runtime/publication/ExportPackageReleaseEngine.js";
import {
  isPathAllowedForPublicationGit,
  type PublicationRoots,
} from "../paths.js";
import { atomicWriteJson } from "./atomicWrite.js";
import type { ExecutionAdapters } from "./adapters.js";
import {
  writePlanReservationLedger,
  type PlanReservationEntry,
} from "./PlanReservationLedger.js";
import {
  readLifecycle,
  upsertLifecycle,
} from "../../staging/CandidateLifecycleStore.js";
import { assertTransition } from "../../staging/TemplateLifecycle.js";

function git(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

/**
 * Production adapters. Push/deploy are real — do not call without Founder gates.
 */
export function createProductionAdapters(
  roots: PublicationRoots,
): ExecutionAdapters {
  return {
    async reserveAll(input) {
      const results = [];
      const ledgerEntries: PlanReservationEntry[] = [];
      for (const entry of input.entries) {
        try {
          const { reservation, created } = reserveSpecificCatalogueId({
            catalogue_id: entry.catalogue_id,
            generation_id: entry.generation_id,
            candidate_id: entry.candidate_id,
            staging_package_id: entry.staging_package_id,
            plan_id: input.plan_id,
            execution_id: input.execution_id,
          });
          results.push({
            ok: true,
            reservation_id: reservation.reservation_id,
            catalogue_id: reservation.reserved_catalogue_id,
            created,
            error: null,
          });
          ledgerEntries.push({
            catalogue_id: reservation.reserved_catalogue_id,
            candidate_id: entry.candidate_id,
            staging_package_id: entry.staging_package_id,
            reservation_id: reservation.reservation_id,
            reserved_at: reservation.reserved_at,
          });
        } catch (e) {
          results.push({
            ok: false,
            reservation_id: null,
            catalogue_id: entry.catalogue_id,
            created: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      if (results.every((r) => r.ok)) {
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
      if (input.entry.export_package_id) {
        return {
          ok: true,
          export_package_id: input.entry.export_package_id,
          generated_files: input.entry.generated_files,
          file_checksums: input.entry.file_checksums,
          error: null,
        };
      }
      const exported = await exportStagedPackage({
        staging_package_id: input.entry.staging_package_id,
        candidate_id: input.entry.candidate_id,
        actor: "publication-executor",
      });
      if (!exported.ok || !exported.export_package_id) {
        return {
          ok: false,
          export_package_id: null,
          generated_files: [],
          file_checksums: {},
          error: exported.error ?? "Export failed",
        };
      }
      if (
        exported.reserved_catalogue_id &&
        exported.reserved_catalogue_id !== input.entry.catalogue_id
      ) {
        return {
          ok: false,
          export_package_id: null,
          generated_files: [],
          file_checksums: {},
          error: `Catalogue drift: expected ${input.entry.catalogue_id} got ${exported.reserved_catalogue_id}`,
        };
      }
      const assets = await processExportAssets({
        export_package_id: exported.export_package_id,
        actor: "publication-executor",
      });
      if (!assets.ok) {
        return {
          ok: false,
          export_package_id: exported.export_package_id,
          generated_files: [],
          file_checksums: {},
          error: assets.error ?? "Asset processing failed",
        };
      }
      const generated = exportReleaseWebsiteRelPaths(input.entry.catalogue_id);
      return {
        ok: true,
        export_package_id: exported.export_package_id,
        generated_files: generated,
        file_checksums: Object.fromEntries(generated.map((f) => [f, `pending:${f}`])),
        error: null,
      };
    },

    async prepareWebsiteWrites(input) {
      const intended = new Set<string>();
      for (const e of input.execution.entries) {
        if (!e.export_package_id) {
          return {
            ok: false,
            intended_writes: [],
            write_set_checksums: {},
            prepared_root: null,
            error: `Missing export for ${e.candidate_id}`,
          };
        }
        const pkg = join(roots.exportPackagesRoot, e.export_package_id);
        for (const req of [
          "manifest-entry.json",
          "seo.json",
          "template.json",
          "assets/thumbnail.png",
          "assets/thumbnail.webp",
        ]) {
          if (!existsSync(join(pkg, req))) {
            return {
              ok: false,
              intended_writes: [],
              write_set_checksums: {},
              prepared_root: null,
              error: `Export package ${e.export_package_id} missing ${req}`,
            };
          }
        }
        const manifestEntry = JSON.parse(
          readFileSync(join(pkg, "manifest-entry.json"), "utf8"),
        ) as { id?: string; categoryId?: string };
        if (manifestEntry.id !== e.catalogue_id) {
          return {
            ok: false,
            intended_writes: [],
            write_set_checksums: {},
            prepared_root: null,
            error: `manifest-entry id ${manifestEntry.id} != ${e.catalogue_id}`,
          };
        }
        if (!manifestEntry.categoryId) {
          return {
            ok: false,
            intended_writes: [],
            write_set_checksums: {},
            prepared_root: null,
            error: `manifest-entry.json missing categoryId for ${e.catalogue_id}`,
          };
        }
        const slug = resolveExportPackageSeoSlug(pkg);
        if (slug.errors.length || !slug.slug) {
          return {
            ok: false,
            intended_writes: [],
            write_set_checksums: {},
            prepared_root: null,
            error: `SEO slug unresolved for ${e.catalogue_id}: ${slug.errors.join("; ")}`,
          };
        }
        for (const f of exportReleaseWebsiteRelPaths(e.catalogue_id)) {
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
        }
      }
      return {
        ok: true,
        intended_writes: [...intended].sort(),
        write_set_checksums: {},
        prepared_root: join(
          roots.executionsRoot,
          input.execution.execution_id,
          "prepared-website",
        ),
        error: null,
      };
    },

    async applyWebsiteWrites(input) {
      const prepared = input.prepared;
      const target = roots.websiteTargetRoot;
      const rollbackDir = join(
        roots.executionsRoot,
        input.execution.execution_id,
        "rollback",
      );
      mkdirSync(rollbackDir, { recursive: true });

      // Batch snapshot of all ReleaseManager target files before any write
      const snap_files: Array<{
        path: string;
        existed: boolean;
        snapshot_path: string | null;
      }> = [];
      const seenAbs = new Set<string>();
      for (const rel of prepared.intended_writes) {
        const abs = join(target, rel);
        if (seenAbs.has(abs)) continue;
        seenAbs.add(abs);
        const existed = existsSync(abs);
        const snapshot_path = existed
          ? join(rollbackDir, rel.replace(/\//g, "__"))
          : null;
        if (existed && snapshot_path) {
          mkdirSync(dirname(snapshot_path), { recursive: true });
          copyFileSync(abs, snapshot_path);
        }
        snap_files.push({ path: abs, existed, snapshot_path });
      }
      const rollback_manifest_path = join(
        roots.executionsRoot,
        input.execution.execution_id,
        "rollback-manifest.json",
      );
      atomicWriteJson(rollback_manifest_path, {
        created_at: new Date().toISOString(),
        engine: "materializeExportPackageWebsite",
        files: snap_files,
      });

      const applied = new Set<string>();
      try {
        for (const e of input.execution.entries) {
          if (!e.export_package_id) {
            throw new Error(`Missing export for ${e.candidate_id}`);
          }
          const pkg = join(roots.exportPackagesRoot, e.export_package_id);
          const result = materializeExportPackageWebsite({
            export_package_dir: pkg,
            catalogue_id: e.catalogue_id,
            target_root: target,
            persist: true,
            take_snapshot: false,
          });
          if (!result.pass) {
            throw new Error(
              `ReleaseManager materialize failed for ${e.catalogue_id}: ${result.errors.join("; ")}`,
            );
          }
          for (const rel of result.written_rel_paths) applied.add(rel);
        }

        // Fail closed: every intended artifact must exist after materialize
        const missing: string[] = [];
        for (const rel of prepared.intended_writes) {
          if (!existsSync(join(target, rel))) missing.push(rel);
        }
        if (missing.length) {
          throw new Error(
            `Required generated artifacts missing: ${missing.join(", ")}`,
          );
        }
        for (const e of input.execution.entries) {
          const catalog = readFileSync(
            join(target, "src/data/templateCatalog.generated.ts"),
            "utf8",
          );
          const registry = readFileSync(
            join(target, "src/data/systemTemplates/registry.generated.ts"),
            "utf8",
          );
          const snapshots = readFileSync(
            join(target, "src/data/templateSnapshots.generated.ts"),
            "utf8",
          );
          const seo = readFileSync(
            join(target, "src/data/templateSeoContent.ts"),
            "utf8",
          );
          if (!catalog.includes(`id: "${e.catalogue_id}"`)) {
            throw new Error(`templateCatalog.generated.ts missing ${e.catalogue_id}`);
          }
          if (!registry.includes(`id: "${e.catalogue_id}"`)) {
            throw new Error(`registry.generated.ts missing ${e.catalogue_id}`);
          }
          if (!snapshots.includes(`"${e.catalogue_id}"`)) {
            throw new Error(
              `templateSnapshots.generated.ts missing ${e.catalogue_id}`,
            );
          }
          if (!seo.includes(`templateId: "${e.catalogue_id}"`)) {
            throw new Error(`templateSeoContent.ts missing ${e.catalogue_id}`);
          }
        }
        if (input.fail_verify) {
          throw new Error("Local verification failed — forced");
        }
      } catch (err) {
        restoreExportWebsiteSnapshot(snap_files);
        return {
          ok: false,
          applied_paths: [...applied],
          rollback_manifest_path,
          error: err instanceof Error ? err.message : String(err),
          rolled_back: true,
        };
      }

      return {
        ok: true,
        applied_paths: [...applied].sort(),
        rollback_manifest_path,
        error: null,
        rolled_back: false,
      };
    },

    async rollbackWebsiteWrites(input) {
      const p = input.execution.rollback_manifest_path;
      if (!p || !existsSync(p)) return { ok: false, error: "No rollback manifest" };
      const doc = JSON.parse(readFileSync(p, "utf8")) as {
        files: Array<{
          path: string;
          existed: boolean;
          snapshot_path: string | null;
        }>;
      };
      restoreExportWebsiteSnapshot(doc.files);
      return { ok: true, error: null };
    },

    async verifyWebsiteBuild(input) {
      const pendingPaths =
        input.execution.generated_files_all?.length > 0
          ? input.execution.generated_files_all
          : input.execution.entries.flatMap((e) =>
              e.generated_files.length
                ? e.generated_files
                : [
                    `src/data/template-json/${e.catalogue_id}.json`,
                    `public/templates/${e.catalogue_id}.png`,
                    `public/templates/${e.catalogue_id}.webp`,
                    "templates.manifest.json",
                    "src/data/systemTemplates/registry.generated.ts",
                    "src/data/templateCatalog.generated.ts",
                    "src/data/templateSnapshots.generated.ts",
                    "src/data/templateSeoContent.ts",
                  ],
            );
      const uniquePending = [...new Set(pendingPaths)];
      const { runIsolatedPendingTreeBuild } = await import(
        "../IsolatedPendingTreeBuild.js"
      );
      const result = runIsolatedPendingTreeBuild({
        repoRoot: roots.websiteTargetRoot,
        pendingPaths: uniquePending,
      });
      return {
        ok: result.ok,
        command: result.command,
        error: result.error,
      };
    },

    async checkWorkingTree(input) {
      const status = git(roots.websiteTargetRoot, ["status", "--porcelain"]);
      if (!status.ok) {
        return {
          ok: false,
          conflicting_paths: [],
          error: status.stderr || "git status failed",
        };
      }
      const dirty = status.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^\?\?\s+/, "").replace(/^..\s+/, ""));
      const conflicting = dirty.filter((p) =>
        input.intended_paths.some(
          (i) => p === i || p.startsWith(i) || i.startsWith(p),
        ),
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
      const cwd = roots.websiteTargetRoot;
      const marker = `publication-exec:${input.execution.execution_id}`;
      const log = git(cwd, ["log", "-20", "--format=%H %s"]);
      if (log.ok) {
        for (const line of log.stdout.split("\n")) {
          if (line.includes(marker)) {
            const sha = line.split(" ")[0]!;
            return {
              ok: true,
              commit_sha: sha,
              reused_existing: true,
              staged_paths: input.paths,
              error: null,
            };
          }
        }
      }
      for (const p of input.paths) {
        if (!isPathAllowedForPublicationGit(p)) {
          return {
            ok: false,
            commit_sha: null,
            reused_existing: false,
            staged_paths: [],
            error: `Unexpected git path rejected: ${p}`,
          };
        }
      }
      for (const p of input.paths) {
        if (!existsSync(join(cwd, p))) {
          return {
            ok: false,
            commit_sha: null,
            reused_existing: false,
            staged_paths: [],
            error: `Required path missing before commit: ${p}`,
          };
        }
        const add = git(cwd, ["add", "--", p]);
        if (!add.ok) {
          return {
            ok: false,
            commit_sha: null,
            reused_existing: false,
            staged_paths: [],
            error: add.stderr || `git add failed: ${p}`,
          };
        }
      }
      const ids = input.execution.entries.map((e) => e.catalogue_id).join(" ");
      const msg = `aios: publish ${input.execution.plan_id} ${marker} ${ids}`;
      const commit = git(cwd, ["commit", "-m", msg]);
      if (!commit.ok) {
        return {
          ok: false,
          commit_sha: null,
          reused_existing: false,
          staged_paths: input.paths,
          error: commit.stderr || commit.stdout || "git commit failed",
        };
      }
      const sha = git(cwd, ["rev-parse", "HEAD"]);
      return {
        ok: sha.ok,
        commit_sha: sha.ok ? sha.stdout.trim() : null,
        reused_existing: false,
        staged_paths: input.paths,
        error: sha.ok ? null : sha.stderr,
      };
    },

    async push(input) {
      const cwd = roots.websiteTargetRoot;
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
      const branchR = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      const branch = branchR.ok ? branchR.stdout.trim() : "main";
      const remoteContains = git(cwd, ["branch", "-r", "--contains", sha]);
      if (remoteContains.ok && remoteContains.stdout.trim()) {
        return {
          ok: true,
          already_pushed: true,
          remote: "origin",
          branch,
          error: null,
        };
      }
      const push = git(cwd, ["push", "origin", "HEAD"]);
      if (!push.ok) {
        return {
          ok: false,
          already_pushed: false,
          remote: "origin",
          branch,
          error: push.stderr || "git push failed",
        };
      }
      return {
        ok: true,
        already_pushed: false,
        remote: "origin",
        branch,
        error: null,
      };
    },

    async verifyDeployment(input) {
      const live_urls: Record<string, string> = {};
      const per_entry: Record<
        string,
        { ok: boolean; url: string | null; error: string | null }
      > = {};
      let allOk = true;
      for (const e of input.execution.entries) {
        if (!e.export_package_id) {
          allOk = false;
          per_entry[e.catalogue_id] = {
            ok: false,
            url: null,
            error: "Missing export_package_id for live verify",
          };
          continue;
        }
        const pkg = join(roots.exportPackagesRoot, e.export_package_id);
        const { slug, errors: slugErrors } = resolveExportPackageSeoSlug(pkg);
        if (!slug || slugErrors.length) {
          allOk = false;
          per_entry[e.catalogue_id] = {
            ok: false,
            url: null,
            error: `SEO slug unresolved: ${slugErrors.join("; ") || "empty"}`,
          };
          continue;
        }
        const url = `https://studiosislab.com/resume/${slug}`;
        const thumbUrl = `https://studiosislab.com/templates/${e.catalogue_id}.png`;
        try {
          const pageRes = await fetch(url, {
            method: "GET",
            redirect: "follow",
          });
          if (!pageRes.ok) {
            allOk = false;
            per_entry[e.catalogue_id] = {
              ok: false,
              url: null,
              error: `Resume page HTTP ${pageRes.status} at ${url}`,
            };
            continue;
          }
          const html = await pageRes.text();
          const idPresent =
            html.includes(e.catalogue_id) ||
            html.includes(`Template ID: ${e.catalogue_id}`) ||
            html.includes(`/editor/template/${e.catalogue_id}`);
          if (!idPresent) {
            allOk = false;
            per_entry[e.catalogue_id] = {
              ok: false,
              url: null,
              error: `Resume page missing catalogue id ${e.catalogue_id}`,
            };
            continue;
          }
          const thumbRes = await fetch(thumbUrl, {
            method: "HEAD",
            redirect: "follow",
          });
          if (!thumbRes.ok) {
            allOk = false;
            per_entry[e.catalogue_id] = {
              ok: false,
              url: null,
              error: `Thumbnail HTTP ${thumbRes.status} at ${thumbUrl}`,
            };
            continue;
          }
          live_urls[e.catalogue_id] = url;
          per_entry[e.catalogue_id] = { ok: true, url, error: null };
        } catch (err) {
          allOk = false;
          per_entry[e.catalogue_id] = {
            ok: false,
            url: null,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
      return {
        ok: allOk,
        deployment_id: input.execution.git_commit_sha,
        live_urls,
        per_entry,
        error: allOk ? null : "Live verification incomplete",
      };
    },

    async updateLifecycle(input) {
      const per_entry: Record<string, { ok: boolean; error: string | null }> =
        {};
      const history_written: string[] = [];
      let allOk = true;
      for (const e of input.execution.entries) {
        try {
          const live_url = input.execution.live_urls[e.catalogue_id];
          if (!live_url || !input.execution.git_commit_sha) {
            throw new Error("Missing live_url or git SHA");
          }
          const life = readLifecycle(e.candidate_id);
          if (!life) throw new Error(`No lifecycle for ${e.candidate_id}`);
          if (life.lifecycle_status !== "PUBLISHED") {
            assertTransition(life.lifecycle_status, "PUBLISHED");
            upsertLifecycle({
              ...life,
              lifecycle_status: "PUBLISHED",
            });
          }
          per_entry[e.catalogue_id] = { ok: true, error: null };
          history_written.push(
            `plan-${input.execution.plan_id}-${e.catalogue_id}`,
          );
          void live_url;
        } catch (err) {
          allOk = false;
          per_entry[e.catalogue_id] = {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
      return {
        ok: allOk,
        per_entry,
        history_written,
        error: allOk ? null : "Partial lifecycle update failure",
      };
    },

    async releaseReservations() {
      // Reservations retained after commit artifacts exist
    },
  };
}
