/**
 * Phase 6F — section-scoped explicit content authorization regression.
 *
 * Uses the sanitized revtask-b5339d03-b67 fixture: the real 21 Founder lines
 * and the real 47-object prior canvas.
 *
 * Founder policy: an explicitly requested section may be content-edited.
 * Everything else stays fail-closed.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "../first-production-cycle/canvas-types.js";
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import {
  resolveRequestedContentSections,
  resolveSectionContentObjectIds,
  runContentPreservationCheck,
  type ContentSectionKey,
} from "./RevisionAcceptanceChecks.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-section-content-authorization-6f.json",
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(cond: boolean, name: string, detail: string): void {
  checks.push({ name, pass: !!cond, detail });
}

const meta = JSON.parse(readFileSync(join(FIX, "meta.json"), "utf8")) as {
  requested_changes: string[];
};
const priorCanvas = JSON.parse(
  readFileSync(join(FIX, "prior-canvas.json"), "utf8"),
) as FabricCanvasDoc;

const REQUESTED = meta.requested_changes;

/** First Founder line that resolves to exactly the given section. */
function founderLineFor(section: ContentSectionKey): string {
  const hit = REQUESTED.find((c) =>
    resolveRequestedContentSections(c).has(section),
  );
  if (!hit) throw new Error(`no Founder line resolves to section ${section}`);
  return hit;
}

function updateTextOp(
  targetId: string,
  founderItem: string,
  text: string,
): CanvasOperation {
  return {
    op: "update_text",
    target_id: targetId,
    before_summary: `prior text of ${targetId}`,
    intended_change: `Replace ${targetId} content as Founder requested`,
    values: { text },
    founder_feedback_item: founderItem,
    confidence: 0.92,
  } as CanvasOperation;
}

function planOf(ops: CanvasOperation[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "section-scoped content revision",
    notes: [],
    operations: ops,
  } as RevisionPlan;
}

function cloneCanvas(c: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(c)) as FabricCanvasDoc;
}

function withText(
  canvas: FabricCanvasDoc,
  edits: Record<string, string>,
): FabricCanvasDoc {
  const next = cloneCanvas(canvas);
  for (const o of (next.objects ?? []) as Record<string, unknown>[]) {
    const id = typeof o.id === "string" ? o.id : null;
    if (id && edits[id] != null) o.text = edits[id];
  }
  return next;
}

