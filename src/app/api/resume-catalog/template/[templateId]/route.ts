import { NextResponse } from "next/server";
import { loadRuntimeTemplateJson } from "@/lib/resumeCatalogRuntime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ templateId: string }>;
};

export async function GET(_: Request, { params }: Props) {
  const { templateId } = await params;
  const templateJson = loadRuntimeTemplateJson(templateId);
  if (!templateJson) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json(templateJson, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
