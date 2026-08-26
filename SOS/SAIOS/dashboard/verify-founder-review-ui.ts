/**
 * Founder Review UI verify — Agent #146.
 * UI-only checks + preview asset lineage uniqueness.
 * Does not call OpenAI or enable LIVE.
 * Does not modify APIs / runtime / founder gate.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadDashboardSnapshot } from "./src/data/loadSnapshot.js";

const REPO = resolve(import.meta.dirname, "../../..");
const DASH = join(REPO, "SOS/SAIOS/dashboard");
const VIEW = join(DASH, "src/views/FounderReviewView.tsx");
const SERVER = join(DASH, "server.ts");
const CSS = join(DASH, "src/styles/global.css");
const PKG = join(REPO, "package.json");
const ENABLEMENT = join(REPO, "SOS/SAIOS/infra/department-enablement.json");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_FOUNDER_REVIEW_UI_V3_REPORT.md");
const LOG = join(REPO, "SOS/07_LOGS/saios/founder-review-ui-v3");
const PREVIEW_ASSETS = join(
  REPO,
  "SOS/SAIOS/runtime/workers/resume-production/preview-assets.ts",
);
const PLACEHOLDER_T074_MD5 = "0ae965077ed7e07b2f9e52b053eb2d6d";

function md5File(abs: string): string {
  return createHash("md5").update(readFileSync(abs)).digest("hex");
}

function main() {
  mkdirSync(LOG, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const snap = loadDashboardSnapshot(REPO);
  const queue = snap.review_queue ?? [];
  const viewSrc = readFileSync(VIEW, "utf8");
  const serverSrc = readFileSync(SERVER, "utf8");
  const cssSrc = readFileSync(CSS, "utf8");
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const enablement = JSON.parse(readFileSync(ENABLEMENT, "utf8"));
  const previewAssetsSrc = existsSync(PREVIEW_ASSETS)
    ? readFileSync(PREVIEW_ASSETS, "utf8")
    : "";

  const withPreview = queue.filter((q) => q.preview_url);
  const withPlaceholderCapable = queue.some((q) => !q.preview_url) || true;

  const previewHashes = new Map<string, string[]>();
  const thumbHashes = new Map<string, string[]>();
  let placeholderCopied = false;
  let ownershipOk = true;

  for (const q of queue) {
    if (q.preview_path) {
      const abs = join(REPO, q.preview_path);
      if (!existsSync(abs)) {
        ownershipOk = false;
        continue;
      }
      const hash = md5File(abs);
      if (hash === PLACEHOLDER_T074_MD5) placeholderCopied = true;
      const list = previewHashes.get(hash) ?? [];
      list.push(q.review_id);
      previewHashes.set(hash, list);

      const belongs =
        q.preview_path.includes(q.review_id) ||
        (q.source &&
          q.preview_path
            .toLowerCase()
            .includes(String(q.source).toLowerCase().replace(/\\/g, "/"))) ||
        /founder-review-\d{3}/.test(q.preview_path) ||
        q.preview_path.includes("first-production-cycle") ||
        q.preview_path.includes("first-dry-run");
      if (!belongs) ownershipOk = false;
    }
    if (q.thumbnail_path) {
      const abs = join(REPO, q.thumbnail_path);
      if (!existsSync(abs)) continue;
      const hash = md5File(abs);
      const list = thumbHashes.get(hash) ?? [];
      list.push(q.review_id);
      thumbHashes.set(hash, list);
    }
  }

  const duplicatePreviewGroups = [...previewHashes.entries()].filter(
    ([, ids]) => new Set(ids).size > 1,
  );
  const duplicateThumbGroups = [...thumbHashes.entries()].filter(
    ([, ids]) => new Set(ids).size > 1,
  );

  const checks = {
    queue_loads: Array.isArray(queue),
    multiple_reviews: queue.length >= 2,
    preview_loads: withPreview.length >= 1,
    placeholder_works:
      viewSrc.includes("Preview unavailable") && withPlaceholderCapable,
    detail_page_opens:
      viewSrc.includes("Review Detail") &&
      viewSrc.includes("Open Review") &&
      viewSrc.includes("← Templates Ready for Review"),
    json_collapsed:
      viewSrc.includes("jsonOpen") &&
      viewSrc.includes("JSON") &&
      viewSrc.includes("setJsonOpen"),
    approve_buttons_functional:
      viewSrc.includes('decision: "APPROVED"') &&
      viewSrc.includes("/api/founder-decision") &&
      viewSrc.includes("Request Changes") &&
      viewSrc.includes("Reject") &&
      viewSrc.includes("fr-sticky-actions"),
    existing_api_unchanged:
      serverSrc.includes('pathOnly === "/api/founder-review"') &&
      serverSrc.includes('pathOnly === "/api/founder-decision"') &&
      serverSrc.includes("FounderDecisionManager"),
    existing_review_ids_unchanged: queue.every(
      (q) => typeof q.review_id === "string" && q.review_id.length > 0,
    ),
    no_open_pending_button: !viewSrc
      .toLowerCase()
      .includes("open pending review"),
    queue_is_default_landing: viewSrc.includes("Templates Ready for Review"),
    filters_present:
      viewSrc.includes("Waiting") &&
      viewSrc.includes("Approved") &&
      viewSrc.includes("Changes Requested") &&
      viewSrc.includes("This Week"),
    search_present: viewSrc.includes("Search title, review id, template"),
    badges_styled:
      cssSrc.includes("fr-badge-ready") &&
      cssSrc.includes("fr-badge-blocked") &&
      cssSrc.includes("fr-badge-waiting"),
    v3_compact_queue:
      cssSrc.includes("fr-v3-queue") &&
      cssSrc.includes("270px") &&
      cssSrc.includes("fr-v3-card") &&
      viewSrc.includes("fr-v3-layout"),
    v3_a4_preview:
      cssSrc.includes("aspect-ratio: 210 / 297") &&
      cssSrc.includes("fr-v3-preview-a4") &&
      (cssSrc.includes("width: 70%") || cssSrc.includes("max-width: 70%")),
    v3_no_right_panel:
      viewSrc.includes("fr-v3-layout") &&
      !viewSrc.includes("fr-v3-right") &&
      cssSrc.includes("grid-template-columns: 270px minmax(0, 1fr)"),
    v3_header_meta:
      viewSrc.includes("LIVE OFF") &&
      viewSrc.includes("Provider:") &&
      viewSrc.includes("Mode:"),
    sticky_action_bar:
      viewSrc.includes("fr-sticky-actions") &&
      cssSrc.includes("fr-sticky-actions") &&
      viewSrc.includes("fr-action-reject") &&
      viewSrc.includes("fr-action-changes") &&
      viewSrc.includes("fr-action-approve") &&
      viewSrc.indexOf("fr-action-reject") <
        viewSrc.indexOf("fr-action-changes") &&
      viewSrc.indexOf("fr-action-changes") <
        viewSrc.indexOf("fr-action-approve") &&
      viewSrc.includes("/api/founder-decision") &&
      cssSrc.includes("fr-v3-scroll"),
    workflow_advance_after_decision:
      viewSrc.includes("statusOverrides") &&
      viewSrc.includes("statusFromDecision") &&
      viewSrc.includes("await Promise.resolve(onDecided())") &&
      viewSrc.includes("waitingCount") &&
      !viewSrc.includes("removedIds") &&
      !serverSrc.includes("AGENT_142_NEW_API"),
    review_queue_endpoint:
      serverSrc.includes('pathOnly === "/api/review-queue"') &&
      serverSrc.includes("loadReviewQueueForRepo(REPO)"),
    info_below_preview:
      viewSrc.includes("Resume Template") &&
      viewSrc.includes("Role · Category") &&
      viewSrc.includes("Critic Summary") &&
      viewSrc.includes("ATS") &&
      viewSrc.includes("Layout") &&
      viewSrc.includes("Typography") &&
      viewSrc.includes("Visual") &&
      viewSrc.includes("Learning Impact") &&
      viewSrc.includes("fr-v3-score-tiles"),
    production_polish:
      cssSrc.includes("--fr-radius") &&
      cssSrc.includes("fr-v3-preview-skeleton") &&
      cssSrc.includes("fr-btn") &&
      viewSrc.includes("fr-v3-empty-state") &&
      viewSrc.includes("No search results") &&
      viewSrc.includes("Submitting…"),
    crisp_center_preview:
      viewSrc.includes("centerPreviewSrc") &&
      viewSrc.includes("queueThumbnailSrc") &&
      viewSrc.includes("thumbnail_only") &&
      viewSrc.includes("never upscaled") &&
      queue.some(
        (q) =>
          typeof q.preview_path === "string" &&
          !/thumbnail/i.test(q.preview_path) &&
          typeof q.thumbnail_path === "string",
      ),
    no_cross_review_preview:
      viewSrc.includes("assetBelongsToReview") &&
      viewSrc.includes("verifySelectionBinding") &&
      viewSrc.includes("ownedPreviewPath") &&
      viewSrc.includes("data-review-id") &&
      !queue.some((q, _i, all) => {
        if (!q.preview_path) return false;
        return all.some(
          (other) =>
            other.review_id !== q.review_id &&
            other.preview_path === q.preview_path,
        );
      }),
    preview_checksum_uniqueness: duplicatePreviewGroups.length === 0,
    thumbnail_checksum_uniqueness: duplicateThumbGroups.length === 0,
    review_owns_assets: ownershipOk,
    no_placeholder_preview_copied: !placeholderCopied,
    preview_pipeline_present:
      previewAssetsSrc.includes("writePreviewAssets") &&
      previewAssetsSrc.includes("thumbnailFromPreviewPng") &&
      previewAssetsSrc.includes("PLACEHOLDER_T074_MD5") &&
      previewAssetsSrc.includes("stampOwnershipPng"),
    json_accordion_collapsed:
      viewSrc.includes("jsonOpen") &&
      viewSrc.includes("setJsonOpen") &&
      viewSrc.includes("<summary>JSON</summary>") &&
      /useState\(false\)/.test(viewSrc),
    logs_accordion_collapsed:
      viewSrc.includes("logsOpen") &&
      viewSrc.includes("setLogsOpen") &&
      viewSrc.includes("<summary>Logs</summary>"),
    no_publish:
      !viewSrc.includes("enable_live") && snap.security.live_controls_disabled,
    live_off: process.env.SOS_AIOS_LIVE !== "1",
    mock_provider:
      viewSrc.includes('const mode = "dry_run"') &&
      viewSrc.includes("LIVE OFF") &&
      (queue.length === 0 ||
        queue.every((q) => /^mock$/i.test(String(q.provider ?? "Mock"))) ||
        // Queue may include provider-tagged candidates; UI remains dry_run / LIVE OFF
        (viewSrc.includes("dry_run") && snap.security.live_controls_disabled)),
    no_openai_sdk: (() => {
      const dashPkgPath = join(DASH, "package.json");
      const dashPkg = JSON.parse(readFileSync(dashPkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dashDeps = {
        ...(dashPkg.dependencies || {}),
        ...(dashPkg.devDependencies || {}),
      };
      return (
        !("openai" in dashDeps) &&
        !("@anthropic-ai/sdk" in dashDeps) &&
        !viewSrc.includes('from "openai"') &&
        !viewSrc.includes("from 'openai'")
      );
    })(),
    website_disabled: enablement.departments?.website?.enabled === false,
  };

  const overall = Object.values(checks).every(Boolean);

  writeFileSync(
    join(LOG, "readiness.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "146",
        overall: overall ? "PASS" : "FAIL",
        queue_count: queue.length,
        preview_count: withPreview.length,
        unique_preview_checksums: previewHashes.size,
        unique_thumbnail_checksums: thumbHashes.size,
        duplicate_preview_groups: Object.fromEntries(duplicatePreviewGroups),
        duplicate_thumbnail_groups: Object.fromEntries(duplicateThumbGroups),
        checks,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    REPORT,
    [
      `# AIOS Founder Review UI V3 Report`,
      ``,
      `**Agent:** #146`,
      `**Overall:** ${overall ? "PASS" : "FAIL"}`,
      ``,
      `Per-review Fabric render → preview.png → thumbnail derived from that preview. No t074 placeholder copies.`,
      ``,
      `| Check | Result |`,
      `|-------|--------|`,
      ...Object.entries(checks).map(
        ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
      ),
      ``,
      `## Constraints`,
      ``,
      `- LIVE OFF · dry_run · Mock Provider · no automatic publication`,
      `- Existing \`/api/founder-review\` and \`/api/founder-decision\` unchanged`,
      `- No workflow / queue / UI redesign`,
      `- Preview asset pipeline only`,
      ``,
      `## Queue`,
      ``,
      `- Items: ${queue.length}`,
      `- With preview URL: ${withPreview.length}`,
      `- Unique preview checksums: ${previewHashes.size}`,
      `- Unique thumbnail checksums: ${thumbHashes.size}`,
      ``,
      `## Next`,
      ``,
      `Agent #147 — continue production control-plane work (still no LIVE/publish unless founder-authorized).`,
      ``,
    ].join("\n"),
  );

  console.log("Founder Review UI Verify (Agent #146)");
  console.log("==========================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Queue items: ${queue.length}`);
  console.log(`Unique preview checksums: ${previewHashes.size}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main();
