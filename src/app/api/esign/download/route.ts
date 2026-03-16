import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    const final = searchParams.get("final");

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: "Missing documentId" },
        { status: 400 }
      );
    }

    // If final=1, stream the final signed PDF from Storage via the finalPdfUrl saved on the document.
    if (final === "1") {
      const docSnap = await adminDb
        .collection("esign_documents")
        .doc(documentId)
        .get();

      if (!docSnap.exists) {
        return NextResponse.json(
          { ok: false, error: "Document not found" },
          { status: 404 }
        );
      }

      const data = docSnap.data() as any;
      const finalPdfUrl = data.finalPdfUrl as string | undefined | null;

      if (!finalPdfUrl) {
        return NextResponse.json(
          { ok: false, error: "Final PDF not found" },
          { status: 404 }
        );
      }

      const res = await fetch(finalPdfUrl);
      if (!res.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to fetch final signed PDF",
          },
          { status: res.status }
        );
      }

      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="esign-final-${documentId}.pdf"`,
        },
      });
    }

    const exts = [".pdf", ".docx", ".doc"];
    let foundExt: string | null = null;
    let fileBuffer: Buffer | null = null;
    let foundExt: string | null = null;

    for (const ext of exts) {
      const objectPath = `esign/original/${documentId}${ext}`;
      const fileRef = adminStorage.file(objectPath);
      const [exists] = await fileRef.exists();
      if (exists) {
        const [downloadedBuffer] = await fileRef.download();
        fileBuffer = downloadedBuffer;
        foundExt = ext;
        break;
      }
    }

    if (!fileBuffer || !foundExt) {
      return NextResponse.json(
        { ok: false, error: "Original file not found" },
        { status: 404 }
      );
    }

    const bytes = new Uint8Array(fileBuffer);

    const contentType =
      foundExt === ".pdf"
        ? "application/pdf"
        : foundExt === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="esign-${documentId}${foundExt}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to download file" },
      { status: 500 }
    );
  }
}

