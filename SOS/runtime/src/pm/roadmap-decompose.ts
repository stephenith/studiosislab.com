import type { BacklogItem, RoadmapComplexity, RoadmapSlice, RoadmapSliceKind } from "./types.js";

export type DecomposeTemplate = {
  id: string;
  match: (item: BacklogItem) => boolean;
  milestone: string;
  feature: string;
  slices: Array<{
    slug: string;
    title: string;
    description: string;
    dependency: string[];
    estimated_complexity: RoadmapComplexity;
    acceptance_criteria: string[];
    evidence_paths: string[];
    suggested_files: string[];
    qa_checklist: string[];
    kind?: RoadmapSliceKind;
    priority?: BacklogItem["priority"];
  }>;
};

const MOBILE_HUB_SLICES: DecomposeTemplate["slices"] = [
  {
    slug: "mobile-routing",
    title: "Mobile routing from Resume Hub",
    description:
      "Detect mobile viewport in Resume Hub and route to `/editor/mobile/template/{id}` instead of desktop `/editor/template/{id}`.",
    dependency: [],
    estimated_complexity: "small",
    acceptance_criteria: [
      "Phone viewport opens mobile editor from Hub template tap",
      "Desktop viewport still opens desktop editor",
      "No regression for blank-create and recents flows",
    ],
    evidence_paths: [
      "src/app/resume/ResumeHubClient.tsx",
      "src/components/editor/EditorMobileGuard.tsx",
      "src/app/editor/mobile/template/[templateId]/page.tsx",
    ],
    suggested_files: ["src/app/resume/ResumeHubClient.tsx"],
    qa_checklist: [
      "Hub → template on 375px viewport opens mobile editor",
      "Hub → template on 1280px viewport opens desktop editor",
      "Build and lint pass",
    ],
  },
  {
    slug: "mobile-template-loading",
    title: "Mobile template loading reliability",
    description: "Ensure all published templates load in mobile editor without canvas errors.",
    dependency: ["mobile-routing"],
    estimated_complexity: "medium",
    acceptance_criteria: [
      "Sample of 5 templates load on mobile without error",
      "Template JSON applies to mobile canvas",
    ],
    evidence_paths: [
      "src/app/editor/mobile/template/[templateId]/page.tsx",
      "src/components/editor/mobile/useMobileFabricEditor.ts",
      "templates.manifest.json",
    ],
    suggested_files: [
      "src/components/editor/mobile/useMobileFabricEditor.ts",
      "src/app/editor/mobile/template/[templateId]/page.tsx",
    ],
    qa_checklist: [
      "Open t010, t020, t030 on mobile viewport",
      "Canvas renders text objects",
      "No console errors on load",
    ],
  },
  {
    slug: "mobile-toolbar",
    title: "Mobile editor toolbar UX",
    description: "Polish mobile toolbar: page nav, zoom reset, edit affordances visible on phone.",
    dependency: ["mobile-template-loading"],
    estimated_complexity: "small",
    acceptance_criteria: [
      "Toolbar controls reachable on 375px viewport",
      "Tap-to-edit text works for headline and body fields",
    ],
    evidence_paths: ["src/components/editor/mobile/"],
    suggested_files: ["src/components/editor/mobile/MobileEditorShell.tsx"],
    qa_checklist: [
      "Toolbar visible without horizontal scroll",
      "Text tap opens edit sheet",
    ],
  },
  {
    slug: "mobile-save",
    title: "Mobile Firestore save",
    description: "Authenticated mobile users can save resume to Firestore `resume_docs`.",
    dependency: ["mobile-toolbar"],
    estimated_complexity: "medium",
    acceptance_criteria: [
      "Save succeeds for authenticated mobile user",
      "Saved doc reloads with same canvas state",
    ],
    evidence_paths: ["src/lib/resumeDocs.ts", "src/components/editor/mobile/"],
    suggested_files: ["src/lib/resumeDocs.ts", "src/components/editor/mobile/useMobileFabricEditor.ts"],
    qa_checklist: [
      "Sign in on mobile, edit, save",
      "Reload document preserves content",
    ],
  },
  {
    slug: "mobile-recent-resumes",
    title: "Mobile recent resumes entry",
    description: "Recents strip and saved-doc open path work on mobile from Hub.",
    dependency: ["mobile-save"],
    estimated_complexity: "medium",
    acceptance_criteria: [
      "Recents visible on mobile Hub",
      "Tapping recent opens correct mobile editor path",
    ],
    evidence_paths: [
      "src/app/resume/recents/ResumeRecentsClient.tsx",
      "src/app/resume/ResumeHubClient.tsx",
    ],
    suggested_files: ["src/app/resume/ResumeHubClient.tsx", "src/app/resume/recents/ResumeRecentsClient.tsx"],
    qa_checklist: [
      "Recent doc opens on mobile",
      "New blank create still works",
    ],
  },
  {
    slug: "mobile-download",
    title: "Mobile PDF download",
    description: "Mobile editor PDF download matches canvas and satisfies L5 launch criterion.",
    dependency: ["mobile-save"],
    estimated_complexity: "medium",
    acceptance_criteria: [
      "PDF downloads on mobile without desktop redirect",
      "PDF contains visible resume content",
    ],
    evidence_paths: ["src/components/editor/mobile/useMobileFabricEditor.ts", "src/lib/editor/exportCanvas.ts"],
    suggested_files: ["src/components/editor/mobile/useMobileFabricEditor.ts"],
    qa_checklist: [
      "Download PDF on mobile viewport",
      "PDF opens and shows resume text",
    ],
  },
  {
    slug: "mobile-qa",
    title: "Mobile launch-path QA pass",
    description: "Full mobile editor QA checklist for Hub → edit → save → download.",
    dependency: ["mobile-download", "mobile-recent-resumes"],
    estimated_complexity: "small",
    kind: "qa",
    acceptance_criteria: [
      "All mobile acceptance criteria verified",
      "QA report filed with pass verdict",
    ],
    evidence_paths: ["SOS/07_LOGS/pm/reports/qa/"],
    suggested_files: [],
    qa_checklist: [
      "Hub routing on phone",
      "Template load",
      "Save round-trip",
      "PDF download",
      "Recents flow",
    ],
  },
  {
    slug: "mobile-regression",
    title: "Mobile regression guard",
    description: "Regression sweep: desktop editor, auth gate, and Hub unaffected by mobile changes.",
    dependency: ["mobile-qa"],
    estimated_complexity: "small",
    kind: "regression",
    acceptance_criteria: [
      "Desktop editor still works",
      "Auth gate unchanged for desktop",
      "No new lint/build failures",
    ],
    evidence_paths: ["src/components/editor/EditorShell.tsx", "src/components/editor/EditorAuthGate.tsx"],
    suggested_files: [],
    qa_checklist: [
      "Desktop template edit + export",
      "Auth redirect loop check",
      "Build + lint pass",
    ],
  },
];

