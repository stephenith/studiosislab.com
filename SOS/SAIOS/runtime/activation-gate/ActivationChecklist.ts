/**
 * ActivationChecklist — immutable checklist catalogue (Agent #185).
 */
import type {
  ActivationCheckId,
  ActivationChecklistItem,
  ActivationCheckResultStatus,
} from "./ActivationGateTypes.js";
import { ACTIVATION_CHECKLIST_VERSION } from "./ActivationGateTypes.js";

export type ChecklistDefinition = {
  check_id: ActivationCheckId;
  label: string;
  required: boolean;
  category:
    | "governance"
    | "execution"
    | "department"
    | "workers"
    | "budget"
    | "telemetry"
    | "providers"
    | "security"
    | "rollback"
    | "retry";
  placeholder?: boolean;
};

/** Immutable catalogue — do not mutate at runtime. */
export const ACTIVATION_CHECKLIST_CATALOGUE: readonly ChecklistDefinition[] = [
  {
    check_id: "system_readiness_valid",
    label: "System Readiness valid",
    required: true,
    category: "governance",
  },
  {
    check_id: "runtime_release_approved",
    label: "Runtime Release approved",
    required: true,
    category: "governance",
  },
  {
    check_id: "runtime_plan_valid",
    label: "Runtime Plan valid",
    required: true,
    category: "governance",
  },
  {
    check_id: "execution_controller_ready",
    label: "Execution Controller ready",
    required: true,
    category: "execution",
  },
  {
    check_id: "department_registered",
    label: "Department registered",
    required: true,
    category: "department",
  },
  {
    check_id: "department_validated",
    label: "Department validated",
    required: true,
    category: "department",
  },
  {
    check_id: "worker_runtime_valid",
    label: "Worker Runtime valid",
    required: true,
    category: "workers",
  },
  {
    check_id: "cost_session_valid",
    label: "Cost Session valid",
    required: true,
    category: "budget",
  },
  {
    check_id: "telemetry_attached",
    label: "Telemetry attached",
    required: true,
    category: "telemetry",
  },
  {
    check_id: "rollback_defined",
    label: "Rollback defined",
    required: true,
    category: "rollback",
  },
  {
    check_id: "retry_policy_defined",
    label: "Retry policy defined",
    required: true,
    category: "retry",
  },
  {
    check_id: "provider_registry_validated",
    label: "Provider Registry validated",
    required: true,
    category: "providers",
    placeholder: true,
  },
  {
    check_id: "execution_authorization_present",
    label: "Execution Authorization present",
    required: true,
    category: "execution",
    placeholder: true,
  },
  {
    check_id: "founder_approval_present",
    label: "Founder approval present",
    required: true,
    category: "governance",
    placeholder: true,
  },
  {
    check_id: "architecture_versions_match",
    label: "Architecture versions match",
    required: true,
    category: "security",
  },
  {
    check_id: "checksum_chain_valid",
    label: "Checksum chain valid",
    required: true,
    category: "security",
  },
  {
    check_id: "live_disabled",
    label: "LIVE disabled",
    required: true,
    category: "security",
  },
] as const;

export function listActivationChecklistCatalogue(): ChecklistDefinition[] {
  return ACTIVATION_CHECKLIST_CATALOGUE.map((c) => ({ ...c }));
}

export function buildChecklistItem(
  def: ChecklistDefinition,
  status: ActivationCheckResultStatus,
  detail: string,
): ActivationChecklistItem {
  const blocking =
    def.required && (status === "fail" || status === "placeholder");
  return {
    check_id: def.check_id,
    label: def.label,
    required: def.required,
    status,
    detail,
    blocking,
  };
}

export function checklistVersion(): typeof ACTIVATION_CHECKLIST_VERSION {
  return ACTIVATION_CHECKLIST_VERSION;
}
