import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

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
    const originalName = (fileLike as any).name || "document";
    const lower = originalName.toLowerCase();

    let ext = "";
    if (lower.endsWith(".pdf")) ext = ".pdf";
    else if (lower.endsWith(".doc")) ext = ".doc";
    else if (lower.endsWith(".docx")) ext = ".docx";

    if (!ext) {
      return NextResponse.json(
        { ok: false, error: "Only PDF or Word documents (.pdf, .doc, .docx) are supported." },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileLike.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const documentId = randomUUID();
    const objectPath = `esign/original/${documentId}${ext}`;

    const fileRef = adminStorage.file(objectPath);
    await fileRef.save(buffer, {
      contentType:
        ext === ".pdf"
          ? "application/pdf"
          : ext === ".docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/msword",
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

