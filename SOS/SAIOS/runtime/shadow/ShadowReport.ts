import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ShadowCommandRecord, ShadowRunReport } from "./types.js";
import { resolveShadowPaths } from "./paths.js";

export class ShadowReport {
  private readonly comparisonDir: string;
  private readonly runId: string;
  private readonly records: ShadowCommandRecord[] = [];
  private readonly startedAt: string;

  constructor(runId: string, comparisonDir?: string) {
    this.runId = runId;
    this.comparisonDir = comparisonDir ?? resolveShadowPaths(runId).comparisonDir;
    this.startedAt = new Date().toISOString();
  }

  addRecord(record: ShadowCommandRecord): void {
    this.records.push(record);
  }

  allComparisonsPass(): boolean {
    return this.records.length > 0 && this.records.every((r) => r.comparison.pass);
  }

  getRecordCount(): number {
    return this.records.length;
  }

  async writeFinal(pass: boolean): Promise<string> {
    const finishedAt = new Date().toISOString();
    const legacySuccess = this.records.filter((r) => r.legacy.ok).length;
    const saiosSuccess = this.records.filter((r) => r.saios?.ok).length;
    const comparisonPass = this.records.filter((r) => r.comparison.pass).length;

    const report: ShadowRunReport = {
      run_id: this.runId,
      mode: "shadow",
      authoritative: "legacy",
      started_at: this.startedAt,
      finished_at: finishedAt,
      command_count: this.records.length,
      legacy_success_count: legacySuccess,
      saios_success_count: saiosSuccess,
      comparison_pass_count: comparisonPass,
      pass,
      records: this.records,
    };

    await mkdir(this.comparisonDir, { recursive: true });
    const path = join(this.comparisonDir, `${this.runId}.json`);
    await writeFile(path, JSON.stringify(report, null, 2), "utf8");
    return path;
  }
}