const SEO_LANDING_SLICES: DecomposeTemplate["slices"] = [
  {
    slug: "seo-audit",
    title: "SEO content gap audit",
    description: "Identify published templates missing `templateSeoContent` entries.",
    dependency: [],
    estimated_complexity: "small",
    acceptance_criteria: ["List of template IDs missing SEO content produced"],
    evidence_paths: ["src/data/templateSeoContent.ts", "templates.manifest.json"],
    suggested_files: ["src/data/templateSeoContent.ts"],
    qa_checklist: ["Audit list matches manifest published count"],
  },
  {
    slug: "seo-batch-1",
    title: "SEO landing pages batch 1 (templates 1–25)",
    description: "Add SEO content and verify `/resume/[slug]` for first batch.",
    dependency: ["seo-audit"],
    estimated_complexity: "large",
    acceptance_criteria: ["25 templates have SEO entries", "Pages render without 404"],
    evidence_paths: ["src/data/templateSeoContent.ts", "src/app/resume/[slug]/page.tsx"],
    suggested_files: ["src/data/templateSeoContent.ts"],
    qa_checklist: ["Spot-check 3 slugs in build output"],
  },
  {
    slug: "seo-batch-2",
    title: "SEO landing pages batch 2 (templates 26–50)",
    description: "Add SEO content for second batch of published templates.",
    dependency: ["seo-batch-1"],
    estimated_complexity: "large",
    acceptance_criteria: ["50 cumulative templates have SEO entries"],
    evidence_paths: ["src/data/templateSeoContent.ts"],
    suggested_files: ["src/data/templateSeoContent.ts"],
    qa_checklist: ["Spot-check 3 new slugs"],
  },
  {
    slug: "seo-batch-3",
    title: "SEO landing pages batch 3 (templates 51–79)",
    description: "Complete SEO coverage for all published templates.",
    dependency: ["seo-batch-2"],
    estimated_complexity: "large",
    acceptance_criteria: ["All 79 published templates have SEO entries", "Sitemap includes new slugs"],
    evidence_paths: ["src/data/templateSeoContent.ts", "src/app/sitemap.ts"],
    suggested_files: ["src/data/templateSeoContent.ts", "src/app/sitemap.ts"],
    qa_checklist: ["79 SEO entries", "Sitemap build passes"],
  },
  {
    slug: "seo-qa",
    title: "SEO launch-path QA",
    description: "Verify SEO pages indexable and match template gallery.",
    dependency: ["seo-batch-3"],
    estimated_complexity: "small",
    kind: "qa",
    acceptance_criteria: ["QA pass on SEO sample set"],
    evidence_paths: ["src/app/resume/[slug]/page.tsx"],
    suggested_files: [],
    qa_checklist: ["10 random slugs render", "Meta title/description present"],
  },
];

