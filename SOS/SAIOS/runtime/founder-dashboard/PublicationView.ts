/**
 * Publication view — catalog states.
 */
import { loadPublicationCatalog } from "./DataAggregator.js";

export function buildPublicationView() {
  const entries = loadPublicationCatalog()?.entries ?? [];

  const count = (state: string) => entries.filter((e) => e.state === state).length;

  return {
    updated_at: new Date().toISOString(),
    ready_to_publish: count("ready_to_publish"),
    waiting_founder: entries.filter((e) => e.state === "draft").length,
    approved: count("founder_approved"),
    rejected: 0,
    revision: 0,
    published: count("published"),
    archived: count("archived"),
    entries: entries.slice(0, 50).map((e) => ({
      catalog_id: e.catalog_id,
      prototype_id: e.prototype_id,
      title: e.title,
      state: e.state,
      category: e.category,
    })),
  };
}
