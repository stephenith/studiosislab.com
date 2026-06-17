import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function sanitizeFileName(name: string): string {
  const raw = String(name || "document.pdf").trim();
  const cleaned = raw.replace(/[\\/\u0000-\u001f\u007f]+/g, "_");
  const bounded = cleaned.slice(0, 180);
  return bounded.toLowerCase().endsWith(".pdf") ? bounded : `${bounded || "document"}.pdf`;
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await getUserFromRequest(req);
    const { uid } = decoded;

    const body = (await req.json()) as {
      documentId?: string;
      fileName?: string;
      sizeBytes?: number;
    };

    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";
    const fileName = sanitizeFileName(
      typeof body.fileName === "string" ? body.fileName : "document.pdf"
    );
    const sizeBytes =
      typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes)
        ? Math.trunc(body.sizeBytes)
        : -1;

    if (!documentId || !UUID_RE.test(documentId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid documentId" },
        { status: 400 }
      );
    }

    if (sizeBytes < 0 || sizeBytes > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "PDF exceeds the maximum upload size (50 MB).",
        },
        { status: 413 }
      );
    }

    const objectPath = `esign/original/${documentId}.pdf`;
    const file = adminStorage.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { ok: false, error: "Uploaded PDF not found in storage" },
        { status: 404 }
      );
    }

    const [metadata] = await file.getMetadata();
    const storedSize = Number(metadata.size ?? 0);
    const contentType = String(metadata.contentType || "").toLowerCase();

    if (storedSize <= 0 || storedSize > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "PDF exceeds the maximum upload size (50 MB).",
        },
        { status: 413 }
      );
    }

    if (contentType && !contentType.includes("pdf")) {
      return NextResponse.json(
        { ok: false, error: "Only PDF files are currently supported for e-signing." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("esign_documents").doc(documentId);
    const existing = await docRef.get();
    if (existing.exists) {
      const existingOwner = existing.data()?.ownerUid;
      if (typeof existingOwner === "string" && existingOwner !== uid) {
        return NextResponse.json(
          { ok: false, error: "Document already belongs to another user" },
          { status: 403 }
        );
      }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await docRef.set(
      {
        id: documentId,
        ownerUid: uid,
        fileName,
        status: "draft",
        createdAt: existing.exists ? existing.data()?.createdAt ?? now : now,
        updatedAt: now,
        finalPdfUrl: null,
        pagesCount: 0,
        originalStoragePath: objectPath,
        originalSizeBytes: storedSize,
        contentType: contentType || "application/pdf",
        uploadStatus: "ready",
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      documentId,
      fileName,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message =
      e && typeof e === "object" && "message" in e
        ? String((e as { message?: string }).message || "")
        : "";
    return NextResponse.json(
      { ok: false, error: message || "Failed to finalize upload" },
      { status: 500 }
    );
  }
}
