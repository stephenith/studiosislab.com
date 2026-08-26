import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import type { WorkOrder, WorkOrderStatus } from "./types.js";
import {
  getWorkOrderPaths,
  inboxJsonPath,
  promptMdPath,
  promptPathRelative,
  type WorkOrderPaths,
} from "./paths.js";
import { classifyWorkOrder, inferWorkOrderPriority } from "./classifier.js";
import { buildCursorPromptMarkdown } from "./prompt-builder.js";
import { loadCommanderStatusSummary } from "./status.js";

export async function ensureWorkOrderDirs(paths: WorkOrderPaths): Promise<void> {
  for (const dir of [paths.root, paths.inbox, paths.prompts, paths.processed, paths.reports]) {
    await mkdir(dir, { recursive: true });
  }
}

export function generateWorkOrderId(receivedAt: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = receivedAt.getUTCFullYear();
  const m = pad(receivedAt.getUTCMonth() + 1);
  const d = pad(receivedAt.getUTCDate());
  const h = pad(receivedAt.getUTCHours());
  const min = pad(receivedAt.getUTCMinutes());
  const s = pad(receivedAt.getUTCSeconds());
  return `WO-${y}${m}${d}-${h}${min}${s}`;
}

async function uniqueWorkOrderId(paths: WorkOrderPaths): Promise<string> {
  let id = generateWorkOrderId();
  let attempt = 0;
  while (existsSync(inboxJsonPath(paths, id)) && attempt < 10) {
    await new Promise((r) => setTimeout(r, 5));
    id = generateWorkOrderId();
    attempt++;
  }
  return id;
}

export async function createWorkOrder(
  config: RuntimeConfig,
  rawMessage: string,
): Promise<WorkOrder> {
  const paths = getWorkOrderPaths(config);
  await ensureWorkOrderDirs(paths);

  const receivedAt = new Date();
  const workOrderId = await uniqueWorkOrderId(paths);
  const classification = classifyWorkOrder(rawMessage);
  const priority = inferWorkOrderPriority(classification, rawMessage);
  const cursorPromptRel = promptPathRelative(config, workOrderId);

  const order: WorkOrder = {
    work_order_id: workOrderId,
    received_at: receivedAt.toISOString(),
    source: "telegram",
    raw_message: rawMessage.trim(),
    classification,
    priority,
    status: "queued",
    cursor_prompt_path: cursorPromptRel,
    requires_approval: false,
    notes: [],
    updated_at: receivedAt.toISOString(),
  };

  const status = await loadCommanderStatusSummary(config);
  const promptMd = buildCursorPromptMarkdown(order, status);

  await writeFile(inboxJsonPath(paths, workOrderId), JSON.stringify(order, null, 2), "utf8");
  await writeFile(promptMdPath(paths, workOrderId), promptMd, "utf8");

  return order;
}

export async function loadWorkOrder(
  config: RuntimeConfig,
  workOrderId: string,
): Promise<WorkOrder | null> {
  const paths = getWorkOrderPaths(config);
  const inbox = inboxJsonPath(paths, workOrderId);
  if (existsSync(inbox)) {
    return JSON.parse(await readFile(inbox, "utf8")) as WorkOrder;
  }
  const processed = processedJsonPath(paths, workOrderId);
  if (existsSync(processed)) {
    return JSON.parse(await readFile(processed, "utf8")) as WorkOrder;
  }
  return null;
}

function processedJsonPath(paths: WorkOrderPaths, workOrderId: string): string {
  return join(paths.processed, `${workOrderId}.json`);
}

async function readOrdersFromDir(dir: string): Promise<WorkOrder[]> {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const orders: WorkOrder[] = [];
  for (const file of files) {
    try {
      orders.push(JSON.parse(await readFile(`${dir}/${file}`, "utf8")) as WorkOrder);
    } catch {
      // skip corrupt
    }
  }
  return orders;
}

export async function listWorkOrders(config: RuntimeConfig): Promise<WorkOrder[]> {
  const paths = getWorkOrderPaths(config);
  const inbox = await readOrdersFromDir(paths.inbox);
  const processed = await readOrdersFromDir(paths.processed);
  return [...inbox, ...processed].sort(
    (a, b) => Date.parse(b.received_at) - Date.parse(a.received_at),
  );
}

export async function listQueuedWorkOrders(config: RuntimeConfig): Promise<WorkOrder[]> {
  const all = await listWorkOrders(config);
  return all.filter((o) => o.status === "queued" || o.status === "in_progress");
}

export async function updateWorkOrderStatus(
  config: RuntimeConfig,
  workOrderId: string,
  status: WorkOrderStatus,
  note?: string,
): Promise<WorkOrder | null> {
  const paths = getWorkOrderPaths(config);
  await ensureWorkOrderDirs(paths);

  const inboxPath = inboxJsonPath(paths, workOrderId);
  const processedPath = processedJsonPath(paths, workOrderId);

  if (!existsSync(inboxPath) && !existsSync(processedPath)) {
    return null;
  }

  const raw = existsSync(inboxPath)
    ? await readFile(inboxPath, "utf8")
    : await readFile(processedPath, "utf8");
  const order = JSON.parse(raw) as WorkOrder;
  order.status = status;
  order.updated_at = new Date().toISOString();
  if (note) order.notes.push(`${order.updated_at}: ${note}`);

  const destInbox = inboxPath;
  await writeFile(destInbox, JSON.stringify(order, null, 2), "utf8");

  if (status === "done" || status === "cancelled") {
    const processedPath = processedJsonPath(paths, workOrderId);
    await writeFile(processedPath, JSON.stringify(order, null, 2), "utf8");
    if (existsSync(inboxPath)) {
      await unlink(inboxPath).catch(() => {});
    }
  }

  return order;
}
