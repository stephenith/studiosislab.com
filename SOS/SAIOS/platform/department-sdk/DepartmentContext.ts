/**
 * DepartmentContext — read-only context bag (Agent #180).
 * Never holds live providers, queues, or execution handles.
 */
import type {
  DepartmentContract,
  DepartmentSdkSafetyFlags,
} from "./DepartmentTypes.js";
import { DEPARTMENT_SDK_SAFETY_FLAGS } from "./DepartmentTypes.js";

export type DepartmentContextBag = {
  department: DepartmentContract;
  repo_root: string | null;
  mode: "contracts_only";
  safety_flags: DepartmentSdkSafetyFlags;
  live: false;
};

export class DepartmentContext {
  readonly bag: DepartmentContextBag;

  constructor(department: DepartmentContract, repoRoot?: string | null) {
    this.bag = {
      department,
      repo_root: repoRoot ?? null,
      mode: "contracts_only",
      safety_flags: DEPARTMENT_SDK_SAFETY_FLAGS,
      live: false,
    };
  }

  get department_id(): string {
    return this.bag.department.department_id;
  }

  /** Future Skills → Brain Router → Providers path is declared but sealed. */
  mayInvokeSkills(): false {
    return false;
  }

  mayCallBrainRouter(): false {
    return false;
  }

  mayCallProviders(): false {
    return false;
  }
}
