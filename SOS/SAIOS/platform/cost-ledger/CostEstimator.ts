/**
 * CostEstimator — placeholder estimates only (Agent #181).
 * No calculations. No provider calls. No token counting.
 */
import type { CostEstimateResult } from "./CostLedgerTypes.js";
import { money } from "./Budget.js";

const NOTE =
  "Placeholder estimate · calculated=false · no billing · Agent #181";

export class CostEstimator {
  estimateMission(_missionId: string): CostEstimateResult {
    return {
      ok: true,
      kind: "mission",
      estimated_cost: money(null),
      calculated: false,
      placeholder: true,
      note: NOTE,
    };
  }

  estimateDepartment(_departmentId: string): CostEstimateResult {
    return {
      ok: true,
      kind: "department",
      estimated_cost: money(null),
      calculated: false,
      placeholder: true,
      note: NOTE,
    };
  }

  estimateWorker(_workerId: string): CostEstimateResult {
    return {
      ok: true,
      kind: "worker",
      estimated_cost: money(null),
      calculated: false,
      placeholder: true,
      note: NOTE,
    };
  }

  estimateProvider(_providerId: string): CostEstimateResult {
    return {
      ok: true,
      kind: "provider",
      estimated_cost: money(null),
      calculated: false,
      placeholder: true,
      note: NOTE,
    };
  }

  estimateExecution(_executionRef: string): CostEstimateResult {
    return {
      ok: true,
      kind: "execution",
      estimated_cost: money(null),
      calculated: false,
      placeholder: true,
      note: NOTE,
    };
  }
}

export function createCostEstimator(): CostEstimator {
  return new CostEstimator();
}
