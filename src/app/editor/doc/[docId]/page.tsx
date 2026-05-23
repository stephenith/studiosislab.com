import EditorShell from "@/components/editor/EditorShell";
import { EditorAuthGate } from "@/components/editor/EditorAuthGate";
import EditorMobileGuard from "@/components/editor/EditorMobileGuard";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditorDocumentPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const normalizedDocId = String(docId || "").trim();
  const isValidDocId = UUID_REGEX.test(normalizedDocId);

  return (
    <EditorAuthGate>
      <EditorMobileGuard>
        <div className="h-screen flex flex-col">
          {isValidDocId ? (
            <EditorShell variant="doc" docId={normalizedDocId} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-amber-600">
              Invalid document
            </div>
          )}
        </div>
      </EditorMobileGuard>
    </EditorAuthGate>
  );
}
