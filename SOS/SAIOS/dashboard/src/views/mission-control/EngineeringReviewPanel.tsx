/**
 * Mission Control Engineering Review panel — Agent #224.
 * Reuses Engineering Intelligence report. Status overlay only. No execution.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, EmptyIllustration, SecondaryButton } from "../../design-system";
import {
  FreshnessIndicator,
  McMetricCard,
  McSectionHeader,
  RecommendationCard,
} from "./components";
import type { FreshnessStatus } from "../../data/founderCommandCenterTypes";

type ReviewStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "DEFERRED";

type ReviewItem = {
  recommendation_id: string;
  title: string;
  category: string;
  severity: string;
  confidence: number;
  supporting_evidence: string[];
  affected_components: string[];
  affected_files: string[];
  risk: string;
  estimated_benefit: string;
  suggested_action: string;
  requires_founder_approval: boolean;
  founder_status: ReviewStatus;
  status_updated_at: string | null;
};

type ReviewProjection = {
  overall_score: number | null;
  report_generated_at: string | null;
  recommendations: ReviewItem[];
  counts: {
    open: number;
    under_review: number;
    approved: number;
    rejected: number;
    deferred: number;
    total: number;
  };
  newest_findings: string[];
  live: boolean;
  publication_allowed: boolean;
};

const CATEGORIES = [
  "architecture",
  "code_quality",
  "performance",
  "storage",
  "documentation",
  "verification",
  "dependencies",
  "legacy",
] as const;

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

type SortKey = "severity" | "confidence" | "estimated_benefit" | "category";

const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function EngineeringReviewPanel({
  scoreFreshness,
  overallFromSnap,
}: {
  scoreFreshness: FreshnessStatus;
  overallFromSnap: number | null;
}) {
  const [proj, setProj] = useState<ReviewProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/engineering-review", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ReviewProjection;
      setProj(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(() => {
    if (!proj || !selectedId) return null;
    return (
      proj.recommendations.find((r) => r.recommendation_id === selectedId) ??
      null
    );
  }, [proj, selectedId]);

  const filtered = useMemo(() => {
    if (!proj) return [];
    let rows = [...proj.recommendations];
    if (category !== "all") {
      rows = rows.filter((r) => r.category === category);
    }
    if (severity !== "all") {
      rows = rows.filter((r) => r.severity === severity);
    }
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.founder_status === statusFilter);
    }
    rows.sort((a, b) => {
      if (sortKey === "severity") {
        return (
          (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9) ||
          a.recommendation_id.localeCompare(b.recommendation_id)
        );
      }
      if (sortKey === "confidence") {
        return b.confidence - a.confidence;
      }
      if (sortKey === "estimated_benefit") {
        return a.estimated_benefit.localeCompare(b.estimated_benefit);
      }
      return a.category.localeCompare(b.category);
    });
    return rows;
  }, [proj, category, severity, statusFilter, sortKey]);

  async function setStatus(status: ReviewStatus) {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/engineering-review-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_id: selectedId,
          status,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const counts = proj?.counts;
  const overall = proj?.overall_score ?? overallFromSnap;

  return (
    <section className="mc-row-block" aria-label="Engineering review">
      <McSectionHeader
        title="Engineering Review"
        subtitle="Founder review of Engineering Intelligence recommendations — no execution"
        actions={
          <Badge tone="waiting" className="mono">
            Advisory Only
          </Badge>
        }
      />

      {loading && !proj ? (
        <p className="muted mono">Loading engineering report…</p>
      ) : error && !proj ? (
        <article className="mc-card">
          <EmptyIllustration
            title="Engineering report unavailable"
            copy={error}
          />
        </article>
      ) : (
        <>
          <div className="mc-row mc-row-5">
            <McMetricCard
              label="Overall Engineering Score"
              value={overall == null ? "—" : String(overall)}
              freshness={scoreFreshness}
              empty={overall == null}
            />
            <McMetricCard
              label="Open Recommendations"
              value={String(counts?.open ?? "—")}
              freshness={scoreFreshness}
            />
            <McMetricCard
              label="Approved"
              value={String(counts?.approved ?? "—")}
              freshness={scoreFreshness}
            />
            <McMetricCard
              label="Rejected"
              value={String(counts?.rejected ?? "—")}
              freshness={scoreFreshness}
            />
            <McMetricCard
              label="Deferred"
              value={String(counts?.deferred ?? "—")}
              freshness={scoreFreshness}
            />
          </div>
          <div className="mc-row mc-row-3" style={{ marginTop: 12 }}>
            <McMetricCard
              label="Under Review"
              value={String(counts?.under_review ?? "—")}
              freshness={scoreFreshness}
            />
            <McMetricCard
              label="Newest Findings"
              value={String(proj?.newest_findings?.length ?? 0)}
              freshness={scoreFreshness}
              detail={proj?.newest_findings?.slice(0, 2).join(", ") || "none"}
            />
            <McMetricCard
              label="Latest analysis"
              value={
                proj?.report_generated_at
                  ? new Date(proj.report_generated_at).toLocaleString()
                  : "—"
              }
              freshness={scoreFreshness}
            />
          </div>

          <div className="mc-eng-review-controls">
            <label className="mc-eng-filter">
              <span>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="mc-eng-filter">
              <span>Severity</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="all">All</option>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="mc-eng-filter">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="OPEN">OPEN</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="DEFERRED">DEFERRED</option>
              </select>
            </label>
            <label className="mc-eng-filter">
              <span>Sort</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="severity">Severity</option>
                <option value="confidence">Confidence</option>
                <option value="estimated_benefit">Estimated Benefit</option>
                <option value="category">Category</option>
              </select>
            </label>
            <SecondaryButton size="sm" onClick={() => void refresh()}>
              Refresh
            </SecondaryButton>
          </div>

          <div className="mc-eng-review-split">
            <div className="mc-eng-review-list">
              {filtered.length === 0 ? (
                <EmptyIllustration
                  title="No recommendations"
                  copy="No items match the current filters."
                />
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.recommendation_id}
                    type="button"
                    className={`mc-eng-rec-btn${selectedId === r.recommendation_id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(r.recommendation_id)}
                  >
                    <RecommendationCard
                      id={r.recommendation_id}
                      title={r.title}
                      body={`${r.category} · ${r.severity} · ${r.founder_status}`}
                      severity={r.severity}
                    />
                  </button>
                ))
              )}
            </div>

            <article className="mc-card mc-eng-detail">
              {!selected ? (
                <EmptyIllustration
                  title="Select a recommendation"
                  copy="Detail appears here. Status changes never execute actions."
                />
              ) : (
                <>
                  <div className="mc-card-top">
                    <h3 className="mc-card-heading">{selected.title}</h3>
                    <FreshnessIndicator status={scoreFreshness} compact />
                  </div>
                  <dl className="mc-eng-dl">
                    <div>
                      <dt>Category</dt>
                      <dd className="mono">{selected.category}</dd>
                    </div>
                    <div>
                      <dt>Severity</dt>
                      <dd className="mono">{selected.severity}</dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd className="mono">{selected.confidence}</dd>
                    </div>
                    <div>
                      <dt>Current Status</dt>
                      <dd className="mono">{selected.founder_status}</dd>
                    </div>
                    <div>
                      <dt>Founder Approval Required</dt>
                      <dd className="mono">
                        {selected.requires_founder_approval ? "yes" : "no"}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated Benefit</dt>
                      <dd>{selected.estimated_benefit}</dd>
                    </div>
                    <div>
                      <dt>Risk</dt>
                      <dd>{selected.risk}</dd>
                    </div>
                    <div>
                      <dt>Suggested Action</dt>
                      <dd>{selected.suggested_action}</dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd className="mono">
                        {selected.supporting_evidence?.length
                          ? selected.supporting_evidence.join(" · ")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Affected Components</dt>
                      <dd className="mono">
                        {selected.affected_components?.join(", ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Affected Files</dt>
                      <dd className="mono">
                        {selected.affected_files?.length
                          ? selected.affected_files.join(", ")
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  <p className="mc-card-detail muted" style={{ marginTop: 12 }}>
                    Status updates persist review metadata only — never modify
                    code, cleanup, production, or architecture.
                  </p>

                  <div className="mc-eng-status-actions">
                    {(
                      [
                        "OPEN",
                        "UNDER_REVIEW",
                        "APPROVED",
                        "REJECTED",
                        "DEFERRED",
                      ] as ReviewStatus[]
                    ).map((s) => (
                      <SecondaryButton
                        key={s}
                        size="sm"
                        disabled={busy || selected.founder_status === s}
                        onClick={() => void setStatus(s)}
                      >
                        {s}
                      </SecondaryButton>
                    ))}
                  </div>
                  {error ? (
                    <p className="mc-card-detail" style={{ color: "var(--ds-status-rejected)" }}>
                      {error}
                    </p>
                  ) : null}
                </>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