export const DECOMPOSE_TEMPLATES: DecomposeTemplate[] = [
  {
    id: "mobile-resume-editor",
    match: (item) =>
      /complete mobile resume editor|mobile resume editor|phone users cannot|mobile hub|resume hub.*phone/i.test(
        `${item.title} ${item.description}`,
      )
      || item.id === "BL-3-1",
    milestone: "Phase B — Mobile parity",
    feature: "Mobile Resume Editor",
    slices: MOBILE_HUB_SLICES,
  },
  {
    id: "seo-landing-pages",
    match: (item) =>
      /seo landing|all published templates|templateSeoContent/i.test(`${item.title} ${item.description}`)
      || item.id === "BL-4-2",
    milestone: "Phase C — Discovery",
    feature: "SEO Template Landing Pages",
    slices: SEO_LANDING_SLICES,
  },
];

export function isLargeRoadmapItem(item: BacklogItem): boolean {
  if (item.completionPct >= 100) return false;
  if (DECOMPOSE_TEMPLATES.some((t) => t.match(item))) return true;
  const text = `${item.title} ${item.description}`;
  if (item.completionPct === 0 && /phase \d|complete .*editor|all published|batch|integration not started/i.test(text)) {
    return true;
  }
  return item.evidence.length >= 4 && item.completionPct < 50;
}

export function findDecomposeTemplate(item: BacklogItem): DecomposeTemplate | null {
  return DECOMPOSE_TEMPLATES.find((t) => t.match(item)) ?? null;
}

export function buildSliceId(parentId: string, slug: string): string {
  const parentSlug = parentId.replace(/^BL-/, "RP-");
  return `${parentSlug}-${slug}`;
}

export function backlogIdForSlice(sliceId: string): string {
  return `BL-${sliceId}`;
}

export function decomposeBacklogItem(item: BacklogItem, template: DecomposeTemplate): RoadmapSlice[] {
  const now = new Date().toISOString();
  const slugToSliceId = new Map<string, string>();

  for (const spec of template.slices) {
    slugToSliceId.set(spec.slug, buildSliceId(item.id, spec.slug));
  }

  return template.slices.map((spec) => {
    const slice_id = slugToSliceId.get(spec.slug)!;
    const dependency = spec.dependency.map((dep) => slugToSliceId.get(dep) ?? buildSliceId(item.id, dep));

    return {
      slice_id,
      task_id: null,
      parent_task: item.id,
      parent_title: item.title,
      title: spec.title,
      description: spec.description,
      dependency,
      estimated_complexity: spec.estimated_complexity,
      acceptance_criteria: spec.acceptance_criteria,
      evidence_paths: spec.evidence_paths.length ? spec.evidence_paths : item.evidence,
      suggested_files: spec.suggested_files,
      qa_checklist: spec.qa_checklist,
      status: dependency.length === 0 ? "planned" : "blocked_deps",
      kind: spec.kind ?? "implementation",
      priority: spec.priority ?? item.priority,
      milestone: template.milestone,
      feature: template.feature,
      created_at: now,
    };
  });
}
