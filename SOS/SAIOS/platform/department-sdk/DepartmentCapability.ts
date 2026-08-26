/**
 * DepartmentCapability — reusable capability units (Agent #180).
 * Provider-independent. Never invoked in V1.
 */
import type {
  CapabilityKind,
  DepartmentCapabilityContract,
} from "./DepartmentTypes.js";

export function defineCapability(input: {
  capability_id: string;
  capability_name: string;
  kind: CapabilityKind;
  version?: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
}): DepartmentCapabilityContract {
  return {
    capability_id: input.capability_id,
    capability_name: input.capability_name,
    kind: input.kind,
    version: input.version ?? "1.0.0",
    provider_independent: true,
    description: input.description,
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    may_invoke_skills: false,
    may_call_brain_router: false,
    may_call_providers: false,
  };
}

export class DepartmentCapability {
  readonly contract: DepartmentCapabilityContract;

  constructor(contract: DepartmentCapabilityContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.capability_id;
  }

  /** V1: discovery only — never invokes. */
  isInvokable(): false {
    return false;
  }
}
