/**
 * Builds morning / evening / daily founder digests.
 */
import type { CollectedSource, DigestBundle, NormalizedAlert } from "./types.js";

function metric(sources: CollectedSource[], sourceId: string, key: string): unknown {
  return sources.find((s) => s.id === sourceId)?.metrics?.[key];
}

export function buildDigests(input: {
  sources: CollectedSource[];
  alerts: NormalizedAlert[];
}): DigestBundle {
  const now = new Date().toISOString();
  const websiteStatus = String(
    metric(input.sources, "project-state", "website_status") ??
      metric(input.sources, "production-dashboard", "status") ??
      "unknown",
  );
  const factoryStatus = String(
    metric(input.sources, "project-state", "factory_v1") ??
      metric(input.sources, "factory-health", "status") ??
      "unknown",
  );
  const pending = (metric(input.sources, "project-state", "pending_actions") as string[]) ?? [];
  const ready =
    Number(metric(input.sources, "production-dashboard", "ready_to_publish") ?? 0) ||
    Number(metric(input.sources, "project-state", "publication_queue") ?? 0);
  const published = metric(input.sources, "project-state", "latest_catalog") ?? "unknown";

  const recommended =
    pending.find((p) => p.toLowerCase().includes("founder")) ??
    (ready > 0
      ? `Review ${ready} publication package(s) ready to publish`
      : input.alerts.some((a) => a.priority === "CRITICAL")
        ? "Address CRITICAL alerts immediately"
        : "No urgent action — continue monitoring");

  const structured = {
    website_status: websiteStatus,
    factory_status: factoryStatus,
    pending_founder_reviews: pending.filter((p) => p.toLowerCase().includes("founder")),
    templates_ready_to_publish: ready,
    published_templates: published,
    alerts: input.alerts,
    recommended_next_action: recommended,
  };

  const alertLines =
    input.alerts.length === 0
      ? ["- None"]
      : input.alerts.map((a) => `- [${a.priority}] ${a.title}: ${a.message}`);

  const body = [
    `Website: ${websiteStatus}`,
    `Resume Factory: ${factoryStatus}`,
    `Pending founder reviews: ${structured.pending_founder_reviews.join("; ") || "None"}`,
    `Templates ready to publish: ${ready}`,
    `Latest published template: ${published}`,
    "",
    "Alerts:",
    ...alertLines,
    "",
    `Recommended next action: ${recommended}`,
  ].join("\n");

  const morning = ["# Morning Review Digest", "", `Generated: ${now}`, "", body, ""].join("\n");
  const evening = ["# Evening Review Digest", "", `Generated: ${now}`, "", body, ""].join("\n");
  const daily = ["# Daily Summary", "", `Generated: ${now}`, "", body, ""].join("\n");

  return { generated_at: now, morning, evening, daily, structured };
}
