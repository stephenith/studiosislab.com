import type { EngineeringJobSpec, ProductEpic, ProductFeature } from "./types.js";

function featureSlug(feature: ProductFeature): string {
  const parts = feature.id.split("-FEAT-");
  return parts[1] ?? feature.name.toLowerCase().replace(/\s+/g, "-");
}

function padIndex(index: number): string {
  return String(index).padStart(3, "0");
}

/**
 * Break every product feature into executable engineering job specifications.
 */
export class EpicDecomposer {
  decompose(epic: ProductEpic, features: ProductFeature[]): EngineeringJobSpec[] {
    const jobs: EngineeringJobSpec[] = [];

    for (const feature of features) {
      const slug = featureSlug(feature);
      for (let i = 1; i <= feature.estimated_jobs; i++) {
        const jobId = `${slug.toUpperCase().replace(/-/g, "_")}-${padIndex(i)}`;
        jobs.push({
          id: jobId,
          feature_id: feature.id,
          feature_name: feature.name,
          title: `${feature.name} #${i}`,
          description: `${feature.description} — unit ${i} of ${feature.estimated_jobs} for epic "${epic.title}"`,
          worker_type: feature.worker_type,
          capability: feature.capability,
          priority: epic.priority,
          index: i,
        });
      }
    }

    return jobs;
  }
}
