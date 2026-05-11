import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

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
    const decoded = await getUserFromRequest(req);
    const { uid } = decoded;

    const body = await req.json();
    const documentId =
      typeof body?.documentId === "string" ? body.documentId.trim() : "";

    if (!documentId) {
      return new Response(
        JSON.stringify({ ok: false, error: "documentId is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const docRef = adminDb.collection("esign_documents").doc(documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return new Response(JSON.stringify({ ok: false, error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = docSnap.data() as Record<string, unknown> | undefined;
    const ownerUid = typeof data?.ownerUid === "string" ? data.ownerUid : "";
    if (!ownerUid || ownerUid !== uid) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionId = randomUUID();
    const linkToken = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);

    await adminDb
      .collection("esign_mobile_signature_sessions")
      .doc(sessionId)
      .set({
        documentId,
        ownerUid: uid,
        status: "pending",
        createdAt,
        expiresAt,
        linkToken,
        usedAt: null,
      });

    const appBase =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      req.nextUrl.origin;
    const normalizedBase = appBase.replace(/\/+$/, "");
    const mobileSigningUrl = `${normalizedBase}/tools/esign/mobile-sign/${encodeURIComponent(
      sessionId
    )}?token=${encodeURIComponent(linkToken)}`;

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId,
        mobileSigningUrl,
        expiresAt: expiresAt.toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    if (e instanceof Response) {
      return e;
    }

    console.error("[esign/mobile-sign/create]", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to create mobile signing session",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
