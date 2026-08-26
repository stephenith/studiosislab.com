/**
 * Agent #246 — Founder Release Controller.
 * Sole authorization layer for READY_FOR_RELEASE → StudiosisLab publication.
 * ReleaseManager executes only with minted authorization.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  findReservationByCandidate,
  listReservations,
  updateReservationStatus,
} from "../export/CatalogueReservation.js";
import { EXPORT_PACKAGES_ROOT } from "../export/ExportService.js";
import type { CatalogueReservation } from "../export/types.js";
import { runAuthorizedExportRelease } from "../../runtime/publication/ReleaseManager.js";
import { mintFounderReleaseAuthorization } from "./ReleaseAuthorization.js";
import { appendReleaseAudit } from "./ReleaseAudit.js";
import type {
  FounderReleaseResult,
  PublicationPlan,
  ReleaseLifecycleStatus,
} from "./types.js";
import { FOUNDER_RELEASE_CONTROLLER_VERSION } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CONFIRM = "RELEASE_TO_STUDIOSISLAB";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function packageDir(export_package_id: string): string {
  return join(EXPORT_PACKAGES_ROOT, export_package_id);
}

function resolveReservation(input: {
  export_package_id?: string;
  candidate_id?: string;
  reservation_id?: string;
}): CatalogueReservation {
  if (input.reservation_id) {
    const hit = listReservations().find(
      (r) => r.reservation_id === input.reservation_id,
    );
    if (!hit) throw new Error(`Reservation not found: ${input.reservation_id}`);
    return hit;
  }
  if (input.export_package_id) {
    const hit = listReservations().find(
      (r) => r.export_package_id === input.export_package_id,
    );
    if (!hit) {
      throw new Error(
        `Reservation not found for export package: ${input.export_package_id}`,
      );
    }
    return hit;
  }
  if (input.candidate_id) {
    const hit = findReservationByCandidate(input.candidate_id);
    if (!hit) throw new Error(`Reservation not found for resume template: ${input.candidate_id}`);
    return hit;
  }
  throw new Error("export_package_id, candidate_id, or reservation_id required");
}

export function listReadyForRelease(): Array<{
  export_package_id: string;
  candidate_id: string;
  catalogue_id: string;
  reservation_id: string;
  status: string;
  title: string | null;
}> {
  return listReservations()
    .filter((r) =>
      [
        "READY_FOR_RELEASE",
        "RELEASE_REQUESTED",
        "FOUNDER_RELEASE_APPROVED",
        "RELEASE_FAILED",
      ].includes(r.status),
    )
    .map((r) => {
      let title: string | null = null;
      if (r.export_package_id) {
        const m = join(packageDir(r.export_package_id), "manifest-entry.json");
        if (existsSync(m)) {
          title = readJson<{ title?: string }>(m).title ?? null;
        }
      }
      return {
        export_package_id: r.export_package_id ?? "",
        candidate_id: r.candidate_id,
        catalogue_id: r.reserved_catalogue_id,
        reservation_id: r.reservation_id,
        status: r.status,
        title,
      };
    });
}

export function buildPublicationPlan(input: {
  export_package_id?: string;
  candidate_id?: string;
}): PublicationPlan {
  const reservation = resolveReservation(input);
  if (!reservation.export_package_id) {
    throw new Error("Reservation has no export_package_id");
  }
  const pkg = packageDir(reservation.export_package_id);
  const manifest = readJson<{
    id: string;
    title: string;
    categoryId: string;
  }>(join(pkg, "manifest-entry.json"));
  const seo = readJson<{
    slug: string;
    collision?: boolean;
    suggested_alternate_slug?: string | null;
  }>(join(pkg, "seo.json"));
  const slugResolved =
    seo.collision && seo.suggested_alternate_slug
      ? seo.suggested_alternate_slug
      : seo.slug;
  const risk: string[] = [];
  if (seo.collision) {
    risk.push(
      `SEO slug collision on "${seo.slug}" — will publish as "${slugResolved}"`,
    );
  }
  risk.push("Live templates.manifest.json will be mutated");
  risk.push("Registries will be regenerated");
  risk.push("No automatic continuous release — this is a one-shot Founder action");

  return {
    export_package_id: reservation.export_package_id,
    catalogue_id: reservation.reserved_catalogue_id,
    title: manifest.title,
    category_id: manifest.categoryId,
    seo_slug: seo.slug,
    seo_slug_resolved: slugResolved,
    seo_collision: Boolean(seo.collision),
    assets: [
      "assets/thumbnail.png",
      "assets/thumbnail.webp",
      "assets/preview.png",
      "assets/preview.webp",
      "template.json",
    ],
    risk_summary: risk,
    steps: [
      "verify READY_FOR_RELEASE",
      "verify integrity",
      "verify compatibility",
      "verify reservation",
      "verify manifest collision",
      "verify slug collision resolution",
      "copy template JSON",
      "copy PNG",
      "copy WebP",
      "update manifest",
      "update SEO",
      "regenerate registries",
      "verify generated output",
      "commit reservation",
      "mark RELEASE_COMPLETED",
    ],
    publication_allowed_auto: false,
    requires_explicit_founder_approval: true,
  };
}

export function getReleaseDryRunPath(export_package_id: string): string | null {
  const p = join(packageDir(export_package_id), "publication-dry-run.json");
  return existsSync(p) ? p : null;
}

export function getReleaseStatus(input: {
  export_package_id?: string;
  candidate_id?: string;
}): {
  export_package_id: string | null;
  candidate_id: string | null;
  catalogue_id: string | null;
  reservation_status: string | null;
  ready_for_release: boolean;
  release_requested: boolean;
  can_release: boolean;
  plan: PublicationPlan | null;
  dry_run_path: string | null;
  controller_version: string;
  auto_publish: false;
  live: false;
} {
  try {
    const reservation = resolveReservation(input);
    const plan = buildPublicationPlan({
      export_package_id: reservation.export_package_id ?? undefined,
      candidate_id: reservation.candidate_id,
    });
    return {
      export_package_id: reservation.export_package_id,
      candidate_id: reservation.candidate_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_status: reservation.status,
      ready_for_release: reservation.status === "READY_FOR_RELEASE",
      release_requested: reservation.status === "RELEASE_REQUESTED",
      can_release: [
        "READY_FOR_RELEASE",
        "RELEASE_REQUESTED",
        "RELEASE_FAILED",
      ].includes(reservation.status),
      plan,
      dry_run_path: reservation.export_package_id
        ? getReleaseDryRunPath(reservation.export_package_id)
        : null,
      controller_version: FOUNDER_RELEASE_CONTROLLER_VERSION,
      auto_publish: false,
      live: false,
    };
  } catch {
    return {
      export_package_id: input.export_package_id ?? null,
      candidate_id: input.candidate_id ?? null,
      catalogue_id: null,
      reservation_status: null,
      ready_for_release: false,
      release_requested: false,
      can_release: false,
      plan: null,
      dry_run_path: null,
      controller_version: FOUNDER_RELEASE_CONTROLLER_VERSION,
      auto_publish: false,
      live: false,
    };
  }
}

/** Transition READY_FOR_RELEASE → RELEASE_REQUESTED */
export function requestRelease(input: {
  export_package_id?: string;
  candidate_id?: string;
  actor?: string;
}): FounderReleaseResult {
  const actor = input.actor ?? "founder";
  const reservation = resolveReservation(input);
  if (
    reservation.status !== "READY_FOR_RELEASE" &&
    reservation.status !== "RELEASE_FAILED"
  ) {
    appendReleaseAudit({
      type: "approval_rejected",
      export_package_id: reservation.export_package_id ?? "",
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: null,
      authorization_id: null,
      actor,
      detail: `requestRelease rejected — status ${reservation.status}`,
      ok: false,
    });
    return {
      ok: false,
      export_package_id: reservation.export_package_id ?? "",
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: null,
      status: "REJECTED",
      authorization_id: null,
      error: `Require READY_FOR_RELEASE (got ${reservation.status})`,
      rolled_back: false,
      website_modified: false,
      auto_publish: false,
      live: false,
    };
  }
  updateReservationStatus({
    reservation_id: reservation.reservation_id,
    status: "RELEASE_REQUESTED",
    reason: "Founder requested release",
  });
  appendReleaseAudit({
    type: "release_requested",
    export_package_id: reservation.export_package_id ?? "",
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: null,
    authorization_id: null,
    actor,
    detail: "RELEASE_REQUESTED",
    ok: true,
  });
  return {
    ok: true,
    export_package_id: reservation.export_package_id ?? "",
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: null,
    status: "RELEASE_REQUESTED",
    authorization_id: null,
    error: null,
    rolled_back: false,
    website_modified: false,
    auto_publish: false,
    live: false,
  };
}

