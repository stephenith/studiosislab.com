import { redirect } from "next/navigation";
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

  if (normalizedId === "new") {
    redirect("/editor/new");
  }

  if (isTemplate) {
    redirect(`/editor/template/${normalizedId}`);
  }

  if (isUuid) {
    redirect(`/editor/doc/${rawId}`);
  }

  redirect("/editor/new");
}