import { useEffect, useState } from "react";
import type { ResumeCatalogSnapshot, RuntimeTemplateRecord } from "@/lib/resumeCatalogRuntime";
import { TEMPLATES as STATIC_TEMPLATES } from "@/data/templates";

const STATIC_SNAPSHOT: ResumeCatalogSnapshot = {
  templates: (STATIC_TEMPLATES as RuntimeTemplateRecord[]).map((template) => ({
    id: template.id,
    title: template.title,
    categoryId: template.categoryId,
    category: template.category,
    tags: template.tags ?? [],
    thumb: template.thumb,
    status: template.status === "draft" ? "draft" : "published",
    jsonPath: `src/data/template-json/${template.id}.json`,
    numericId: Number(template.id.replace(/\D+/g, "")) || 0,
  })),
  seoPages: [],
  featuredTemplates: [],
  recentTemplates: [],
  searchIndex: [],
  generatedAt: "",
  cacheKey: "static-fallback",
};

export function useRuntimeResumeCatalog() {
  const [snapshot, setSnapshot] = useState<ResumeCatalogSnapshot>(STATIC_SNAPSHOT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/resume-catalog", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
        const next = (await response.json()) as ResumeCatalogSnapshot;
        if (!cancelled) setSnapshot(next);
      } catch (error: any) {
        const message = String(error?.message || "").toLowerCase();
        if (!cancelled && error?.name !== "AbortError" && !message.includes("aborted")) {
          console.warn("[resume-catalog] Falling back to static template catalog", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return {
    snapshot,
    templates: snapshot.templates,
    featuredTemplates: snapshot.featuredTemplates.length
      ? snapshot.featuredTemplates
      : snapshot.templates.filter((_, index) => index >= 8).slice(0, 8),
    recentTemplates: snapshot.recentTemplates.length
      ? snapshot.recentTemplates
      : snapshot.templates.slice(0, 8),
    loading,
  };
}
