/**
 * Extended editor validation — technical contract + editor map.
 */
import type { BuiltTemplate } from "./template-builder.js";
import { validateTemplate, type ValidationReport } from "./validator.js";
import type { KnowledgeContext } from "./knowledge-context.js";

export type EditorValidationResult = {
  pass: boolean;
  contract: ValidationReport;
  editor_checks: Array<{ id: string; pass: boolean; detail: string }>;
};

export function validateEditorCompatibility(
  template: BuiltTemplate,
  _ctx: KnowledgeContext,
): EditorValidationResult {
  const contract = validateTemplate(template);
  const objects = template.json.objects ?? [];

  const editor_checks = [
    check("page-background-index-0", objects[0]?.role === "pageBackground" || objects[0]?.isPageBg === true),
    check("fabric-version", template.json.version === "6.9.1"),
    check("object-ids", objects.every((o) => typeof o.id === "string" && o.id.length > 0)),
    check(
      "data-ids",
      objects.filter((o) => !o.isPageBg).every((o) => Boolean((o.data as { id?: string })?.id ?? o.id)),
    ),
    check("no-blob-src", !JSON.stringify(template.json).includes('"src":"blob:')),
    check("no-unsupported-groups", template.tier === "ats_safe" ? !objects.some((o) => o.type === "Group") : true),
    check("portable-images", !objects.some((o) => String(o.src ?? "").startsWith("data:"))),
  ];

  const pass = contract.pass && editor_checks.every((c) => c.pass);

  return { pass, contract, editor_checks };
}

function check(id: string, pass: boolean): { id: string; pass: boolean; detail: string } {
  return { id, pass, detail: pass ? "ok" : "failed" };
}
