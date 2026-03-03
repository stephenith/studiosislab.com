import EditorShell from "@/components/editor/EditorShell";

export default async function EditorTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rawId = id?.trim();
  const templateId = rawId?.toLowerCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    rawId || ""
  );
  if (templateId === "new") {
    return (
      <div className="h-screen flex flex-col">
        <EditorShell mode="new" />
      </div>
    );
  }
  if (isUuid && rawId) {
    return (
      <div className="h-screen flex flex-col">
        <EditorShell mode="template" docId={rawId} />
      </div>
    );
  }
  return (
    <div className="h-screen flex flex-col">
      <EditorShell mode="template" initialTemplateId={templateId} />
    </div>
  );
}
