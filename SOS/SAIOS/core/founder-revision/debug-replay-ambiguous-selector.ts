/**
 * Local replay of saved failed revision plan op[3] — no OpenAI, no task mutation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { CanvasOperation } from "./revision-task-types.js";

const FIX = resolve(
  import.meta.dirname,
  "../../../../.cursor/debug-fixtures/revtask-9348b928-68b",
);

async function main(): Promise<void> {
  const canvas = JSON.parse(
    readFileSync(resolve(FIX, "canvas.json"), "utf8"),
  ) as FabricCanvasDoc;
  const plan = JSON.parse(
    readFileSync(resolve(FIX, "revision-plan.json"), "utf8"),
  ) as { operations: CanvasOperation[] };

  // #region agent log
  fetch("http://127.0.0.1:7653/ingest/56601a8a-ebed-4e8a-847f-61b683cab256", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a4b69a",
    },
    body: JSON.stringify({
      sessionId: "a4b69a",
      runId: "pre-fix",
      hypothesisId: "H4",
      location: "debug-replay-ambiguous-selector.ts:main",
      message: "replay_start",
      data: {
        opCount: plan.operations.length,
        op3: plan.operations[3],
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const result = executeCanvasOperations({
    canvas,
    operations: plan.operations,
  });

  // #region agent log
  fetch("http://127.0.0.1:7653/ingest/56601a8a-ebed-4e8a-847f-61b683cab256", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a4b69a",
    },
    body: JSON.stringify({
      sessionId: "a4b69a",
      runId: "pre-fix",
      hypothesisId: "H5",
      location: "debug-replay-ambiguous-selector.ts:main",
      message: "replay_result",
      data: {
        ok: result.ok,
        error: result.error,
        failedLog: result.log.filter((e) => !e.ok),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  // Allow fetch to flush
  await new Promise((r) => setTimeout(r, 200));
  console.log(
    JSON.stringify(
      { ok: result.ok, error: result.error, failed: result.log.filter((e) => !e.ok) },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
