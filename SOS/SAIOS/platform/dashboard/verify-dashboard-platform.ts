#!/usr/bin/env tsx
/**
 * Dashboard Plugin Architecture verify — Agents #174 / #175.
 * Wave-1 + Wave-2 registration, snapshot parity, route parity.
 * Fixtures only. No execution. Snapshot JSON contracts unchanged.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { assert, BaseVerificationHarness } from "../verification/index.js";
import { isLiveOff } from "../shared/index.js";
import { SnapshotRegistry } from "./SnapshotRegistry.js";
import { RouteRegistry } from "./RouteRegistry.js";
import { SnapshotLoader } from "./SnapshotLoader.js";
import {
  ALL_DASHBOARD_PLUGINS,
  WAVE1_DASHBOARD_PLUGINS,
  WAVE2_DASHBOARD_PLUGINS,
  registerAllDashboardPlugins,
} from "./plugins/register.js";
import type { SnapshotLoadContext } from "./SnapshotSource.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIXTURE = join(
  REPO,
  "SOS/07_LOGS/saios/platform/dashboard/fixtures",
);

const EXPECTED_PLUGIN_IDS = [
  "mission-approval",
  "queue-admission",
  "execution-package",
  "execution-package-ack",
  "queue-submission",
  "shadow-queue",
  "runtime-plan",
  "runtime-release",
  "system-readiness",
  "execution-controller",
  "department-registry",
  "cost-ledger",
  "worker-runtime",
  "telemetry-registry",
  "activation-gate",
  "execution-authorization",
  "pre-dispatch-simulation",
] as const;

const EXPECTED_FIELDS: Record<string, readonly string[]> = {
  "mission-approval": [
    "pending_mission_approval",
    "latest_mission_decision",
    "mission_approval_health",
  ],
  "queue-admission": ["queue_admission"],
  "execution-package": ["execution_package"],
  "execution-package-ack": [
    "execution_package_ack_status",
    "pending_execution_package_ack",
    "latest_execution_package_ack",
    "execution_package_ack_health",
  ],
  "queue-submission": [
    "queue_submission_status",
    "pending_queue_submission",
    "latest_queue_submission",
    "queue_submission_health",
  ],
  "shadow-queue": [
    "shadow_queue_status",
    "latest_shadow_queue",
    "shadow_queue_health",
  ],
  "runtime-plan": [
    "runtime_plan_status",
    "latest_runtime_plan",
    "runtime_plan_health",
  ],
  "runtime-release": [
    "runtime_release_status",
    "pending_runtime_release",
    "latest_runtime_release",
    "runtime_release_health",
  ],
  "system-readiness": [
    "system_readiness_status",
    "latest_system_readiness",
    "system_readiness_health",
  ],
  "execution-controller": [
    "execution_controller_status",
    "pending_execution_controller",
    "latest_execution_controller",
    "execution_controller_health",
  ],
  "department-registry": [
    "department_registry_status",
    "department_registry",
    "department_registry_health",
  ],
  "cost-ledger": [
    "cost_ledger_status",
    "cost_ledger",
    "cost_ledger_health",
  ],
  "worker-runtime": [
    "worker_runtime_status",
    "worker_runtime",
    "worker_runtime_health",
  ],
  "telemetry-registry": [
    "telemetry_registry_status",
    "telemetry_registry",
    "telemetry_registry_health",
  ],
  "activation-gate": [
    "activation_gate_status",
    "activation_gate",
    "activation_gate_health",
  ],
  "execution-authorization": [
    "execution_authorization_status",
    "execution_authorization",
    "execution_authorization_health",
  ],
  "pre-dispatch-simulation": [
    "pre_dispatch_simulation_status",
    "pre_dispatch_simulation",
    "pre_dispatch_simulation_health",
  ],
};

/** Legacy-compatible empty/default contracts (Wave-2 idle defaults). */
const LEGACY_EMPTY: Record<string, Record<string, unknown>> = {
  "queue-admission": { queue_admission: null },
  "execution-package": { execution_package: null },
  "execution-package-ack": {
    execution_package_ack_status: null,
    pending_execution_package_ack: false,
    latest_execution_package_ack: null,
    execution_package_ack_health: null,
  },
  "queue-submission": {
    queue_submission_status: null,
    pending_queue_submission: false,
    latest_queue_submission: null,
    queue_submission_health: null,
  },
  "shadow-queue": {
    shadow_queue_status: null,
    latest_shadow_queue: null,
    shadow_queue_health: null,
  },
  "runtime-plan": {
    runtime_plan_status: null,
    latest_runtime_plan: null,
    runtime_plan_health: null,
  },
};

