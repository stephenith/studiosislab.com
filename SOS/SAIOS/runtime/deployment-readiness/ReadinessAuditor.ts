/**
 * Read-only deployment readiness checks.
 */
import { exists, readJson, readable } from "./utils.js";
import type { CheckResult } from "./types.js";

function check(
  id: string,
  category: string,
  label: string,
  pass: boolean,
  detail: string,
  weight = 1,
): CheckResult {
  return { id, category, label, pass, weight, detail };
}

export function runAllChecks(): CheckResult[] {
  const ops = readJson<{
    operations?: Record<string, Record<string, unknown>>;
    factory_v1?: { status?: string; production_ready?: boolean };
    pending_actions?: string[];
    discovery?: {
      releases?: Array<{ rollback_available?: boolean; status?: string }>;
    };
  }>("SOS/project-state.json");

  const o = ops?.operations ?? {};
  const checks: CheckResult[] = [];

  // --- Departments / modules present ---
  const modules: Array<[string, string]> = [
    ["runtime-manager", "SOS/SAIOS/runtime/runtime-manager"],
    ["runtime-loop", "SOS/SAIOS/runtime/runtime-loop"],
    ["runtime-supervisor", "SOS/SAIOS/runtime/runtime-supervisor"],
    ["live-runtime", "SOS/SAIOS/runtime/live-runtime"],
    ["deployment-package", "SOS/SAIOS/runtime/deployment-package"],
    ["website-department", "SOS/SAIOS/runtime/website-department"],
    ["notification-department", "SOS/SAIOS/runtime/notification-department"],
    ["timeline-department", "SOS/SAIOS/runtime/timeline-department"],
    ["security-department", "SOS/SAIOS/runtime/security-department"],
    ["event-bus", "SOS/SAIOS/runtime/event-bus"],
    ["founder-control-center", "SOS/SAIOS/runtime/founder-control-center"],
    ["resume-factory", "SOS/SAIOS/runtime/unified-production"],
    ["release-manager", "SOS/SAIOS/runtime/publication"],
    ["catalog-integrity", "SOS/SAIOS/runtime/catalog-integrity"],
    ["batch-release", "SOS/SAIOS/runtime/batch-release"],
  ];
  for (const [id, path] of modules) {
    checks.push(
      check(
        `module-${id}`,
        "runtime",
        `Module present: ${id}`,
        exists(path),
        path,
        2,
      ),
    );
  }

  // --- Ops status ---
  const statusOk = (key: string, accept: string[]) => {
    const st = String(o[key]?.status ?? o[key]?.health ?? "").toUpperCase();
    return accept.some((a) => st.includes(a));
  };

  checks.push(
    check(
      "ops-runtime-manager",
      "runtime",
      "Runtime Manager RUNNING",
      statusOk("runtime_manager", ["RUNNING", "READY", "HEALTHY"]),
      String(o.runtime_manager?.status ?? "missing"),
      3,
    ),
  );
  checks.push(
    check(
      "ops-runtime-loop",
      "runtime",
      "Runtime Loop READY",
      statusOk("runtime_loop", ["READY"]),
      String(o.runtime_loop?.status ?? "missing"),
      3,
    ),
  );
  checks.push(
    check(
      "ops-supervisor",
      "runtime",
      "Runtime Supervisor READY",
      statusOk("runtime_supervisor", ["READY"]),
      String(o.runtime_supervisor?.status ?? "missing"),
      3,
    ),
  );
  checks.push(
    check(
      "ops-live-runtime",
      "runtime",
      "Live Runtime READY",
      statusOk("live_runtime", ["READY"]),
      String(o.live_runtime?.status ?? "missing"),
      3,
    ),
  );
  checks.push(
    check(
      "ops-website",
      "runtime",
      "Website HEALTHY",
      statusOk("website_department", ["HEALTHY", "READY"]),
      String(o.website_department?.status ?? "missing"),
      2,
    ),
  );
  checks.push(
    check(
      "ops-security",
      "runtime",
      "Security READY (not RED)",
      statusOk("security_department", ["READY"]) &&
        String(o.security_department?.security_level ?? "").toUpperCase() !==
          "RED",
      `status=${o.security_department?.status}; level=${o.security_department?.security_level}`,
      2,
    ),
  );
  checks.push(
    check(
      "ops-event-bus",
      "runtime",
      "Event Bus READY",
      statusOk("event_bus", ["READY"]),
      String(o.event_bus?.status ?? "missing"),
      2,
    ),
  );
  checks.push(
    check(
      "ops-fcc",
      "runtime",
      "Founder Control Center READY",
      statusOk("founder_control_center", ["READY"]),
      String(o.founder_control_center?.status ?? "missing"),
      2,
    ),
  );
  checks.push(
    check(
      "ops-deployment-package",
      "infrastructure",
      "Deployment Package READY",
      statusOk("deployment_package", ["READY"]),
      String(o.deployment_package?.status ?? "missing"),
      3,
    ),
  );

  // --- Startup / shutdown / deps ---
  const plan = readJson<{
    startup_order?: string[];
    shutdown_order?: string[];
    departments?: unknown[];
  }>("SOS/07_LOGS/saios/deployment-manager/deployment-plan.json");
  const deps = readJson<{
    startup_order?: string[];
    nodes?: unknown[];
  }>("SOS/07_LOGS/saios/runtime-manager/runtime-dependencies.json");

  checks.push(
    check(
      "startup-order",
      "runtime",
      "Startup order present",
      (plan?.startup_order?.length ?? 0) > 0 ||
        (deps?.startup_order?.length ?? 0) > 0,
      `plan=${plan?.startup_order?.length ?? 0}; deps=${deps?.startup_order?.length ?? 0}`,
      3,
    ),
  );
  checks.push(
    check(
      "shutdown-order",
      "runtime",
      "Shutdown order present",
      (plan?.shutdown_order?.length ?? 0) > 0,
      `count=${plan?.shutdown_order?.length ?? 0}`,
      2,
    ),
  );
  checks.push(
    check(
      "dependency-graph",
      "runtime",
      "Dependency graph present",
      (deps?.nodes?.length ?? 0) > 0 || (plan?.departments?.length ?? 0) > 0,
      `nodes=${deps?.nodes?.length ?? 0}`,
      3,
    ),
  );

  // --- Deployment assets ---
  const pkg = "SOS/07_LOGS/saios/deployment-package";
  const assets: Array<[string, string, string]> = [
    ["docker-dockerfile", "Docker package", `${pkg}/Dockerfile`],
    ["docker-compose", "Docker compose", `${pkg}/docker-compose.yml`],
    ["pm2-config", "PM2 configuration", `${pkg}/pm2.config.cjs`],
    ["systemd-unit", "systemd configuration", `${pkg}/aios.service`],
    ["install-script", "install scripts", `${pkg}/install.sh`],
    ["backup-script", "backup scripts", `${pkg}/backup.sh`],
    ["restore-script", "restore scripts", `${pkg}/restore.sh`],
    ["update-script", "update scripts", `${pkg}/update.sh`],
    ["env-example", "environment template", `${pkg}/.env.example`],
    ["healthcheck", "health endpoints", `${pkg}/healthcheck.js`],
  ];
  for (const [id, label, path] of assets) {
    checks.push(
      check(id, "infrastructure", label, exists(path) && readable(path), path, 2),
    );
  }

  // --- Folders / logs / permissions ---
  const folders = [
    "SOS",
    "SOS/SAIOS/runtime",
    "SOS/07_LOGS/saios",
    "SOS/07_LOGS/saios/runtime-loop",
    "SOS/07_LOGS/saios/runtime-supervisor",
    "SOS/07_LOGS/saios/live-runtime",
    "SOS/07_LOGS/saios/deployment-package",
  ];
  for (const f of folders) {
    checks.push(
      check(
        `folder-${f.replace(/[\\/]/g, "-")}`,
        "infrastructure",
        `Required folder: ${f}`,
        exists(f) && readable(f),
        f,
        1,
      ),
    );
  }

  // --- Heartbeat / restart / recovery ---
  const hb = readJson<{ heartbeat_at?: string }>(
    "SOS/07_LOGS/saios/runtime-loop/runtime-heartbeat.json",
  );
  checks.push(
    check(
      "heartbeat",
      "runtime",
      "Heartbeat present",
      Boolean(hb?.heartbeat_at),
      hb?.heartbeat_at ?? "missing",
      3,
    ),
  );

  const recovery = readJson<{ recoveries?: unknown[] }>(
    "SOS/07_LOGS/saios/runtime-supervisor/recovery-history.json",
  );
  const restart = readJson<{ restarts?: unknown[] }>(
    "SOS/07_LOGS/saios/runtime-supervisor/restart-history.json",
  );
  checks.push(
    check(
      "recovery-flow",
      "recovery",
      "Recovery flow artifacts",
      recovery != null,
      `recoveries=${recovery?.recoveries?.length ?? 0}`,
      2,
    ),
  );
  checks.push(
    check(
      "restart-flow",
      "recovery",
      "Restart flow artifacts",
      restart != null,
      `restarts=${restart?.restarts?.length ?? 0}`,
      2,
    ),
  );

  // --- Founder gate / LIVE safety ---
  const gate = readJson<{
    approved?: boolean;
    live_flag?: boolean;
    checks?: Array<{ pass?: boolean }>;
  }>("SOS/07_LOGS/saios/live-runtime/runtime-gate.json");
  const mode = readJson<{
    effective_mode?: string;
    requested_mode?: string;
  }>("SOS/07_LOGS/saios/live-runtime/runtime-mode.json");

  checks.push(
    check(
      "founder-gate",
      "founder_safety",
      "Founder gate evaluated",
      gate != null && Array.isArray(gate.checks),
      `approved=${gate?.approved}; live_flag=${gate?.live_flag}`,
      3,
    ),
  );
  checks.push(
    check(
      "live-mode-safety",
      "founder_safety",
      "LIVE mode not enabled by default",
      mode?.effective_mode !== "LIVE" && gate?.live_flag !== true,
      `effective=${mode?.effective_mode}; live_flag=${gate?.live_flag}`,
      4,
    ),
  );

  // --- Notification / Telegram bridge ---
  const liveMon = o.live_monitoring as
    | { commander_bridge_detected?: boolean; duplicate_telegram_stack?: boolean }
    | undefined;
  checks.push(
    check(
      "notification-bridge",
      "founder_safety",
      "Notification bridge available",
      liveMon?.commander_bridge_detected === true ||
        exists("SOS/runtime/src/services/notification-pipeline.ts"),
      `commander_bridge=${liveMon?.commander_bridge_detected}`,
      2,
    ),
  );
  checks.push(
    check(
      "telegram-bridge",
      "founder_safety",
      "Single Telegram stack (no duplicate)",
      liveMon?.duplicate_telegram_stack !== true &&
        exists("SOS/runtime/src/services/telegram.ts"),
      `duplicate=${liveMon?.duplicate_telegram_stack}`,
      3,
    ),
  );

  // --- Factory / publication / rollback ---
  checks.push(
    check(
      "factory-stable",
      "publication",
      "Resume Factory STABLE",
      ops?.factory_v1?.status === "STABLE",
      String(ops?.factory_v1?.status ?? "missing"),
      4,
    ),
  );
  checks.push(
    check(
      "publication-safety",
      "publication",
      "Publication / release manager available",
      exists("SOS/SAIOS/runtime/publication") &&
        exists("SOS/07_LOGS/saios/publication"),
      "publication module + logs",
      2,
    ),
  );
  const rollbacks = (ops?.discovery?.releases ?? []).filter(
    (r) => r.rollback_available,
  ).length;
  checks.push(
    check(
      "rollback-readiness",
      "recovery",
      "Rollback readiness",
      rollbacks > 0 ||
        exists("SOS/07_LOGS/saios/publication/release-manager/snapshots"),
      `rollback_available_releases=${rollbacks}`,
      3,
    ),
  );

  const catalog = o.catalog_integrity as
    | { conflicts_detected?: number; safe_to_publish?: boolean }
    | undefined;
  checks.push(
    check(
      "catalog-integrity",
      "publication",
      "Catalog integrity tracked",
      catalog != null,
      `conflicts=${catalog?.conflicts_detected}; safe=${catalog?.safe_to_publish}`,
      2,
    ),
  );

  // Env template
  checks.push(
    check(
      "env-vars-template",
      "infrastructure",
      "Environment variables template",
      exists(`${pkg}/.env.example`),
      `${pkg}/.env.example`,
      2,
    ),
  );

  return checks;
}
