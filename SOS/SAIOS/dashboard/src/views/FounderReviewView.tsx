import { useEffect, useMemo, useRef, useState } from "react";
import type { DashboardSnapshot, FounderReviewQueueItem } from "../data/types";
import {
  Badge,
  DangerButton,
  EmptyIllustration,
  FilterChipButton,
  FilterChipGroup,
  PageHeader,
  PageSection,
  PrimaryButton,
  SearchBar,
  SecondaryButton,
  SectionCard,
  StatCard,
  StickyFooter,
  ToolbarActions,
  type BadgeTone,
} from "../design-system";

/** Resume page width at 100% zoom (CSS px). Height from A4 aspect ratio. */
const PREVIEW_PAGE_WIDTH = 794;
const PREVIEW_PAGE_HEIGHT = Math.round((PREVIEW_PAGE_WIDTH * 297) / 210);
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

type Props = {
  snapshot: DashboardSnapshot;
  /** Refresh review queue from server (prefer /api/review-queue). */
  onDecided: () => void | Promise<void>;
};

type StatusOverride = {
  status: FounderReviewQueueItem["status"];
  badge: FounderReviewQueueItem["badge"];
  decision_id?: string;
};

function statusFromDecision(
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
): StatusOverride {
  if (decision === "APPROVED") {
    return { status: "approved", badge: "ready" };
  }
  if (decision === "REJECTED") {
    return { status: "rejected", badge: "blocked" };
  }
  return { status: "changes_requested", badge: "ready" };
}

type FilterKey =
  | "all"
  | "waiting"
  | "approved"
  | "rejected"
  | "changes"
  | "today"
  | "week";

/** Filters kept for verify surface; default All shows full queue. */
const FILTERS_ENABLED = true;

