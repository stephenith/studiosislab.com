import MobileEditorShell from "@/components/editor/mobile/MobileEditorShell";
import { EditorAuthGate } from "@/components/editor/EditorAuthGate";
import { SYSTEM_TEMPLATE_IDS } from "@/data/systemTemplates/registry";

export default async function MobileEditorTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const normalizedTemplateId = String(templateId || "").toLowerCase().trim();
  const isValidTemplate = SYSTEM_TEMPLATE_IDS.includes(normalizedTemplateId);

  return (
    <EditorAuthGate>
      <div className="h-[100dvh] flex flex-col">
        {isValidTemplate ? (
          <MobileEditorShell templateId={normalizedTemplateId} />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#ebecf0] px-4">
            <div className="w-full max-w-sm rounded-2xl border border-[#d6deeb] bg-white p-6 text-center shadow-[0_6px_14px_rgba(30,64,175,0.08)]">
              <h1 className="text-base font-semibold text-zinc-900">Template not found</h1>
              <p className="mt-2 text-sm text-zinc-600">
                That template ID is not available in the system catalog.
              </p>
            </div>
          </div>
        )}
      </div>
    </EditorAuthGate>
  );
}
