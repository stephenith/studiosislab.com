/** Runtime core version — frozen after prompt #024. Bug fixes only. */
export const RUNTIME_VERSION = "1.0.0-frozen";
export const ARCHITECTURE_VERSION = "1.0.0";
export const RUNTIME_FROZEN = true;
export const DEFAULT_PM_MISSION = "Build StudiosisLab";

export type RuntimeFreezeInfo = {
  runtime_version: string;
  architecture_version: string;
  runtime_frozen: boolean;
  default_mission: string;
  frozen_at: string;
  policy: string;
};

export function getRuntimeFreezeInfo(): RuntimeFreezeInfo {
  return {
    runtime_version: RUNTIME_VERSION,
    architecture_version: ARCHITECTURE_VERSION,
    runtime_frozen: RUNTIME_FROZEN,
    default_mission: DEFAULT_PM_MISSION,
    frozen_at: "2026-06-29",
    policy: "Runtime receives bug fixes only. New features are product work in src/.",
  };
}