function main(): void {
  // --- Deterministic section resolution over the real Founder lines ---------
  const sections: ContentSectionKey[] = [
    "job_title",
    "summary",
    "experience",
    "skills",
    "projects",
    "certifications",
    "education",
  ];
  for (const s of sections) {
    const hit = REQUESTED.filter((c) => resolveRequestedContentSections(c).has(s));
    assert(
      hit.length > 0,
      `founder_request_resolves_section_${s}`,
      hit.length ? `${hit.length} line(s)` : "NO LINE RESOLVED",
    );
  }

  // Layout lines must never authorize content, even when they name a section.
  const layoutLines = REQUESTED.filter((c) =>
    /overlap|wrapping|clipping|spacing|out-of-bounds/i.test(c),
  );
  assert(
    layoutLines.length > 0 &&
      layoutLines.every((c) => resolveRequestedContentSections(c).size === 0),
    "layout_lines_authorize_nothing",
    `${layoutLines.length} layout line(s) → 0 sections`,
  );
  assert(
    resolveRequestedContentSections(
      "Fix the visible text overlap inside the Certifications section.",
    ).size === 0,
    "certifications_overlap_line_is_not_content_auth",
    "layout intent wins over section noun",
  );
  assert(
    resolveRequestedContentSections("Make it look more professional.").size === 0,
    "ambiguous_wording_grants_nothing",
    "no verb + no section",
  );
  assert(
    resolveRequestedContentSections("Replace the content.").size === 0,
    "verb_without_section_grants_nothing",
    "verb but no section noun",
  );

  // --- Object-level scoping over the real 47-object canvas ------------------
  const expectations: [ContentSectionKey, string[], string[]][] = [
    ["job_title", ["block-header-0-t2"], ["block-header-0-t1", "block-header-0-t3"]],
    ["summary", ["block-summary-1-t2"], ["block-summary-1-t1"]],
    ["experience", ["block-experience-2-t2", "block-experience-2-t8"], ["block-experience-2-t1"]],
    ["skills", ["block-skills-4-t2", "block-skills-4-t3"], ["block-skills-4-t1"]],
    ["projects", ["block-projects-5-t2", "block-projects-5-t3"], ["block-projects-5-t1"]],
    [
      "certifications",
      ["block-certifications-6-t2", "block-certifications-6-t3"],
      ["block-certifications-6-t1"],
    ],
    ["education", ["block-education-3-t2", "block-education-3-t3"], ["block-education-3-t1"]],
  ];

  for (const [section, mustAllow, mustDeny] of expectations) {
    const ids = resolveSectionContentObjectIds(
      priorCanvas,
      new Set<ContentSectionKey>([section]),
    );
    assert(
      mustAllow.every((id) => ids.has(id)),
      `section_${section}_authorizes_body_objects`,
      `${mustAllow.filter((id) => ids.has(id)).length}/${mustAllow.length} allowed`,
    );
    assert(
      mustDeny.every((id) => !ids.has(id)),
      `section_${section}_protects_heading_and_identity`,
      `denied: ${mustDeny.join(",")}`,
    );
    // Unrequested sections must never leak in.
    const leaked = [...ids].filter((id) => {
      const seg = section === "job_title" ? "header" : section;
      return !id.includes(seg);
    });
    assert(
      leaked.length === 0,
      `section_${section}_does_not_leak_other_sections`,
      leaked.length ? `LEAKED ${leaked.join(",")}` : "no leakage",
    );
  }

  // Structural objects are never authorized for any section.
  const allSections = new Set<ContentSectionKey>(sections);
  const everyAllowed = resolveSectionContentObjectIds(priorCanvas, allSections);
  const structural = [
    "page-root",
    "page-sidebar-bg",
    "block-header-0-r0",
    "block-summary-1-r0",
    "block-certifications-6-r0",
  ];
  assert(
    structural.every((id) => !everyAllowed.has(id)),
    "structural_objects_never_authorized",
    "page bg, sidebar bg, header band, section markers denied",
  );
  assert(
    !everyAllowed.has("block-languages-7-t2"),
    "unrequested_languages_section_protected",
    "languages never requested → protected",
  );
  assert(
    !everyAllowed.has("block-header-0-t1") &&
      !everyAllowed.has("block-header-0-t3"),
    "candidate_name_and_contact_protected",
    "name + contact denied under all sections",
  );

  // --- End-to-end preservation gate over the real canvas -------------------
  for (const [section, mustAllow] of expectations) {
    const line = founderLineFor(section);
    const targetId = mustAllow[0];
    const after = withText(priorCanvas, {
      [targetId]: `Operations Analyst content for ${section}.`,
    });
    const r = runContentPreservationCheck({
      beforeCanvas: priorCanvas,
      afterCanvas: after,
      requestedChange: line,
      plan: planOf([
        updateTextOp(targetId, line, `Operations Analyst content for ${section}.`),
      ]),
      requested_changes: REQUESTED,
    });
    assert(
      r.pass === true,
      `preservation_allows_requested_${section}_replacement`,
      r.pass ? "authorized" : JSON.stringify(r.findings?.map((f) => f.code)),
    );
  }

  // Unrequested section edit fails even when the plan claims a valid Founder item.
  const summaryLine = founderLineFor("summary");
  const langAfter = withText(priorCanvas, {
    "block-languages-7-t2": "German (Fluent) · Mandarin (Native)",
  });
  const langCheck = runContentPreservationCheck({
    beforeCanvas: priorCanvas,
    afterCanvas: langAfter,
    requestedChange: summaryLine,
    plan: planOf([
      updateTextOp(
        "block-languages-7-t2",
        summaryLine,
        "German (Fluent) · Mandarin (Native)",
      ),
    ]),
    requested_changes: REQUESTED,
  });
  assert(
    langCheck.pass === false,
    "unrequested_section_edit_fails_closed",
    langCheck.pass ? "UNEXPECTED PASS" : "blocked",
  );

  // Candidate name edit fails even with a job-title authorization present.
  const titleLine = founderLineFor("job_title");
  const nameAfter = withText(priorCanvas, { "block-header-0-t1": "Jordan Blake" });
  const nameCheck = runContentPreservationCheck({
    beforeCanvas: priorCanvas,
    afterCanvas: nameAfter,
    requestedChange: titleLine,
    plan: planOf([updateTextOp("block-header-0-t1", titleLine, "Jordan Blake")]),
    requested_changes: REQUESTED,
  });
  assert(
    nameCheck.pass === false,
    "candidate_name_edit_fails_closed",
    nameCheck.pass ? "UNEXPECTED PASS" : "blocked",
  );

  // Contact detail edit fails.
  const contactAfter = withText(priorCanvas, {
    "block-header-0-t3": "hacker@example.com · +1 (555) 000-0000",
  });
  const contactCheck = runContentPreservationCheck({
    beforeCanvas: priorCanvas,
    afterCanvas: contactAfter,
    requestedChange: titleLine,
    plan: planOf([
      updateTextOp(
        "block-header-0-t3",
        titleLine,
        "hacker@example.com · +1 (555) 000-0000",
      ),
    ]),
    requested_changes: REQUESTED,
  });
  assert(
    contactCheck.pass === false,
    "contact_details_edit_fails_closed",
    contactCheck.pass ? "UNEXPECTED PASS" : "blocked",
  );

  // Section heading label edit fails.
  const headingAfter = withText(priorCanvas, {
    "block-certifications-6-t1": "AWARDS",
  });
  const certLine = founderLineFor("certifications");
  const headingCheck = runContentPreservationCheck({
    beforeCanvas: priorCanvas,
    afterCanvas: headingAfter,
    requestedChange: certLine,
    plan: planOf([updateTextOp("block-certifications-6-t1", certLine, "AWARDS")]),
    requested_changes: REQUESTED,
  });
  assert(
    headingCheck.pass === false,
    "section_heading_label_edit_fails_closed",
    headingCheck.pass ? "UNEXPECTED PASS" : "blocked",
  );

  // Unrelated text modification with no plan authorization at all fails.
  const strayAfter = withText(priorCanvas, {
    "block-experience-2-t3": "2099 — Present",
  });
  const strayCheck = runContentPreservationCheck({
    beforeCanvas: priorCanvas,
    afterCanvas: strayAfter,
    requestedChange: summaryLine,
    plan: planOf([]),
    requested_changes: REQUESTED,
  });
  assert(
    strayCheck.pass === false,
    "unauthorized_text_modification_fails_closed",
    strayCheck.pass ? "UNEXPECTED PASS" : "blocked",
  );

  finish();
}

function finish(): void {
  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "section-content-authorization-6f-1.0.0",
    generated_at: new Date().toISOString(),
    fixture: ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized",
    pass,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}  ${c.detail}`);
  }
  console.log(
    pass
      ? "\nSECTION_CONTENT_AUTHORIZATION_6F=PASS"
      : "\nSECTION_CONTENT_AUTHORIZATION_6F=FAIL",
  );
  if (!pass) process.exit(1);
}

main();
