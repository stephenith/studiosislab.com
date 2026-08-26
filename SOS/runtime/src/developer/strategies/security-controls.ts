import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ParsedBrief } from "../types.js";
import { assertPathEditable } from "../safety.js";

const SECURITY_MARKER = "Active Security Controls";
const FAQ_MARKER = 'href="/security"';

export type StrategyResult = {
  files_changed: string[];
  diff_summary: string;
  implementation_summary: string;
  skipped: boolean;
};

export async function executeSecurityControlsStrategy(
  repoRoot: string,
  brief: ParsedBrief,
): Promise<StrategyResult> {
  const securityPath = "src/app/security/page.tsx";
  const faqPath = "src/app/faq/page.tsx";
  const files_changed: string[] = [];
  const changes: string[] = [];

  for (const file of [securityPath, faqPath]) {
    const check = assertPathEditable(file, brief.evidence);
    if (!check.allowed) {
      throw new Error(check.reason);
    }
  }

  const securityFull = join(repoRoot, securityPath);
  const faqFull = join(repoRoot, faqPath);

  if (!existsSync(securityFull) || !existsSync(faqFull)) {
    throw new Error("Evidence files not found on disk");
  }

  let securityContent = await readFile(securityFull, "utf8");
  let faqContent = await readFile(faqFull, "utf8");

  if (!securityContent.includes(SECURITY_MARKER)) {
    const insertBlock = `
      <SectionBlock title="${SECURITY_MARKER}">
        <p>
          StudiosisLab applies layered controls across authentication, transport, and document workflows:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>HTTPS for data in transit on all core interactions</li>
          <li>Firebase authentication and owner-scoped document access</li>
          <li>Firestore security rules limiting client reads and writes to authorized resources</li>
          <li>Signed upload flows for e-sign documents with verification checkpoints</li>
          <li>Ongoing retention and cleanup improvements for stored files</li>
        </ul>
      </SectionBlock>

`;
    const anchor = '<SectionBlock title="Security Reporting">';
    if (!securityContent.includes(anchor)) {
      throw new Error("Cannot locate insertion point in security page");
    }
    securityContent = securityContent.replace(anchor, insertBlock + anchor);
    await writeFile(securityFull, securityContent, "utf8");
    files_changed.push(securityPath);
    changes.push("Added Active Security Controls section to security page");
  }

  if (!faqContent.includes(FAQ_MARKER)) {
    const oldFaq = `          We use secure connections and controlled access practices to protect uploaded files. We
          continue improving security controls to support trust-first document handling.`;
    const newFaq = `          We use secure connections and controlled access practices to protect uploaded files. We
          continue improving security controls to support trust-first document handling. See our{" "}
          <a className="font-medium text-zinc-900 underline" href="/security">security page</a>{" "}
          for details on active controls.`;
    if (!faqContent.includes(oldFaq)) {
      throw new Error("Cannot locate FAQ security answer to update");
    }
    faqContent = faqContent.replace(oldFaq, newFaq);
    await writeFile(faqFull, faqContent, "utf8");
    files_changed.push(faqPath);
    changes.push("Linked FAQ security answer to /security page");
  }

  const skipped = files_changed.length === 0;
  return {
    files_changed,
    diff_summary: skipped
      ? "Security controls content already present — no file changes required"
      : changes.join("; "),
    implementation_summary: skipped
      ? "Verified existing security controls documentation; no additional edits needed"
      : `Improved security controls documentation: ${changes.join("; ")}`,
    skipped,
  };
}
