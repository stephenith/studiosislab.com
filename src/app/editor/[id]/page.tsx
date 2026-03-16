import EditorShell from "@/components/editor/EditorShell";

const TEMPLATE_IDS = ["t001", "t002", "t003"];

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

  const isTemplate = TEMPLATE_IDS.includes(normalizedId);

  // 1️⃣ Blank editor
  if (normalizedId === "new") {
    return (
      <div className="h-screen flex flex-col">
        <EditorShell mode="new" />
      </div>
    );
  }

  // 2️⃣ Load template
  if (isTemplate) {
    return (
      <div className="h-screen flex flex-col">
        <EditorShell mode="template" initialTemplateId={normalizedId} />
      </div>
    );
  }

  // 3️⃣ Load saved document
  if (isUuid) {
    return (
      <div className="h-screen flex flex-col">
        <EditorShell mode="template" docId={rawId} />
      </div>
    );
  }

  // 4️⃣ Fallback → blank editor
  return (
    <div className="h-screen flex flex-col">
      <EditorShell mode="new" />
    </div>
  );
}