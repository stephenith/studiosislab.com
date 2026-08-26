/**
 * Plans batch release groups and candidate selection.
 */
import type { PackageRecord, ReleaseGroup, ReleaseGroupType } from "./types.js";

export function buildReleaseGroups(packages: PackageRecord[]): ReleaseGroup[] {
  const ready = packages.filter((p) => p.classification === "ready");
  const batch001 = ready.filter((p) => p.batch_id === "production-batch-001");
  const premium = ready.filter((p) => p.batch_id === "premium-collection");

  const byCategory = new Map<string, string[]>();
  for (const p of ready) {
    const cat = p.category_id ?? "uncategorized";
    const list = byCategory.get(cat) ?? [];
    list.push(p.catalog_id);
    byCategory.set(cat, list);
  }

  const groups: ReleaseGroup[] = [
    {
      type: "production_batch",
      label: "production-batch-001",
      catalog_ids: batch001.map((p) => p.catalog_id),
      filter: { batch_id: "production-batch-001" },
    },
    {
      type: "catalog_ids",
      label: "all-ready-safe",
      catalog_ids: ready.map((p) => p.catalog_id),
    },
    {
      type: "founder_list",
      label: "founder-selected-pending",
      catalog_ids: ready
        .filter((p) => !p.founder_final_publish_approval)
        .map((p) => p.catalog_id),
    },
  ];

  for (const [categoryId, catalogIds] of byCategory) {
    groups.push({
      type: "category",
      label: categoryId,
      catalog_ids: catalogIds,
      filter: { category_id: categoryId },
    });
  }

  if (premium.length > 0) {
    groups.push({
      type: "catalog_ids",
      label: "premium-collection",
      catalog_ids: premium.map((p) => p.catalog_id),
      filter: { batch_id: "premium-collection" },
    });
  }

  for (const p of ready) {
    groups.push({
      type: "single",
      label: p.catalog_id,
      catalog_ids: [p.catalog_id],
    });
  }

  return groups;
}

export function selectForGroup(
  packages: PackageRecord[],
  group: ReleaseGroup,
): { selected: string[]; excluded: Array<{ catalog_id: string; reason: string }> } {
  const byId = new Map(packages.map((p) => [p.catalog_id, p]));
  const selected: string[] = [];
  const excluded: Array<{ catalog_id: string; reason: string }> = [];

  for (const catalogId of group.catalog_ids) {
    const pkg = byId.get(catalogId);
    if (!pkg) {
      excluded.push({ catalog_id: catalogId, reason: "package_not_found" });
      continue;
    }
    if (pkg.classification === "published") {
      excluded.push({ catalog_id: catalogId, reason: "already_published" });
      continue;
    }
    if (pkg.classification !== "ready") {
      excluded.push({
        catalog_id: catalogId,
        reason: `classification_${pkg.classification}`,
      });
      continue;
    }
    if (!pkg.founder_final_publish_approval) {
      // Eligible for plan but requires founder final approval at execution
      selected.push(catalogId);
      continue;
    }
    selected.push(catalogId);
  }

  return { selected, excluded };
}

export function filterByIndustry(
  packages: PackageRecord[],
  industries: string[],
): string[] {
  const normalized = new Set(industries.map((i) => i.toLowerCase()));
  return packages
    .filter(
      (p) =>
        p.classification === "ready" &&
        p.industry &&
        normalized.has(p.industry.toLowerCase()),
    )
    .map((p) => p.catalog_id);
}

export function groupByType(groups: ReleaseGroup[], type: ReleaseGroupType): ReleaseGroup | null {
  return groups.find((g) => g.type === type) ?? null;
}
