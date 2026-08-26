/**
 * Deployment Manager — shared types.
 * AGENT #106 — AI OS Deployment Manager V1
 */

export type DepartmentId =
  | "runtime-manager"
  | "security-department"
  | "timeline-department"
  | "notification-department"
  | "website-department"
  | "resume-factory"
  | "scheduler"
  | "production-dashboard"
  | "founder-dashboard"
  | "release-manager"
  | "catalog-integrity"
  | "batch-release"
  | "event-bus";

export type DeployableDepartment = {
  id: DepartmentId;
  label: string;
  module_path: string;
  verify_command: string;
  depends_on: DepartmentId[];
  available: boolean;
  log_dir?: string;
};

export type ValidationCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type EnvironmentCheck = {
  generated_at: string;
  node_version: string;
  node_ok: boolean;
  min_node_major: number;
  has_project_state: boolean;
  has_saios_runtime: boolean;
  has_sos_runtime_env: boolean;
  placeholders: string[];
  checks: ValidationCheck[];
  pass: boolean;
};

export type DeploymentPlan = {
  generated_at: string;
  version: string;
  department_count: number;
  available_count: number;
  startup_order: DepartmentId[];
  shutdown_order: DepartmentId[];
  departments: DeployableDepartment[];
  notes: string[];
};

export type DeploymentBundle = {
  generated_at: string;
  version: string;
  bundle_id: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  artifacts: string[];
  startup_order: DepartmentId[];
  departments: Array<{
    id: DepartmentId;
    label: string;
    module_path: string;
    available: boolean;
    verify_command: string;
  }>;
  scripts: {
    startup: string;
    shutdown: string;
    restart: string;
  };
  validation_pass: boolean;
};

export type DeploymentManagerResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  plan: DeploymentPlan;
  bundle: DeploymentBundle;
  environment: EnvironmentCheck;
  validations: ValidationCheck[];
  checks: Record<string, boolean>;
  output_dir: string;
};
