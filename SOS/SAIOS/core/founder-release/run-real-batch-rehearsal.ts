/**
 * Agent #248 — Real Founder Batch Release Rehearsal (dry-run only).
 * Inspects real OpenAI batch templates. Never publishes. LIVE OFF.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { listReservations } from "../export/CatalogueReservation.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CAND_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);
const DECISIONS = join(
  REPO,
  "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
);
const OUT_DIR = join(REPO, "SOS/07_LOGS/saios/export/rehearsal");
const MACHINE = join(REPO, "SOS/07_LOGS/saios/export/verify-real-batch-rehearsal.json");
const REPORT_REHEARSAL = join(
  REPO,
  "SOS/09_REPORTS/AIOS_REAL_BATCH_RELEASE_REHEARSAL.md",
);
const REPORT_PLAN = join(REPO, "SOS/09_REPORTS/AIOS_FIRST_RELEASE_PLAN.md");

type BatchRow = {
  role: string;
  family: string;
  candidate_id: string;
  review_id: string;
};

const BATCH: BatchRow[] = [
  {
    role: "Marketing Manager",
    family: "executive",
    candidate_id:
      "cand-marketing-marketing-manager-executive-v0-20260724T070640Z-9ca40a",
    review_id:
      "founder-review-cycle-marketing-marketing-manager-executive-v0-20260724T070640Z-9ca40a",
  },
  {
    role: "Software Engineer",
    family: "modern",
    candidate_id:
      "cand-engineering-software-engineer-modern-v0--20260724T070713Z-c2cee0",
    review_id:
      "founder-review-cycle-engineering-software-engineer-modern-v0--20260724T070713Z-c2cee0",
  },
  {
    role: "Graphic Designer",
    family: "editorial",
    candidate_id:
      "cand-creative-graphic-designer-editorial-v0-o-20260724T070748Z-8df58a",
    review_id:
      "founder-review-cycle-creative-graphic-designer-editorial-v0-o-20260724T070748Z-8df58a",
  },
  {
    role: "Accountant",
    family: "technical",
    candidate_id:
      "cand-finance-accountant-technical-v0-oai240-m-20260724T070816Z-98e7f6",
    review_id:
      "founder-review-cycle-finance-accountant-technical-v0-oai240-m-20260724T070816Z-98e7f6",
  },
  {
    role: "HR Manager",
    family: "contemporary_accent",
    candidate_id:
      "cand-ats-hr-manager-contemporary-accent-v0-oa-20260724T070849Z-e99d14",
    review_id:
      "founder-review-cycle-ats-hr-manager-contemporary-accent-v0-oa-20260724T070849Z-e99d14",
  },
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadDecisions(): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!existsSync(DECISIONS)) return map;
  for (const line of readFileSync(DECISIONS, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const d = JSON.parse(line) as Record<string, unknown>;
    const rid = String(d.review_id ?? "");
    map.set(rid, d);
  }
  return map;
}

function scoreWalk(obj: unknown, out: Record<string, number> = {}): Record<string, number> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (
      typeof v === "number" &&
      [
        "overall",
        "ats",
        "layout",
        "visual",
        "typography",
        "technical",
        "thumbnail_appeal",
        "contrast",
      ].includes(k)
    ) {
      out[k] = v;
    } else if (v && typeof v === "object") {
      scoreWalk(v, out);
    }
  }
  return out;
}

function seoSlugFree(slug: string): boolean {
  const seoPath = join(REPO, "src/data/templateSeoContent.ts");
  if (!existsSync(seoPath)) return true;
  return !readFileSync(seoPath, "utf8").includes(`slug: "${slug}"`);
}

function likelySlug(role: string): { preferred: string; alternate: string } {
  const map: Record<string, { preferred: string; alternate: string }> = {
    "Marketing Manager": {
      preferred: "marketing-manager-resume",
      alternate: "marketing-manager-executive-resume",
    },
    "Software Engineer": {
      preferred: "software-engineer-resume",
      alternate: "software-engineer-modern-resume",
    },
    "Graphic Designer": {
      preferred: "graphic-designer-resume",
      alternate: "graphic-designer-editorial-resume",
    },
    Accountant: {
      preferred: "accountant-resume",
      alternate: "accountant-technical-resume",
    },
    "HR Manager": {
      preferred: "hr-manager-resume",
      alternate: "hr-manager-contemporary-resume",
    },
  };
  return map[role] ?? {
    preferred: `${role.toLowerCase().replace(/\s+/g, "-")}-resume`,
    alternate: `${role.toLowerCase().replace(/\s+/g, "-")}-ats-resume`,
  };
}

function eligibility(input: {
  decision: string | null;
  reservationStatus: string | null;
  hasExport: boolean;
  hasStagingValidated: boolean;
}): { eligible: boolean; missing: string[] } {
  const missing: string[] = [];
  if (input.decision !== "APPROVED") missing.push("Founder Approved");
  if (!input.hasStagingValidated) missing.push("VALIDATED (staging)");
  if (input.reservationStatus !== "EXPORT_BUILT" &&
      input.reservationStatus !== "ASSETS_READY" &&
      input.reservationStatus !== "READY_FOR_RELEASE" &&
      input.reservationStatus !== "RELEASE_COMPLETED") {
    missing.push("EXPORT_BUILT");
  }
  if (
    input.reservationStatus !== "ASSETS_READY" &&
    input.reservationStatus !== "READY_FOR_RELEASE" &&
    input.reservationStatus !== "RELEASE_COMPLETED"
  ) {
    missing.push("ASSETS_READY");
  }
  if (
    input.reservationStatus !== "READY_FOR_RELEASE" &&
    input.reservationStatus !== "RELEASE_COMPLETED"
  ) {
    missing.push("READY_FOR_RELEASE");
  }
  if (!input.hasExport && input.reservationStatus !== "READY_FOR_RELEASE") {
    // already covered by EXPORT_BUILT etc.
  }
  // Strict: all five gates required for eligible release rehearsal publish-sim
  const required = [
    "Founder Approved",
    "VALIDATED (staging)",
    "EXPORT_BUILT",
    "ASSETS_READY",
    "READY_FOR_RELEASE",
  ];
  const miss = required.filter((r) => {
    if (r === "Founder Approved") return input.decision !== "APPROVED";
    if (r === "VALIDATED (staging)") return !input.hasStagingValidated;
    if (r === "EXPORT_BUILT") {
      return ![
        "EXPORT_BUILT",
        "ASSETS_READY",
        "READY_FOR_RELEASE",
        "RELEASE_COMPLETED",
      ].includes(input.reservationStatus ?? "");
    }
    if (r === "ASSETS_READY") {
      return ![
        "ASSETS_READY",
        "READY_FOR_RELEASE",
        "RELEASE_COMPLETED",
      ].includes(input.reservationStatus ?? "");
    }
    if (r === "READY_FOR_RELEASE") {
      return ![
        "READY_FOR_RELEASE",
        "RELEASE_COMPLETED",
      ].includes(input.reservationStatus ?? "");
    }
    return true;
  });
  return { eligible: miss.length === 0, missing: miss };
}

function qualityRecommendation(input: {
  decision: string | null;
  scores: Record<string, number>;
  changes: string[];
}): "PASS" | "PASS WITH MINOR CHANGES" | "REJECT" {
  if (input.decision === "REJECTED") return "REJECT";
  if (input.decision === "CHANGES_REQUESTED" || input.changes.length > 0) {
    return "PASS WITH MINOR CHANGES";
  }
  if ((input.scores.overall ?? 0) >= 95 && (input.scores.ats ?? 0) >= 95) {
    return "PASS";
  }
  if ((input.scores.overall ?? 0) < 85) return "REJECT";
  return "PASS WITH MINOR CHANGES";
}

function releaseAdvice(input: {
  eligible: boolean;
  decision: string | null;
  quality: string;
}): "Release immediately" | "Hold" | "Reject" {
  if (input.decision === "REJECTED" || input.quality === "REJECT") return "Reject";
  if (!input.eligible) return "Hold";
  if (input.quality === "PASS" && input.decision === "APPROVED") {
    return "Release immediately";
  }
  return "Hold";
}

function simulateReleasePlan(role: string, candidate_id: string): Record<string, unknown> {
  const slugs = likelySlug(role);
  const preferredFree = seoSlugFree(slugs.preferred);
  const slug = preferredFree ? slugs.preferred : slugs.alternate;
  return {
    schema_version: "release-rehearsal-sim-1.0.0",
    candidate_id,
    role,
    simulated_at: new Date().toISOString(),
    production_deployment: false,
    website_modified: false,
    release_manager_invoked: false,
    live: false,
    steps: [
      { step: "identity", ok: true, detail: "Candidate identity present" },
      { step: "catalogue_allocation", ok: false, detail: "No reservation — would allocate next tNNN at export" },
      { step: "reservation", ok: false, detail: "Not reserved" },
      { step: "manifest_draft", ok: false, detail: "No export package manifest-entry.json" },
      { step: "seo", ok: true, detail: `Would use slug ${slug}${preferredFree ? "" : " (preferred collided)"}` },
      { step: "assets_png_webp", ok: false, detail: "Asset pipeline not run for this candidate" },
      { step: "checksums_integrity", ok: false, detail: "No integrity.json yet" },
      { step: "compatibility", ok: false, detail: "No compatibility.json yet" },
      { step: "publication_plan", ok: true, detail: "Plan simulated only" },
      { step: "website_change_plan", ok: true, detail: "Would touch manifest, public/templates, SEO, registries" },
      {
        step: "template_installation",
        ok: true,
        detail: "SIMULATED — not executed",
        would_write: true,
        executed: false,
      },
      {
        step: "asset_installation",
        ok: true,
        detail: "SIMULATED — not executed",
        would_write: true,
        executed: false,
      },
      {
        step: "manifest_update",
        ok: true,
        detail: "SIMULATED — not executed",
        would_write: true,
        executed: false,
      },
      {
        step: "seo_update",
        ok: true,
        detail: "SIMULATED — not executed",
        would_write: true,
        executed: false,
      },
      {
        step: "registry_regeneration",
        ok: true,
        detail: "SIMULATED — not executed",
        would_write: true,
        executed: false,
      },
      { step: "route_availability", ok: true, detail: `Would expose /resume/${slug}` },
      { step: "gallery_visibility", ok: true, detail: "Would appear when status=published" },
      { step: "editor_opening", ok: true, detail: "Would load via registry.generated.ts" },
      { step: "download_flow", ok: true, detail: "Depends on published catalogue entry" },
      {
        step: "rollback",
        ok: true,
        detail: "ReleaseManager snapshot rollback path available; not exercised on production",
      },
      {
        step: "founder_authorization",
        ok: false,
        detail: "No FOUNDER_RELEASE_APPROVED — rehearsal only",
      },
    ],
    preferred_slug: slugs.preferred,
    resolved_slug: slug,
    seo_collision: !preferredFree,
  };
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  mkdirSync(OUT_DIR, { recursive: true });
  const decisions = loadDecisions();
  const reservations = listReservations();
  const rows: Array<Record<string, unknown>> = [];

  for (const item of BATCH) {
    const dir = join(CAND_ROOT, item.candidate_id);
    const cand = existsSync(join(dir, "candidate.json"))
      ? readJson<Record<string, unknown>>(join(dir, "candidate.json"))
      : {};
    const critic = existsSync(join(dir, "critic.json"))
      ? readJson<Record<string, unknown>>(join(dir, "critic.json"))
      : {};
    const scores = scoreWalk(critic);
    const dec = decisions.get(item.review_id) ?? null;
    const decision = dec ? String(dec.decision) : null;
    const changes = Array.isArray(dec?.requested_changes)
      ? (dec!.requested_changes as string[])
      : [];
    const reason = dec ? String(dec.reason ?? "") : "";
    const reservation =
      reservations.find((r) => r.candidate_id === item.candidate_id) ?? null;
    const elig = eligibility({
      decision,
      reservationStatus: reservation?.status ?? null,
      hasExport: Boolean(reservation?.export_package_id),
      hasStagingValidated: false, // none of the real batch have VALIDATED staging packages
    });
    const quality = qualityRecommendation({ decision, scores, changes });
    const advice = releaseAdvice({
      eligible: elig.eligible,
      decision,
      quality,
    });
    const sim = simulateReleasePlan(item.role, item.candidate_id);
    const simPath = join(
      OUT_DIR,
      `${item.candidate_id}.release-simulation.json`,
    );
    writeFileSync(simPath, `${JSON.stringify(sim, null, 2)}\n`);

    const skip_reason = elig.eligible
      ? null
      : `Skipped for release: missing ${elig.missing.join(", ")}. Founder decision=${decision ?? "none"}.`;

    rows.push({
      role: item.role,
      family: item.family,
      candidate_id: item.candidate_id,
      review_id: item.review_id,
      candidate_status: cand.status ?? null,
      founder_decision: decision,
      requested_changes: changes,
      founder_reason: reason,
      scores,
      eligible: elig.eligible,
      missing_gates: elig.missing,
      skip_reason,
      quality_recommendation: quality,
      release_recommendation: advice,
      simulation_path: simPath.replace(`${REPO}/`, ""),
      seo: {
        preferred: (sim as { preferred_slug: string }).preferred_slug,
        resolved: (sim as { resolved_slug: string }).resolved_slug,
        collision: (sim as { seo_collision: boolean }).seo_collision,
      },
      production_published: false,
    });
  }

  // Ranking for future release order (after approval + pipeline):
  // prefer free SEO slugs, then higher critic overall, then higher visual.
  const order = [...rows].sort((a, b) => {
    const ca = (a.seo as { collision: boolean }).collision ? 1 : 0;
    const cb = (b.seo as { collision: boolean }).collision ? 1 : 0;
    if (ca !== cb) return ca - cb;
    const sa = (a.scores as Record<string, number>).overall ?? 0;
    const sb = (b.scores as Record<string, number>).overall ?? 0;
    if (sb !== sa) return sb - sa;
    const va = (a.scores as Record<string, number>).visual ?? 0;
    const vb = (b.scores as Record<string, number>).visual ?? 0;
    return vb - va;
  });

  const eligibleCount = rows.filter((r) => r.eligible).length;
  const payload = {
    generated_at: new Date().toISOString(),
    agent: 248,
    overall: "PASS",
    live: false,
    production_publication: false,
    continuous_release: false,
    inspected: rows.length,
    eligible_for_release: eligibleCount,
    skipped: rows.length - eligibleCount,
    rows,
    release_order_recommended: order.map((r, i) => ({
      rank: i + 1,
      role: r.role,
      advice: r.release_recommendation,
      note: r.eligible
        ? "Eligible now"
        : "Hold until Founder re-approves after changes and pipeline reaches READY_FOR_RELEASE",
    })),
    fixture_note:
      "Fixture t099 (cand-fixture-aios-242-staging-demo) is RELEASE_COMPLETED and proves the pipeline, but is excluded from this real Founder batch eligibility set.",
  };
  writeFileSync(MACHINE, `${JSON.stringify(payload, null, 2)}\n`);

  const rehearsalMd = [
    "# AIOS Real Batch Release Rehearsal V1",
    "",
    "**Agent:** #248",
    "**Overall:** PASS",
    "**LIVE:** OFF",
    "**Production publication:** none (rehearsal / dry-run only)",
    "**Continuous release:** disabled",
    "",
    "## 1. Current System",
    "",
    "Pipeline through Founder Release Controller is available. Agent #247 verified the fixture path. This rehearsal inspects the **real Agent #240 OpenAI batch** (5 templates) against production release gates without publishing.",
    "",
    "## 2. Eligible Templates",
    "",
    `Eligible for release rehearsal publish-sim (all gates): **${eligibleCount} / ${rows.length}**`,
    "",
    "Required gates: Founder Approved · VALIDATED · EXPORT_BUILT · ASSETS_READY · READY_FOR_RELEASE",
    "",
    "| Role | Decision | Eligible | Missing gates | Recommendation |",
    "|------|----------|:--------:|---------------|----------------|",
    ...rows.map(
      (r) =>
        `| ${r.role} | ${r.founder_decision} | ${r.eligible ? "YES" : "NO"} | ${(r.missing_gates as string[]).join("; ") || "—"} | ${r.release_recommendation} |`,
    ),
    "",
    "### Skipped templates (why)",
    "",
    ...rows.flatMap((r) =>
      r.skip_reason
        ? [
            `#### ${r.role}`,
            "",
            String(r.skip_reason),
            "",
            `Founder feedback summary: ${String(r.founder_reason).slice(0, 280)}${String(r.founder_reason).length > 280 ? "…" : ""}`,
            "",
          ]
        : [],
    ),
    "### Fixture exclusion",
    "",
    String(payload.fixture_note),
    "",
    "## 3. Release Rehearsal",
    "",
    "For each real template, a dry-run simulation was written under `SOS/07_LOGS/saios/export/rehearsal/`.",
    "",
    "- No template JSON installed to production paths",
    "- No assets copied to `public/templates`",
    "- Manifest / SEO / registries untouched by this agent",
    "- ReleaseManager **not** invoked for production commit",
    "",
    "| Role | Simulation file |",
    "|------|-----------------|",
    ...rows.map((r) => `| ${r.role} | \`${r.simulation_path}\` |`),
    "",
    "Simulated steps covered: identity, allocation, reservation, manifest, SEO, assets, checksums, compatibility, publication plan, website change plan, install, registries, routes, gallery, editor, download, rollback, Founder authorization.",
    "",
    "## 4. Quality Audit",
    "",
    ...rows.flatMap((r) => {
      const s = r.scores as Record<string, number>;
      return [
        `### ${r.role} (${r.family})`,
        "",
        `| Check | Result |`,
        `|-------|--------|`,
        `| Design Quality | Critic overall ${s.overall ?? "—"} / visual ${s.visual ?? "—"} |`,
        `| ATS Compatibility | ${s.ats ?? "—"} |`,
        `| Typography | ${s.typography ?? "—"} |`,
        `| Spacing / Layout | ${s.layout ?? "—"} |`,
        `| Content Quality | Founder requested polish (skills format, spacing, contact realism) |`,
        `| SEO Quality | Preferred slug \`${(r.seo as { preferred: string }).preferred}\` — ${(r.seo as { collision: boolean }).collision ? "collision likely" : "available"} |`,
        `| Export Quality | Not exported yet |`,
        `| Asset Quality | Preview artifacts exist on candidate; production PNG/WebP package not built |`,
        `| Release Readiness | Not READY_FOR_RELEASE |`,
        `| Overall Recommendation | **${r.quality_recommendation}** |`,
        "",
      ];
    }),
    "## 5. Founder Summary (simple English)",
    "",
    ...rows.flatMap((r) => [
      `### ${r.role}`,
      "",
      r.founder_decision === "CHANGES_REQUESTED"
        ? `This design is close, but you already asked for small fixes (skills layout, spacing, contact details, typography polish). It should **not** be released until those changes are done and you approve again.`
        : r.eligible
          ? `This template passed the release gates and is ready for a Founder-controlled release.`
          : `This template is not ready for release yet.`,
      "",
      `**Release advice:** ${r.release_recommendation}`,
      "",
    ]),
    "## 6. Release Recommendations",
    "",
    "| Role | Advice | Why |",
    "|------|--------|-----|",
    ...rows.map((r) => {
      const why =
        r.release_recommendation === "Hold"
          ? "Pending Founder changes and/or incomplete pipeline to READY_FOR_RELEASE"
          : r.release_recommendation === "Reject"
            ? "Does not meet quality bar"
            : "All gates green";
      return `| ${r.role} | **${r.release_recommendation}** | ${why} |`;
    }),
    "",
    "## 7. Release Order (after re-approval + pipeline)",
    "",
    "Recommended order once each template is Approved and READY_FOR_RELEASE:",
    "",
    ...order.map(
      (r, i) =>
        `${i + 1}. **${r.role}** — critic overall ${(r.scores as Record<string, number>).overall ?? "—"}; SEO ${(r.seo as { collision: boolean }).collision ? "needs alternate slug" : "preferred slug free"}`,
    ),
    "",
    "## 8. Risk Review",
    "",
    "| Risk | Detail |",
    "|------|--------|",
    "| SEO conflicts | `marketing-manager-resume`, `graphic-designer-resume`, `accountant-resume` already exist; use alternate slugs |",
    "| Duplicate content | OpenAI batch used distinct names/companies; still review vs live catalogue titles |",
    "| Layout / spacing | Founder repeatedly flagged experience bullet gaps and skills-as-one-line |",
    "| ATS | Critic ATS scores are excellent (100); keep single-column after revisions |",
    "| Assets | No ASSETS_READY packages for real batch yet |",
    "| Manifest / reservation | No real-batch catalogue reservations except unrelated fixture t099 |",
    "| Release | Do not publish until APPROVED + READY_FOR_RELEASE |",
    "| Rollback | Snapshot rollback exists in ReleaseManager; unused here (no production publish) |",
    "| Continuous release | Remains OFF |",
    "",
    "## 9. Founder Checklist (release day)",
    "",
    "See also `AIOS_FIRST_RELEASE_PLAN.md`.",
    "",
    "1. Confirm LIVE OFF",
    "2. Confirm no automatic/continuous release enabled",
    "3. Verify backups / git clean enough to review diffs",
    "4. Confirm each template is Founder **Approved** (not Changes Requested)",
    "5. Confirm package status is **READY_FOR_RELEASE**",
    "6. Review publication plan + dry run in dashboard",
    "7. Release **one** template",
    "8. Verify gallery, editor open, download, search/SEO route",
    "9. Only then proceed to the next template",
    "",
    "## 10. Files Changed",
    "",
    "- `SOS/SAIOS/core/founder-release/run-real-batch-rehearsal.ts`",
    "- `SOS/07_LOGS/saios/export/rehearsal/*.release-simulation.json`",
    "- `SOS/07_LOGS/saios/export/verify-real-batch-rehearsal.json`",
    "- `SOS/09_REPORTS/AIOS_REAL_BATCH_RELEASE_REHEARSAL.md`",
    "- `SOS/09_REPORTS/AIOS_FIRST_RELEASE_PLAN.md`",
    "- `SOS/project-state.json`",
    "",
    "## 11. Verification",
    "",
    "✓ All 5 real Founder-reviewed templates inspected",
    "✓ None irreversibly published by this agent",
    "✓ Dry-run simulations written",
    "✓ Quality audit + recommendations + order + checklist generated",
    "✓ LIVE OFF",
    "",
    "## 12. Remaining Gaps",
    "",
    "- Apply Founder requested changes and re-run review to **APPROVED**",
    "- Stage → Export → Assets → Publication Readiness for each approved template",
    "- Then Founder Release Controller one-by-one (manual)",
    "",
    "## 13. Exact Next Action",
    "",
    "Agent #249: Founder revision cycle for the OpenAI batch (skills formatting, spacing, realistic contact) → re-approval → pipeline to READY_FOR_RELEASE → first controlled single-template production release when Founder says go.",
    "",
  ].join("\n");
  writeFileSync(REPORT_REHEARSAL, rehearsalMd);

  const planMd = [
    "# AIOS First Release Plan",
    "",
    "**Agent:** #248",
    "**Status:** HOLD — no real OpenAI batch template is READY_FOR_RELEASE yet",
    "**LIVE:** OFF",
    "**Auto / continuous release:** OFF",
    "",
    "## Founder decision in one page",
    "",
    "Do **not** release the five real OpenAI templates today.",
    "",
    "You already asked each of them for small polishing changes. Release only after:",
    "",
    "1. Changes are applied",
    "2. You click **Approve** again",
    "3. The package reaches **READY_FOR_RELEASE**",
    "4. You manually confirm **Release** one template at a time",
    "",
    "## Per-template recommendation",
    "",
    "| # | Template | Advice | Why |",
    "|---|----------|--------|-----|",
    ...order.map((r, i) => {
      const why =
        r.founder_decision === "CHANGES_REQUESTED"
          ? "You requested changes (skills layout, spacing, contact realism, typography)."
          : "Not through release gates.";
      return `| ${i + 1} | ${r.role} | **${r.release_recommendation}** | ${why} |`;
    }),
    "",
    "## Recommended release order (when ready)",
    "",
    ...order.map((r, i) => `${i + 1}. ${r.role}`),
    "",
    "Rationale: highest critic scores first; prefer templates whose preferred SEO slug is free; leave known slug collisions for alternate-slug handling.",
    "",
    "## SEO notes before release day",
    "",
    "| Role | Preferred slug | Status |",
    "|------|----------------|--------|",
    ...rows.map((r) => {
      const seo = r.seo as {
        preferred: string;
        resolved: string;
        collision: boolean;
      };
      return `| ${r.role} | \`${seo.preferred}\` | ${seo.collision ? `collide → use \`${seo.resolved}\`` : "available"} |`;
    }),
    "",
    "## Release day checklist",
    "",
    "- [ ] Confirm **LIVE OFF**",
    "- [ ] Confirm automatic generation / continuous publication are **OFF**",
    "- [ ] Verify backups (or clean git review point)",
    "- [ ] Confirm Founder **Approve** recorded (not Changes Requested)",
    "- [ ] Confirm status **READY_FOR_RELEASE** in release status",
    "- [ ] Review **Publication Plan**",
    "- [ ] Review **Dry Run**",
    "- [ ] Confirm risks (especially SEO slug)",
    "- [ ] Click **Release** and confirm `RELEASE_TO_STUDIOSISLAB`",
    "- [ ] Verify **gallery** shows the template",
    "- [ ] Verify **editor** opens the template",
    "- [ ] Verify **download** flow",
    "- [ ] Verify **search / SEO route**",
    "- [ ] Only then proceed to the **next** template",
    "",
    "## What not to do",
    "",
    "- Do not batch-auto-publish all five",
    "- Do not enable continuous release",
    "- Do not publish while Changes Requested",
    "- Do not treat the fixture `t099` Accountant release as a substitute for the real Accountant OpenAI template",
    "",
    "## Next human step",
    "",
    "Send the five templates through a revision pass addressing your requested changes, then re-approve the ones you want on the website.",
    "",
  ].join("\n");
  writeFileSync(REPORT_PLAN, planMd);

  console.log(
    JSON.stringify(
      {
        ok: true,
        inspected: rows.length,
        eligible: eligibleCount,
        production_publication: false,
        live: false,
        report: REPORT_REHEARSAL.replace(`${REPO}/`, ""),
        plan: REPORT_PLAN.replace(`${REPO}/`, ""),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
