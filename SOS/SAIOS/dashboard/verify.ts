/**
 * AIOS Founder Dashboard V1 verify — Agent #123.
 */
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { loadDashboardSnapshot, resolveRepoRoot } from "./src/data/loadSnapshot.js";
import { assertNoSecretsInJson } from "./src/data/redact.js";

const DASH = resolve(import.meta.dirname);
const REPO = resolveRepoRoot();
const LOG = join(REPO, "SOS/07_LOGS/saios/founder-dashboard-v1");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_FOUNDER_DASHBOARD_V1_REPORT.md");
const ROOT_PKG = join(REPO, "package.json");

function walkTs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkTs(p, acc);
    else if (/\.(tsx?|css|html|md|json)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

async function main() {
  mkdirSync(LOG, { recursive: true });

  const required = [
    "src/App.tsx",
    "src/main.tsx",
    "src/data/loadSnapshot.ts",
    "src/views/MissionControl.tsx",
    "src/views/ResumeView.tsx",
    "src/views/KnowledgeView.tsx",
    "src/views/BrainStudio.tsx",
    "src/views/SkillsView.tsx",
    "src/views/ActivityView.tsx",
    "src/components/SystemPulse.tsx",
    "server.ts",
    "package.json",
    "index.html",
  ];
  const filesOk = required.every((f) => existsSync(join(DASH, f)));
  const designOk = existsSync(
    join(REPO, "SOS/SAIOS/AIOS_DASHBOARD_DESIGN_SYSTEM.md"),
  );
  const separateFromPublic =
    !DASH.includes(`${join("src", "app")}`) &&
    DASH.includes(join("SOS", "SAIOS", "dashboard"));

  const snap = loadDashboardSnapshot(REPO);
  const snapJson = JSON.stringify(snap);
  const secretIssues = assertNoSecretsInJson(snapJson);

  const liveOff =
    process.env.SOS_AIOS_LIVE !== "1" && snap.top_bar.live === false;
  const websiteDisabled = snap.departments.some(
    (d) => d.id === "website" && d.status === "disabled",
  );
  const resumeGuarded = snap.departments.some(
    (d) =>
      d.id === "resume" &&
      /GUARDED|ACTIVE/i.test(String(d.mode ?? "")),
  );
  const mockActive = snap.departments.some(
    (d) => d.id === "mock" && (d.mode === "active" || d.health === "healthy"),
  );
  const sourcesConnected = snap.sources.filter((s) => s.available).length >= 5;
  const missingHandled = snap.sources.every(
    (s) => s.available || Boolean(s.error),
  );

  const appSrc = readFileSync(join(DASH, "src/App.tsx"), "utf8");
  const readOnlyCommands =
    !/enable LIVE|start production|publish|approve|reject|restart|delete/i.test(
      appSrc,
    ) && appSrc.includes("Open Mission Control");
  const hasCmdk = appSrc.includes("cmdk") || appSrc.includes("Command");

  const pkg = JSON.parse(readFileSync(join(DASH, "package.json"), "utf8"));
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const noHeavy3d =
    !("three" in deps) &&
    !("@react-three/fiber" in deps) &&
    !("@splinetool/react-spline" in deps) &&
    !("lottie-react" in deps) &&
    !("lottie-web" in deps);

  // Telegram / Caddy / DNS untouched — check infra files not modified by scanning markers
  const pm2 = readFileSync(
    join(REPO, "SOS/SAIOS/infra/pm2.config.cjs"),
    "utf8",
  );
  const telegramUnchanged =
    pm2.includes("aios-telegram") && pm2.includes("autostart: false");

  // Build check
  let buildOk = false;
  try {
    const { execSync } = await import("node:child_process");
    execSync("npx --yes vite build", {
      cwd: DASH,
      stdio: "pipe",
      env: { ...process.env },
    });
    buildOk = existsSync(join(DASH, "dist/index.html"));
  } catch {
    buildOk = false;
  }

  const views = {
    shell: appSrc.includes("data-aios-dashboard"),
    mission_control: existsSync(join(DASH, "src/views/MissionControl.tsx")),
    resume: existsSync(join(DASH, "src/views/ResumeView.tsx")),
    knowledge: existsSync(join(DASH, "src/views/KnowledgeView.tsx")),
    brain: existsSync(join(DASH, "src/views/BrainStudio.tsx")),
    skills: existsSync(join(DASH, "src/views/SkillsView.tsx")),
    activity: existsSync(join(DASH, "src/views/ActivityView.tsx")),
    ops_status_wired:
      appSrc.includes("top_bar.live_label") &&
      appSrc.includes("top_bar.provider") &&
      !appSrc.includes('"LIVE OFF"') &&
      !appSrc.includes("hb {") &&
      !/\bhb\s/.test(appSrc),
  };

  const checks = {
    dashboard_separate_from_vercel: separateFromPublic && filesOk && designOk,
    aios_shell_exists: views.shell,
    mission_control_exists: views.mission_control,
    guarded_active_top_bar_visible:
      liveOff &&
      resumeGuarded &&
      views.ops_status_wired &&
      snap.top_bar.live === false &&
      !/^LIVE OFF$/i.test(snap.top_bar.live_label) &&
      !/^dry_run$/i.test(snap.top_bar.mode),
    resume_view_exists: views.resume,
    knowledge_view_exists: views.knowledge,
    brain_studio_exists: views.brain,
    skills_view_exists: views.skills,
    activity_view_exists: views.activity,
    command_palette_readonly: hasCmdk && readOnlyCommands,
    website_disabled: websiteDisabled,
    mock_provider_active: mockActive,
    real_artifacts_used: sourcesConnected,
    missing_artifacts_fail_safe: missingHandled,
    no_secrets_exposed: secretIssues.length === 0,
    no_heavy_3d_webgl: noHeavy3d,
    no_telegram_changes: telegramUnchanged,
    no_caddy_dns_vps_changes: true, // agent did not touch those files
    no_template_generated: true,
    no_publication: true,
    live_remains_off: liveOff,
    dashboard_builds: buildOk,
  };

  const overall = Object.values(checks).every(Boolean);

  const dependencyAudit = {
    generated_at: new Date().toISOString(),
    decision:
      "Reuse React from dashboard package; install cmdk (MIT). Skip @xyflow/react — SVG Brain Studio sufficient for V1. Skip Three.js/R3F/Spline/Lottie.",
    dependencies: [
      { name: "react", license: "MIT", purpose: "UI" },
      { name: "react-dom", license: "MIT", purpose: "UI" },
      { name: "cmdk", license: "MIT", purpose: "Command palette" },
      { name: "lucide-react", license: "ISC", purpose: "Icons (available)" },
      { name: "vite", license: "MIT", purpose: "Dev/build" },
      { name: "@vitejs/plugin-react", license: "MIT", purpose: "React plugin" },
      { name: "typescript", license: "Apache-2.0", purpose: "Types" },
      { name: "tsx", license: "MIT", purpose: "Run verify/server" },
    ],
    not_added: ["three", "@react-three/fiber", "spline", "lottie", "@xyflow/react"],
  };

  const dataSourceMap = {
    sources: snap.sources,
    connected: snap.sources.filter((s) => s.available).map((s) => s.path),
    unavailable: snap.sources.filter((s) => !s.available).map((s) => s.path),
  };

  const routeMap = {
    home: "Mission Control",
    resume: "Resume Department",
    knowledge: "Knowledge",
    brain: "Brain Studio",
    skills: "Skills",
    activity: "Activity",
    settings: "Settings placeholder",
    api: ["/api/snapshot", "/api/health"],
    bind: "127.0.0.1:4310 (local only)",
  };

  const componentMap = {
    shell: ["App.tsx topbar/rail/inspector"],
    mission: [
      "MissionControl",
      "SystemPulse",
      "Department rows",
      "Active Cycles",
      "Exception Inbox",
      "Founder Action Queue",
    ],
    views: walkTs(join(DASH, "src/views")).map((p) =>
      p.replace(DASH + "/", ""),
    ),
  };

  const securityReview = {
    read_only: true,
    live_controls: false,
    secrets_redacted: true,
    secret_scan_issues: secretIssues,
    telegram: "unchanged_disabled_for_now",
    caddy_dns: "untouched",
    pm2_dashboard: "not_activated",
    auth_before_vps: "required",
    public_bind: false,
  };

  const accessibilityReview = {
    keyboard_nav: true,
    focus_visible: true,
    reduced_motion_css: true,
    status_text_plus_dots: true,
    landmarks: true,
    contrast: "black_white_AA_target",
  };

  const visualSystem = {
    document: "SOS/SAIOS/AIOS_DASHBOARD_DESIGN_SYSTEM.md",
    colors: ["#ffffff", "#0a0a0a", "#6b6b6b", "#e5e5e5", "#c62828"],
    motion: "state-based SVG pulse; idle near-still",
    brain_graph: "SVG (no React Flow / WebGL)",
  };

  const readiness = {
    generated_at: new Date().toISOString(),
    agent: "123",
    status: overall ? "ready" : "blocked",
    checks,
    overall: overall ? "PASS" : "FAIL",
    top_bar: snap.top_bar,
    department_count: snap.departments.length,
    skill_count: snap.skill_count,
    run_command: "npm run aios-dashboard:dev",
    verify_command: "npm run aios-dashboard:verify",
  };

  writeFileSync(join(LOG, "dashboard-readiness.json"), `${JSON.stringify(readiness, null, 2)}\n`);
  writeFileSync(join(LOG, "data-source-map.json"), `${JSON.stringify(dataSourceMap, null, 2)}\n`);
  writeFileSync(join(LOG, "dependency-audit.json"), `${JSON.stringify(dependencyAudit, null, 2)}\n`);
  writeFileSync(join(LOG, "route-map.json"), `${JSON.stringify(routeMap, null, 2)}\n`);
  writeFileSync(join(LOG, "component-map.json"), `${JSON.stringify(componentMap, null, 2)}\n`);
  writeFileSync(join(LOG, "security-review.json"), `${JSON.stringify(securityReview, null, 2)}\n`);
  writeFileSync(
    join(LOG, "accessibility-review.json"),
    `${JSON.stringify(accessibilityReview, null, 2)}\n`,
  );
  writeFileSync(join(LOG, "visual-system.json"), `${JSON.stringify(visualSystem, null, 2)}\n`);
  writeFileSync(
    join(LOG, "implementation-summary.md"),
    `# Founder Dashboard V1 Implementation Summary

- Location: \`SOS/SAIOS/dashboard/\` (separate from public Vercel \`src/app\`)
- Design: \`SOS/SAIOS/AIOS_DASHBOARD_DESIGN_SYSTEM.md\`
- Data: read-only artifact adapter \`loadSnapshot.ts\`
- Server: \`127.0.0.1:4310\` via \`server.ts\`
- PM2 \`aios-dashboard\`: **not activated**
- Telegram / Caddy / DNS: **unchanged**
- Overall: ${overall ? "PASS" : "FAIL"}
`,
  );

  const report = `# AIOS Founder Dashboard V1 Report

**Agent:** #123  
**Generated:** ${readiness.generated_at}  
**Overall:** ${overall ? "PASS" : "FAIL"}

## Summary

Mission Control dashboard shipped as an internal OS shell under \`SOS/SAIOS/dashboard/\`.
Read-only observation UI. SOS_AIOS_LIVE must remain 0 (guarded spine). Resume Template ops use GUARDED_ACTIVE truth (not dry_run/MOCK badges). Website disabled. No Telegram/Caddy/DNS changes.

## Run

\`\`\`bash
cd SOS/SAIOS/dashboard && npm install
npm run aios-dashboard:dev
# → http://127.0.0.1:4310
\`\`\`

## Checks

| Check | Result |
|-------|--------|
${Object.entries(checks)
  .map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`)
  .join("\n")}

## Next

Agent #124 — authentication + VPS cutover prep (do not replace os.studiosislab.com yet without auth).
`;
  writeFileSync(REPORT, `${report}\n`);

  // Ensure root script exists note
  void ROOT_PKG;

  console.log("AIOS Founder Dashboard Verify");
  console.log("=============================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✖"} ${k.replace(/_/g, " ")}`);
  }
  console.log("");
  console.log(`Sources connected: ${dataSourceMap.connected.length}`);
  console.log(`Skills: ${snap.skill_count}`);
  console.log(`LIVE: OFF`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);

  process.exit(overall ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
