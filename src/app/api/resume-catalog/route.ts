import { NextResponse } from "next/server";
import { getResumeCatalogSnapshot } from "@/lib/resumeCatalogRuntime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(getResumeCatalogSnapshot(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
