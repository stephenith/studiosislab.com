/**
 * ExecutionAuthorizationPolicy — Agent #186.
 * Authorization does not dispatch, enqueue, spawn, schedule, provide, publish, or LIVE.
 */
import { EXECUTION_AUTHORIZATION_SAFETY_FLAGS } from "./ExecutionAuthorizationTypes.js";

export const EXECUTION_AUTHORIZATION_POLICY = {
  records_founder_intent_only: true,
  overrides_activation_gate: false,
  enables_execution: false,
  may_dispatch_workers: false,
  may_insert_queues: false,
  may_spawn_workers: false,
  may_activate_scheduler: false,
  may_enable_providers: false,
  may_publish: false,
  may_enable_live: false,
  safety_flags: EXECUTION_AUTHORIZATION_SAFETY_FLAGS,
} as const;

export function assertAuthorizationDoesNotEnableExecution(): void {
  if (EXECUTION_AUTHORIZATION_POLICY.enables_execution) {
    throw new Error("Authorization must never enable execution");
  }
  if (EXECUTION_AUTHORIZATION_POLICY.overrides_activation_gate) {
    throw new Error("Authorization must never override Activation Gate");
  }
  for (const [k, v] of Object.entries(EXECUTION_AUTHORIZATION_SAFETY_FLAGS)) {
    if (v !== false) {
      throw new Error(`Safety flag ${k} must remain false`);
    }
  }
}

export function authorizationPolicyNotes(): string[] {
  return [
    "Execution Authorization records founder intent only.",
    "AUTHORIZATION IS NOT EXECUTION.",
    "Does not override Activation Gate.",
    "Does not dispatch workers, insert queues, spawn, schedule, enable providers, publish, or LIVE.",
  ];
}
