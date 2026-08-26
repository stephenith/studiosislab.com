/**
 * Execution Controller Scaffold — Agent #179.
 * Structural framework only. Never executes.
 */
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  EmptyIllustration,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StickyFooter,
} from "../design-system";

type Props = {
  snapshot: DashboardSnapshot;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
};

type ControllerPayload = {
  record: {
    controller_id: string;
    mission_id: string;
    mission_version: number;
    runtime_plan_id: string;
    runtime_release_id: string;
    system_readiness_id: string;
    department: string;
    architecture_version: string;
    governance_version: string;
    controller_status: string;
    checksum_chain: Record<string, string>;
    worker_inventory: {
      declared: string[];
      resolved: string[];
      missing: string[];
      informational: boolean;
      invoked: boolean;
    };
    estimated_cost_usd: number | null;
    estimated_duration_ms: number | null;
    telemetry: { enabled: boolean; run_id: string | null };
    rollback: { implemented: boolean; points: string[] };
    retry: { implemented: boolean; policy: string; max_attempts: number };
    safety_flags: Record<string, boolean>;
    next_safe_action: string;
    founder: string;
  } | null;
  mission_status: string | null;
  controller_status: string | null;
  history: Array<{
    at: string;
    from_status: string;
    to_status: string;
    reason: string;
  }>;
  error?: string;
};

