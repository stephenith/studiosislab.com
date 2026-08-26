import type { DependencyEdge, DependencyGraph, EngineeringJobSpec, ProductFeature } from "./types.js";

function featureSlugFromId(featureId: string): string {
  const parts = featureId.split("-FEAT-");
  return parts[1] ?? "";
}

/**
 * Determine must-finish-first chains, parallel work, and blocked jobs.
 */
export class DependencyResolver {
  resolve(features: ProductFeature[], jobs: EngineeringJobSpec[]): DependencyGraph {
    const edges: DependencyEdge[] = [];
    const jobsByFeature = new Map<string, EngineeringJobSpec[]>();

    for (const job of jobs) {
      const list = jobsByFeature.get(job.feature_id) ?? [];
      list.push(job);
      jobsByFeature.set(job.feature_id, list);
    }

    for (const list of jobsByFeature.values()) {
      list.sort((a, b) => a.index - b.index);
    }

    const templateFeature = features.find((f) => featureSlugFromId(f.id) === "resume-templates");
    const dependentSlugs = new Set(["resume-assets", "thumbnail-images", "seo-pages", "ats-validation"]);

    if (templateFeature) {
      const templates = jobsByFeature.get(templateFeature.id) ?? [];
      for (const feature of features) {
        const slug = featureSlugFromId(feature.id);
        if (!dependentSlugs.has(slug)) continue;
        const dependents = jobsByFeature.get(feature.id) ?? [];
        for (const depJob of dependents) {
          const templateIndex = Math.min(depJob.index, templates.length);
          const templateJob = templates[templateIndex - 1] ?? templates[templates.length - 1];
          if (!templateJob) continue;
          edges.push({
            from_job_id: templateJob.id,
            to_job_id: depJob.id,
            kind: slug === "ats-validation" ? "blocks" : "must_finish_first",
            reason: `${depJob.feature_name} depends on base template ${templateJob.id}`,
          });
        }
      }

      const assetsFeature = features.find((f) => featureSlugFromId(f.id) === "resume-assets");
      const validationFeature = features.find((f) => featureSlugFromId(f.id) === "ats-validation");
      if (assetsFeature && validationFeature) {
        const assets = jobsByFeature.get(assetsFeature.id) ?? [];
        const validations = jobsByFeature.get(validationFeature.id) ?? [];
        for (const valJob of validations) {
          const assetJob = assets[Math.min(valJob.index, assets.length) - 1] ?? assets[assets.length - 1];
          if (!assetJob) continue;
          edges.push({
            from_job_id: assetJob.id,
            to_job_id: valJob.id,
            kind: "must_finish_first",
            reason: "ATS validation requires resume assets",
          });
        }
      }
    } else {
      const orderedFeatures = [...features].sort((a, b) => a.estimated_jobs - b.estimated_jobs);
      for (let i = 1; i < orderedFeatures.length; i++) {
        const prev = orderedFeatures[i - 1]!;
        const curr = orderedFeatures[i]!;
        const prevJobs = jobsByFeature.get(prev.id) ?? [];
        const currJobs = jobsByFeature.get(curr.id) ?? [];
        if (prevJobs[0] && currJobs[0]) {
          edges.push({
            from_job_id: prevJobs[0]!.id,
            to_job_id: currJobs[0]!.id,
            kind: "must_finish_first",
            reason: `${curr.name} follows ${prev.name}`,
          });
        }
      }
    }

    const blocked_jobs: Record<string, string[]> = {};
    for (const edge of edges) {
      const list = blocked_jobs[edge.to_job_id] ?? [];
      list.push(edge.from_job_id);
      blocked_jobs[edge.to_job_id] = list;
    }

    const must_finish_first = edges
      .filter((e) => e.kind === "must_finish_first")
      .map((e) => [e.from_job_id, e.to_job_id]);

    const parallel_groups = this.buildParallelGroups(jobs, blocked_jobs);

    return {
      edges,
      must_finish_first,
      parallel_groups,
      blocked_jobs,
    };
  }

  topologicalOrder(jobs: EngineeringJobSpec[], graph: DependencyGraph): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const job of jobs) {
      inDegree.set(job.id, 0);
      adjacency.set(job.id, []);
    }

    for (const edge of graph.edges) {
      adjacency.get(edge.from_job_id)?.push(edge.to_job_id);
      inDegree.set(edge.to_job_id, (inDegree.get(edge.to_job_id) ?? 0) + 1);
    }

    const queue = jobs.filter((j) => (inDegree.get(j.id) ?? 0) === 0).map((j) => j.id);
    const order: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const next of adjacency.get(current) ?? []) {
        const deg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }

    if (order.length < jobs.length) {
      for (const job of jobs) {
        if (!order.includes(job.id)) order.push(job.id);
      }
    }

    return order;
  }

  criticalPath(jobs: EngineeringJobSpec[], graph: DependencyGraph): string[] {
    const order = this.topologicalOrder(jobs, graph);
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();

    for (const job of jobs) {
      dist.set(job.id, 0);
      prev.set(job.id, null);
    }

    for (const jobId of order) {
      for (const edge of graph.edges) {
        if (edge.from_job_id !== jobId) continue;
        const nextDist = (dist.get(jobId) ?? 0) + 1;
        if (nextDist > (dist.get(edge.to_job_id) ?? 0)) {
          dist.set(edge.to_job_id, nextDist);
          prev.set(edge.to_job_id, jobId);
        }
      }
    }

    let bestEnd = jobs[0]?.id ?? "";
    let bestDist = -1;
    for (const job of jobs) {
      const d = dist.get(job.id) ?? 0;
      if (d > bestDist) {
        bestDist = d;
        bestEnd = job.id;
      }
    }

    const path: string[] = [];
    let cursor: string | null = bestEnd;
    while (cursor) {
      path.unshift(cursor);
      cursor = prev.get(cursor) ?? null;
    }

    return path.length > 0 ? path : order.slice(0, Math.min(5, order.length));
  }

  private buildParallelGroups(
    jobs: EngineeringJobSpec[],
    blocked_jobs: Record<string, string[]>,
  ): string[][] {
    const groups: string[][] = [];
    const assigned = new Set<string>();

    const roots = jobs.filter((j) => !(blocked_jobs[j.id]?.length)).map((j) => j.id);
    if (roots.length > 0) {
      groups.push(roots);
      for (const id of roots) assigned.add(id);
    }

    const remaining = jobs.map((j) => j.id).filter((id) => !assigned.has(id));
    const chunkSize = 10;
    for (let i = 0; i < remaining.length; i += chunkSize) {
      groups.push(remaining.slice(i, i + chunkSize));
    }

    return groups.filter((g) => g.length > 0);
  }
}
