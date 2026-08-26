/**
 * Founder review queue — templates awaiting approval.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  PATHS,
  loadCriticReview,
  loadPublicationCatalog,
  loadRenderScores,
  loadUnifiedRuns,
} from "./DataAggregator.js";
import type { ReviewItem } from "./types.js";

export function buildReviewQueue(): { items: ReviewItem[]; total: number } {
  const runs = loadUnifiedRuns().filter((r) => r.status === "waiting_founder");
  const catalog = loadPublicationCatalog()?.entries ?? [];
  const items: ReviewItem[] = [];

  for (const run of runs) {
    const prototype_id = String(run.prototype_id ?? run.run_id);
    const prototype_dir = String(run.prototype_dir ?? "");
    const template_path = join(prototype_dir, "template-preview.json");
    const critic = loadCriticReview(prototype_id);
    const render = loadRenderScores(prototype_id);
    const quality = (run.quality as Record<string, number>) ?? {};

    const catalogEntry = catalog.find(
      (c) => c.prototype_id === prototype_id || c.template_id === prototype_id,
    );

    const gatePath = join(prototype_dir.replace("/generating", ""), "waiting-founder/founder-gate.json");
    let review_command: string | null = null;
    if (existsSync(template_path)) {
      review_command = `npm run review:template -- --path=${template_path}`;
    }

    items.push({
      run_id: String(run.run_id),
      prototype_id,
      template_path: existsSync(template_path) ? template_path : prototype_dir,
      objective: String(run.objective ?? ""),
      quality_score: Number(quality.overall_confidence ?? critic.approval?.overall_score ?? 0),
      founder_prediction: String(
        quality.founder_prediction ?? critic.prediction?.founder_approval_probability ?? "PENDING",
      ),
      ats_score: Number(quality.ats_score ?? 0),
      premium_score: Number(quality.premium_score ?? render?.premium_score ?? 0),
      visual_score: Number(quality.visual_render_score ?? render?.overall_render_score ?? 0),
      publication_status: catalogEntry ? String(catalogEntry.state ?? "draft") : "waiting_founder",
      review_command,
      catalog_id: run.catalog_id ? String(run.catalog_id) : null,
    });
  }

  return { items, total: items.length };
}

export function recordFounderReviewAction(
  action: import("./types.js").FounderReviewAction,
  persistPath: string,
): void {
  const store = existsSync(persistPath)
    ? (JSON.parse(readFileSync(persistPath, "utf8")) as { decisions: unknown[] })
    : { decisions: [] };
  store.decisions.push({
    ...action,
    recorded_at: new Date().toISOString(),
  });
  mkdirSync(dirname(persistPath), { recursive: true });
  writeFileSync(persistPath, JSON.stringify(store, null, 2));
}