export function ExecutionControllerView({
  snapshot,
  onBack,
  onRefresh,
}: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<ControllerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!missionId) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/runtime/execution-controller/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ControllerPayload;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [missionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const record =
    data?.record ??
    (snapshot.company_brain?.latest_execution_controller
      ? {
          controller_id:
            snapshot.company_brain.latest_execution_controller.controller_id ??
            "—",
          mission_id:
            snapshot.company_brain.latest_execution_controller.mission_id ??
            missionId ??
            "—",
          mission_version: 0,
          runtime_plan_id:
            snapshot.company_brain.latest_execution_controller
              .runtime_plan_id ?? "—",
          runtime_release_id:
            snapshot.company_brain.latest_execution_controller
              .runtime_release_id ?? "—",
          system_readiness_id:
            snapshot.company_brain.latest_execution_controller
              .system_readiness_id ?? "—",
          department: "—",
          architecture_version: "—",
          governance_version: "—",
          controller_status:
            snapshot.company_brain.latest_execution_controller
              .controller_status ??
            snapshot.company_brain.execution_controller_status ??
            "—",
          checksum_chain: {
            plan_checksum:
              snapshot.company_brain.latest_execution_controller
                .plan_checksum ?? "",
            readiness_checksum:
              snapshot.company_brain.latest_execution_controller
                .readiness_checksum ?? "",
          },
          worker_inventory: {
            declared: [],
            resolved: [],
            missing: [],
            informational: true,
            invoked: false,
          },
          estimated_cost_usd: null,
          estimated_duration_ms: null,
          telemetry: { enabled: false, run_id: null },
          rollback: { implemented: false, points: [] },
          retry: {
            implemented: false,
            policy: "exponential_backoff_capped",
            max_attempts: 3,
          },
          safety_flags: {},
          next_safe_action:
            snapshot.company_brain.latest_execution_controller
              .next_safe_action ?? "—",
          founder: "stephen",
        }
      : null);

  const status =
    record?.controller_status ??
    snapshot.company_brain?.execution_controller_status ??
    data?.controller_status;

  const canAuthorize =
    Boolean(missionId) &&
    Boolean(record) &&
    (status === "WAITING_EXECUTION_AUTHORIZATION" ||
      status === "EXECUTION_CONTROLLER_BLOCKED") &&
    data?.mission_status === "SYSTEM_READY";

  async function authorizeScaffold(
    decision:
      | "APPROVE_CONTROLLER_SCAFFOLD"
      | "BLOCK_CONTROLLER_SCAFFOLD",
  ) {
    if (!missionId || !record || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/runtime/execution-controller/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: missionId,
          mission_version:
            data?.record?.mission_version ??
            snapshot.company_brain?.current_mission?.mission_version ??
            0,
          controller_id: record.controller_id,
          decision,
          actor: "stephen",
          reason:
            reason.trim() ||
            (decision === "APPROVE_CONTROLLER_SCAFFOLD"
              ? "Authorize execution-controller scaffold"
              : "Block execution-controller scaffold"),
        }),
      });
      const body = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || body.ok === false) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setReason("");
      await onRefresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ds-stack">
      <PageHeader
        title="Execution Controller"
        subtitle="Scaffold only · future sole execution authority · execution remains impossible · LIVE OFF"
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
      <AlertBanner tone="warn" title="QUEUE DISABLED">
        queue_insert_allowed=false · QueueManager untouched
      </AlertBanner>
      <AlertBanner tone="warn" title="PROVIDERS DISABLED">
        provider_allowed=false
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        live_enabled=false · STOP after EXECUTION_CONTROLLER_READY
      </AlertBanner>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SecondaryButton size="sm" onClick={onBack}>
          Back to Mission Control
        </SecondaryButton>
      </div>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Certify System Readiness (SYSTEM_READY), then open Execution Controller."
        />
      ) : error && !data && !record ? (
        <EmptyIllustration title="Failed to load controller" copy={error} />
      ) : (
        <>
          {error ? (
            <InfoBanner title="Notice">{error}</InfoBanner>
          ) : null}

          <MetricGrid columns={4}>
            <KPIStatCard
              value={status ?? "—"}
              label="Controller Status"
              tone={
                status === "EXECUTION_CONTROLLER_READY"
                  ? "positive"
                  : status === "EXECUTION_CONTROLLER_BLOCKED"
                    ? "critical"
                    : "neutral"
              }
            />
            <KPIStatCard
              value={data?.mission_status ?? "—"}
              label="Mission Status"
              tone="neutral"
            />
            <KPIStatCard
              value={record?.department ?? "—"}
              label="Department"
              tone="neutral"
            />
            <KPIStatCard
              value={record?.controller_id ?? "—"}
              label="Controller ID"
              tone="neutral"
            />
          </MetricGrid>

          <PageSection title="Controller Summary">
            <SectionCard>
              <div className="ds-stack" style={{ gap: 8 }}>
                <div>
                  <Badge>
                    {record?.next_safe_action ?? "—"}
                  </Badge>
                </div>
                <p className="ds-meta">
                  Plan: {record?.runtime_plan_id ?? "—"} · Release:{" "}
                  {record?.runtime_release_id ?? "—"} · Readiness:{" "}
                  {record?.system_readiness_id ?? "—"}
                </p>
                <p className="ds-meta">
                  Architecture: {record?.architecture_version ?? "—"} ·
                  Governance: {record?.governance_version ?? "—"}
                </p>
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Checksum Chain">
            <SectionCard>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                {JSON.stringify(record?.checksum_chain ?? {}, null, 2)}
              </pre>
            </SectionCard>
          </PageSection>

          <PageSection title="Future Worker Inventory">
            <SectionCard>
              <p className="ds-meta">
                Declared: {(record?.worker_inventory.declared ?? []).join(", ") || "—"}
              </p>
              <p className="ds-meta">
                Invoked: {String(record?.worker_inventory.invoked ?? false)} ·
                Informational only
              </p>
            </SectionCard>
          </PageSection>

          <PageSection title="Future Telemetry / Rollback / Retry">
            <SectionCard>
              <p className="ds-meta">
                Telemetry enabled: {String(record?.telemetry.enabled ?? false)}
              </p>
              <p className="ds-meta">
                Rollback implemented:{" "}
                {String(record?.rollback.implemented ?? false)}
              </p>
              <p className="ds-meta">
                Retry implemented: {String(record?.retry.implemented ?? false)}{" "}
                · {record?.retry.policy ?? "—"}
              </p>
            </SectionCard>
          </PageSection>

          {canAuthorize ? (
            <StickyFooter>
              <div className="ds-stack" style={{ gap: 8, width: "100%" }}>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  rows={2}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <PrimaryButton
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void authorizeScaffold("APPROVE_CONTROLLER_SCAFFOLD")
                    }
                  >
                    Authorize Scaffold
                  </PrimaryButton>
                  <SecondaryButton
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void authorizeScaffold("BLOCK_CONTROLLER_SCAFFOLD")
                    }
                  >
                    Block Scaffold
                  </SecondaryButton>
                </div>
              </div>
            </StickyFooter>
          ) : null}
        </>
      )}
    </div>
  );
}
