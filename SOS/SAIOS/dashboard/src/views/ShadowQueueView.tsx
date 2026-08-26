/**
 * Shadow Queue view — Agent #168.
 * Isolated shadow receiver. Never dispatches or executes.
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

type ShadowPayload = {
  record: {
    shadow_queue_id: string;
    submission_id: string;
    mission_id: string;
    mission_version: number;
    execution_package_id: string;
    execution_package_checksum: string;
    acknowledgement_id: string;
    acknowledgement_checksum: string;
    submission_checksum: string;
    department: string;
    priority: string;
    received_timestamp: string;
    status: string;
    validation_summary: string;
    warnings: string[];
    shadow: true;
    dispatch_allowed: false;
    execution_allowed: false;
    publishing_allowed: false;
    next_safe_action: string;
  } | null;
  submission: {
    submission_id: string;
    mission_id: string;
    mission_version: number;
    submission_checksum: string;
    department: string;
    priority: string;
    execution_package_checksum: string;
    acknowledgement_checksum: string;
  } | null;
  mission_status: string | null;
  error?: string;
};

export function ShadowQueueView({ snapshot, onBack, onRefresh }: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<ShadowPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!missionId) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/runtime/shadow-queue/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ShadowPayload;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [missionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async () => {
    if (!data?.submission) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/runtime/shadow-queue/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: data.submission.mission_id,
          mission_version: data.submission.mission_version,
          submission_id: data.submission.submission_id,
          submission_checksum: data.submission.submission_checksum,
          actor: "stephen",
          reason: "Accept into Shadow Queue",
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || body.ok === false) {
        throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
      }
      await onRefresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const record = data?.record;
  const canAccept =
    data?.mission_status === "QUEUE_SUBMISSION_READY" && data.submission;
  const snapStatus =
    snapshot.company_brain?.shadow_queue_status ??
    record?.status ??
    data?.mission_status;

  return (
    <div className="ds-stack">
      <PageHeader
        title="Shadow Queue"
        subtitle="Runtime shadow receiver · never dispatches · LIVE OFF"
        actions={
          <SecondaryButton size="sm" onClick={onBack}>
            Back to Mission Control
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="Shadow Queue">
        Packages are accepted into an isolated Shadow Queue only. The execution
        queue is untouched.
      </AlertBanner>
      <AlertBanner tone="warn" title="Execution Disabled">
        dispatch_allowed=false · execution_allowed=false · publishing_allowed=false
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        No scheduler · no workers · no providers · no publish.
      </AlertBanner>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Confirm a Queue Submission package first, then open Shadow Queue."
        />
      ) : error && !data ? (
        <EmptyIllustration title="Failed to load Shadow Queue" copy={error} />
      ) : !record && !data?.submission ? (
        <EmptyIllustration
          title="Nothing to receive"
          copy={
            data?.error ??
            "Mission must reach QUEUE_SUBMISSION_READY before shadow reception."
          }
        />
      ) : (
        <>
          <InfoBanner title={`Shadow status · ${snapStatus ?? "—"}`}>
            {record?.next_safe_action ??
              "Accept READY submission into Shadow Queue · STOP after receive"}
          </InfoBanner>

          <MetricGrid columns={4}>
            <KPIStatCard
              value={record?.shadow_queue_id?.slice(0, 14) ?? "—"}
              label="Shadow Queue ID"
              delta="shadow=true"
              deltaDirection="flat"
              tone="processing"
            />
            <KPIStatCard
              value={record?.department ?? data?.submission?.department ?? "—"}
              label="Department"
              delta={record?.priority ?? data?.submission?.priority ?? ""}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={
                record?.received_timestamp
                  ? record.received_timestamp.slice(0, 19)
                  : "pending"
              }
              label="Received time"
              delta={String(snapStatus ?? "—")}
              deltaDirection="flat"
              tone="waiting"
            />
            <KPIStatCard
              value={record ? "RECEIVED" : "READY?"}
              label="Validation"
              delta={record?.validation_summary?.slice(0, 24) ?? "awaiting"}
              deltaDirection="flat"
              tone={record ? "approved" : "waiting"}
            />
          </MetricGrid>

          <PageSection title="Mission & submission">
            <SectionCard title="Mission">
              <p className="mono">
                {record?.mission_id ?? data?.submission?.mission_id}
              </p>
              <p className="mono">Status: {data?.mission_status}</p>
            </SectionCard>
            <SectionCard title="Submission">
              <p className="mono">
                {record?.submission_id ?? data?.submission?.submission_id}
              </p>
              <Badge>shadow receive only</Badge>
            </SectionCard>
          </PageSection>

          <PageSection title="Checksums">
            <SectionCard title="Integrity">
              <p className="mono">
                Submission:{" "}
                {(
                  record?.submission_checksum ??
                  data?.submission?.submission_checksum ??
                  ""
                ).slice(0, 24)}
                …
              </p>
              <p className="mono">
                Execution package:{" "}
                {(
                  record?.execution_package_checksum ??
                  data?.submission?.execution_package_checksum ??
                  ""
                ).slice(0, 24)}
                …
              </p>
              <p className="mono">
                Acknowledgement:{" "}
                {(
                  record?.acknowledgement_checksum ??
                  data?.submission?.acknowledgement_checksum ??
                  ""
                ).slice(0, 24)}
                …
              </p>
            </SectionCard>
          </PageSection>

          {record ? (
            <PageSection title="Warnings">
              <SectionCard title="Guarantees">
                {record.warnings.map((w) => (
                  <p key={w} className="muted">
                    {w}
                  </p>
                ))}
              </SectionCard>
            </PageSection>
          ) : null}

          {error ? (
            <AlertBanner tone="danger" title="Receive failed">
              {error}
            </AlertBanner>
          ) : null}

          {canAccept ? (
            <StickyFooter>
              <PrimaryButton disabled={busy} onClick={() => void accept()}>
                Accept into Shadow Queue
              </PrimaryButton>
            </StickyFooter>
          ) : null}
        </>
      )}
    </div>
  );
}
