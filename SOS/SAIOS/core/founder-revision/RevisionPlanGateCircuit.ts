/**
 * Production gate circuit for a validated RevisionPlan (no OpenAI, no task I/O).
 * Invokes the same modules FounderRevisionPipeline uses after plan creation.
 */
import {
  buildCanvasInventory,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import {
  buildPlanWithDeterministicSpacingOwnership,
  isVerticalSpacingRhythmHeavyFeedback,
} from "./DeterministicSpacingPlan.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { isHeaderIdentityLayoutFeedback } from "./HeaderIdentityLayout.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import { validatePlanVerticalDirections } from "./PositionOpCanonicalization.js";
import {
  findTextOverlapFindings,
  runRevisionAcceptanceChecks,
} from "./RevisionAcceptanceChecks.js";
import { normalizeRevisionLayout } from "./RevisionLayoutNormalizer.js";
import {
  allRequestedChangesAllowEmptyPlan,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { validateRevisionPlanSelectors } from "./SelectorResolution.js";
import { applySectionUnitVerticalSafety } from "./SectionUnitVerticalSafety.js";
import { validateRevisionPlanAgainstInventory } from "./StructuralAlignmentSafety.js";
import type { RevisionPlan } from "./revision-task-types.js";

export type GateCircuitStage =
  | "PLAN_SHAPE"
  | "SIDEBAR_OWNERSHIP"
  | "DIRECTION"
  | "SELECTORS"
  | "INVENTORY_ALIGNMENT"
  | "GEOMETRY"
  | "EXECUTION_SIMULATION"
  | "SECTION_VERTICAL_SAFETY"
  | "LAYOUT_NORMALIZATION"
  | "ACCEPTANCE"
  | "FEEDBACK_COVERAGE"
  | "COVERAGE_LEDGER"
  | "REVISED_RESUME_TEMPLATE_OUTPUT";

export type GateCircuitResult = {
  ok: boolean;
  failed_stage: GateCircuitStage | null;
  status:
    | "PASS"
    | "FAILED"
    | "FAILED_GATE"
    | "FAILED_COVERAGE"
    | "FAILED_EXECUTION";
  error: string | null;
  stages: Record<GateCircuitStage, "PASS" | "FAIL" | "SKIP">;
  active_plan: RevisionPlan | null;
  after_canvas: FabricCanvasDoc | null;
  coverage_gate_pass: boolean;
  coverage_items?: Array<{
    item: string;
    status: string;
    notes: string | null;
  }>;
  sidebar_overlap_proof?: {
    skills_overlap: number;
    projects_overlap: number;
    projects_certs_collision: number;
    certs_languages_collision: number;
    page_oob: number;
  };
};

function stageInit(): Record<GateCircuitStage, "PASS" | "FAIL" | "SKIP"> {
  return {
    PLAN_SHAPE: "SKIP",
    SIDEBAR_OWNERSHIP: "SKIP",
    DIRECTION: "SKIP",
    SELECTORS: "SKIP",
    INVENTORY_ALIGNMENT: "SKIP",
    GEOMETRY: "SKIP",
    EXECUTION_SIMULATION: "SKIP",
    SECTION_VERTICAL_SAFETY: "SKIP",
    LAYOUT_NORMALIZATION: "SKIP",
    ACCEPTANCE: "SKIP",
    FEEDBACK_COVERAGE: "SKIP",
    COVERAGE_LEDGER: "SKIP",
    REVISED_RESUME_TEMPLATE_OUTPUT: "SKIP",
  };
}

function rectsOverlap(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  return !(
    a.left + a.width <= b.left ||
    b.left + b.width <= a.left ||
    a.top + a.height <= b.top ||
    b.top + b.height <= a.top
  );
}

function objectBox(
  o: Record<string, unknown>,
): { left: number; top: number; width: number; height: number } | null {
  const left = Number(o.left);
  const top = Number(o.top);
  const width = Number(o.width);
  const height = Number(o.height);
  if (![left, top, width, height].every(Number.isFinite)) return null;
  return { left, top, width, height };
}

function sectionOf(o: Record<string, unknown>): string {
  const data =
    o.data && typeof o.data === "object" && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : {};
  return String(data.section ?? "").toLowerCase();
}

function countSidebarOverlaps(canvas: FabricCanvasDoc): {
  skills_overlap: number;
  projects_overlap: number;
  projects_certs_collision: number;
  certs_languages_collision: number;
  page_oob: number;
} {
  const objs = (canvas.objects ?? []).filter(
    (o): o is Record<string, unknown> =>
      !!o && typeof o === "object" && !Array.isArray(o),
  );
  const pageW = Number(canvas.width ?? 794);
  const pageH = Number(canvas.height ?? 1123);
  let page_oob = 0;
  const bySection = new Map<string, Array<ReturnType<typeof objectBox>>>();
  for (const o of objs) {
    const box = objectBox(o);
    if (!box) continue;
    if (
      box.left < -0.5 ||
      box.top < -0.5 ||
      box.left + box.width > pageW + 0.5 ||
      box.top + box.height > pageH + 0.5
    ) {
      page_oob++;
    }
    const sec = sectionOf(o);
    if (!sec) continue;
    const list = bySection.get(sec) ?? [];
    list.push(box);
    bySection.set(sec, list);
  }
  const countInternal = (sec: string): number => {
    const list = (bySection.get(sec) ?? []).filter(Boolean);
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (rectsOverlap(list[i]!, list[j]!)) n++;
      }
    }
    return n;
  };
  const collisionBetween = (a: string, b: string): number => {
    const A = (bySection.get(a) ?? []).filter(Boolean);
    const B = (bySection.get(b) ?? []).filter(Boolean);
    let n = 0;
    for (const x of A) for (const y of B) if (rectsOverlap(x!, y!)) n++;
    return n;
  };
  return {
    skills_overlap: countInternal("skills"),
    projects_overlap: countInternal("projects"),
    projects_certs_collision: collisionBetween("projects", "certifications"),
    certs_languages_collision: collisionBetween(
      "certifications",
      "languages",
    ),
    page_oob,
  };
}

