/**
 * Department Registry — Agent #180.
 * Contracts only. Never executes.
 */
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  EmptyIllustration,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  SecondaryButton,
  SectionCard,
} from "../design-system";

type Props = {
  snapshot: DashboardSnapshot;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
};

type DeptSummary = {
  department_id: string;
  department_name: string;
  department_type: string;
  version: string;
  status: string;
  director_id: string;
  manager_count: number;
  worker_count: number;
  capability_count: number;
  reference: boolean;
  placeholder: boolean;
  validation_ok: boolean;
};

type ListPayload = {
  departments: DeptSummary[];
};

export function DepartmentRegistryView({
  snapshot,
  onBack,
  onRefresh,
}: Props) {
  const [data, setData] = useState<ListPayload | null>(null);
  const [selected, setSelected] = useState<string | null>("resume");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/departments", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ListPayload;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(
        `/api/platform/departments/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail((await res.json()) as Record<string, unknown>);
    } catch (e) {
      setDetail({ error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
  }, [selected, loadDetail]);

  const departments = data?.departments ?? [];
  const reg = snapshot.company_brain?.department_registry;

  return (
    <div className="ds-stack">
      <PageHeader
        title="Department Registry"
        subtitle="Canonical Department SDK · contracts only · execution remains impossible · LIVE OFF"
        actions={
          <SecondaryButton
            size="sm"
            onClick={() => {
              void onRefresh();
              void load();
            }}
          >
            Refresh
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="EXECUTION DISABLED">
        execution_allowed=false · dispatch_allowed=false · worker_spawn_allowed=false
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        live_enabled=false · Skills → Brain Router → Providers sealed
      </AlertBanner>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SecondaryButton size="sm" onClick={onBack}>
          Back to Mission Control
        </SecondaryButton>
      </div>

      {error && !data ? (
        <EmptyIllustration title="Failed to load registry" copy={error} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <KPIStatCard
              value={String(
                departments.length || reg?.department_count || 0,
              )}
              label="Registered"
              tone="neutral"
            />
            <KPIStatCard
              value={String(
                departments.filter((d) => d.status === "READY").length ||
                  reg?.ready_count ||
                  0,
              )}
              label="Ready"
              tone="positive"
            />
            <KPIStatCard
              value={String(
                departments.filter((d) => d.placeholder).length ||
                  reg?.placeholder_count ||
                  0,
              )}
              label="Placeholders"
              tone="neutral"
            />
            <KPIStatCard
              value={reg?.reference_department_id ?? "resume"}
              label="Reference"
              tone="neutral"
            />
          </MetricGrid>

          <PageSection title="Registered Departments">
            <SectionCard>
              <div className="ds-stack" style={{ gap: 8 }}>
                {departments.map((d) => (
                  <button
                    key={d.department_id}
                    type="button"
                    className="ds-row-between"
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      background:
                        selected === d.department_id
                          ? "var(--ds-surface-2, #eee)"
                          : "transparent",
                      border: "none",
                      padding: 8,
                      width: "100%",
                    }}
                    onClick={() => setSelected(d.department_id)}
                  >
                    <span>
                      <strong>{d.department_name}</strong>{" "}
                      <span className="ds-meta">({d.department_id})</span>
                      {d.reference ? (
                        <Badge>REFERENCE</Badge>
                      ) : null}
                      {d.placeholder ? (
                        <Badge>placeholder</Badge>
                      ) : null}
                    </span>
                    <span className="ds-meta">
                      {d.status} · M{d.manager_count} · W{d.worker_count} · C
                      {d.capability_count} · v{d.version}
                      {d.validation_ok ? " · valid" : " · invalid"}
                    </span>
                  </button>
                ))}
                {!departments.length ? (
                  <p className="ds-meta">No departments loaded yet.</p>
                ) : null}
              </div>
            </SectionCard>
          </PageSection>

          {selected && detail ? (
            <PageSection title={`Department · ${selected}`}>
              <SectionCard>
                <pre
                  style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}
                >
                  {JSON.stringify(
                    {
                      status: (detail.department as { status?: string })
                        ?.status,
                      director: detail.director,
                      manager_count: Array.isArray(detail.managers)
                        ? detail.managers.length
                        : 0,
                      worker_count: Array.isArray(detail.workers)
                        ? detail.workers.length
                        : 0,
                      capability_count: Array.isArray(detail.capabilities)
                        ? detail.capabilities.length
                        : 0,
                      validation: detail.validation,
                    },
                    null,
                    2,
                  )}
                </pre>
              </SectionCard>
            </PageSection>
          ) : null}
        </>
      )}
    </div>
  );
}
