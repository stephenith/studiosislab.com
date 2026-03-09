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
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded;
  } catch (e: any) {
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
    const { uid, email } = decoded;

    const body = await req.json();
    const { documentId, senderEmail, clientEmail, message } = body || {};

    if (!documentId || !senderEmail || !clientEmail) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "documentId, senderEmail and clientEmail are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const docRef = adminDb.collection("esign_documents").doc(documentId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return new Response(
        JSON.stringify({ ok: false, error: "Document not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const data = snap.data() as any;
    const ownerUid = data.ownerUid as string | undefined;
    if (!ownerUid || ownerUid !== uid) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "You are not allowed to invite for this document",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const inviteId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const inviteRef = docRef.collection("invites").doc(inviteId);
    await inviteRef.set({
      token,
      senderUid: uid,
      senderEmail,
      clientEmail,
      message: message ?? "",
      status: "sent",
      createdAt: now,
      updatedAt: now,
      expiresAt,
      viewedAt: null,
      completedAt: null,
      recipientUid: null,
      recipientEmail: null,
    });

    await docRef.set(
      {
        countersignStatus: "sent",
        ownerUid: ownerUid,
      },
      { merge: true }
    );

    const url = `/tools/esign/${documentId}?token=${encodeURIComponent(
      token
    )}`;

    return new Response(
      JSON.stringify({
        ok: true,
        url,
        inviteId,
        token,
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
    console.error("esign invite error", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to create countersign invite",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

