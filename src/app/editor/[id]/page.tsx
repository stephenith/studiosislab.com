import EditorShell from "@/components/editor/EditorShell";

export default async function EditorTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const templateId = id?.toLowerCase().trim();
  if (templateId === "new") {
    return (
      <div className="h-screen flex flex-col">
        <EditorShell mode="new" />
      </div>
    );
  }
  return (
    <div className="h-screen flex flex-col">
      <EditorShell mode="template" initialTemplateId={templateId} />
    </div>
  );
}
