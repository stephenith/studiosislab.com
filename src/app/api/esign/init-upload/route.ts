import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminAuth, adminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

async function getUserFromRequest(req: NextRequest) {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ ok: false, error: "Missing Authorization header" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const idToken = authHeader.slice("Bearer ".length).trim();

  try {
    return await adminAuth.verifyIdToken(idToken);
  } catch {
    throw new Response(
      JSON.stringify({ ok: false, error: "Invalid or expired auth token" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await getUserFromRequest(req);

    const body = (await req.json()) as {
      fileName?: string;
      sizeBytes?: number;
      contentType?: string;
    };

    const fileName =
      typeof body.fileName === "string" ? body.fileName.trim() : "";
    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes)
        ? Math.trunc(body.sizeBytes)
        : -1;
    const contentType = String(body.contentType || "")
      .trim()
      .toLowerCase();

    if (!fileName || !fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { ok: false, error: "Only PDF files are currently supported for e-signing." },
        { status: 400 }
      );
    }

    if (sizeBytes <= 0 || sizeBytes > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "PDF exceeds the maximum upload size (50 MB).",
        },
        { status: 413 }
      );
    }

    if (contentType && contentType !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "Only PDF files are currently supported for e-signing." },
        { status: 400 }
      );
    }

    const documentId = randomUUID();
    const objectPath = `esign/original/${documentId}.pdf`;
    const file = adminStorage.file(objectPath);

    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + SIGNED_URL_TTL_MS,
      contentType: "application/pdf",
    });

    return NextResponse.json({
      ok: true,
      documentId,
      objectPath,
      uploadUrl,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message =
      e && typeof e === "object" && "message" in e
        ? String((e as { message?: string }).message || "")
        : "";
    return NextResponse.json(
      { ok: false, error: message || "Failed to initialize upload" },
      { status: 500 }
    );
  }
}