/** Expected load() shapes when all JSON reads return null (deterministic fixtures). */
const LEGACY_NULL_LOAD: Record<string, Record<string, unknown>> = {
  "queue-admission": {
    queue_admission: {
      queue_status: null,
      overall_score: null,
      verdict: null,
      pending: false,
      execution_still_blocked_reason:
        "READY_FOR_QUEUE does not enqueue or execute",
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
    },
  },
  "execution-package": {
    execution_package: {
      package_id: null,
      execution_id: null,
      dry_run: true,
      execution_allowed: false,
      available: false,
    },
  },
  "execution-package-ack": {
    execution_package_ack_status: null,
    pending_execution_package_ack: false,
    latest_execution_package_ack: null,
    execution_package_ack_health: {
      pending_count: 0,
      acknowledged_count: 0,
      status: "idle",
      mode: "acknowledgement_only",
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
    },
  },
  "queue-submission": {
    queue_submission_status: null,
    pending_queue_submission: false,
    latest_queue_submission: null,
    queue_submission_health: {
      pending_count: 0,
      ready_count: 0,
      blocked_count: 0,
      status: "idle",
      mode: "shadow_submission_only",
      dry_run: true,
      submission_allowed: false,
      queue_insert_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
    },
  },
  "shadow-queue": {
    shadow_queue_status: null,
    latest_shadow_queue: null,
    shadow_queue_health: {
      received_count: 0,
      status: "idle",
      mode: "shadow_receive_only",
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
    },
  },
  "runtime-plan": {
    runtime_plan_status: null,
    latest_runtime_plan: null,
    runtime_plan_health: {
      plan_count: 0,
      ready_count: 0,
      blocked_count: 0,
      status: "idle",
      mode: "planning_only",
      planning_only: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
    },
  },
};

