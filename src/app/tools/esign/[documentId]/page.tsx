// src/app/tools/esign/[documentId]/page.tsx
// Wrapper server component that renders the client-side e-sign viewer.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Next.js may not pick up types for this local client component
import EsignViewerClient from "./EsignViewerClient";

export default async function Page({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;

  return <EsignViewerClient documentId={documentId} />;
}