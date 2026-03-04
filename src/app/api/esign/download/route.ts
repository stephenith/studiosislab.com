import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: "Missing documentId" },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const baseDir = path.join(projectRoot, "storage", "esign");

    const exts = [".pdf", ".docx", ".doc"];
    let foundPath: string | null = null;
    let foundExt: string | null = null;

    for (const ext of exts) {
      const p = path.join(baseDir, `${documentId}${ext}`);
      if (fs.existsSync(p)) {
        foundPath = p;
        foundExt = ext;
        break;
      }
    }

    if (!foundPath || !foundExt) {
      return NextResponse.json(
        { ok: false, error: "File not found for this documentId" },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(foundPath);
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

