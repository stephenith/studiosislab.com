/**
 * Same-tab preview of a PDF the sender just uploaded.
 * The viewer otherwise downloads the original again after navigation.
 * A refresh misses this cache and uses the download route.
 */
let currentId: string | null = null;
let currentBytes: Uint8Array | null = null;
const inflight = new Map<string, Promise<Uint8Array>>();

export function rememberEsignOriginalPreview(
  documentId: string,
  bytes: Uint8Array
): void {
  currentId = documentId;
  currentBytes = bytes;
}

export function peekEsignOriginalPreview(documentId: string): Uint8Array | null {
  if (currentId === documentId && currentBytes) return currentBytes;
  return null;
}

export function loadEsignOriginalPreview(
  documentId: string,
  fetcher: () => Promise<Uint8Array>
): Promise<Uint8Array> {
  const peeked = peekEsignOriginalPreview(documentId);
  if (peeked) return Promise.resolve(peeked);
  const existing = inflight.get(documentId);
  if (existing) return existing;
  const job = fetcher()
    .then((bytes) => {
      rememberEsignOriginalPreview(documentId, bytes);
      inflight.delete(documentId);
      return bytes;
    })
    .catch((error: unknown) => {
      inflight.delete(documentId);
      throw error;
    });
  inflight.set(documentId, job);
  return job;
}
