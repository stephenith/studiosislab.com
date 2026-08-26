/**
 * Publication state transitions.
 */
import type { PublicationState } from "./types.js";

export function resolvePublicationState(input: {
  founder_approved: boolean;
  validation_pass: boolean;
}): PublicationState {
  if (!input.founder_approved) return "draft";
  if (input.validation_pass) return "ready_to_publish";
  return "founder_approved";
}

export const PUBLICATION_STATE_LABELS: Record<PublicationState, string> = {
  draft: "Draft",
  founder_approved: "Founder Approved",
  ready_to_publish: "Ready To Publish",
  published: "Published",
  archived: "Archived",
  deprecated: "Deprecated",
};

export function canTransition(from: PublicationState, to: PublicationState): boolean {
  const allowed: Record<PublicationState, PublicationState[]> = {
    draft: ["founder_approved", "archived"],
    founder_approved: ["ready_to_publish", "draft", "archived"],
    ready_to_publish: ["published", "founder_approved", "archived"],
    published: ["archived", "deprecated"],
    archived: ["deprecated"],
    deprecated: [],
  };
  return allowed[from]?.includes(to) ?? false;
}
