export type WorkOrderClassification =
  | "create_agent"
  | "roadmap_task"
  | "product_feature"
  | "bug_fix"
  | "qa_task"
  | "research_task"
  | "runtime_bug"
  | "status_question"
  | "unknown";

export type WorkOrderPriority = "P0" | "P1" | "P2" | "P3";

export type WorkOrderStatus = "queued" | "in_progress" | "done" | "cancelled";

export type WorkOrderSource = "telegram";

export type WorkOrder = {
  work_order_id: string;
  received_at: string;
  source: WorkOrderSource;
  raw_message: string;
  classification: WorkOrderClassification;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  cursor_prompt_path: string;
  requires_approval: boolean;
  notes: string[];
  updated_at?: string;
};

export type WorkOrderCommandResult = {
  ok: boolean;
  reply: string;
  work_order_id?: string;
  action: string;
  details?: Record<string, unknown>;
};
