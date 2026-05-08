import EditorShell from "@/components/editor/EditorShell";
import { EditorAuthGate } from "@/components/editor/EditorAuthGate";
import { SYSTEM_TEMPLATE_IDS } from "@/data/systemTemplates/registry";

export default async function EditorTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const normalizedTemplateId = String(templateId || "").toLowerCase().trim();
  const isValidTemplate = SYSTEM_TEMPLATE_IDS.includes(normalizedTemplateId);

  return (
    <EditorAuthGate>
      <div className="h-screen flex flex-col">
        {isValidTemplate ? (
          <EditorShell variant="template" templateId={normalizedTemplateId} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-amber-600">
            Template not found
          </div>
        )}
      </div>
    </EditorAuthGate>
  );
}
