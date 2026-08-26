import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { RuntimeConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { getQaPaths } from "../qa/paths.js";
import { getApprovalsPaths } from "../approvals/paths.js";

export type AgentHeartbeat = {
  worker_id: string;
  status_file: string;
  last_heartbeat: string | null;
  stale: boolean;
  age_ms: number | null;
};

async function readHeartbeat(path: string, fields: string[]): Promise<string | null> {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    for (const field of fields) {
      const val = raw[field];
      if (typeof val === "string" && val.length > 0) return val;
    }
    return null;
  } catch {
    return null;
  }
}

export async function readAgentHeartbeats(
  config: RuntimeConfig,
  staleAfterMs: number,
): Promise<AgentHeartbeat[]> {
  const now = Date.now();
  const pmPaths = getPmPaths(config);
  const devPaths = getDeveloperPaths(config);
  const qaPaths = getQaPaths(config);
  const approvalsPaths = getApprovalsPaths(config);

  const sources: Array<{ worker_id: string; status_file: string; fields: string[] }> = [
    { worker_id: "pm", status_file: pmPaths.agentStatus, fields: ["updated_at"] },
    { worker_id: "developer", status_file: devPaths.status, fields: ["last_heartbeat"] },
    { worker_id: "qa", status_file: qaPaths.status, fields: ["last_heartbeat"] },
    { worker_id: "approvals", status_file: approvalsPaths.status, fields: ["last_heartbeat"] },
  ];

  return Promise.all(
    sources.map(async ({ worker_id, status_file, fields }) => {
      const last_heartbeat = await readHeartbeat(status_file, fields);
      const age_ms = last_heartbeat ? now - Date.parse(last_heartbeat) : null;
      const stale = age_ms !== null && age_ms > staleAfterMs;
      return { worker_id, status_file, last_heartbeat, stale, age_ms };
    }),
  );
}
