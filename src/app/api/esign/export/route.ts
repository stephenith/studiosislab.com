import { NextRequest } from "next/server";
import {
  buildSignedPdf,
  safeEsignExportFailure,
  type SignaturePlacement,
} from "@/lib/esignSignatureImage";

export const runtime = "nodejs";

export type ExportPlacement = SignaturePlacement;

export type ExportBody = {
  documentId: string;
  placements: ExportPlacement[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExportBody;
    const { documentId, placements } = body;

    if (!documentId || !Array.isArray(placements)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing documentId or placements" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch original PDF via the existing download endpoint so we reuse
    // the same storage logic as the viewer.
    const origin = req.nextUrl.origin;
    const downloadUrl = `${origin}/api/esign/download?documentId=${encodeURIComponent(
      documentId
    )}`;
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to fetch original PDF for this documentId",
        }),
        {
          status: downloadRes.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const contentType = downloadRes.headers.get("content-type") || "";
    if (!contentType.includes("pdf")) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Original file is not a PDF; export currently supports PDF only.",
        }),
        {
          status: 415,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const originalBytes = new Uint8Array(await downloadRes.arrayBuffer());
    const signedBytes = await buildSignedPdf(originalBytes, placements);

    // Simple binary PDF response, no Storage writes for now.
    return new Response(Buffer.from(signedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (error: unknown) {
    const failure = safeEsignExportFailure(error);
    console.error("esign export error", { reason: failure.reason });
    return new Response(
      JSON.stringify({
        ok: false,
        error: failure.clientMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