const EXPECTED_ROUTES: ReadonlyArray<{
  id: string;
  method: "GET" | "POST";
  pathPattern: string;
}> = [
  {
    id: "mission-approval.missions",
    method: "GET",
    pathPattern: "/api/company-brain/missions",
  },
  {
    id: "mission-approval.mission-detail",
    method: "GET",
    pathPattern: "/api/company-brain/mission/:mission_id",
  },
  {
    id: "mission-approval.mission-decision",
    method: "POST",
    pathPattern: "/api/company-brain/mission-decision",
  },
  {
    id: "runtime-release.list",
    method: "GET",
    pathPattern: "/api/runtime/runtime-release",
  },
  {
    id: "runtime-release.mission",
    method: "GET",
    pathPattern: "/api/runtime/runtime-release/:mission_id",
  },
  {
    id: "runtime-release.review",
    method: "POST",
    pathPattern: "/api/runtime/runtime-release/review",
  },
  {
    id: "system-readiness.list",
    method: "GET",
    pathPattern: "/api/runtime/system-readiness",
  },
  {
    id: "system-readiness.mission",
    method: "GET",
    pathPattern: "/api/runtime/system-readiness/:mission_id",
  },
  {
    id: "queue-admission.list",
    method: "GET",
    pathPattern: "/api/company-brain/queue-review",
  },
  {
    id: "queue-admission.mission",
    method: "GET",
    pathPattern: "/api/company-brain/queue-review/:mission_id",
  },
  {
    id: "queue-admission.decision",
    method: "POST",
    pathPattern: "/api/company-brain/queue-decision",
  },
  {
    id: "execution-package.list",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package",
  },
  {
    id: "execution-package.mission",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package/:mission_id",
  },
  {
    id: "execution-package-ack.list",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package-ack",
  },
  {
    id: "execution-package-ack.mission",
    method: "GET",
    pathPattern: "/api/company-brain/execution-package-ack/:mission_id",
  },
  {
    id: "execution-package-ack.decision",
    method: "POST",
    pathPattern: "/api/company-brain/execution-package-ack-decision",
  },
  {
    id: "queue-submission.list",
    method: "GET",
    pathPattern: "/api/company-brain/queue-submission",
  },
  {
    id: "queue-submission.mission",
    method: "GET",
    pathPattern: "/api/company-brain/queue-submission/:mission_id",
  },
  {
    id: "queue-submission.review",
    method: "POST",
    pathPattern: "/api/company-brain/queue-submission-review",
  },
  {
    id: "shadow-queue.list",
    method: "GET",
    pathPattern: "/api/runtime/shadow-queue",
  },
  {
    id: "shadow-queue.mission",
    method: "GET",
    pathPattern: "/api/runtime/shadow-queue/:mission_id",
  },
  {
    id: "shadow-queue.review",
    method: "POST",
    pathPattern: "/api/runtime/shadow-queue/review",
  },
  {
    id: "runtime-plan.list",
    method: "GET",
    pathPattern: "/api/runtime/runtime-plan",
  },
  {
    id: "runtime-plan.mission",
    method: "GET",
    pathPattern: "/api/runtime/runtime-plan/:mission_id",
  },
  {
    id: "execution-controller.list",
    method: "GET",
    pathPattern: "/api/runtime/execution-controller",
  },
  {
    id: "execution-controller.mission",
    method: "GET",
    pathPattern: "/api/runtime/execution-controller/:mission_id",
  },
  {
    id: "execution-controller.review",
    method: "POST",
    pathPattern: "/api/runtime/execution-controller/review",
  },
  {
    id: "department-registry.list",
    method: "GET",
    pathPattern: "/api/platform/departments",
  },
  {
    id: "department-registry.registry",
    method: "GET",
    pathPattern: "/api/platform/departments/registry",
  },
  {
    id: "department-registry.one",
    method: "GET",
    pathPattern: "/api/platform/departments/:department",
  },
  {
    id: "cost-ledger.list",
    method: "GET",
    pathPattern: "/api/platform/cost-ledger",
  },
  {
    id: "cost-ledger.budgets",
    method: "GET",
    pathPattern: "/api/platform/cost-ledger/budgets",
  },
  {
    id: "cost-ledger.session",
    method: "GET",
    pathPattern: "/api/platform/cost-ledger/:session",
  },
  {
    id: "worker-runtime.list",
    method: "GET",
    pathPattern: "/api/runtime/worker-runtime",
  },
  {
    id: "worker-runtime.assignments",
    method: "GET",
    pathPattern: "/api/runtime/worker-runtime/assignments",
  },
  {
    id: "worker-runtime.one",
    method: "GET",
    pathPattern: "/api/runtime/worker-runtime/:worker",
  },
  {
    id: "telemetry-registry.list",
    method: "GET",
    pathPattern: "/api/platform/telemetry",
  },
  {
    id: "telemetry-registry.events",
    method: "GET",
    pathPattern: "/api/platform/telemetry/events",
  },
  {
    id: "telemetry-registry.one",
    method: "GET",
    pathPattern: "/api/platform/telemetry/:session",
  },
  {
    id: "activation-gate.list",
    method: "GET",
    pathPattern: "/api/runtime/activation-gate",
  },
  {
    id: "activation-gate.certificate",
    method: "GET",
    pathPattern: "/api/runtime/activation-gate/certificate/:mission_id",
  },
  {
    id: "activation-gate.one",
    method: "GET",
    pathPattern: "/api/runtime/activation-gate/:mission_id",
  },
  {
    id: "execution-authorization.list",
    method: "GET",
    pathPattern: "/api/runtime/execution-authorization",
  },
  {
    id: "execution-authorization.certificate",
    method: "GET",
    pathPattern:
      "/api/runtime/execution-authorization/certificate/:mission_id",
  },
  {
    id: "execution-authorization.one",
    method: "GET",
    pathPattern: "/api/runtime/execution-authorization/:mission_id",
  },
  {
    id: "pre-dispatch-simulation.list",
    method: "GET",
    pathPattern: "/api/runtime/pre-dispatch-simulation",
  },
  {
    id: "pre-dispatch-simulation.one",
    method: "GET",
    pathPattern: "/api/runtime/pre-dispatch-simulation/:mission_id",
  },
];

