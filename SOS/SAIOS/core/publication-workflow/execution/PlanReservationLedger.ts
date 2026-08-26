/**
 * Plan-bound catalogue reservation ledger (queryable; ties IDs to plan+execution).
 * Canonical ID claim still lives in catalogue-id-reservations (or fixture store).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultPublicationRoots, type PublicationRoots } from "../paths.js";
import { atomicWriteJson } from "./atomicWrite.js";

export type PlanReservationEntry = {
  catalogue_id: string;
  candidate_id: string;
  staging_package_id: string;
  reservation_id: string;
  reserved_at: string;
};

export type PlanReservationLedger = {
  schema_version: "plan-reservation-ledger-1.0.0";
  plan_id: string;
  execution_id: string;
  reserved_at: string;
  updated_at: string;
  entries: PlanReservationEntry[];
  released: boolean;
};

export function planReservationLedgerPath(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): string {
  return join(roots.executionsRoot, `reservations-${planId}.json`);
}

export function readPlanReservationLedger(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): PlanReservationLedger | null {
  const p = planReservationLedgerPath(planId, roots);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as PlanReservationLedger;
}

export function writePlanReservationLedger(
  ledger: PlanReservationLedger,
  roots: PublicationRoots = defaultPublicationRoots(),
): void {
  atomicWriteJson(planReservationLedgerPath(ledger.plan_id, roots), {
    ...ledger,
    updated_at: new Date().toISOString(),
  });
}
