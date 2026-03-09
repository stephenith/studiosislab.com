import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

export type ExportPlacement = {
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  imageDataUrl: string;
  locked?: boolean;
};

export type ExportBody = {
  documentId: string;
  placements: ExportPlacement[];
};

/** Convert normalized coords (0..1, top-left origin) to PDF points (bottom-left origin). */
function normToPdf(
  pageWidthPts: number,
  pageHeightPts: number,
  xNorm: number,
  yNorm: number,
  wNorm: number,
  hNorm: number
) {
  const wPts = wNorm * pageWidthPts;
  const hPts = hNorm * pageHeightPts;
  const xPts = xNorm * pageWidthPts;
  // PDF origin is bottom-left; yNorm is from top, so flip.
  const yPts = pageHeightPts - yNorm * pageHeightPts - hPts;
  return { x: xPts, y: yPts, width: wPts, height: hPts };
}

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
    const pdfDoc = await PDFDocument.load(originalBytes);
    const numPages = pdfDoc.getPageCount();

    for (const p of placements) {
      const pageNumber = Math.max(1, Math.min(numPages, Number(p.page) || 1));
      const pageIndex = pageNumber - 1;
      const page = pdfDoc.getPage(pageIndex);
      const pageWidthPts = page.getWidth();
      const pageHeightPts = page.getHeight();

      const imageDataUrl = p.imageDataUrl;
      if (!imageDataUrl || typeof imageDataUrl !== "string") continue;

      const base64 = imageDataUrl.split(",")[1];
      if (!base64) continue;

      const pngBytes = Buffer.from(base64, "base64");
      const pngImage = await pdfDoc.embedPng(pngBytes);

      const xNorm = Number(p.xNorm ?? 0);
      const yNorm = Number(p.yNorm ?? 0);
      const wNorm = Number(p.wNorm ?? 0.2);
      const hNorm = Number(p.hNorm ?? 0.08);

      const { x, y, width, height } = normToPdf(
        pageWidthPts,
        pageHeightPts,
        xNorm,
        yNorm,
        wNorm,
        hNorm
      );

      page.drawImage(pngImage, { x, y, width, height });
    }

    const signedBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(signedBytes);

    // Simple binary PDF response, no Storage writes for now.
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (e: any) {
    console.error("esign export error", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: e?.message || "Failed to export signed PDF",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
