/**
 * Phase 6G helper — dump the current requested-change classification for every
 * historical production Founder line.
 *
 * Run BEFORE and AFTER the classifier redesign. The resulting baseline is the
 * evidence input for verify-requested-change-classification-6g, which requires
 * a documented justification for every changed classification.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyRequestedChange,
  verificationCheckTypes,
} from "./RequestedChangeClassification.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CORPUS = resolve(
  REPO,
  ".cursor/debug-fixtures/historical-requested-changes-corpus.json",
);

type Corpus = {
  tasks: { task_id: string; status: string; requested_changes: string[] }[];
};

function main(): void {
  const outPath = process.argv[2];
  if (!outPath) {
    throw new Error("usage: dump-classification-baseline-6g.ts <out.json>");
  }
  const corpus = JSON.parse(readFileSync(CORPUS, "utf8")) as Corpus;
  const rows: Record<string, unknown>[] = [];
  for (const task of corpus.tasks) {
    task.requested_changes.forEach((text, index) => {
      const classified = classifyRequestedChange(text);
      rows.push({
        task_id: task.task_id,
        task_status: task.status,
        index,
        text,
        classification: classified.classification,
        check_types: verificationCheckTypes(classified),
      });
    });
  }
  writeFileSync(
    resolve(REPO, outPath),
    `${JSON.stringify({ line_count: rows.length, rows }, null, 1)}\n`,
  );
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = String(r.classification);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  console.log(`lines=${rows.length}`);
  for (const [k, v] of [...counts].sort()) console.log(`  ${k} = ${v}`);
}

main();
