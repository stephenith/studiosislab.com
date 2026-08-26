/**
 * ExecutionGraphBuilder — worker + execution graphs (Agent #165).
 * Informational only. Never executes.
 */
import type { MissionContract } from "./mission-types.js";
import type { WorkerGraph } from "./execution-package-types.js";
import { planExecutionStages } from "./ExecutionStagePlanner.js";

export function buildExecutionGraph() {
  return planExecutionStages();
}

export function buildWorkerGraph(mission: MissionContract): WorkerGraph {
  const depts = mission.estimated_departments
    .filter(
      (d) => d.role_in_plan === "primary" || d.role_in_plan === "supporting",
    )
    .map((d) => d.department);

  const nodes: WorkerGraph["nodes"] = [
    {
      id: "director-company-brain",
      kind: "director",
      label: "Company Brain (Director / planning authority)",
      informational: true,
    },
    {
      id: "manager-resume",
      kind: "manager",
      label: "Resume Department Manager (orchestration only)",
      informational: true,
    },
    {
      id: "worker-designbrief",
      kind: "worker",
      label: "DesignBrief Worker",
      informational: true,
    },
    {
      id: "worker-renderer",
      kind: "worker",
      label: "Resume Renderer Worker",
      informational: true,
    },
    {
      id: "worker-critic",
      kind: "worker",
      label: "Resume Critic Worker",
      informational: true,
    },
    {
      id: "skill-layout",
      kind: "skill",
      label: "resume.layout_planning",
      informational: true,
    },
    {
      id: "skill-critic",
      kind: "skill",
      label: "resume.critic",
      informational: true,
    },
    {
      id: "model-mock",
      kind: "model",
      label: "Mock Provider (no live models)",
      informational: true,
    },
    {
      id: "tool-brain-router",
      kind: "tool",
      label: "Brain Router (only reasoning gateway)",
      informational: true,
    },
    {
      id: "tool-firecrawl",
      kind: "tool",
      label: "Firecrawl (research tool)",
      informational: true,
    },
  ];

  if (depts.includes("website") || depts.includes("seo")) {
    nodes.push({
      id: "manager-website",
      kind: "manager",
      label: "Website/SEO Manager (informational — disabled dept)",
      informational: true,
    });
  }

  const edges: WorkerGraph["edges"] = [
    {
      from: "director-company-brain",
      to: "manager-resume",
      kind: "orchestrates",
    },
    {
      from: "manager-resume",
      to: "worker-designbrief",
      kind: "orchestrates",
    },
    {
      from: "manager-resume",
      to: "worker-renderer",
      kind: "orchestrates",
    },
    {
      from: "manager-resume",
      to: "worker-critic",
      kind: "orchestrates",
    },
    {
      from: "worker-designbrief",
      to: "skill-layout",
      kind: "uses",
    },
    {
      from: "worker-critic",
      to: "skill-critic",
      kind: "uses",
    },
    {
      from: "skill-layout",
      to: "model-mock",
      kind: "invokes",
    },
    {
      from: "skill-layout",
      to: "tool-brain-router",
      kind: "uses",
    },
    {
      from: "skill-critic",
      to: "tool-brain-router",
      kind: "uses",
    },
    {
      from: "director-company-brain",
      to: "tool-firecrawl",
      kind: "uses",
    },
  ];

  return {
    nodes,
    edges,
    note: "Worker graph is informational. Directors/Managers never execute; workers are not dispatched.",
  };
}

export class ExecutionGraphBuilder {
  buildExecutionGraph() {
    return buildExecutionGraph();
  }

  buildWorkerGraph(mission: MissionContract) {
    return buildWorkerGraph(mission);
  }
}