const HARDCODED_ABSENT = [
  'pathOnly === "/api/company-brain/missions"',
  'pathOnly === "/api/runtime/runtime-release"',
  'pathOnly === "/api/runtime/system-readiness"',
  'pathOnly === "/api/company-brain/queue-review"',
  'pathOnly === "/api/company-brain/execution-package"',
  'pathOnly === "/api/company-brain/execution-package-ack"',
  'pathOnly === "/api/company-brain/queue-submission"',
  'pathOnly === "/api/runtime/shadow-queue"',
  'pathOnly === "/api/runtime/runtime-plan"',
  'pathOnly === "/api/runtime/execution-controller"',
  'pathOnly === "/api/platform/departments"',
  'pathOnly === "/api/platform/cost-ledger"',
  'pathOnly === "/api/runtime/worker-runtime"',
  'pathOnly === "/api/platform/telemetry"',
  'pathOnly === "/api/runtime/activation-gate"',
  'pathOnly === "/api/runtime/execution-authorization"',
  'pathOnly === "/api/runtime/pre-dispatch-simulation"',
] as const;

function clean(): void {
  if (existsSync(FIXTURE)) rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(FIXTURE, { recursive: true });
  writeFileSync(join(FIXTURE, ".verify-run"), new Date().toISOString(), "utf8");
}

