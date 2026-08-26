/**
 * Department — immutable department contract wrapper (Agent #180).
 */
import type {
  DepartmentContract,
  DepartmentDirectorContract,
  DepartmentManagerContract,
  DepartmentWorkerContract,
  DepartmentCapabilityContract,
  DepartmentLifecycleStatus,
  DepartmentType,
} from "./DepartmentTypes.js";
import {
  DEPARTMENT_CONTRACT_VERSION,
  DEPARTMENT_SDK_SAFETY_FLAGS,
} from "./DepartmentTypes.js";
import { defineDirector } from "./DepartmentDirector.js";

const LOCKED_POLICY_NOTE = "Locked false in Department SDK V1 · scaffold only";

export function createDepartmentContract(input: {
  department_id: string;
  department_name: string;
  department_type: DepartmentType;
  version?: string;
  status?: DepartmentLifecycleStatus;
  director: DepartmentDirectorContract;
  managers?: DepartmentManagerContract[];
  workers?: DepartmentWorkerContract[];
  capabilities?: DepartmentCapabilityContract[];
  supported_missions?: string[];
  supported_artifacts?: string[];
  supported_tools?: string[];
  supported_skills?: string[];
  dependencies?: string[];
  reference?: boolean;
  placeholder?: boolean;
  notes?: string[];
}): DepartmentContract {
  const now = new Date().toISOString();
  return {
    schema_version: DEPARTMENT_CONTRACT_VERSION,
    department_id: input.department_id,
    department_name: input.department_name,
    department_type: input.department_type,
    version: input.version ?? "1.0.0",
    status: input.status ?? "REGISTERED",
    director: input.director,
    managers: input.managers ?? [],
    workers: input.workers ?? [],
    capabilities: input.capabilities ?? [],
    supported_missions: input.supported_missions ?? [],
    supported_artifacts: input.supported_artifacts ?? [],
    supported_tools: input.supported_tools ?? [],
    supported_skills: input.supported_skills ?? [],
    dependencies: input.dependencies ?? [],
    execution_policy: {
      enabled: false,
      may_execute: false,
      may_dispatch: false,
      note: LOCKED_POLICY_NOTE,
    },
    learning_policy: { enabled: false, note: LOCKED_POLICY_NOTE },
    evaluation_policy: { enabled: false, note: LOCKED_POLICY_NOTE },
    publishing_policy: {
      enabled: false,
      may_publish: false,
      note: LOCKED_POLICY_NOTE,
    },
    cost_policy: { enabled: false, note: LOCKED_POLICY_NOTE },
    telemetry_policy: { enabled: false, note: LOCKED_POLICY_NOTE },
    retry_policy: {
      enabled: false,
      max_attempts: 3,
      implemented: false,
      note: LOCKED_POLICY_NOTE,
    },
    rollback_policy: {
      enabled: false,
      implemented: false,
      note: LOCKED_POLICY_NOTE,
    },
    reference: Boolean(input.reference),
    placeholder: Boolean(input.placeholder),
    safety_flags: DEPARTMENT_SDK_SAFETY_FLAGS,
    registered_at: now,
    updated_at: now,
    next_safe_action:
      "Contracts only · STOP — execution remains impossible · LIVE OFF",
    notes: input.notes ?? [],
  };
}

export function createPlaceholderDepartment(input: {
  department_id: string;
  department_name: string;
  department_type?: DepartmentType;
}): DepartmentContract {
  const id = input.department_id;
  return createDepartmentContract({
    department_id: id,
    department_name: input.department_name,
    department_type: input.department_type ?? "placeholder",
    status: "REGISTERED",
    director: defineDirector({
      director_id: `${id}-director`,
      director_name: `${input.department_name} Director`,
      description: `Placeholder director for ${input.department_name}`,
    }),
    managers: [],
    workers: [],
    capabilities: [],
    placeholder: true,
    reference: false,
    notes: [
      "Placeholder metadata only — Agent #180",
      "No runtime wiring",
      "No workers migrated",
    ],
  });
}

export class Department {
  readonly contract: DepartmentContract;

  constructor(contract: DepartmentContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.department_id;
  }

  get status(): DepartmentLifecycleStatus {
    return this.contract.status;
  }

  withStatus(status: DepartmentLifecycleStatus): Department {
    return new Department({
      ...this.contract,
      status,
      updated_at: new Date().toISOString(),
    });
  }

  summary() {
    return {
      department_id: this.contract.department_id,
      department_name: this.contract.department_name,
      department_type: this.contract.department_type,
      version: this.contract.version,
      status: this.contract.status,
      director_id: this.contract.director.director_id,
      manager_count: this.contract.managers.length,
      worker_count: this.contract.workers.length,
      capability_count: this.contract.capabilities.length,
      reference: this.contract.reference,
      placeholder: this.contract.placeholder,
    };
  }
}