/**
 * Explicit Founder approval + authorized ReleaseManager execution.
 * Never infers approval. Requires confirm_phrase + explicit_approval.
 */
export async function approveAndExecuteRelease(input: {
  export_package_id?: string;
  candidate_id?: string;
  founder_name?: string;
  explicit_approval: boolean;
  confirm_phrase: string;
  confirm_dialog: boolean;
  actor?: string;
  target_root?: string;
  force_fail_after?:
    | "verify_integrity"
    | "copy_template"
    | "update_manifest"
    | "regenerate_registries"
    | null;
}): Promise<FounderReleaseResult> {
  const actor = input.actor ?? "founder";
  const reservation = resolveReservation(input);
  const export_package_id = reservation.export_package_id;
  if (!export_package_id) {
    return fail(reservation, "missing export_package_id", actor);
  }

  if (input.explicit_approval !== true) {
    appendReleaseAudit({
      type: "approval_rejected",
      export_package_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: null,
      authorization_id: null,
      actor,
      detail: "explicit_approval not true",
      ok: false,
    });
    return fail(reservation, "explicit_approval required — never inferred", actor);
  }
  if (input.confirm_dialog !== true) {
    appendReleaseAudit({
      type: "approval_rejected",
      export_package_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: null,
      authorization_id: null,
      actor,
      detail: "confirmation dialog not acknowledged",
      ok: false,
    });
    return fail(reservation, "confirm_dialog required", actor);
  }
  if (input.confirm_phrase !== CONFIRM) {
    appendReleaseAudit({
      type: "approval_rejected",
      export_package_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: null,
      authorization_id: null,
      actor,
      detail: "confirm_phrase mismatch",
      ok: false,
    });
    return fail(
      reservation,
      `confirm_phrase must be ${CONFIRM}`,
      actor,
    );
  }

  if (
    ![
      "READY_FOR_RELEASE",
      "RELEASE_REQUESTED",
      "RELEASE_FAILED",
    ].includes(reservation.status)
  ) {
    if (reservation.status === "RELEASE_COMPLETED") {
      return fail(reservation, "duplicate release — already RELEASE_COMPLETED", actor);
    }
    return fail(
      reservation,
      `status ${reservation.status} not releasable`,
      actor,
    );
  }

  // Ensure request state exists
  if (reservation.status === "READY_FOR_RELEASE" || reservation.status === "RELEASE_FAILED") {
    updateReservationStatus({
      reservation_id: reservation.reservation_id,
      status: "RELEASE_REQUESTED",
      reason: "auto-request on approveAndExecute",
    });
    appendReleaseAudit({
      type: "release_requested",
      export_package_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: null,
      authorization_id: null,
      actor,
      detail: "RELEASE_REQUESTED (via approveAndExecute)",
      ok: true,
    });
  }

  let authorization;
  try {
    authorization = mintFounderReleaseAuthorization({
      export_package_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      founder_name: input.founder_name ?? "Stephen",
      confirm_phrase: input.confirm_phrase,
      explicit_approval: true,
    });
  } catch (e) {
    return fail(
      reservation,
      e instanceof Error ? e.message : String(e),
      actor,
    );
  }

  updateReservationStatus({
    reservation_id: reservation.reservation_id,
    status: "FOUNDER_RELEASE_APPROVED",
    reason: "Founder explicit release approval",
  });
  appendReleaseAudit({
    type: "approval",
    export_package_id,
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: null,
    authorization_id: authorization.authorization_id,
    actor,
    detail: "FOUNDER_RELEASE_APPROVED",
    ok: true,
  });

  updateReservationStatus({
    reservation_id: reservation.reservation_id,
    status: "RELEASE_EXECUTING",
    reason: "ReleaseManager execution started",
  });
  appendReleaseAudit({
    type: "execution_started",
    export_package_id,
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: null,
    authorization_id: authorization.authorization_id,
    actor,
    detail: "RELEASE_EXECUTING",
    ok: true,
  });

  const exec = runAuthorizedExportRelease({
    authorization,
    export_package_dir: packageDir(export_package_id),
    target_root: input.target_root ?? REPO,
    persist: true,
    force_fail_after: input.force_fail_after ?? null,
  });

  appendReleaseAudit({
    type: "execution",
    export_package_id,
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: exec.release_id,
    authorization_id: authorization.authorization_id,
    actor,
    detail: exec.pass
      ? `steps: ${exec.steps_completed.join(",")}`
      : exec.errors.join("; "),
    ok: exec.pass,
  });

  if (!exec.pass) {
    if (exec.rolled_back) {
      appendReleaseAudit({
        type: "rollback",
        export_package_id,
        catalogue_id: reservation.reserved_catalogue_id,
        reservation_id: reservation.reservation_id,
        release_id: exec.release_id,
        authorization_id: authorization.authorization_id,
        actor,
        detail: "website restored from snapshot",
        ok: true,
      });
    }
    updateReservationStatus({
      reservation_id: reservation.reservation_id,
      status: "RELEASE_FAILED",
      reason: exec.errors.join("; "),
    });
    appendReleaseAudit({
      type: "failure",
      export_package_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: exec.release_id,
      authorization_id: authorization.authorization_id,
      actor,
      detail: exec.errors.join("; "),
      ok: false,
    });
    return {
      ok: false,
      export_package_id,
      catalogue_id: reservation.reserved_catalogue_id,
      reservation_id: reservation.reservation_id,
      release_id: exec.release_id,
      status: "RELEASE_FAILED",
      authorization_id: authorization.authorization_id,
      error: exec.errors.join("; "),
      rolled_back: exec.rolled_back,
      website_modified: false,
      auto_publish: false,
      live: false,
    };
  }

  updateReservationStatus({
    reservation_id: reservation.reservation_id,
    status: "RELEASE_COMPLETED",
    reason: `Released as ${exec.release_id}`,
  });
  appendReleaseAudit({
    type: "completion",
    export_package_id,
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: exec.release_id,
    authorization_id: authorization.authorization_id,
    actor,
    detail: "RELEASE_COMPLETED",
    ok: true,
  });

  return {
    ok: true,
    export_package_id,
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: exec.release_id,
    status: "RELEASE_COMPLETED" satisfies ReleaseLifecycleStatus,
    authorization_id: authorization.authorization_id,
    error: null,
    rolled_back: false,
    website_modified: true,
    auto_publish: false,
    live: false,
  };
}

function fail(
  reservation: CatalogueReservation,
  error: string,
  actor: string,
): FounderReleaseResult {
  appendReleaseAudit({
    type: "failure",
    export_package_id: reservation.export_package_id ?? "",
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: null,
    authorization_id: null,
    actor,
    detail: error,
    ok: false,
  });
  return {
    ok: false,
    export_package_id: reservation.export_package_id ?? "",
    catalogue_id: reservation.reserved_catalogue_id,
    reservation_id: reservation.reservation_id,
    release_id: null,
    status: "REJECTED",
    authorization_id: null,
    error,
    rolled_back: false,
    website_modified: false,
    auto_publish: false,
    live: false,
  };
}
