/**
 * ExecutionAuthorizationRequest — Agent #186.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  ExecutionAuthorizationRequestContract,
  ExecutionAuthorizationScope,
} from "./ExecutionAuthorizationTypes.js";
import { EXECUTION_AUTHORIZATION_FOUNDER } from "./ExecutionAuthorizationTypes.js";

export function computeRequestChecksum(
  record: Omit<ExecutionAuthorizationRequestContract, "request_checksum"> & {
    request_checksum: string;
  },
): string {
  const { request_checksum: _c, ...rest } = record;
  return sha256Canonical(rest);
}

export function createExecutionAuthorizationRequest(input: {
  mission_id: string;
  activation_id?: string | null;
  controller_id?: string | null;
  reason: string;
  scope?: ExecutionAuthorizationScope;
  requested_at?: string;
  request_id?: string;
  fixture?: boolean;
}): ExecutionAuthorizationRequestContract {
  const now = input.requested_at ?? new Date().toISOString();
  const draft: ExecutionAuthorizationRequestContract = {
    request_id:
      input.request_id ??
      `ear-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    activation_id: input.activation_id ?? null,
    controller_id: input.controller_id ?? null,
    founder: EXECUTION_AUTHORIZATION_FOUNDER,
    requested_at: now,
    reason: input.reason,
    scope: input.scope ?? "mission",
    request_checksum: "",
    fixture: input.fixture,
  };
  draft.request_checksum = computeRequestChecksum(draft);
  return draft;
}