function normalizeStatus(status: string | undefined | null): string {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isWaitingFounder(status: string | undefined | null): boolean {
  return normalizeStatus(status) === "waiting_founder";
}

function isRevisionFailed(status: string | undefined | null): boolean {
  return normalizeStatus(status) === "revision_failed";
}

function canRequestOrReject(status: string | undefined | null): boolean {
  return isWaitingFounder(status) || isRevisionFailed(status);
}

function canApprove(status: string | undefined | null): boolean {
  return isWaitingFounder(status);
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(): number {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: string): string {
  const n = normalizeStatus(status);
  if (n === "waiting_founder") return "Ready for Review";
  if (n === "approved") return "Approved";
  if (n === "rejected") return "Rejected";
  if (n === "changes_requested") return "Changes Requested";
  if (n === "revision_failed") return "Revision Failed";
  if (n === "staging_requested") return "Staging Requested";
  if (n === "staging") return "Staging";
  if (n === "staged") return "Staged";
  if (n === "validated") return "Validated / Staged";
  if (n === "staging_failed") return "Validation Failed";
  if (n === "publishing") return "Publishing";
  if (n === "publication_failed") return "Publication Failed";
  if (n === "published") return "Published";
  return status || "—";
}

type StagingStatusPayload = {
  candidate_id: string;
  lifecycle_status: string | null;
  generation_id: string | null;
  staging_package_id: string | null;
  staging_path: string | null;
  validation: {
    pass?: boolean;
    checks?: Record<string, boolean>;
    checked_at?: string;
  } | null;
  publication_allowed: false;
};

type MultiPublicationStatusPayload = {
  candidate_id: string;
  title: string | null;
  status_label: string;
  lifecycle_status: string | null;
  staging_package_id: string | null;
  catalogue_id: string | null;
  plan_id: string | null;
  release_id: string | null;
  git_commit_sha: string | null;
  live_url: string | null;
  reason: string | null;
};

/** Agent #246 — Founder release status for READY_FOR_RELEASE packages */
type ReleaseStatusPayload = {
  export_package_id: string | null;
  candidate_id: string | null;
  catalogue_id: string | null;
  reservation_status: string | null;
  ready_for_release: boolean;
  release_requested: boolean;
  can_release: boolean;
  plan: {
    title: string;
    catalogue_id: string;
    category_id: string;
    seo_slug: string;
    seo_slug_resolved: string;
    seo_collision: boolean;
    assets: string[];
    risk_summary: string[];
  } | null;
  dry_run_path: string | null;
  auto_publish: false;
  live: false;
};

/** Verify-required fr-badge-* classes retained alongside DS Badge tones. */
function badgeClass(item: FounderReviewQueueItem): string {
  if (item.badge === "ready") return "fr-badge fr-badge-ready";
  if (item.badge === "blocked") return "fr-badge fr-badge-blocked";
  if (item.badge === "waiting" || isWaitingFounder(item.status)) {
    return "fr-badge fr-badge-waiting";
  }
  return "fr-badge";
}

function badgeTone(item: FounderReviewQueueItem): BadgeTone {
  if (item.badge === "ready") return "ready";
  if (item.badge === "blocked") return "blocked";
  if (item.badge === "waiting" || isWaitingFounder(item.status)) return "waiting";
  const n = normalizeStatus(item.status);
  if (n === "approved") return "approved";
  if (n === "rejected") return "rejected";
  if (n === "changes_requested") return "processing";
  if (n === "revision_failed") return "blocked";
  return "neutral";
}

function scoreValue(n: number | undefined | null): string {
  return n == null || !Number.isFinite(n) ? "—" : String(Math.round(n));
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function snapZoom(z: number): number {
  return clampZoom(Math.round(z / ZOOM_STEP) * ZOOM_STEP);
}

function formatZoomPercent(z: number): string {
  return `${Math.round(z * 100)}%`;
}

function artifactSrc(rel: string | null | undefined): string | null {
  if (!rel) return null;
  const clean = rel.replace(/^\/+/, "");
  if (!clean.startsWith("SOS/07_LOGS/")) return null;
  return `/artifacts/${clean}`;
}

function isThumbnailAsset(relOrUrl: string | null | undefined): boolean {
  if (!relOrUrl) return false;
  return /thumbnail/i.test(relOrUrl);
}

/**
 * Asset must belong to this review — never reuse another review's image.
 * Ownership: path contains review_id / candidate_id, or sits under item.source.
 */
function assetBelongsToReview(
  item: FounderReviewQueueItem,
  rel: string | null | undefined,
): boolean {
  if (!rel) return false;
  const path = rel.replace(/\\/g, "/").toLowerCase();
  const reviewId = item.review_id.toLowerCase();
  const candidateId = String(item.candidate_id ?? "").toLowerCase();
  const source = String(item.source ?? "").replace(/\\/g, "/").toLowerCase();

  if (path.includes(reviewId)) return true;
  if (candidateId && candidateId.length >= 4 && path.includes(candidateId)) {
    return true;
  }

  const fr = reviewId.match(/founder-review-(\d{3})\b/);
  if (fr && path.includes(`founder-review-${fr[1]}`)) return true;

  if (source.startsWith("sos/07_logs/") && path.includes(source)) return true;

  // Production cycle item may use its dedicated generated-resume folder.
  if (
    source.includes("first-production-cycle") &&
    (path.includes("first-production-cycle") ||
      (candidateId.includes("ats-mm") && path.includes("marketing-manager")))
  ) {
    return true;
  }

  if (source.includes("first-dry-run") && path.includes("first-dry-run")) {
    return true;
  }

  return false;
}

function ownedPreviewPath(item: FounderReviewQueueItem): string | null {
  if (item.preview_path && assetBelongsToReview(item, item.preview_path)) {
    return item.preview_path;
  }
  return null;
}

function ownedThumbnailPath(item: FounderReviewQueueItem): string | null {
  if (item.thumbnail_path && assetBelongsToReview(item, item.thumbnail_path)) {
    return item.thumbnail_path;
  }
  return null;
}

/** Left queue — this review's thumbnail_path only. */
function queueThumbnailSrc(item: FounderReviewQueueItem): string | null {
  return artifactSrc(ownedThumbnailPath(item));
}

/**
 * Center preview — this review's preview_path only.
 * Missing → placeholder. Never borrow another review's image.
 */
function centerPreviewSrc(item: FounderReviewQueueItem): {
  url: string | null;
  mode: "full" | "thumbnail_only" | "missing";
  preview_path: string | null;
} {
  const owned = ownedPreviewPath(item);
  if (owned && !isThumbnailAsset(owned)) {
    return { url: artifactSrc(owned), mode: "full", preview_path: owned };
  }
  // Do not fall back to preview_url / other reviews — missing means placeholder.
  if (ownedThumbnailPath(item) || isThumbnailAsset(item.preview_path)) {
    return { url: null, mode: "thumbnail_only", preview_path: null };
  }
  return { url: null, mode: "missing", preview_path: null };
}

/** Internal binding check: selected media must match selected review_id. */
function verifySelectionBinding(
  selected: FounderReviewQueueItem,
  selectedId: string,
): {
  ok: boolean;
  review_id: string;
  candidate_id: string;
  preview_path: string | null;
} {
  const preview_path = ownedPreviewPath(selected);
  const thumb_path = ownedThumbnailPath(selected);
  // Foreign paths on the item are ignored for display; binding ok = selection identity + owned assets.
  const ok =
    selected.review_id === selectedId &&
    Boolean(selected.candidate_id) &&
    (preview_path == null || assetBelongsToReview(selected, preview_path)) &&
    (thumb_path == null || assetBelongsToReview(selected, thumb_path));
  return {
    ok,
    review_id: selected.review_id,
    candidate_id: selected.candidate_id,
    preview_path,
  };
}

export function FounderReviewView({ snapshot, onDecided }: Props) {
  const serverQueue: FounderReviewQueueItem[] = Array.isArray(
    snapshot.review_queue,
  )
    ? snapshot.review_queue
    : [];

  /**
   * Optimistic status patches applied immediately after a successful decision.
   * Cleared once server refresh matches (reconcile).
   */
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, StatusOverride>
  >({});

  const reviewQueue: FounderReviewQueueItem[] = useMemo(() => {
    if (Object.keys(statusOverrides).length === 0) return serverQueue;
    return serverQueue.map((item) => {
      const o = statusOverrides[item.review_id];
      if (!o) return item;
      return {
        ...item,
        status: o.status,
        badge: o.badge,
        decision_id: o.decision_id ?? item.decision_id,
      };
    });
  }, [serverQueue, statusOverrides]);

  // Drop overrides that already match backend truth after refresh.
  useEffect(() => {
    setStatusOverrides((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const id of ids) {
        const server = serverQueue.find((r) => r.review_id === id);
        if (server && server.status === next[id]!.status) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [serverQueue]);

  /** Operational badges — same top_bar truth as App toolbar (not per-item provider). */
  const opsLabel = (value: string | undefined | null): string => {
    const v = typeof value === "string" ? value.trim() : "";
    return v || "Unavailable";
  };
  const departmentLabel = opsLabel(snapshot.top_bar.live_label);
  const providerLabel = opsLabel(snapshot.top_bar.provider);
  const modeLabel = opsLabel(snapshot.top_bar.mode);
  const publicationLabel = opsLabel(
    snapshot.top_bar.publication_label ?? "MANUAL / GUARDED",
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [modeAction, setModeAction] = useState<"idle" | "approve" | "reject" | "changes">(
    "idle",
  );
  const [reason, setReason] = useState("");
  const [changes, setChanges] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  /** null = Fit to View (recomputed from viewport). */
  const [zoomManual, setZoomManual] = useState<number | null>(null);
  const [fitZoom, setFitZoom] = useState(0.75);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  /** Agent #242 — Stage for StudiosisLab (never publish) */
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [stagingInfo, setStagingInfo] = useState<StagingStatusPayload | null>(
    null,
  );
  const [pubInfo, setPubInfo] = useState<MultiPublicationStatusPayload | null>(
    null,
  );
  const [stageMeta, setStageMeta] = useState<{
    title: string;
    role: string;
    design_family: string;
    model: string;
    provider: string;
    approved_at: string;
  } | null>(null);
  /** Agent #246 — Founder release (manual only) */
  const [releaseInfo, setReleaseInfo] = useState<ReleaseStatusPayload | null>(
    null,
  );
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [releasePlanOpen, setReleasePlanOpen] = useState(false);
  const [releaseDryRunOpen, setReleaseDryRunOpen] = useState(false);
  const [releaseDryRunJson, setReleaseDryRunJson] = useState<string | null>(
    null,
  );

  const zoom = zoomManual ?? fitZoom;
  const zoomMode: "fit" | "manual" = zoomManual == null ? "fit" : "manual";

  const activeQueue = reviewQueue;

  const waitingCount = useMemo(
    () => activeQueue.filter((r) => isWaitingFounder(r.status)).length,
    [activeQueue],
  );

  const filtered = useMemo(() => {
    if (!FILTERS_ENABLED) return activeQueue;

    const q = search.trim().toLowerCase();
    const today = startOfToday();
    const week = startOfWeek();

    return activeQueue.filter((item) => {
      if (filter === "waiting" && !isWaitingFounder(item.status)) return false;
      if (filter === "approved" && normalizeStatus(item.status) !== "approved") return false;
      if (filter === "rejected" && normalizeStatus(item.status) !== "rejected") return false;
      if (
        filter === "changes" &&
        normalizeStatus(item.status) !== "changes_requested" &&
        !isRevisionFailed(item.status)
      ) {
        return false;
      }
      if (filter === "today") {
        const t = item.created_at ? Date.parse(item.created_at) : NaN;
        if (!Number.isFinite(t) || t < today) return false;
      }
      if (filter === "week") {
        const t = item.created_at ? Date.parse(item.created_at) : NaN;
        if (!Number.isFinite(t) || t < week) return false;
      }
      if (!q) return true;
      const title = String(item.title ?? "").toLowerCase();
      const reviewId = String(item.review_id ?? "").toLowerCase();
      const template = String(item.template ?? "").toLowerCase();
      return title.includes(q) || reviewId.includes(q) || template.includes(q);
    });
  }, [activeQueue, filter, search]);

  const list = filtered;
  const hasSearchOrFilter = search.trim().length > 0 || filter !== "all";

  /** Never auto-select. Clear only when the current selection leaves the list. */
  useEffect(() => {
    if (!selectedId) return;
    if (!list.some((r) => r.review_id === selectedId)) {
      setSelectedId(null);
      setModeAction("idle");
      setReason("");
      setChanges("");
      setJsonOpen(false);
      setLogsOpen(false);
    }
  }, [list, selectedId]);

  const selected = useMemo(
    () => list.find((r) => r.review_id === selectedId) ?? null,
    [list, selectedId],
  );

  const selectionBinding = useMemo(
    () =>
      selected && selectedId
        ? verifySelectionBinding(selected, selectedId)
        : null,
    [selected, selectedId],
  );

  useEffect(() => {
    if (!selectionBinding) return;
    console.log("[FounderReview] selection binding", {
      review_id: selectionBinding.review_id,
      candidate_id: selectionBinding.candidate_id,
      preview_path: selectionBinding.preview_path,
      ok: selectionBinding.ok,
    });
  }, [selectionBinding]);

  useEffect(() => {
    const center = selected ? centerPreviewSrc(selected) : null;
    setPreviewBroken(false);
    setZoomManual(null);
    if (center?.mode === "full" && center.url) {
      setPreviewLoading(true);
    } else {
      setPreviewLoading(false);
    }
  }, [selected?.review_id, selected?.preview_path]);

  useEffect(() => {
    const el = previewViewportRef.current;
    if (!el) return;

    const recomputeFit = () => {
      const pad = 28;
      const availW = Math.max(80, el.clientWidth - pad);
      const availH = Math.max(80, el.clientHeight - pad);
      const scale = Math.min(
        availW / PREVIEW_PAGE_WIDTH,
        availH / PREVIEW_PAGE_HEIGHT,
      );
      setFitZoom(clampZoom(scale));
    };

    recomputeFit();
    const ro = new ResizeObserver(() => recomputeFit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [selected?.review_id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoomManual((z) => snapZoom((z ?? fitZoom) - ZOOM_STEP));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoomManual((z) => snapZoom((z ?? fitZoom) + ZOOM_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoomManual(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitZoom]);

  async function refreshStaging(
    candidateId: string,
  ): Promise<StagingStatusPayload | null> {
    try {
      const res = await fetch(
        `/api/staging/status?candidate_id=${encodeURIComponent(candidateId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as StagingStatusPayload;
      setStagingInfo(data);
      return data;
    } catch {
      return null;
    }
  }

  async function refreshPublication(
    candidateId: string,
  ): Promise<MultiPublicationStatusPayload | null> {
    try {
      const res = await fetch(
        `/api/publication/status?candidate_id=${encodeURIComponent(candidateId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as MultiPublicationStatusPayload;
      setPubInfo(data);
      return data;
    } catch {
      setPubInfo(null);
      return null;
    }
  }

  async function refreshRelease(
    candidateId: string,
  ): Promise<ReleaseStatusPayload | null> {
    try {
      const res = await fetch(
        `/api/release/status?candidate_id=${encodeURIComponent(candidateId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as ReleaseStatusPayload;
      setReleaseInfo(data);
      return data;
    } catch {
      setReleaseInfo(null);
      return null;
    }
  }

  async function openReleasePlan(): Promise<void> {
    if (!selected?.candidate_id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/release/plan?candidate_id=${encodeURIComponent(selected.candidate_id)}`,
      );
      const data = (await res.json()) as ReleaseStatusPayload["plan"] & {
        error?: string;
        export_package_id?: string;
        catalogue_id?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? "Plan failed");
      setReleaseInfo((prev) => ({
        export_package_id:
          prev?.export_package_id ?? data.export_package_id ?? null,
        candidate_id: selected.candidate_id,
        catalogue_id: data.catalogue_id ?? prev?.catalogue_id ?? null,
        reservation_status: prev?.reservation_status ?? null,
        ready_for_release: prev?.ready_for_release ?? true,
        release_requested: prev?.release_requested ?? false,
        can_release: prev?.can_release ?? true,
        plan: data,
        dry_run_path: prev?.dry_run_path ?? null,
        auto_publish: false,
        live: false,
      }));
      setReleasePlanOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function openReleaseDryRun(): Promise<void> {
    const exportId = releaseInfo?.export_package_id;
    if (!exportId) {
      setError("No export package for dry-run");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/release/dry-run?export_package_id=${encodeURIComponent(exportId)}`,
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Dry-run not found");
      setReleaseDryRunJson(text);
      setReleaseDryRunOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRelease(): Promise<void> {
    if (!selected?.candidate_id || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/release/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: selected.candidate_id,
          export_package_id: releaseInfo?.export_package_id ?? undefined,
          explicit_approval: true,
          confirm_dialog: true,
          confirm_phrase: "RELEASE_TO_STUDIOSISLAB",
          founder_name: "Stephen",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        release_id?: string;
        status?: string;
        catalogue_id?: string;
      };
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? `Release failed (HTTP ${res.status})`);
      }
      setReleaseConfirmOpen(false);
      setMessage(
        `Released ${data.catalogue_id ?? ""} · ${data.release_id} · ${data.status} · manual Founder approval only`,
      );
      await refreshRelease(selected.candidate_id);
      await Promise.resolve(onDecided());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!selected?.candidate_id) {
      setStagingInfo(null);
      setPubInfo(null);
      setStageConfirmOpen(false);
      setReleaseInfo(null);
      setReleaseConfirmOpen(false);
      return;
    }
    void refreshStaging(selected.candidate_id);
    void refreshRelease(selected.candidate_id);
    void refreshPublication(selected.candidate_id);
  }, [selected?.candidate_id, selected?.status]);

  async function submit(decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    // Runtime-confirmed: revised templates are projected as status "waiting_founder"
    // in Templates Ready for Review (legacy candidate.json may still say READY_FOR_FOUNDER_REVIEW).
    if (!selected) {
      setError("No template selected — choose a review from the queue first.");
      return;
    }
    if (busy) {
      setError("Submission already in progress — wait for it to finish.");
      return;
    }
    if (decision === "APPROVED" && !canApprove(selected.status)) {
      setError(
        `Cannot approve — this review is "${selected.status}". After a failed revision, submit new changes or reject.`,
      );
      return;
    }
    if ((decision === "REJECTED" || decision === "CHANGES_REQUESTED") && !canRequestOrReject(selected.status)) {
      setError(
        `Cannot submit — this review is "${selected.status}" (expected waiting_founder or revision_failed). Refresh the queue and try again.`,
      );
      return;
    }
    if (!reason.trim() && decision !== "APPROVED") {
      setError("Reason / feedback is required");
      return;
    }

    const decidedId = selected.review_id;
    const candidateId = selected.candidate_id;
    const payload = {
      review_id: selected.review_id,
      task_id: selected.task_id,
      cycle_id: selected.cycle_id,
      candidate_id: selected.candidate_id,
      decision,
      reason: reason.trim() || "Founder decision from Templates Ready for Review",
      requested_changes:
        decision === "CHANGES_REQUESTED"
          ? changes
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      dry_run: true,
    };

    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/founder-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        decision?: { decision_id?: string; decision?: string };
        message?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      // Immediate UI truth: keep card visible under All + matching status filter.
      const optimistic = statusFromDecision(decision);
      setStatusOverrides((prev) => ({
        ...prev,
        [decidedId]: {
          ...optimistic,
          decision_id: data.decision?.decision_id,
        },
      }));
      // Keep selection so Approve can Stage; Reject / Changes Requested stay visible.
      setSelectedId(decidedId);
      setModeAction("idle");
      setReason("");
      setChanges("");
      setJsonOpen(false);
      setLogsOpen(false);
      setMessage(
        data.message ??
          `Decision recorded: ${data.decision?.decision_id ?? ""} · publication_allowed=false`,
      );

      await Promise.resolve(onDecided());
      if (decision === "APPROVED" && candidateId) {
        await refreshStaging(candidateId);
      }
    } catch (err) {
      // Keep entered reason/changes so the Founder can retry.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function openStageConfirm(): Promise<void> {
    if (!selected?.candidate_id || busy) return;
    setError(null);
    setBusy(true);
    try {
      const status = await refreshStaging(selected.candidate_id);
      setStageMeta({
        title: selected.title,
        role: selected.production_target?.title || selected.template || "—",
        design_family: selected.template || "—",
        model: selected.provider || "—",
        provider: selected.provider || "—",
        approved_at: new Date().toISOString(),
      });
      if (
        status &&
        status.lifecycle_status &&
        status.lifecycle_status !== "APPROVED" &&
        status.lifecycle_status !== "STAGING_FAILED"
      ) {
        setError(
          `Cannot stage from status ${status.lifecycle_status}. Only APPROVED (or failed retry) may stage.`,
        );
        return;
      }
      setStageConfirmOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmStage(): Promise<void> {
    if (!selected?.candidate_id || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const latest = await refreshStaging(selected.candidate_id);
      const endpoint =
        latest?.lifecycle_status === "STAGING_FAILED"
          ? "/api/staging/retry"
          : "/api/staging/request";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: selected.candidate_id,
          decision_id: selected.decision_id ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        staging_package_id?: string;
        staging_path?: string;
        lifecycle_status?: string;
        idempotent?: boolean;
      };
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? `Staging failed (HTTP ${res.status})`);
      }
      setStageConfirmOpen(false);
      setMessage(
        data.idempotent
          ? `Existing staging package returned: ${data.staging_package_id} · not published`
          : `Staged: ${data.staging_package_id} · ${data.lifecycle_status} · publication_allowed=false`,
      );
      await refreshStaging(selected.candidate_id);
      await Promise.resolve(onDecided());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const emptyKind =
    reviewQueue.length === 0
      ? "none"
      : hasSearchOrFilter
        ? "search"
        : "none";

  return (
    <div className="fr-v3-page ds-command">
      <PageHeader
        title="Templates Ready for Review"
        subtitle={`Founder moderation · ${modeLabel}`}
        actions={
          <ToolbarActions>
            <div className="fr-v3-header-meta">
              <Badge tone="neutral">{list.length} reviews</Badge>
              <Badge tone="waiting">{waitingCount} waiting</Badge>
              <Badge tone="neutral">{departmentLabel}</Badge>
              <Badge tone="neutral">Provider: {providerLabel}</Badge>
              <Badge tone="neutral">Mode: {modeLabel}</Badge>
              <Badge tone="neutral">{publicationLabel}</Badge>
            </div>
          </ToolbarActions>
        }
      />

      <div className="ds-stat-row" aria-label="Review statistics">
        <StatCard value={list.length} label="Templates in queue" />
        <StatCard value={waitingCount} label="Ready for Review" />
        <StatCard
          value={activeQueue.filter((r) => normalizeStatus(r.status) === "approved").length}
          label="Approved"
        />
        <StatCard
          value={
            activeQueue.filter((r) => normalizeStatus(r.status) === "rejected").length
          }
          label="Rejected"
        />
      </div>

      <div className="fr-v3-toolbar">
        <ToolbarActions>
          <FilterChipGroup aria-label="Review filters">
            <div className="fr-filters" role="tablist" aria-label="Review filters">
              {(
                [
                  ["all", "All"],
                  ["waiting", "Ready for Review"],
                  ["approved", "Approved"],
                  ["rejected", "Rejected"],
                  ["changes", "Changes Requested"],
                  ["today", "Today"],
                  ["week", "This Week"],
                ] as const
              ).map(([key, label]) => (
                <FilterChipButton
                  key={key}
                  id={`fr-${key}`}
                  label={label}
                  active={filter === key}
                  role="tab"
                  aria-selected={filter === key}
                  className={filter === key ? "fr-filter active" : "fr-filter"}
                  onClick={() => setFilter(key)}
                />
              ))}
            </div>
          </FilterChipGroup>
          <SearchBar
            className="fr-search"
            value={search}
            placeholder="Search title, review id, template…"
            aria-label="Search reviews"
            onChange={setSearch}
          />
        </ToolbarActions>
      </div>

      <div className="fr-v3-divider" aria-hidden />

      <div className="fr-v3-scroll">
        <div className="fr-v3-layout">
          <aside className="fr-v3-queue" aria-label="Templates Ready for Review">
            {list.length === 0 ? (
              <div className="fr-v3-empty-state" data-kind={emptyKind}>
                <EmptyIllustration
                  title={emptyKind === "search" ? "No search results" : "No reviews"}
                  copy={
                    emptyKind === "search"
                      ? "No reviews match this filter. Try clearing search or switching to All."
                      : "No reviews in snapshot.review_queue. Waiting cycles will appear here."
                  }
                />
                {/* Class hooks retained for verify / CSS targeting */}
                <span className="fr-v3-empty-title fr-v3-empty-art" hidden aria-hidden />
                <span className="fr-v3-empty-copy" hidden aria-hidden />
              </div>
            ) : (
              <ul className="fr-v3-queue-list">
                {list.map((item) => {
                  const active = item.review_id === selectedId;
                  return (
                    <li key={item.review_id}>
                      <button
                        type="button"
                        className={active ? "fr-v3-card selected" : "fr-v3-card"}
                        onClick={() => {
                          setSelectedId(item.review_id);
                          setModeAction("idle");
                          setJsonOpen(false);
                          setLogsOpen(false);
                          setMessage(null);
                          setError(null);
                        }}
                      >
                        <div className="fr-v3-card-thumb fr-thumb">
                          {queueThumbnailSrc(item) ? (
                            <img
                              key={`thumb-${item.review_id}`}
                              src={queueThumbnailSrc(item)!}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              data-review-id={item.review_id}
                            />
                          ) : (
                            <span className="fr-v3-thumb-fallback">Preview unavailable</span>
                          )}
                        </div>
                        <div className="fr-v3-card-body">
                          <div className="fr-v3-card-title">{item.title}</div>
                          <div className="fr-v3-card-meta">
                            <Badge tone={badgeTone(item)} className={badgeClass(item)}>
                              {statusLabel(item.status)}
                            </Badge>
                            <span className="fr-v3-card-date">{formatDate(item.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="fr-v3-center fr-detail" aria-label="Review Detail">
            {!selected ? (
              <div className="fr-v3-empty-state fr-v3-empty-center">
                <EmptyIllustration
                  title="Select a resume to review"
                  copy="Choose an item from the queue to view its full preview. Open Review from the list."
                />
                <span className="fr-v3-empty-title fr-v3-empty-art" hidden aria-hidden />
                <span className="fr-v3-empty-copy" hidden aria-hidden />
              </div>
            ) : (
              <>
                {(() => {
                  const center = centerPreviewSrc(selected);
                  const pageW = Math.round(PREVIEW_PAGE_WIDTH * zoom);
                  const pageH = Math.round(PREVIEW_PAGE_HEIGHT * zoom);
                  return (
                <div
                  className="fr-v3-preview-wrap"
                  data-review-id={selected.review_id}
                  data-candidate-id={selected.candidate_id}
                  data-preview-path={center.preview_path ?? ""}
                  data-binding-ok={selectionBinding?.ok ? "1" : "0"}
                  data-zoom-mode={zoomMode}
                >
                  <div
                    className="fr-v3-zoom-bar"
                    role="toolbar"
                    aria-label="Resume preview zoom"
                  >
                    <button
                      type="button"
                      className="fr-v3-zoom-btn"
                      aria-label="Zoom out"
                      title="Zoom out (−)"
                      disabled={zoom <= ZOOM_MIN + 0.001}
                      onClick={() =>
                        setZoomManual(snapZoom((zoomManual ?? fitZoom) - ZOOM_STEP))
                      }
                    >
                      −
                    </button>
                    <span className="fr-v3-zoom-pct" aria-live="polite">
                      {formatZoomPercent(zoom)}
                    </span>
                    <button
                      type="button"
                      className="fr-v3-zoom-btn"
                      aria-label="Zoom in"
                      title="Zoom in (+)"
                      disabled={zoom >= ZOOM_MAX - 0.001}
                      onClick={() =>
                        setZoomManual(snapZoom((zoomManual ?? fitZoom) + ZOOM_STEP))
                      }
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={
                        zoomMode === "fit"
                          ? "fr-v3-zoom-btn fr-v3-zoom-fit is-active"
                          : "fr-v3-zoom-btn fr-v3-zoom-fit"
                      }
                      aria-label="Fit to view"
                      title="Fit to view (0)"
                      onClick={() => setZoomManual(null)}
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      className={
                        zoomManual != null && Math.abs(zoomManual - 1) < 0.001
                          ? "fr-v3-zoom-btn is-active"
                          : "fr-v3-zoom-btn"
                      }
                      aria-label="Zoom 100 percent"
                      title="100%"
                      onClick={() => setZoomManual(1)}
                    >
                      100%
                    </button>
                  </div>

                  <div
                    className={
                      zoomMode === "fit"
                        ? "fr-v3-preview-viewport is-fit"
                        : "fr-v3-preview-viewport"
                    }
                    ref={previewViewportRef}
                  >
                    <div
                      className="fr-v3-preview-stage"
                      style={{ width: pageW, height: pageH }}
                    >
                      <div
                        className="fr-v3-preview-a4"
                        style={{
                          width: PREVIEW_PAGE_WIDTH,
                          height: PREVIEW_PAGE_HEIGHT,
                          transform: `scale(${zoom})`,
                        }}
                      >
                        {center.mode === "full" && center.url && !previewBroken ? (
                          <>
                            {previewLoading ? (
                              <div className="fr-v3-preview-skeleton" aria-hidden>
                                <div className="fr-v3-skel-line" />
                                <div className="fr-v3-skel-line short" />
                                <div className="fr-v3-skel-block" />
                                <div className="fr-v3-skel-line" />
                                <div className="fr-v3-skel-line mid" />
                              </div>
                            ) : null}
                            <img
                              key={selected.review_id}
                              src={center.url}
                              alt={`${selected.title} resume preview`}
                              className={
                                previewLoading
                                  ? "fr-v3-preview-img loading"
                                  : "fr-v3-preview-img"
                              }
                              decoding="async"
                              onLoad={() => {
                                setPreviewLoading(false);
                                setPreviewBroken(false);
                              }}
                              onError={() => {
                                setPreviewLoading(false);
                                setPreviewBroken(true);
                              }}
                            />
                          </>
                        ) : center.mode === "thumbnail_only" ? (
                          <div className="fr-v3-preview-fallback fr-v3-preview-thumb-warn">
                            <EmptyIllustration
                              title="Full preview unavailable"
                              copy="Only a queue thumbnail exists for this review. Thumbnails are never upscaled in the center preview."
                            />
                          </div>
                        ) : previewBroken ? (
                          <div className="fr-v3-preview-fallback">
                            <EmptyIllustration
                              title="Preview unavailable"
                              copy="Resume preview failed to load for this review."
                            />
                          </div>
                        ) : (
                          <div className="fr-v3-preview-fallback">
                            <EmptyIllustration
                              title="Preview unavailable"
                              copy="No resume artifact for this review yet."
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                  );
                })()}

                <div className="fr-v3-under-preview">
                  <div className="fr-v3-selected-title">
                    <strong>{selected.title}</strong>
                    <Badge tone={badgeTone(selected)} className={badgeClass(selected)}>
                      {selected.revision?.revised
                        ? `Revision ${selected.revision.revision_number ?? 1} — Ready for Review`
                        : statusLabel(selected.status)}
                    </Badge>
                  </div>

                  {selected.revision?.revised ? (
                    <PageSection title="Revision Summary">
                      <SectionCard className="fr-v3-section">
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>
                            Role: {selected.revision.role ?? "—"}
                          </li>
                          <li>
                            Previous status:{" "}
                            {selected.revision.prior_status ?? "Changes Requested"}
                          </li>
                          <li>
                            Revision number:{" "}
                            {selected.revision.revision_number ?? 1}
                          </li>
                          <li>
                            Prior resume template:{" "}
                            {selected.revision.prior_candidate_id ?? "—"}
                          </li>
                          <li>
                            Prior decision:{" "}
                            {selected.revision.prior_decision_id ?? "—"}
                          </li>
                          <li>
                            Founder feedback addressed:{" "}
                            {(selected.revision.changes_applied ?? [])
                              .slice(0, 5)
                              .join(" · ") || "—"}
                          </li>
                          <li>
                            Original requested changes:{" "}
                            {(selected.revision.requested_changes ?? [])
                              .slice(0, 4)
                              .join(" · ") || "—"}
                          </li>
                        </ul>
                        <p className="muted" style={{ marginTop: 8 }}>
                          Approval is still manual. Use Approve, Request Changes, or
                          Reject below. Nothing publishes automatically.
                        </p>
                      </SectionCard>
                    </PageSection>
                  ) : null}

                  <div className="fr-v3-meta-row">
                    <div>
                      <span className="fr-v3-label">Resume Template</span>
                      <span className="fr-v3-value">
                        {selected.production_target?.title ||
                          selected.title ||
                          "—"}
                      </span>
                    </div>
                    <div>
                      <span className="fr-v3-label">Role · Category</span>
                      <span className="fr-v3-value">
                        {selected.production_target
                          ? `${selected.production_target.title} · ${selected.production_target.category}`
                          : selected.template || "—"}
                      </span>
                    </div>
                    <div title="Internal identifier">
                      <span className="fr-v3-label">Resume Template ID</span>
                      <span className="fr-v3-value" style={{ fontSize: "0.85em", opacity: 0.75 }}>
                        {selected.candidate_id || "—"}
                      </span>
                    </div>
                  </div>

                  <PageSection title="Critic Summary">
                    <SectionCard className="fr-v3-section">
                      <div className="fr-v3-score-tiles">
                        <div className="fr-v3-score-tile">
                          <span className="fr-v3-label">ATS</span>
                          <span className="fr-v3-score">{scoreValue(selected.critic?.ats)}</span>
                        </div>
                        <div className="fr-v3-score-tile">
                          <span className="fr-v3-label">Layout</span>
                          <span className="fr-v3-score">{scoreValue(selected.critic?.layout)}</span>
                        </div>
                        <div className="fr-v3-score-tile">
                          <span className="fr-v3-label">Visual</span>
                          <span className="fr-v3-score">{scoreValue(selected.critic?.visual)}</span>
                        </div>
                        <div className="fr-v3-score-tile">
                          <span className="fr-v3-label">Typography</span>
                          <span className="fr-v3-score">
                            {scoreValue(selected.critic?.typography)}
                          </span>
                        </div>
                        <div className="fr-v3-score-tile overall">
                          <span className="fr-v3-label">Overall</span>
                          <span className="fr-v3-score">
                            {scoreValue(selected.critic?.overall)}
                          </span>
                        </div>
                      </div>
                    </SectionCard>
                  </PageSection>

                  <PageSection title="Learning Impact">
                    <SectionCard className="fr-v3-section fr-v3-learning">
                      <p className="fr-v3-learning-copy">
                        {selected.learning_impact || "—"}
                      </p>
                    </SectionCard>
                  </PageSection>

                  <div className="fr-v3-accordions">
                    <details
                      className="fr-v3-accordion"
                      open={jsonOpen}
                      onToggle={(e) => setJsonOpen((e.target as HTMLDetailsElement).open)}
                    >
                      <summary>JSON</summary>
                      <pre className="mono fr-v3-json">
                        {JSON.stringify(selected, null, 2)}
                      </pre>
                    </details>

                    <details
                      className="fr-v3-accordion"
                      open={logsOpen}
                      onToggle={(e) => setLogsOpen((e.target as HTMLDetailsElement).open)}
                    >
                      <summary>Logs</summary>
                      <pre className="mono fr-v3-logs">
                        {[
                          `review_id: ${selected.review_id}`,
                          `cycle_id: ${selected.cycle_id}`,
                          `task_id: ${selected.task_id}`,
                          `source: ${selected.source}`,
                          `provider: ${selected.provider}`,
                          `department: ${selected.department}`,
                          selected.decision_id
                            ? `decision_id: ${selected.decision_id}`
                            : null,
                          selected.critic?.gate_id
                            ? `gate_id: ${selected.critic.gate_id}`
                            : null,
                          selected.critic?.critic_report_reference
                            ? `critic_report: ${selected.critic.critic_report_reference}`
                            : null,
                          selected.critic?.blocking_reasons?.length
                            ? `blocking: ${selected.critic.blocking_reasons.join("; ")}`
                            : "blocking: none",
                          selected.preview_path
                            ? `preview_path: ${selected.preview_path}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join("\n")}
                      </pre>
                    </details>
                  </div>

                  {normalizeStatus(selected.status) === "approved" ||
                  stagingInfo?.lifecycle_status === "APPROVED" ||
                  stagingInfo?.lifecycle_status === "STAGED" ||
                  stagingInfo?.lifecycle_status === "VALIDATED" ||
                  stagingInfo?.lifecycle_status === "STAGING_FAILED" ||
                  stagingInfo?.lifecycle_status === "STAGING_REQUESTED" ||
                  stagingInfo?.lifecycle_status === "STAGING" ||
                  stagingInfo?.lifecycle_status === "PUBLISHED" ||
                  stagingInfo?.lifecycle_status === "PUBLISHING" ||
                  stagingInfo?.lifecycle_status === "PUBLICATION_FAILED" ? (
                    <div className="fr-v3-staging-panel" style={{ marginTop: 12 }}>
                      <p className="muted" style={{ marginBottom: 6 }}>
                        Staging:{" "}
                        {statusLabel(
                          stagingInfo?.lifecycle_status ?? selected.status,
                        )}
                        {" · "}
                        publication_allowed=false
                      </p>
                      {pubInfo?.status_label ? (
                        <p className="muted">
                          Publication: {pubInfo.status_label}
                          {pubInfo.plan_id ? ` · plan ${pubInfo.plan_id}` : ""}
                          {pubInfo.catalogue_id
                            ? ` · ${pubInfo.catalogue_id}`
                            : ""}
                        </p>
                      ) : null}
                      {pubInfo?.live_url ? (
                        <p className="muted">
                          Live:{" "}
                          <a href={pubInfo.live_url} target="_blank" rel="noreferrer">
                            {pubInfo.live_url}
                          </a>
                        </p>
                      ) : null}
                      {stagingInfo?.generation_id ? (
                        <p className="muted">
                          Generation ID: {stagingInfo.generation_id}
                        </p>
                      ) : null}
                      {stagingInfo?.staging_package_id ? (
                        <>
                          <p className="muted">
                            Package: {stagingInfo.staging_package_id}
                          </p>
                          <p className="muted">
                            Path: {stagingInfo.staging_path ?? "—"}
                          </p>
                          <p className="muted">
                            Checksums:{" "}
                            {stagingInfo.validation?.checks?.checksums_match ===
                            false
                              ? "FAILED"
                              : stagingInfo.validation
                                ? "verified"
                                : "—"}
                          </p>
                          <p className="muted">
                            Validation:{" "}
                            {stagingInfo.validation?.pass === true
                              ? "PASS"
                              : stagingInfo.validation?.pass === false
                                ? "FAIL"
                                : "—"}
                            {stagingInfo.validation?.checked_at
                              ? ` · ${stagingInfo.validation.checked_at}`
                              : ""}
                          </p>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {isRevisionFailed(selected.status) ? (
                    <p className="muted fr-v3-closed">
                      Revision failed. No revised Resume Template was produced.
                      You may submit new changes or reject.
                    </p>
                  ) : !isWaitingFounder(selected.status) &&
                    normalizeStatus(selected.status) !== "approved" &&
                    !stagingInfo?.lifecycle_status ? (
                    <p className="muted fr-v3-closed">
                      This review is closed. No further founder action.
                    </p>
                  ) : null}

                  <SecondaryButton
                    size="sm"
                    className="fr-v3-back muted"
                    onClick={() => {
                      setSelectedId(null);
                      setModeAction("idle");
                      setReason("");
                      setChanges("");
                      setJsonOpen(false);
                      setLogsOpen(false);
                    }}
                  >
                    ← Templates Ready for Review
                  </SecondaryButton>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Action bar only after Founder manually selects a review */}
      {selected ? (
        <StickyFooter
          className={busy ? "fr-sticky-actions is-busy" : "fr-sticky-actions"}
          busy={busy}
          aria-label="Founder review actions"
        >
          <div className="fr-v3-actions">
            <DangerButton
              className="fr-btn fr-action-reject"
              disabled={busy || !canRequestOrReject(selected.status)}
              onClick={() => setModeAction("reject")}
            >
              Reject
            </DangerButton>
            <SecondaryButton
              className="fr-btn fr-action-changes"
              disabled={busy || !canRequestOrReject(selected.status)}
              onClick={() => setModeAction("changes")}
            >
              Request Changes
            </SecondaryButton>
            <PrimaryButton
              className="fr-btn fr-action-approve"
              disabled={busy || !canApprove(selected.status)}
              onClick={() => setModeAction("approve")}
            >
              Approve
            </PrimaryButton>
            {(normalizeStatus(selected.status) === "approved" ||
              stagingInfo?.lifecycle_status === "APPROVED" ||
              stagingInfo?.lifecycle_status === "STAGING_FAILED") &&
            stagingInfo?.lifecycle_status !== "STAGED" &&
            stagingInfo?.lifecycle_status !== "VALIDATED" &&
            stagingInfo?.lifecycle_status !== "PUBLISHED" &&
            stagingInfo?.lifecycle_status !== "PUBLISHING" &&
            !pubInfo?.plan_id ? (
              <PrimaryButton
                className="fr-btn fr-action-stage"
                disabled={busy}
                onClick={() => {
                  void openStageConfirm();
                }}
              >
                {stagingInfo?.lifecycle_status === "STAGING_FAILED"
                  ? "Retry Staging"
                  : "Stage for StudiosisLab"}
              </PrimaryButton>
            ) : null}
            {stagingInfo?.lifecycle_status === "VALIDATED" &&
            !pubInfo?.plan_id &&
            pubInfo?.status_label !== "PUBLISHED" ? (
              <Badge tone="ready">Staged</Badge>
            ) : null}
            {pubInfo?.status_label === "PLANNED" ||
            pubInfo?.status_label === "VERIFIED" ? (
              <Badge tone="ready">
                Publication Ready
                {pubInfo.catalogue_id ? ` · ${pubInfo.catalogue_id}` : ""}
              </Badge>
            ) : null}
            {pubInfo?.status_label === "PUBLISHING" ? (
              <Badge tone="processing">Publishing</Badge>
            ) : null}
            {pubInfo?.status_label === "PUBLICATION_FAILED" ? (
              <Badge tone="blocked">Publication Failed</Badge>
            ) : null}
            {(releaseInfo?.can_release || releaseInfo?.ready_for_release) &&
            !pubInfo?.plan_id ? (
              <>
                <PrimaryButton
                  className="fr-btn fr-action-release"
                  disabled={busy}
                  onClick={() => setReleaseConfirmOpen(true)}
                >
                  Release
                </PrimaryButton>
                <SecondaryButton
                  disabled={busy}
                  onClick={() => {
                    void openReleasePlan();
                  }}
                >
                  View Publication Plan
                </SecondaryButton>
                <SecondaryButton
                  disabled={busy || !releaseInfo?.export_package_id}
                  onClick={() => {
                    void openReleaseDryRun();
                  }}
                >
                  View Dry Run
                </SecondaryButton>
              </>
            ) : null}
            {pubInfo?.plan_id &&
            pubInfo.status_label !== "PUBLISHED" &&
            (releaseInfo?.can_release || releaseInfo?.ready_for_release) ? (
              <Badge tone="blocked">
                In multi-plan {pubInfo.plan_id} — use aios:publication:apply
              </Badge>
            ) : null}
            {releaseInfo?.reservation_status === "RELEASE_COMPLETED" ||
            pubInfo?.status_label === "PUBLISHED" ||
            stagingInfo?.lifecycle_status === "PUBLISHED" ? (
              <Badge tone="ready">
                Published
                {pubInfo?.catalogue_id || releaseInfo?.catalogue_id
                  ? ` · ${pubInfo?.catalogue_id ?? releaseInfo?.catalogue_id}`
                  : ""}
              </Badge>
            ) : null}
          </div>

          {stageConfirmOpen ? (
            <div
              className="fr-v3-stage-confirm"
              role="dialog"
              aria-label="Confirm staging"
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid var(--ds-border, #ccc)",
                borderRadius: 6,
              }}
            >
              <p>
                <strong>Confirm Stage for StudiosisLab</strong>
              </p>
              <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
                <li>Title: {stageMeta?.title ?? selected.title}</li>
                <li>Role: {stageMeta?.role ?? "—"}</li>
                <li>Design family: {stageMeta?.design_family ?? "—"}</li>
                <li>Resume Template ID: {selected.candidate_id}</li>
                <li>
                  Generation ID: {stagingInfo?.generation_id ?? "(will assign)"}
                </li>
                <li>
                  Provider/model: {stageMeta?.provider ?? selected.provider} /{" "}
                  {stageMeta?.model ?? "—"}
                </li>
                <li>
                  Approval timestamp:{" "}
                  {stageMeta?.approved_at ?? new Date().toISOString()}
                </li>
                <li>
                  Decision ID: {selected.decision_id ?? "(from lifecycle)"}
                </li>
              </ul>
              <p className="muted">
                Staging does not publish this template. It creates an immutable
                package only. publication_allowed remains false. No website
                write. No catalogue ID.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <PrimaryButton
                  disabled={busy}
                  onClick={() => {
                    void confirmStage();
                  }}
                >
                  {busy ? "Staging…" : "Confirm staging"}
                </PrimaryButton>
                <SecondaryButton
                  disabled={busy}
                  onClick={() => setStageConfirmOpen(false)}
                >
                  Cancel
                </SecondaryButton>
              </div>
            </div>
          ) : null}

          {releaseConfirmOpen ? (
            <div
              className="fr-v3-release-confirm"
              role="dialog"
              aria-label="Confirm Founder release"
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid var(--ds-border, #ccc)",
                borderRadius: 6,
              }}
            >
              <p>
                <strong>Confirm Release to StudiosisLab</strong>
              </p>
              <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
                <li>Title: {releaseInfo?.plan?.title ?? selected.title}</li>
                <li>Catalogue ID: {releaseInfo?.catalogue_id ?? "—"}</li>
                <li>
                  SEO slug:{" "}
                  {releaseInfo?.plan?.seo_slug_resolved ??
                    releaseInfo?.plan?.seo_slug ??
                    "—"}
                </li>
                <li>Category: {releaseInfo?.plan?.category_id ?? "—"}</li>
                <li>
                  Assets:{" "}
                  {(releaseInfo?.plan?.assets ?? []).join(", ") || "PNG/WebP"}
                </li>
                {(releaseInfo?.plan?.risk_summary ?? []).map((r) => (
                  <li key={r}>Risk: {r}</li>
                ))}
              </ul>
              <p className="muted">
                This writes the live catalogue. Confirmation phrase{" "}
                <code>RELEASE_TO_STUDIOSISLAB</code> is required. No automatic
                continuous release.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <PrimaryButton
                  disabled={busy}
                  onClick={() => {
                    void confirmRelease();
                  }}
                >
                  {busy ? "Releasing…" : "Confirm release"}
                </PrimaryButton>
                <SecondaryButton
                  disabled={busy}
                  onClick={() => setReleaseConfirmOpen(false)}
                >
                  Cancel
                </SecondaryButton>
              </div>
            </div>
          ) : null}

          {releasePlanOpen && releaseInfo?.plan ? (
            <div
              role="dialog"
              aria-label="Publication plan"
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid var(--ds-border, #ccc)",
                borderRadius: 6,
              }}
            >
              <p>
                <strong>Publication Plan</strong>
              </p>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  maxHeight: 220,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(releaseInfo.plan, null, 2)}
              </pre>
              <SecondaryButton onClick={() => setReleasePlanOpen(false)}>
                Close
              </SecondaryButton>
            </div>
          ) : null}

          {releaseDryRunOpen && releaseDryRunJson ? (
            <div
              role="dialog"
              aria-label="Publication dry run"
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid var(--ds-border, #ccc)",
                borderRadius: 6,
              }}
            >
              <p>
                <strong>View Dry Run</strong>
              </p>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  maxHeight: 220,
                  overflow: "auto",
                }}
              >
                {releaseDryRunJson}
              </pre>
              <SecondaryButton onClick={() => setReleaseDryRunOpen(false)}>
                Close
              </SecondaryButton>
            </div>
          ) : null}

          {(message || error) && modeAction === "idle" ? (
            <div className="fr-v3-sticky-feedback">
              {message ? <p className="ok fr-v3-feedback">{message}</p> : null}
              {error ? <p className="fail fr-v3-feedback">{error}</p> : null}
            </div>
          ) : null}

          {(isWaitingFounder(selected.status) ||
            (isRevisionFailed(selected.status) && modeAction !== "approve")) &&
          modeAction !== "idle" ? (
            <div className="fr-v3-action-form">
              {message ? <p className="ok fr-v3-feedback">{message}</p> : null}
              {error ? <p className="fail fr-v3-feedback">{error}</p> : null}
              <label>
                {modeAction === "approve"
                  ? "Optional observation"
                  : "Required reason / feedback"}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  disabled={busy}
                />
              </label>
              {modeAction === "changes" ? (
                <label>
                  Requested changes (one per line)
                  <textarea
                    value={changes}
                    onChange={(e) => setChanges(e.target.value)}
                    rows={2}
                    disabled={busy}
                  />
                </label>
              ) : null}
              <PrimaryButton
                className="fr-btn fr-btn-submit"
                disabled={busy}
                onClick={() => {
                  // decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"
                  void submit(
                    modeAction === "approve"
                      ? "APPROVED"
                      : modeAction === "reject"
                        ? "REJECTED"
                        : "CHANGES_REQUESTED",
                  );
                }}
              >
                {busy ? (
                  <span className="fr-btn-loading">
                    <span className="fr-btn-spinner" aria-hidden />
                    Submitting…
                  </span>
                ) : (
                  `Submit ${modeAction}`
                )}
              </PrimaryButton>
            </div>
          ) : null}
        </StickyFooter>
      ) : null}

      {/* Persist feedback after panel closes (e.g. Request Changes / Reject success). */}
      {!selected && (message || error) ? (
        <div className="fr-v3-feedback-banner" role="status">
          {message ? <p className="ok fr-v3-feedback">{message}</p> : null}
          {error ? <p className="fail fr-v3-feedback">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
