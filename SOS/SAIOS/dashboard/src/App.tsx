import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import type {
  DashboardRoute,
  DashboardSnapshot,
  FounderReviewQueueItem,
} from "./data/types";
import type { FounderCommandCenterSnapshot } from "./data/founderCommandCenterTypes";
import { MissionControl } from "./views/MissionControl";
import { ResumeView } from "./views/ResumeView";
import { KnowledgeView } from "./views/KnowledgeView";
import { BrainStudio } from "./views/BrainStudio";
import { SkillsView } from "./views/SkillsView";
import { ActivityView } from "./views/ActivityView";
import { FounderReviewView } from "./views/FounderReviewView";
import {
  FounderCommandCenterOverview,
  FccReportsPage,
  FccSectionPage,
} from "./views/FounderCommandCenterView";
import { ResumeProductionView } from "./views/ResumeProductionView";
import { MissionControlSkeleton } from "./views/mission-control/components";
import { MissionApprovalView } from "./views/MissionApprovalView";
import { QueueAdmissionView } from "./views/QueueAdmissionView";
import { ExecutionPackageView } from "./views/ExecutionPackageView";
import { QueueSubmissionView } from "./views/QueueSubmissionView";
import { ShadowQueueView } from "./views/ShadowQueueView";
import { RuntimePlanView } from "./views/RuntimePlanView";
import { RuntimeReleaseView } from "./views/RuntimeReleaseView";
import { SystemReadinessView } from "./views/SystemReadinessView";
import { ExecutionControllerView } from "./views/ExecutionControllerView";
import { DepartmentRegistryView } from "./views/DepartmentRegistryView";
import { CostLedgerView } from "./views/CostLedgerView";
import { WorkerRuntimeView } from "./views/WorkerRuntimeView";
import { TelemetryRegistryView } from "./views/TelemetryRegistryView";
import { ActivationGateView } from "./views/ActivationGateView";
import { ExecutionAuthorizationView } from "./views/ExecutionAuthorizationView";
import { PreDispatchSimulationView } from "./views/PreDispatchSimulationView";
import { ProviderValidationView } from "./views/ProviderValidationView";
import { SettingsView } from "./views/SettingsView";
import {
  Badge,
  DashboardShell,
  LoadingSkeletons,
  NotificationButton,
  PrimaryButton,
  ProfileMenu,
  SearchBar,
  SecondaryButton,
  Sidebar,
  TopToolbar,
} from "./design-system";

const NAV: { id: DashboardRoute; label: string }[] = [
  { id: "command-center", label: "Mission Control" },
  { id: "review", label: "Templates Ready for Review" },
  { id: "fcc-production", label: "Production" },
  { id: "fcc-portfolio", label: "Portfolio · inactive" },
  { id: "fcc-strategy", label: "Strategy · inactive" },
  { id: "fcc-governance", label: "Governance · inactive" },
  { id: "fcc-advisor", label: "Advisor · inactive" },
  { id: "fcc-reports", label: "Reports · legacy" },
  { id: "home", label: "Operations Hub · scaffold" },
  { id: "settings", label: "Settings" },
];

const FCC_ROUTES = new Set<DashboardRoute>([
  "command-center",
  "fcc-production",
  "fcc-portfolio",
  "fcc-strategy",
  "fcc-governance",
  "fcc-advisor",
  "fcc-reports",
]);

type Selection =
  | { kind: "none" }
  | { kind: "department"; id: string }
  | { kind: "cycle"; id: string }
  | { kind: "event"; id: string }
  | { kind: "skill"; id: string }
  | { kind: "knowledge"; id: string }
  | { kind: "brain"; id: string };

