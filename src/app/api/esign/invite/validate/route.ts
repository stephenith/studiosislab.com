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

export async function GET(req: NextRequest) {
  try {
    const decoded = await getUserFromRequest(req);
    const { uid, email } = decoded;

    const { searchParams } = req.nextUrl;
    const documentId = searchParams.get("documentId");
    const token = searchParams.get("token");

    if (!documentId || !token) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "documentId and token are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const docRef = adminDb.collection("esign_documents").doc(documentId);
    const inviteSnap = await docRef
      .collection("invites")
      .where("token", "==", token)
      .limit(1)
      .get();

    if (inviteSnap.empty) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invite not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const inviteDoc = inviteSnap.docs[0];
    const inviteData = inviteDoc.data() as any;

    const now = new Date();
    const expiresAt = inviteData.expiresAt
      ? new Date(inviteData.expiresAt.toDate?.() ?? inviteData.expiresAt)
      : null;
    if (expiresAt && now > expiresAt) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invite has expired" }),
        {
          status: 410,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (inviteData.status === "sent") {
      await inviteDoc.ref.update({
        status: "viewed",
        viewedAt: now,
        updatedAt: now,
        recipientUid: inviteData.recipientUid || uid,
        recipientEmail: inviteData.recipientEmail || email || null,
      });
    }

    const refreshed = (await inviteDoc.ref.get()).data() as any;

    return new Response(
      JSON.stringify({
        ok: true,
        invite: {
          id: inviteDoc.id,
          token,
          status: refreshed.status,
          senderEmail: refreshed.senderEmail,
          clientEmail: refreshed.clientEmail,
          message: refreshed.message,
          recipientEmail: refreshed.recipientEmail,
        },
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
    console.error("esign invite validate error", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to validate invite",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