/**
 * Run production post-plan gates on an already shape-valid plan.
 * Does not write revision tasks, candidates, Telegram, or call OpenAI.
 */
export function runRevisionPlanGateCircuit(input: {
  priorCanvas: FabricCanvasDoc;
  requested_changes: string[];
  plan: RevisionPlan;
  task_id?: string;
  decision_id?: string;
}): GateCircuitResult {
  const stages = stageInit();
  const inventory = buildCanvasInventory(input.priorCanvas);

  const shape = validateRevisionPlan(input.plan, {
    requested_changes: input.requested_changes,
    allowEmptyOperations: allRequestedChangesAllowEmptyPlan(
      input.requested_changes,
    ),
  });
  if (!shape.ok || !shape.plan) {
    stages.PLAN_SHAPE = "FAIL";
    return {
      ok: false,
      failed_stage: "PLAN_SHAPE",
      status: "FAILED",
      error: `invalid revision plan: ${shape.errors.join("; ")}`,
      stages,
      active_plan: null,
      after_canvas: null,
      coverage_gate_pass: false,
    };
  }
  stages.PLAN_SHAPE = "PASS";

  let activePlan: RevisionPlan = shape.plan;
  if (
    isVerticalSpacingRhythmHeavyFeedback(input.requested_changes) ||
    isHeaderIdentityLayoutFeedback(input.requested_changes)
  ) {
    const det = buildPlanWithDeterministicSpacingOwnership({
      priorCanvas: input.priorCanvas,
      requested_changes: input.requested_changes,
      aiPlan: activePlan,
    });
    if (det.ok && det.plan) {
      const revalidated = validateRevisionPlan(det.plan, {
        requested_changes: input.requested_changes,
        allowEmptyOperations: allRequestedChangesAllowEmptyPlan(
          input.requested_changes,
        ),
      });
      if (revalidated.ok && revalidated.plan) {
        activePlan = revalidated.plan;
        stages.SIDEBAR_OWNERSHIP = "PASS";
      } else {
        stages.SIDEBAR_OWNERSHIP = "PASS"; // retain AI plan (pipeline behavior)
      }
    } else {
      stages.SIDEBAR_OWNERSHIP = "PASS";
    }
  } else {
    stages.SIDEBAR_OWNERSHIP = "SKIP";
  }

  const directionGate = validatePlanVerticalDirections({
    plan: activePlan,
    inventory,
    requested_changes: input.requested_changes,
  });
  if (!directionGate.ok) {
    stages.DIRECTION = "FAIL";
    return {
      ok: false,
      failed_stage: "DIRECTION",
      status: "FAILED_GATE",
      error: `plan direction validation failed: ${directionGate.errors.join("; ")}`,
      stages,
      active_plan: activePlan,
      after_canvas: null,
      coverage_gate_pass: false,
    };
  }
  stages.DIRECTION = "PASS";

  const selectorGate = validateRevisionPlanSelectors(
    input.priorCanvas,
    activePlan,
  );
  if (!selectorGate.ok) {
    stages.SELECTORS = "FAIL";
    return {
      ok: false,
      failed_stage: "SELECTORS",
      status: "FAILED_GATE",
      error: selectorGate.error ?? "selector validation failed",
      stages,
      active_plan: activePlan,
      after_canvas: null,
      coverage_gate_pass: false,
    };
  }
  stages.SELECTORS = "PASS";

  const inventoryGate = validateRevisionPlanAgainstInventory({
    canvas: input.priorCanvas,
    plan: activePlan,
  });
  if (!inventoryGate.ok) {
    stages.INVENTORY_ALIGNMENT = "FAIL";
    return {
      ok: false,
      failed_stage: "INVENTORY_ALIGNMENT",
      status: "FAILED_GATE",
      error: `inventory alignment safety: ${inventoryGate.errors.join("; ")}`,
      stages,
      active_plan: activePlan,
      after_canvas: null,
      coverage_gate_pass: false,
    };
  }
  stages.INVENTORY_ALIGNMENT = "PASS";

  const planGeometryGate = validatePlanGeometrySafety({
    canvas: input.priorCanvas,
    plan: activePlan,
  });
  if (!planGeometryGate.ok) {
    stages.GEOMETRY = "FAIL";
    return {
      ok: false,
      failed_stage: "GEOMETRY",
      status: "FAILED_GATE",
      error:
        planGeometryGate.error ??
        "plan geometry safety failed — not executing geometrically invalid plan",
      stages,
      active_plan: activePlan,
      after_canvas: null,
      coverage_gate_pass: false,
    };
  }
  stages.GEOMETRY = "PASS";

  const executed = executeCanvasOperations({
    canvas: input.priorCanvas,
    operations: activePlan.operations,
  });
  if (!executed.ok) {
    stages.EXECUTION_SIMULATION = "FAIL";
    return {
      ok: false,
      failed_stage: "EXECUTION_SIMULATION",
      status: "FAILED_EXECUTION",
      error: executed.error ?? "execution failed",
      stages,
      active_plan: activePlan,
      after_canvas: null,
      coverage_gate_pass: false,
    };
  }
  stages.EXECUTION_SIMULATION = "PASS";

  const verticalSafety = applySectionUnitVerticalSafety({
    priorCanvas: input.priorCanvas,
    afterCanvas: executed.canvas,
    requested_changes: input.requested_changes,
  });
  if (!verticalSafety.report.ok) {
    stages.SECTION_VERTICAL_SAFETY = "FAIL";
    return {
      ok: false,
      failed_stage: "SECTION_VERTICAL_SAFETY",
      status: "FAILED_GATE",
      error:
        verticalSafety.report.error ??
        "section-unit vertical safety failed",
      stages,
      active_plan: activePlan,
      after_canvas: executed.canvas,
      coverage_gate_pass: false,
    };
  }
  stages.SECTION_VERTICAL_SAFETY = "PASS";

  const normalized = normalizeRevisionLayout({
    canvas: verticalSafety.canvas,
    requested_changes: input.requested_changes,
    prior_canvas: input.priorCanvas,
  });
  if (!normalized.report.ok) {
    stages.LAYOUT_NORMALIZATION = "FAIL";
    return {
      ok: false,
      failed_stage: "LAYOUT_NORMALIZATION",
      status: "FAILED_COVERAGE",
      error:
        normalized.report.error ??
        "deterministic layout normalization failed",
      stages,
      active_plan: activePlan,
      after_canvas: verticalSafety.canvas,
      coverage_gate_pass: false,
    };
  }
  stages.LAYOUT_NORMALIZATION = "PASS";

  // Phase 5W: final post-normalization pairwise rendered overlap gate.
  const finalOverlaps = findTextOverlapFindings(normalized.canvas);
  if (finalOverlaps.length > 0) {
    stages.ACCEPTANCE = "FAIL";
    return {
      ok: false,
      failed_stage: "ACCEPTANCE",
      status: "FAILED_GATE",
      error: `final rendered geometry failed: text_overlaps=${finalOverlaps.length}`,
      stages,
      active_plan: activePlan,
      after_canvas: normalized.canvas,
      coverage_gate_pass: false,
    };
  }

  const acceptanceReport = runRevisionAcceptanceChecks({
    beforeCanvas: input.priorCanvas,
    afterCanvas: normalized.canvas,
    plan: activePlan,
    requested_changes: input.requested_changes,
    task_id: input.task_id ?? "revtask-fixture-5v",
    decision_id: input.decision_id ?? "fd-fixture-5v",
    revision_id: null,
    page_fit: normalized.report.page_fit,
  });
  stages.ACCEPTANCE = "PASS";

  const coverage = buildFeedbackCoverage({
    requested_changes: input.requested_changes,
    plan: activePlan,
    log: executed.log,
    beforeCanvas: input.priorCanvas,
    afterCanvas: normalized.canvas,
    acceptanceReport,
  });
  if (!coverage.gate_pass) {
    stages.FEEDBACK_COVERAGE = "FAIL";
    stages.COVERAGE_LEDGER = "FAIL";
    return {
      ok: false,
      failed_stage: "FEEDBACK_COVERAGE",
      status: "FAILED_COVERAGE",
      error: "feedback coverage gate failed — not returning to Founder Review",
      stages,
      active_plan: activePlan,
      after_canvas: normalized.canvas,
      coverage_gate_pass: false,
      coverage_items: coverage.items.map((it) => ({
        item: it.founder_feedback_item.slice(0, 80),
        status: it.status,
        notes: it.evidence?.notes ?? null,
      })),
    };
  }
  stages.FEEDBACK_COVERAGE = "PASS";
  stages.COVERAGE_LEDGER = "PASS";

  const proof = countSidebarOverlaps(normalized.canvas);
  const outputOk =
    proof.skills_overlap === 0 &&
    proof.projects_overlap === 0 &&
    proof.projects_certs_collision === 0 &&
    proof.certs_languages_collision === 0 &&
    proof.page_oob === 0;
  if (!outputOk) {
    stages.REVISED_RESUME_TEMPLATE_OUTPUT = "FAIL";
    return {
      ok: false,
      failed_stage: "REVISED_RESUME_TEMPLATE_OUTPUT",
      status: "FAILED_COVERAGE",
      error: `revised output contract failed: ${JSON.stringify(proof)}`,
      stages,
      active_plan: activePlan,
      after_canvas: normalized.canvas,
      coverage_gate_pass: true,
      sidebar_overlap_proof: proof,
    };
  }
  stages.REVISED_RESUME_TEMPLATE_OUTPUT = "PASS";

  return {
    ok: true,
    failed_stage: null,
    status: "PASS",
    error: null,
    stages,
    active_plan: activePlan,
    after_canvas: normalized.canvas,
    coverage_gate_pass: true,
    sidebar_overlap_proof: proof,
  };
}
