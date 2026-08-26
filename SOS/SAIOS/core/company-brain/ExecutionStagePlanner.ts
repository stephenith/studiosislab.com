/**
 * ExecutionStagePlanner — ordered dry-run stages (Agent #165).
 * Never executes stages.
 */
import type {
  ExecutionGraph,
  ExecutionGraphEdge,
  ExecutionGraphNode,
  ExecutionStageId,
  QualityGate,
  RollbackPoint,
} from "./execution-package-types.js";

const STAGE_DEFS: Array<{
  id: ExecutionStageId;
  label: string;
  description: string;
}> = [
  {
    id: "mission",
    label: "Mission",
    description: "Mission Contract context (already approved)",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    description: "Load knowledge snapshot references",
  },
  {
    id: "planning",
    label: "Planning",
    description: "Company Brain derived ExecutionPlan",
  },
  {
    id: "designbrief",
    label: "DesignBrief",
    description: "Canonical DesignBrief Engine (preview only)",
  },
  {
    id: "renderer",
    label: "Renderer",
    description: "Resume Renderer (preview only)",
  },
  {
    id: "editor_compatibility",
    label: "Editor Compatibility",
    description: "Editor compatibility checks (preview only)",
  },
  {
    id: "critic",
    label: "Critic",
    description: "Resume Critic evaluation (preview only)",
  },
  {
    id: "gate",
    label: "Gate",
    description: "Critic Gate — Ready check (preview only)",
  },
  {
    id: "founder_review",
    label: "Founder Review",
    description: "Interactive Founder Gate pause (preview only)",
  },
  {
    id: "learning",
    label: "Learning",
    description: "Learning write-back planning (preview only)",
  },
];

export function planExecutionStages(): ExecutionGraph {
  const nodes: ExecutionGraphNode[] = STAGE_DEFS.map((s, i) => ({
    id: s.id,
    label: s.label,
    order: i + 1,
    description: s.description,
    executed: false,
  }));
  const edges: ExecutionGraphEdge[] = [];
  for (let i = 0; i < STAGE_DEFS.length - 1; i++) {
    edges.push({
      from: STAGE_DEFS[i]!.id,
      to: STAGE_DEFS[i + 1]!.id,
      kind: "sequential",
    });
  }
  return {
    nodes,
    edges,
    critical_path: STAGE_DEFS.map((s) => s.id),
    note: "Execution graph is a dry-run preview. No stage is executed.",
  };
}

export function planQualityGates(opts: {
  knowledge_available: boolean;
  mission_approved_or_ready: boolean;
  queue_approved: boolean;
}): QualityGate[] {
  return [
    {
      id: "knowledge_ready",
      label: "Knowledge Ready",
      required: true,
      satisfied: opts.knowledge_available,
      publishing_gate: false,
      note: "Knowledge snapshot reference present",
    },
    {
      id: "mission_approved",
      label: "Mission Approved",
      required: true,
      satisfied: opts.mission_approved_or_ready,
      publishing_gate: false,
      note: "Mission passed founder approval",
    },
    {
      id: "queue_approved",
      label: "Queue Approved",
      required: true,
      satisfied: opts.queue_approved,
      publishing_gate: false,
      note: "Queue admission reached READY_FOR_QUEUE",
    },
    {
      id: "design_ready",
      label: "Design Ready",
      required: true,
      satisfied: null,
      publishing_gate: false,
      note: "Future — DesignBrief not run in preview",
    },
    {
      id: "render_ready",
      label: "Render Ready",
      required: true,
      satisfied: null,
      publishing_gate: false,
      note: "Future — Renderer not run in preview",
    },
    {
      id: "critic_ready",
      label: "Critic Ready",
      required: true,
      satisfied: null,
      publishing_gate: false,
      note: "Future — Critic not run in preview",
    },
    {
      id: "founder_review",
      label: "Founder Review",
      required: true,
      satisfied: null,
      publishing_gate: false,
      note: "Future — cycle founder gate not entered",
    },
    {
      id: "learning_complete",
      label: "Learning Complete",
      required: false,
      satisfied: null,
      publishing_gate: false,
      note: "Future — learning write-back not run",
    },
    {
      id: "publishing_eligible",
      label: "Publishing Eligible",
      required: true,
      satisfied: false,
      publishing_gate: true,
      note: "ALWAYS false — publishing disabled",
    },
  ];
}

export function planRollbackPoints(): RollbackPoint[] {
  return [
    {
      id: "rb-after-knowledge",
      after_stage: "knowledge",
      label: "Rollback after Knowledge",
      description: "Discard loaded knowledge context; return to Mission",
      implemented: false,
    },
    {
      id: "rb-after-planning",
      after_stage: "planning",
      label: "Rollback after Planning",
      description: "Supersede derived plan; keep Mission Contract",
      implemented: false,
    },
    {
      id: "rb-after-designbrief",
      after_stage: "designbrief",
      label: "Rollback after DesignBrief",
      description: "Discard DesignBrief artifacts (future)",
      implemented: false,
    },
    {
      id: "rb-after-renderer",
      after_stage: "renderer",
      label: "Rollback after Renderer",
      description: "Discard render outputs (future)",
      implemented: false,
    },
    {
      id: "rb-after-critic",
      after_stage: "critic",
      label: "Rollback after Critic",
      description: "Return to render/revise path (future)",
      implemented: false,
    },
    {
      id: "rb-after-founder",
      after_stage: "founder_review",
      label: "Rollback after Founder Review",
      description: "Honor REJECTED / CHANGES_REQUESTED (future)",
      implemented: false,
    },
  ];
}
