/**
 * Builds the Resume Factory runtime dependency graph.
 */
import type { RuntimeDependencyGraph } from "./types.js";

export function buildRuntimeDependencyGraph(): RuntimeDependencyGraph {
  const nodes = [
    { id: "research", label: "Research Engine", type: "engine" as const, depends_on: [], verify_command: "research:verify" },
    { id: "benchmark", label: "Benchmark Engine", type: "engine" as const, depends_on: ["research"], verify_command: "benchmark:verify" },
    { id: "design-brain", label: "Design Brain", type: "engine" as const, depends_on: ["benchmark"], verify_command: "design-brain:verify" },
    { id: "design-dna", label: "Design DNA", type: "engine" as const, depends_on: ["design-brain"], verify_command: "design-dna:verify" },
    { id: "design-system", label: "Design System", type: "engine" as const, depends_on: ["design-dna"], verify_command: "design-system:verify" },
    { id: "adaptive-composer", label: "Adaptive Composer", type: "engine" as const, depends_on: ["design-system", "design-brain"], verify_command: "composer:verify" },
    { id: "premium-generator", label: "Premium Generator", type: "engine" as const, depends_on: ["adaptive-composer", "design-dna"], verify_command: "premium-generator:verify" },
    { id: "qa", label: "QA", type: "engine" as const, depends_on: ["premium-generator"], verify_command: "resume-qa:verify" },
    { id: "visual-render", label: "Visual Render", type: "engine" as const, depends_on: ["qa"], verify_command: "visual-render:verify" },
    { id: "founder-critic", label: "Founder Critic", type: "engine" as const, depends_on: ["visual-render"], verify_command: "founder-critic:verify" },
    { id: "competitive-validation", label: "Competitive Validation", type: "engine" as const, depends_on: ["founder-critic"], verify_command: "competitive-validation:verify" },
    { id: "publication", label: "Publication", type: "publication" as const, depends_on: ["competitive-validation", "founder-critic"], verify_command: "publication:verify" },
    { id: "release-manager", label: "Release Manager", type: "publication" as const, depends_on: ["publication"], verify_command: "release-manager:verify" },
    { id: "runtime-catalog", label: "Runtime Catalog", type: "platform" as const, depends_on: ["release-manager"], verify_command: "catalog-integration:verify" },
    { id: "factory-state", label: "Factory State", type: "orchestration" as const, depends_on: ["runtime-catalog"], verify_command: "factory-state:verify" },
    { id: "production-dashboard", label: "Production Dashboard", type: "orchestration" as const, depends_on: ["factory-state"], verify_command: "production-dashboard:verify" },
    { id: "catalog-integrity", label: "Catalog Integrity", type: "orchestration" as const, depends_on: ["production-dashboard"], verify_command: "catalog-integrity:verify" },
    { id: "batch-release", label: "Batch Release", type: "orchestration" as const, depends_on: ["catalog-integrity", "release-manager"], verify_command: "batch-release:verify" },
  ];

  return {
    generated_at: new Date().toISOString(),
    version: "1.0.0",
    nodes,
    pipeline_order: [
      "research",
      "benchmark",
      "design-brain",
      "design-dna",
      "design-system",
      "adaptive-composer",
      "premium-generator",
      "qa",
      "visual-render",
      "founder-critic",
      "competitive-validation",
      "publication",
      "release-manager",
      "runtime-catalog",
    ],
  };
}
