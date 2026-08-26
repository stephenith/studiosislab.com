/**
 * Security Department — shared types.
 * AGENT #104 — AI OS operational health & protection
 */

export type SecurityLevel = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "CRITICAL";

export type SecurityFinding = {
  id: string;
  area: string;
  level: SecurityLevel;
  title: string;
  detail: string;
  source: string;
  pass: boolean;
};

export type SecurityAlert = {
  id: string;
  level: SecurityLevel;
  title: string;
  message: string;
  area: string;
  created_at: string;
  channel_ready: false;
  payload: Record<string, unknown>;
};

export type SecurityChecklistItem = {
  id: string;
  label: string;
  pass: boolean;
  level: SecurityLevel;
  notes: string;
};

export type SecurityDepartmentResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  security_level: SecurityLevel;
  findings: SecurityFinding[];
  alerts: SecurityAlert[];
  checklist: SecurityChecklistItem[];
  sources: Array<{ id: string; path: string; status: "available" | "unavailable" }>;
  checks: Record<string, boolean>;
  output_dir: string;
};