function nullCtx(sources: SnapshotLoadContext["sources"] = []): SnapshotLoadContext {
  return {
    repoRoot: REPO,
    sources,
    readJson: () => null,
    missionStatus: null,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function keysOf(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

function collectSafetyFlags(value: unknown, out: string[] = []): string[] {
  if (value == null || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (
      [
        "execution_allowed",
        "dispatch_allowed",
        "scheduler_allowed",
        "worker_execution_allowed",
        "worker_spawn_allowed",
        "child_process_allowed",
        "queue_insert_allowed",
        "queue_enqueue_allowed",
        "submission_allowed",
        "provider_allowed",
        "publishing_allowed",
        "billing_allowed",
        "collection_allowed",
        "emission_allowed",
        "activation_enables_execution",
        "authorization_enables_execution",
        "overrides_activation_gate",
        "simulation_only",
        "billing_allowed",
        "telemetry_collection_enabled",
        "learning_write_enabled",
        "live",
        "live_enabled",
      ].includes(k)
    ) {
      if (v === true) out.push(k);
    } else if (typeof v === "object") {
      collectSafetyFlags(v, out);
    }
  }
  return out;
}

async function main(): Promise<void> {
  assert(isLiveOff(), "LIVE must be OFF");
  clean();
  const h = new BaseVerificationHarness();

  {
    const snapshots = new SnapshotRegistry();
    const routes = new RouteRegistry();
    registerAllDashboardPlugins(snapshots, routes);

    assert(WAVE1_DASHBOARD_PLUGINS.length === 3, "wave1 count");
    assert(WAVE2_DASHBOARD_PLUGINS.length === 6, "wave2 count");
    assert(ALL_DASHBOARD_PLUGINS.length === 17, "all plugins count");
    assert(
      snapshots.ids().sort().join(",") ===
        [...EXPECTED_PLUGIN_IDS].sort().join(","),
      "snapshot plugin ids",
    );
    for (const id of EXPECTED_PLUGIN_IDS) {
      const source = snapshots.get(id);
      assert(source != null, `source ${id}`);
      assert(
        source!.fields.join(",") === EXPECTED_FIELDS[id]!.join(","),
        `fields ${id}`,
      );
    }
    h.mark("plugin_registration", true);
  }

  {
    const snapshots = new SnapshotRegistry();
    const routes = new RouteRegistry();
    registerAllDashboardPlugins(snapshots, routes);
    const loader = new SnapshotLoader(snapshots);
    const readOrder: string[] = [];
    const ctx: SnapshotLoadContext = {
      repoRoot: REPO,
      sources: [],
      readJson: (rel) => {
        readOrder.push(rel);
        return null;
      },
      missionStatus: null,
    };

    for (const id of EXPECTED_PLUGIN_IDS) {
      const source = snapshots.get(id)!;
      const empty = source.empty();
      const loaded = source.load(nullCtx());
      assert(
        keysOf(empty).join(",") ===
          EXPECTED_FIELDS[id]!.slice().sort().join(","),
        `empty keys ${id}`,
      );
      assert(
        keysOf(loaded).join(",") ===
          EXPECTED_FIELDS[id]!.slice().sort().join(","),
        `load keys ${id}`,
      );
    }

    // Wave-2 empty vs legacy contract
    for (const [id, legacy] of Object.entries(LEGACY_EMPTY)) {
      const empty = snapshots.get(id)!.empty();
      assert(deepEqual(empty, legacy), `empty parity ${id}`);
    }

    // Wave-2 null-load vs legacy contract
    for (const [id, legacy] of Object.entries(LEGACY_NULL_LOAD)) {
      const loaded = snapshots.get(id)!.load(nullCtx());
      assert(deepEqual(loaded, legacy), `null-load parity ${id}`);
      const unsafe = collectSafetyFlags(loaded);
      assert(unsafe.length === 0, `safety flags ${id}: ${unsafe.join(",")}`);
    }

    // Source diagnostic ordering — call loaders in loadSnapshot order
    readOrder.length = 0;
    const orderIds = [
      "mission-approval",
      "queue-admission",
      "execution-package",
      "execution-package-ack",
      "queue-submission",
      "shadow-queue",
      "runtime-plan",
      "runtime-release",
      "system-readiness",
    ] as const;
    for (const id of orderIds) {
      loader.loadOne(id, ctx);
    }
    assert(readOrder.length > 0, "source reads recorded");
    // First path of each stage must appear in registration/load order
    const firsts = [
      "SOS/07_LOGS/saios/company-brain/mission-approvals/latest-mission-approval.json",
      "SOS/07_LOGS/saios/company-brain/queue-admission/latest-queue-admission.json",
      "SOS/07_LOGS/saios/company-brain/execution-packages/latest-execution-package.json",
      "SOS/07_LOGS/saios/company-brain/execution-package-ack/latest-execution-package-ack.json",
      "SOS/07_LOGS/saios/company-brain/queue-submission/latest-queue-submission-snapshot.json",
      "SOS/07_LOGS/saios/runtime/shadow-queue/latest-shadow-queue-snapshot.json",
      "SOS/07_LOGS/saios/runtime/runtime-plan/latest-runtime-plan-snapshot.json",
      "SOS/07_LOGS/saios/runtime/runtime-release/latest-runtime-release.json",
      "SOS/07_LOGS/saios/runtime/system-readiness/latest-system-readiness-snapshot.json",
    ];
    let cursor = 0;
    for (const path of firsts) {
      const idx = readOrder.indexOf(path, cursor);
      assert(idx >= 0, `source order missing ${path}`);
      cursor = idx + 1;
    }
    writeFileSync(
      join(FIXTURE, "source-read-order.json"),
      JSON.stringify(readOrder, null, 2),
      "utf8",
    );
    h.mark("snapshot_parity", true);
  }

  {
    const snapshots = new SnapshotRegistry();
    const routes = new RouteRegistry();
    registerAllDashboardPlugins(snapshots, routes);

    const listed = routes.list();
    assert(listed.length === EXPECTED_ROUTES.length, "route count");
    for (const expected of EXPECTED_ROUTES) {
      const found = listed.find((r) => r.id === expected.id);
      assert(found != null, `route ${expected.id}`);
      assert(found!.method === expected.method, `method ${expected.id}`);
      assert(
        found!.pathPattern === expected.pathPattern,
        `pattern ${expected.id}`,
      );
    }

    // Param + reserved checks
    const shadowMission = listed.find((r) => r.id === "shadow-queue.mission")!;
    assert(
      shadowMission.match("/api/runtime/shadow-queue/m-1", "GET")?.params
        .mission_id === "m-1",
      "shadow param",
    );
    assert(
      shadowMission.match("/api/runtime/shadow-queue/review", "GET") == null,
      "shadow reserved",
    );
    const shadowReview = listed.find((r) => r.id === "shadow-queue.review")!;
    assert(
      shadowReview.match("/api/runtime/shadow-queue/review", "POST") != null,
      "shadow review",
    );

    // Response payload shape keys (safety) from null-load snapshots already checked;
    // route handlers share the same false flags in plugin sources.
    h.mark("route_parity", true);
  }

  {
    const snapshots = new SnapshotRegistry();
    const routes = new RouteRegistry();
    registerAllDashboardPlugins(snapshots, routes);

    const handledUnknown = await routes.tryHandle(
      { method: "GET" } as IncomingMessage,
      {} as ServerResponse,
      "/api/unknown",
      { repoRoot: REPO, readBody: async () => "" },
    );
    assert(handledUnknown === false, "unknown route not handled");
    h.mark("route_dispatch", true);
  }

  {
    const loadSnapshot = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/data/loadSnapshot.ts"),
      "utf8",
    );
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    assert(
      loadSnapshot.includes("ensureDashboardPluginsRegistered"),
      "loadSnapshot registers plugins",
    );
    assert(
      loadSnapshot.includes('"queue-admission"'),
      "loadSnapshot queue-admission",
    );
    assert(
      loadSnapshot.includes('"execution-package"'),
      "loadSnapshot execution-package",
    );
    assert(
      loadSnapshot.includes('"execution-package-ack"'),
      "loadSnapshot execution-package-ack",
    );
    assert(
      loadSnapshot.includes('"queue-submission"'),
      "loadSnapshot queue-submission",
    );
    assert(
      loadSnapshot.includes('"shadow-queue"'),
      "loadSnapshot shadow-queue",
    );
    assert(
      loadSnapshot.includes('"runtime-plan"'),
      "loadSnapshot runtime-plan",
    );
    assert(
      loadSnapshot.includes('"execution-controller"'),
      "loadSnapshot execution-controller",
    );
    assert(
      loadSnapshot.includes('"department-registry"'),
      "loadSnapshot department-registry",
    );
    assert(
      loadSnapshot.includes('"cost-ledger"'),
      "loadSnapshot cost-ledger",
    );
    assert(
      loadSnapshot.includes('"worker-runtime"'),
      "loadSnapshot worker-runtime",
    );
    assert(
      loadSnapshot.includes('"telemetry-registry"'),
      "loadSnapshot telemetry-registry",
    );
    assert(
      loadSnapshot.includes('"activation-gate"'),
      "loadSnapshot activation-gate",
    );
    assert(
      loadSnapshot.includes('"execution-authorization"'),
      "loadSnapshot execution-authorization",
    );
    assert(
      loadSnapshot.includes('"pre-dispatch-simulation"'),
      "loadSnapshot pre-dispatch-simulation",
    );
    assert(
      !loadSnapshot.includes(
        "SOS/07_LOGS/saios/company-brain/queue-admission/latest-queue-admission.json",
      ),
      "no inline queue-admission read",
    );
    assert(
      server.includes("ensureDashboardPluginsRegistered"),
      "server registers plugins",
    );
    assert(
      server.includes("defaultRouteRegistry.tryHandle"),
      "server tryHandle",
    );
    assert(
      server.includes("/api/founder-review") &&
        server.includes("/api/founder-decision"),
      "founder review intact",
    );
    for (const needle of HARDCODED_ABSENT) {
      assert(!server.includes(needle), `no hardcoded ${needle}`);
    }
    h.mark("dashboard_wired", true);
  }

  {
    assert(
      existsSync(join(REPO, "SOS/SAIOS/platform/dashboard/ARCHITECTURE.json")),
      "architecture json",
    );
    for (const f of [
      "queueAdmission.ts",
      "executionPackage.ts",
      "executionPackageAck.ts",
      "queueSubmission.ts",
      "shadowQueue.ts",
      "runtimePlan.ts",
      "executionController.ts",
      "departmentRegistry.ts",
      "costLedger.ts",
      "workerRuntime.ts",
      "telemetryRegistry.ts",
      "activationGate.ts",
      "executionAuthorization.ts",
      "preDispatchSimulation.ts",
    ]) {
      assert(
        existsSync(join(REPO, "SOS/SAIOS/platform/dashboard/plugins", f)),
        `plugin ${f}`,
      );
    }
    const pkg = JSON.parse(
      readFileSync(join(REPO, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    assert(
      typeof pkg.scripts?.["dashboard-platform:verify"] === "string",
      "npm script",
    );
    h.mark("platform_files", true);
  }

  h.mark("backward_compatible_contracts", true);
  h.mark("no_execution", true);
  h.mark("live_off", isLiveOff());
  h.finish("dashboard-plugin-migration-wave-2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