type ReviewQueueResponse = {
  generated_at: string;
  review_queue: FounderReviewQueueItem[];
  review_queue_count: number;
  waiting_founder_count: number;
};

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [fcc, setFcc] = useState<FounderCommandCenterSnapshot | null>(null);
  const [fccLoaded, setFccLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<DashboardRoute>("command-center");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [toolbarSearch, setToolbarSearch] = useState("");

  const routeRef = useRef(route);
  routeRef.current = route;
  /** Monotonic token so stale poll/decision responses cannot overwrite newer state. */
  const snapshotEpoch = useRef(0);
  const reviewEpoch = useRef(0);
  const snapshotInFlight = useRef(false);
  const reviewInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (snapshotInFlight.current) return;
    snapshotInFlight.current = true;
    const epoch = ++snapshotEpoch.current;
    try {
      const res = await fetch("/api/snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error(`snapshot HTTP ${res.status}`);
      const data = (await res.json()) as DashboardSnapshot;
      if (epoch !== snapshotEpoch.current) return;
      setSnapshot(data);
      setError(null);
    } catch (e) {
      if (epoch !== snapshotEpoch.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      snapshotInFlight.current = false;
    }
  }, []);

  const refreshReviewQueue = useCallback(async (opts?: { force?: boolean }) => {
    // Interval polls coalesce; post-decision force always issues a new request.
    if (reviewInFlight.current && !opts?.force) return;
    reviewInFlight.current = true;
    const epoch = ++reviewEpoch.current;
    try {
      const res = await fetch("/api/review-queue", { cache: "no-store" });
      if (!res.ok) throw new Error(`review-queue HTTP ${res.status}`);
      const data = (await res.json()) as ReviewQueueResponse;
      if (epoch !== reviewEpoch.current) return;
      setSnapshot((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          last_refreshed: data.generated_at,
          review_queue: data.review_queue,
        };
      });
      setError(null);
    } catch (e) {
      if (epoch !== reviewEpoch.current) return;
      // Do not blank the Review page on a transient poll failure.
      console.warn("[review-queue]", e instanceof Error ? e.message : e);
    } finally {
      if (epoch === reviewEpoch.current) {
        reviewInFlight.current = false;
      }
    }
  }, []);

  const refreshFcc = useCallback(async () => {
    try {
      const res = await fetch("/api/founder-command-center", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`fcc HTTP ${res.status}`);
      const data = (await res.json()) as FounderCommandCenterSnapshot;
      setFcc(data);
    } catch {
      setFcc(null);
    } finally {
      setFccLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshFcc();
    const t = setInterval(() => {
      if (routeRef.current === "review") {
        void refreshReviewQueue();
      } else {
        void refresh();
        void refreshFcc();
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [refresh, refreshFcc, refreshReviewQueue]);

  // When entering Review, pull the light queue immediately.
  useEffect(() => {
    if (route === "review") {
      void refreshReviewQueue();
    }
  }, [route, refreshReviewQueue]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const inspectorOpen = selection.kind !== "none";

  const inspectorBody = useMemo(() => {
    if (!snapshot || selection.kind === "none") return null;
    if (selection.kind === "department") {
      const d = snapshot.departments.find((x) => x.id === selection.id);
      return d ? (
        <div>
          <h3>{d.label}</h3>
          <p className="mono">status: {d.status}</p>
          <p className="mono">mode: {d.mode}</p>
          <p className="muted">{d.notes}</p>
        </div>
      ) : null;
    }
    if (selection.kind === "cycle") {
      const c = snapshot.cycles.find((x) => x.id === selection.id);
      return c ? (
        <div>
          <h3>{c.title}</h3>
          <p className="mono">{c.id}</p>
          <p className="mono">status: {c.status}</p>
          <p className="mono">{c.source}</p>
          {snapshot.critic && (
            <>
              <h4 className="section-title">Critic</h4>
              <p className="mono">
                Overall {snapshot.critic.overall} · ATS {snapshot.critic.ats} ·
                Ready {snapshot.critic.ready ? "YES" : "NO"}
              </p>
              <p className="muted">
                {snapshot.critic.ready
                  ? "Founder review permitted · No automatic publication"
                  : "Founder review blocked"}
              </p>
            </>
          )}
        </div>
      ) : null;
    }
    if (selection.kind === "skill") {
      const s = snapshot.skills.find((x) => x.id === selection.id);
      return s ? (
        <div>
          <h3>{s.name}</h3>
          <p className="mono">{s.id}</p>
          <p className="mono">domain: {s.domain}</p>
          <p className="mono">active: {String(s.active)}</p>
        </div>
      ) : null;
    }
    if (selection.kind === "event") {
      const e = snapshot.activity.find((x) => x.id === selection.id);
      return e ? (
        <div>
          <h3>{e.event_type}</h3>
          <p className="mono">{e.timestamp}</p>
          <p>{e.summary}</p>
        </div>
      ) : null;
    }
    if (selection.kind === "knowledge") {
      return (
        <div>
          <h3>Knowledge Snapshot</h3>
          <p className="mono">{snapshot.knowledge_snapshot.snapshot_id ?? "n/a"}</p>
          <p className="mono">
            domains: {snapshot.knowledge_snapshot.domains.join(", ")}
          </p>
          <p className="mono">
            refs: {snapshot.knowledge_snapshot.references.length}
          </p>
        </div>
      );
    }
    if (selection.kind === "brain") {
      const n = snapshot.brain_path.find((x) => x.id === selection.id);
      return n ? (
        <div>
          <h3>{n.label}</h3>
          <pre className="mono">{JSON.stringify(n.meta, null, 2)}</pre>
        </div>
      ) : null;
    }
    return null;
  }, [snapshot, selection]);

  const runCommand = (id: string) => {
    setCmdOpen(false);
    switch (id) {
      case "command-center":
        setRoute("command-center");
        break;
      case "home":
        setRoute("home");
        break;
      case "resume":
        setRoute("resume");
        break;
      case "knowledge":
        setRoute("knowledge");
        break;
      case "brain":
        setRoute("brain");
        break;
      case "skills":
        setRoute("skills");
        break;
      case "activity":
        setRoute("activity");
        break;
      case "review":
        setRoute("review");
        break;
      case "fcc-production":
      case "fcc-portfolio":
      case "fcc-strategy":
      case "fcc-governance":
      case "fcc-advisor":
      case "fcc-reports":
        setRoute(id);
        break;
      case "provider-validation":
        setRoute("provider-validation");
        break;
      case "latest-run":
        setRoute("command-center");
        break;
      case "latest-failure":
        setRoute("command-center");
        break;
      case "founder-actions":
        setRoute("command-center");
        break;
      default:
        break;
    }
  };

  const needsSnapshot = !FCC_ROUTES.has(route);

  if (error && !snapshot && needsSnapshot) {
    return (
      <main className="ds-boot">
        <p className="ds-boot-error">Dashboard unavailable</p>
        <p className="mono">{error}</p>
        <PrimaryButton onClick={() => void refresh()}>Retry</PrimaryButton>
      </main>
    );
  }

  if ((!snapshot && needsSnapshot) || (FCC_ROUTES.has(route) && !fccLoaded)) {
    return (
      <main className="ds-boot" aria-busy="true" aria-label="Loading dashboard">
        {FCC_ROUTES.has(route) ? (
          <MissionControlSkeleton />
        ) : (
          <LoadingSkeletons variant="page" />
        )}
      </main>
    );
  }

  /** Human-facing ops labels from snapshot top_bar — never invent LIVE OFF / Mock / $0.00. */
  const opsLabel = (value: string | undefined | null): string => {
    const v = typeof value === "string" ? value.trim() : "";
    return v || "Unavailable";
  };
  const costTodayLabel = (raw: string | undefined | null): string => {
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) return "Unavailable";
    return v.startsWith("$") ? v : `$${v}`;
  };
  const departmentLabel = opsLabel(snapshot?.top_bar.live_label);
  const modeLabel = opsLabel(snapshot?.top_bar.mode);
  const providerLabel = opsLabel(snapshot?.top_bar.provider);
  const freshnessLabel = opsLabel(snapshot?.top_bar.heartbeat_age);
  const queueLabel = snapshot?.top_bar.queue_label?.trim() || "";
  const healthLabel = snapshot?.top_bar.health_label?.trim() || "";
  const publicationLabel = snapshot?.top_bar.publication_label?.trim() || "";

  return (
    <>
      <DashboardShell
        data-aios-dashboard="v1"
        data-live="off"
        data-readonly="true"
        inspectorOpen={inspectorOpen}
        sidebar={
          <Sidebar
            brand="A"
            items={NAV}
            activeId={route}
            onSelect={(id) => {
              setRoute(id as DashboardRoute);
              if (id === "settings") setSelection({ kind: "none" });
            }}
          />
        }
        toolbar={
          <TopToolbar
            search={
              <SearchBar
                value={toolbarSearch}
                placeholder="Search AIOS…"
                aria-label="Search AIOS"
                onChange={setToolbarSearch}
                onSubmit={() => setCmdOpen(true)}
              />
            }
            meta={
              <>
                <strong className="ds-brand-mark">AIOS</strong>
                <Badge tone="neutral">{departmentLabel}</Badge>
                <Badge tone="neutral">{modeLabel}</Badge>
                <Badge tone="neutral">provider: {providerLabel}</Badge>
                {snapshot ? (
                  <>
                    <span className="mono muted">{freshnessLabel}</span>
                    {queueLabel ? (
                      <span className="mono muted">q {queueLabel}</span>
                    ) : null}
                    {healthLabel ? (
                      <span className="mono muted">{healthLabel}</span>
                    ) : null}
                    <span className="mono muted">
                      {costTodayLabel(snapshot.top_bar.cost_today_usd)}
                    </span>
                    {publicationLabel ? (
                      <Badge tone="neutral">{publicationLabel}</Badge>
                    ) : null}
                  </>
                ) : (
                  <span className="mono muted">Unavailable</span>
                )}
              </>
            }
            actions={
              <>
                <SecondaryButton
                  size="sm"
                  onClick={() => setCmdOpen(true)}
                  aria-keyshortcuts="Meta+K Control+K"
                >
                  ⌘K
                </SecondaryButton>
                <SecondaryButton
                  size="sm"
                  onClick={() => {
                    void refresh();
                    void refreshFcc();
                  }}
                >
                  Refresh
                </SecondaryButton>
                <NotificationButton
                  hasNotification={Boolean(snapshot?.exceptions?.length)}
                  onClick={() => setRoute("activity")}
                />
                <ProfileMenu
                  initials="F"
                  label="Founder"
                  onClick={() => setRoute("settings")}
                />
              </>
            }
          />
        }
        inspector={
          <>
            <div className="ds-row-between ds-inspector-head">
              <p className="section-title ds-meta">Inspector</p>
              <SecondaryButton
                size="sm"
                onClick={() => setSelection({ kind: "none" })}
              >
                Close
              </SecondaryButton>
            </div>
            {inspectorBody}
          </>
        }
      >
        {route === "command-center" && fcc && (
          <FounderCommandCenterOverview
            snap={fcc}
            onOpenReview={() => setRoute("review")}
            onRefresh={() => {
              void refresh();
              void refreshFcc();
            }}
          />
        )}
        {route === "command-center" && !fcc && (
          <main className="ds-command">
            <p className="ds-boot-error">Command Center snapshot unavailable</p>
            <SecondaryButton onClick={() => void refreshFcc()}>
              Retry
            </SecondaryButton>
          </main>
        )}
        {route === "fcc-production" && snapshot && (
          <ResumeProductionView snapshot={snapshot} />
        )}
        {route === "fcc-production" && !snapshot && (
          <main className="ds-command">
            <p className="muted mono">Loading production snapshot…</p>
          </main>
        )}
        {route === "fcc-portfolio" && fcc && (
          <FccSectionPage
            title="Portfolio"
            subtitle="Inactive / historical projection — not current Resume Template operations."
            safety={fcc.safety}
            section={fcc.portfolio}
            rows={[
              {
                label: "Coverage score",
                value: String(fcc.portfolio.data?.coverage_score ?? "—"),
              },
              {
                label: "Template total",
                value: String(fcc.portfolio.data?.candidate_total ?? "—"),
              },
              {
                label: "Recommendations",
                value: String(fcc.portfolio.data?.recommendation_count ?? "—"),
              },
            ]}
          />
        )}
        {route === "fcc-strategy" && fcc && (
          <FccSectionPage
            title="Strategy"
            subtitle="Inactive / planned — not current Resume Template operations."
            safety={fcc.safety}
            section={fcc.strategy}
            rows={[
              {
                label: "Strategy version",
                value: String(fcc.strategy.data?.strategy_version ?? "—"),
              },
              {
                label: "Recommendations",
                value: String(fcc.strategy.data?.recommendation_count ?? "—"),
              },
              {
                label: "Portfolio score",
                value: String(fcc.strategy.data?.portfolio_score ?? "—"),
              },
            ]}
          />
        )}
        {route === "fcc-governance" && fcc && (
          <FccSectionPage
            title="Governance"
            subtitle="Inactive / legacy observation — use Production for Resume Template ops."
            safety={fcc.safety}
            section={fcc.health}
            rows={[
              {
                label: "Health",
                value: fcc.health.data?.status ?? "—",
              },
              {
                label: "Budget",
                value: fcc.budget.data?.decision ?? "—",
              },
              {
                label: "Scheduling",
                value: fcc.scheduling.data?.decision ?? "—",
              },
              {
                label: "Department (env-aware)",
                value: fcc.safety.live_label,
              },
              {
                label: "Publication",
                value: fcc.safety.publication_label,
              },
            ]}
          />
        )}
        {route === "fcc-advisor" && fcc && (
          <FccSectionPage
            title="Advisor"
            subtitle="Inactive / advisory scaffold — not current Resume Template operations."
            safety={fcc.safety}
            section={fcc.advisor}
            rows={[
              {
                label: "Recommendation count",
                value: String(fcc.advisor.data?.recommendation_count ?? "—"),
              },
              {
                label: "Top IDs",
                value: fcc.advisor.data?.top_ids?.join(", ") || "—",
              },
            ]}
          />
        )}
        {route === "fcc-reports" && fcc && <FccReportsPage snap={fcc} />}
        {route === "home" && snapshot && (
          <MissionControl
            snapshot={snapshot}
            onOpenDepartment={(id, openRoute) => {
              if (openRoute) setRoute(openRoute);
              setSelection({ kind: "department", id });
            }}
            onSelectCycle={(id) => setSelection({ kind: "cycle", id })}
            onSelectKnowledge={() =>
              setSelection({ kind: "knowledge", id: "snapshot" })
            }
            onOpenReview={() => setRoute("review")}
            onOpenMissionApproval={() => setRoute("mission-approval")}
            onOpenQueueAdmission={() => setRoute("queue-admission")}
            onOpenExecutionPackage={() => setRoute("execution-package")}
            onOpenQueueSubmission={() => setRoute("queue-submission")}
            onOpenShadowQueue={() => setRoute("shadow-queue")}
            onOpenRuntimePlan={() => setRoute("runtime-plan")}
            onOpenRuntimeRelease={() => setRoute("runtime-release")}
            onOpenSystemReadiness={() => setRoute("system-readiness")}
            onOpenExecutionController={() => setRoute("execution-controller")}
            onOpenDepartmentRegistry={() => setRoute("department-registry")}
            onOpenCostLedger={() => setRoute("cost-ledger")}
            onOpenWorkerRuntime={() => setRoute("worker-runtime")}
            onOpenTelemetryRegistry={() => setRoute("telemetry-registry")}
            onOpenActivationGate={() => setRoute("activation-gate")}
            onOpenExecutionAuthorization={() =>
              setRoute("execution-authorization")
            }
            onOpenPreDispatchSimulation={() =>
              setRoute("pre-dispatch-simulation")
            }
          />
        )}
        {route === "mission-approval" && snapshot && (
          <MissionApprovalView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onDecided={() => void refresh()}
          />
        )}
        {route === "queue-admission" && snapshot && (
          <QueueAdmissionView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onDecided={() => void refresh()}
          />
        )}
        {route === "execution-package" && snapshot && (
          <ExecutionPackageView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "queue-submission" && snapshot && (
          <QueueSubmissionView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "shadow-queue" && snapshot && (
          <ShadowQueueView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "runtime-plan" && snapshot && (
          <RuntimePlanView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "runtime-release" && snapshot && (
          <RuntimeReleaseView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "system-readiness" && snapshot && (
          <SystemReadinessView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "execution-controller" && snapshot && (
          <ExecutionControllerView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "department-registry" && snapshot && (
          <DepartmentRegistryView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "cost-ledger" && snapshot && (
          <CostLedgerView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "worker-runtime" && snapshot && (
          <WorkerRuntimeView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "telemetry-registry" && snapshot && (
          <TelemetryRegistryView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "activation-gate" && snapshot && (
          <ActivationGateView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "execution-authorization" && snapshot && (
          <ExecutionAuthorizationView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "pre-dispatch-simulation" && snapshot && (
          <PreDispatchSimulationView
            snapshot={snapshot}
            onBack={() => setRoute("home")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "resume" && snapshot && (
          <ResumeView
            snapshot={snapshot}
            onOpenReview={() => setRoute("review")}
            onNavigate={(r) => setRoute(r)}
            onRefresh={() => void refresh()}
            onInspectCycle={(id) => {
              setSelection({ kind: "cycle", id });
            }}
          />
        )}
        {route === "knowledge" && snapshot && (
          <KnowledgeView
            snapshot={snapshot}
            onSelectSnapshot={() =>
              setSelection({ kind: "knowledge", id: "snapshot" })
            }
            onRefresh={() => void refresh()}
          />
        )}
        {route === "brain" && snapshot && (
          <BrainStudio
            snapshot={snapshot}
            onSelectNode={(id) => setSelection({ kind: "brain", id })}
            onNavigate={(r) => setRoute(r)}
            onOpenReview={() => setRoute("review")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "skills" && snapshot && (
          <SkillsView
            snapshot={snapshot}
            onSelectSkill={(id) => setSelection({ kind: "skill", id })}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "activity" && snapshot && (
          <ActivityView
            snapshot={snapshot}
            onSelectEvent={(id) => setSelection({ kind: "event", id })}
            onNavigate={(r) => setRoute(r)}
            onOpenReview={() => setRoute("review")}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "review" && snapshot && (
          <FounderReviewView
            snapshot={snapshot}
            onDecided={() => {
              void refreshReviewQueue({ force: true });
              void refreshFcc();
            }}
          />
        )}
        {route === "provider-validation" && snapshot && (
          <ProviderValidationView
            snapshot={snapshot}
            onOpenReview={() => setRoute("review")}
            onNavigate={(r) => setRoute(r)}
            onRefresh={() => void refresh()}
          />
        )}
        {route === "settings" && snapshot && (
          <SettingsView
            snapshot={snapshot}
            onNavigate={(r) => setRoute(r)}
            onOpenReview={() => setRoute("review")}
            onRefresh={() => void refresh()}
          />
        )}
      </DashboardShell>

      {cmdOpen && (
        <div className="cmdk-overlay" role="presentation">
          <div className="cmdk-dialog" role="dialog" aria-label="Command palette">
            <Command label="AIOS commands">
              <Command.Input placeholder="Navigate…" autoFocus />
              <Command.List>
                <Command.Empty>No results</Command.Empty>
                <Command.Item onSelect={() => runCommand("command-center")}>
                  Open Mission Control
                </Command.Item>
                <Command.Item onSelect={() => runCommand("home")}>
                  Open Operations Hub
                </Command.Item>
                <Command.Item onSelect={() => runCommand("resume")}>
                  Open Resume Department
                </Command.Item>
                <Command.Item onSelect={() => runCommand("knowledge")}>
                  Open Knowledge
                </Command.Item>
                <Command.Item onSelect={() => runCommand("brain")}>
                  Open Brain Studio
                </Command.Item>
                <Command.Item onSelect={() => runCommand("skills")}>
                  Open Skills
                </Command.Item>
                <Command.Item onSelect={() => runCommand("activity")}>
                  Open Activity
                </Command.Item>
                <Command.Item onSelect={() => runCommand("review")}>
                  Open Founder Review
                </Command.Item>
                <Command.Item onSelect={() => runCommand("provider-validation")}>
                  Open Provider Validation
                </Command.Item>
                <Command.Item onSelect={() => runCommand("latest-run")}>
                  Jump to latest run
                </Command.Item>
                <Command.Item onSelect={() => runCommand("latest-failure")}>
                  Jump to latest failure
                </Command.Item>
                <Command.Item onSelect={() => runCommand("founder-actions")}>
                  Open Founder Action Queue
                </Command.Item>
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
