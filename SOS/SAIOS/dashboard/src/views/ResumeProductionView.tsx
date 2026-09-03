/**
 * Resume Template Production — GUARDED_ACTIVE ops from snapshot.resume_ops.
 * Observation only. No generation / revision / publish controls.
 */
import type { DashboardSnapshot, ResumeOpsSnapshot } from "../data/types";
import {
  Badge,
  InfoBanner,
  MetricGrid,
  PageHeader,
  PageSection,
  SectionCard,
} from "../design-system";

function cell(value: unknown): string {
  if (value === undefined || value === null) return "Unavailable";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "YES" : "NO";
  const s = String(value).trim();
  return s || "Unavailable";
}

function money(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `$${value.toFixed(2)}`;
}

function limitMoney(value: unknown): string {
  if (value === null || value === undefined) return "Unavailable";
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `$${value.toFixed(2)}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <dt className="muted">{label}</dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}

function TimerBlock({
  title,
  timer,
}: {
  title: string;
  timer: ResumeOpsSnapshot["timers"] extends infer T
    ? T extends { morning?: infer M }
      ? M
      : undefined
    : undefined;
}) {
  if (!timer || timer.available === false) {
    return (
      <SectionCard title={title}>
        <dl>
          <Row label="Status" value="Unavailable" />
          <Row
            label="Detail"
            value={cell(timer?.detail ?? "systemctl unavailable (local/dev)")}
          />
        </dl>
      </SectionCard>
    );
  }
  return (
    <SectionCard title={title}>
      <dl>
        <Row label="Unit" value={cell(timer.unit)} />
        <Row
          label="Enabled"
          value={
            timer.enabled === null || timer.enabled === undefined
              ? "Unavailable"
              : timer.enabled
                ? "YES"
                : "NO"
          }
        />
        <Row
          label="Active"
          value={
            timer.active === null || timer.active === undefined
              ? "Unavailable"
              : timer.active
                ? "YES"
                : "NO"
          }
        />
        <Row label="Next run" value={cell(timer.next_run)} />
        <Row label="Last run" value={cell(timer.last_run)} />
        <Row label="Detail" value={cell(timer.detail)} />
      </dl>
    </SectionCard>
  );
}

export function ResumeProductionView({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const ops = snapshot.resume_ops;
  const q = ops?.queue;
  const cost = ops?.cost;
  const health = ops?.health;
  const last = ops?.last_execution;
  const mem = ops?.memory;
  const waiting = q?.waiting_founder;
  const max = q?.queue_max;
  const backpressured =
    typeof waiting === "number" &&
    typeof max === "number" &&
    waiting >= max;

  return (
    <div className="ds-command" data-readonly="true" data-resume-production="1">
      <PageHeader
        title="Production"
        subtitle="Resume Template department — GUARDED_ACTIVE operations (read-only)"
      />

      {!ops ? (
        <InfoBanner title="Operational status unavailable">
          resume_ops missing from snapshot — cannot invent metrics.
        </InfoBanner>
      ) : (
        <>
          <InfoBanner title={cell(ops.human_status_label)}>
            Mode {cell(ops.mode_label)} · Provider {cell(ops.provider_label)} ·
            Health {cell(health?.status)} · Publication{" "}
            {cell(ops.publication_mode)} · SOS_AIOS_LIVE=
            {cell(ops.sos_aios_live)} (env guard, not department off)
          </InfoBanner>

          <PageSection title="Status" subtitle="Department posture">
            <MetricGrid columns={3}>
              <SectionCard title="Department">
                <dl>
                  <Row label="Status" value={cell(ops.department_status)} />
                  <Row label="Active" value={cell(ops.department_active)} />
                  <Row label="Operating mode" value={cell(ops.operating_mode)} />
                </dl>
              </SectionCard>
              <SectionCard title="Generation">
                <dl>
                  <Row label="Status" value={cell(ops.generation_status)} />
                  <Row
                    label="Freshness"
                    value={cell(ops.freshness?.label)}
                  />
                  {backpressured ? (
                    <Row
                      label="Capacity"
                      value="BACKPRESSURED / REVIEW QUEUE FULL"
                    />
                  ) : (
                    <Row
                      label="Capacity"
                      value={
                        typeof waiting === "number" && typeof max === "number"
                          ? `${waiting}/${max} waiting`
                          : "Unavailable"
                      }
                    />
                  )}
                </dl>
              </SectionCard>
              <SectionCard title="Health">
                <dl>
                  <Row label="Status" value={cell(health?.status)} />
                  <Row label="Detail" value={cell(health?.detail)} />
                  <Row
                    label="Last production health"
                    value={cell(health?.production_health)}
                  />
                </dl>
              </SectionCard>
            </MetricGrid>
          </PageSection>

          <PageSection title="Generation timers" subtitle="systemd (server-side)">
            <MetricGrid columns={2}>
              <TimerBlock title="Morning timer" timer={ops.timers?.morning} />
              <TimerBlock title="Evening timer" timer={ops.timers?.evening} />
            </MetricGrid>
          </PageSection>

          <PageSection title="Last generation" subtitle="Persisted execution">
            <SectionCard title="Latest execution">
              {!last?.available ? (
                <p className="muted mono">Unavailable</p>
              ) : (
                <dl>
                  <Row label="Execution ID" value={cell(last.execution_id)} />
                  <Row label="Finished at" value={cell(last.finished_at)} />
                  <Row label="Batch ID" value={cell(last.batch_id)} />
                  <Row label="Stop reason" value={cell(last.stop_reason)} />
                  <Row label="Health" value={cell(last.health_status)} />
                  <Row label="Budget" value={cell(last.budget_decision)} />
                  <Row label="Requested" value={cell(last.requested)} />
                  <Row label="Accepted" value={cell(last.accepted)} />
                  <Row label="Failed" value={cell(last.failed)} />
                  <Row
                    label="Role integrity failed"
                    value={cell(last.role_integrity_failed)}
                  />
                  <Row
                    label="Duplicate skips"
                    value={cell(last.duplicate_skips)}
                  />
                </dl>
              )}
            </SectionCard>
          </PageSection>

          <PageSection title="Queue" subtitle="Founder review capacity">
            <SectionCard title="Review queue">
              <dl>
                <Row label="Waiting founder" value={cell(waiting)} />
                <Row label="Queue max" value={cell(max)} />
                <Row label="Queue free" value={cell(q?.queue_free)} />
                <Row
                  label="Revision failed"
                  value={cell(q?.revision_failed)}
                />
                <Row label="Approved" value={cell(q?.approved)} />
                <Row
                  label="Changes requested"
                  value={cell(q?.changes_requested)}
                />
                <Row label="Rejected" value={cell(q?.rejected)} />
                {backpressured ? (
                  <div style={{ marginTop: 8 }}>
                    <Badge tone="waiting">
                      BACKPRESSURED / REVIEW QUEUE FULL
                    </Badge>
                  </div>
                ) : null}
              </dl>
            </SectionCard>
          </PageSection>

          <PageSection title="Provider & budget" subtitle="Bounded OpenAI">
            <MetricGrid columns={2}>
              <SectionCard title="Provider">
                <dl>
                  <Row label="Label" value={cell(ops.provider_label)} />
                  <Row
                    label="Generation"
                    value={cell(ops.provider_generation)}
                  />
                  <Row
                    label="Revision"
                    value={cell(ops.provider_revision)}
                  />
                  <Row
                    label="Bounded enabled"
                    value={cell(ops.openai_bounded_enabled)}
                  />
                </dl>
              </SectionCard>
              <SectionCard title="Cost / budget">
                <dl>
                  <Row
                    label="Today"
                    value={
                      cost?.available === false
                        ? "Unavailable"
                        : money(cost?.today_usd)
                    }
                  />
                  <Row
                    label="Month"
                    value={
                      cost?.available === false
                        ? "Unavailable"
                        : money(cost?.month_usd)
                    }
                  />
                  <Row
                    label="Daily limit"
                    value={limitMoney(cost?.daily_limit_usd)}
                  />
                  <Row
                    label="Monthly limit"
                    value={limitMoney(cost?.monthly_limit_usd)}
                  />
                  <Row
                    label="Auto-pause threshold"
                    value={
                      typeof cost?.auto_pause_threshold_pct === "number"
                        ? `${cost.auto_pause_threshold_pct}%`
                        : "Unavailable"
                    }
                  />
                  <Row
                    label="Budget OK"
                    value={
                      cost?.budget_ok === undefined
                        ? "Unavailable"
                        : cost.budget_ok
                          ? "YES"
                          : cell(cost.budget_reason ?? "NO")
                    }
                  />
                </dl>
              </SectionCard>
            </MetricGrid>
          </PageSection>

          <PageSection title="Revision & memory" subtitle="Observability only">
            <MetricGrid columns={2}>
              <SectionCard title="Revision dispatcher">
                <dl>
                  <Row
                    label="Enabled"
                    value={cell(ops.revision_dispatcher_enabled)}
                  />
                  <Row
                    label="Active"
                    value={cell(ops.revision_dispatcher_active)}
                  />
                  <Row
                    label="Evidence"
                    value={
                      ops.revision_dispatcher_basis === "env_flag"
                        ? "env flag (not process probe)"
                        : cell(ops.revision_dispatcher_basis)
                    }
                  />
                  <Row label="Pending tasks" value={cell(ops.revision_pending)} />
                  <Row label="Running tasks" value={cell(ops.revision_running)} />
                </dl>
              </SectionCard>
              <SectionCard title="Founder memory">
                {!mem?.available ? (
                  <p className="muted mono">Unavailable</p>
                ) : (
                  <dl>
                    <Row
                      label="Active rules"
                      value={cell(mem.active_rules)}
                    />
                    <Row label="Confirmed" value={cell(mem.confirmed)} />
                    <Row label="Provisional" value={cell(mem.provisional)} />
                    <Row label="Superseded" value={cell(mem.superseded)} />
                  </dl>
                )}
              </SectionCard>
            </MetricGrid>
          </PageSection>

          <PageSection title="Publication" subtitle="Guarded apply">
            <SectionCard title="Publication policy">
              <dl>
                <Row
                  label="Mode"
                  value={
                    ops.publication_mode === "MANUAL_GUARDED"
                      ? "MANUAL / GUARDED"
                      : cell(ops.publication_mode)
                  }
                />
                <Row
                  label="Auto apply"
                  value={ops.publication_auto_apply ? "ON" : "OFF"}
                />
                <Row
                  label="Note"
                  value="Approved templates may auto-stage; live publish remains manual"
                />
              </dl>
            </SectionCard>
          </PageSection>
        </>
      )}

      <p className="muted mono" style={{ marginTop: 16 }}>
        Observation only — no generation, revision, or publication controls.
      </p>
    </div>
  );
}
