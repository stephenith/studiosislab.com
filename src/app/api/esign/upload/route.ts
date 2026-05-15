import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

/** Maximum PDF upload size for e-sign originals (bytes). */
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "Missing file in form-data under key `file`" },
        { status: 400 }
      );
    }

    const fileLike = file as File;
    if (typeof fileLike.size === "number" && fileLike.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "PDF exceeds the maximum upload size (15 MB). Try compressing the file or splitting the document.",
        },
        { status: 413 }
      );
    }

    const originalName = (fileLike as any).name || "document";
    const lower = originalName.toLowerCase();

    if (!lower.endsWith(".pdf")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Only PDF files are currently supported for e-signing.",
        },
        { status: 400 }
      );
    }

    const ext = ".pdf" as const;

    const arrayBuffer = await fileLike.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const documentId = randomUUID();
    const objectPath = `esign/original/${documentId}${ext}`;

    const fileRef = adminStorage.file(objectPath);
    await fileRef.save(buffer, {
      contentType: "application/pdf",
    });

    return NextResponse.json({
      ok: true,
      documentId,
      originalFilename: originalName,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}

