/**
 * Full-screen gallery → editor transition. Lives outside the hub tree so the
 * branded loader can cover the route swap until the editor's own load state
 * (or an error / login / not-found) takes over.
 */

type Listener = (open: boolean) => void;

const listeners = new Set<Listener>();
let open = false;

function emit(): void {
  for (const listener of listeners) listener(open);
}

export function isGalleryEditorOpen(): boolean {
  return open;
}

export function beginGalleryEditorOpen(): void {
  if (open) return;
  open = true;
  emit();
}

export function endGalleryEditorOpen(): void {
  if (!open) return;
  open = false;
  emit();
}

export function subscribeGalleryEditorOpen(listener: Listener): () => void {
  listeners.add(listener);
  listener(open);
  return () => {
    listeners.delete(listener);
  };
}

export function shouldIgnoreModifiedEditorClick(event: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
}): boolean {
  if (typeof event.button === "number" && event.button !== 0) return true;
  return Boolean(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
