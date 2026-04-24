import EditorShell from "@/components/editor/EditorShell";
import { EditorAuthGate } from "@/components/editor/EditorAuthGate";
import { SYSTEM_TEMPLATE_IDS } from "@/data/systemTemplates/registry";

export default async function EditorTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rawId = id?.trim() || "";
  const normalizedId = rawId.toLowerCase();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      rawId
    );

  const isTemplate = SYSTEM_TEMPLATE_IDS.includes(normalizedId);

  // 1️⃣ Blank editor
  if (normalizedId === "new") {
    return (
      <EditorAuthGate>
        <div className="h-screen flex flex-col">
          <EditorShell mode="new" />
        </div>
      </EditorAuthGate>
    );
  }

  // 2️⃣ Load template
  if (isTemplate) {
    return (
      <EditorAuthGate>
        <div className="h-screen flex flex-col">
          <EditorShell mode="template" initialTemplateId={normalizedId} />
        </div>
      </EditorAuthGate>
    );
  }

  // 3️⃣ Load saved document
  if (isUuid) {
    return (
      <EditorAuthGate>
        <div className="h-screen flex flex-col">
          <EditorShell mode="template" docId={rawId} />
        </div>
      </EditorAuthGate>
    );
  }

  // 4️⃣ Fallback → blank editor
  return (
    <EditorAuthGate>
      <div className="h-screen flex flex-col">
        <EditorShell mode="new" />
      </div>
    </EditorAuthGate>
  );
}