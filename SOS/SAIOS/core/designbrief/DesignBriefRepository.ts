/**
 * Persist DesignBrief artifacts under SOS/07_LOGS (dry-run only).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { DesignBrief } from "./types.js";

function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export class DesignBriefRepository {
  constructor(private readonly rootDir: string) {
    mkdirSync(rootDir, { recursive: true });
  }

  write(brief: DesignBrief, opts?: { fixture?: boolean }): string[] {
    const dir = opts?.fixture ? join(this.rootDir, "fixtures") : this.rootDir;
    mkdirSync(dir, { recursive: true });

    const briefPath = join(dir, "design-brief.json");
    const resumePath = join(dir, "resume-json-instructions.json");
    const layoutPath = join(dir, "layout-blueprint.json");
    const reportPath = join(dir, "designbrief-report.md");
    const indexPath = join(dir, "brief-index.json");

    atomicWriteJson(briefPath, brief);
    atomicWriteJson(resumePath, brief.resume_json);
    atomicWriteJson(layoutPath, brief.layout);

    const index = {
      updated_at: new Date().toISOString(),
      latest_brief_id: brief.brief_id,
      dry_run: true,
      publication_allowed: false,
      template_generated: false,
      validation_pass: brief.validation.pass,
    };
    atomicWriteJson(indexPath, index);

    const md = [
      `# DesignBrief Report`,
      ``,
      `- brief_id: \`${brief.brief_id}\``,
      `- created_at: ${brief.created_at}`,
      `- dry_run: true`,
      `- publication_allowed: false`,
      `- template_generated: false`,
      `- live_enabled: false`,
      `- provider: mock`,
      `- layout: ${brief.layout.structure} / ${brief.layout.page_size}`,
      `- sections: ${brief.sections.order.join(" → ")}`,
      `- palette: ${brief.colors.id}`,
      `- validation: ${brief.validation.pass ? "PASS" : "FAIL"}`,
      ``,
    ].join("\n");
    writeFileSync(reportPath, md, "utf8");

    return [briefPath, resumePath, layoutPath, indexPath, reportPath];
  }

  readLatest(): DesignBrief | null {
    const path = join(this.rootDir, "design-brief.json");
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as DesignBrief;
  }
}
