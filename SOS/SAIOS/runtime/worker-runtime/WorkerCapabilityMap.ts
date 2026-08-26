/**
 * WorkerCapabilityMap — capability references only (Agent #182).
 * No provider invocation.
 */
import type { WorkerCapabilityKind } from "./WorkerRuntimeTypes.js";

export type CapabilityMapEntry = {
  capability_id: string;
  kind: WorkerCapabilityKind;
  provider_independent: true;
  invokable: false;
};

export const CANONICAL_WORKER_CAPABILITIES: CapabilityMapEntry[] = [
  {
    capability_id: "render",
    kind: "render",
    provider_independent: true,
    invokable: false,
  },
  {
    capability_id: "research",
    kind: "research",
    provider_independent: true,
    invokable: false,
  },
  {
    capability_id: "critique",
    kind: "critique",
    provider_independent: true,
    invokable: false,
  },
  {
    capability_id: "evaluation",
    kind: "evaluation",
    provider_independent: true,
    invokable: false,
  },
  {
    capability_id: "packaging",
    kind: "packaging",
    provider_independent: true,
    invokable: false,
  },
  {
    capability_id: "learning",
    kind: "learning",
    provider_independent: true,
    invokable: false,
  },
  {
    capability_id: "planning",
    kind: "planning",
    provider_independent: true,
    invokable: false,
  },
];

export class WorkerCapabilityMap {
  private readonly byId = new Map(
    CANONICAL_WORKER_CAPABILITIES.map((c) => [c.capability_id, c]),
  );

  list(): CapabilityMapEntry[] {
    return [...this.byId.values()];
  }

  resolve(capabilityIds: string[]): {
    known: CapabilityMapEntry[];
    unknown: string[];
  } {
    const known: CapabilityMapEntry[] = [];
    const unknown: string[] = [];
    for (const id of capabilityIds) {
      const hit = this.byId.get(id);
      if (hit) known.push(hit);
      else unknown.push(id);
    }
    return { known, unknown };
  }

  /** V1: never invokable. */
  mayInvoke(_capabilityId: string): false {
    return false;
  }
}

export function createWorkerCapabilityMap(): WorkerCapabilityMap {
  return new WorkerCapabilityMap();
}
