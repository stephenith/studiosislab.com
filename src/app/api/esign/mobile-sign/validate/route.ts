import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { recipientSessionInviteDecision } from "@/lib/esignRecipientSession";

export const runtime = "nodejs";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  const maybe = new Date(String(value));
  return Number.isNaN(maybe.getTime()) ? null : maybe;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const sessionId = (searchParams.get("sessionId") || "").trim();
    const token = (searchParams.get("token") || "").trim();

    if (!sessionId || !token) {
      return new Response(
        JSON.stringify({ ok: false, error: "sessionId and token are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const sessionRef = adminDb
      .collection("esign_mobile_signature_sessions")
      .doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return new Response(
        JSON.stringify({ ok: false, error: "Session not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = sessionSnap.data() as Record<string, unknown>;
    const linkToken = typeof data.linkToken === "string" ? data.linkToken : "";
    if (!linkToken || linkToken !== token) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid token" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (data.status !== "pending") {
      return new Response(
        JSON.stringify({ ok: false, error: "Session is no longer pending" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const expiresAt = toDate(data.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Session has expired" }),
        {
          status: 410,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const inviteId = typeof data.inviteId === "string" ? data.inviteId : "";
    if (inviteId) {
      const boundDocumentId = typeof data.documentId === "string" ? data.documentId : "";
      const inviteSnap = boundDocumentId
        ? await adminDb.collection("esign_documents").doc(boundDocumentId).collection("invites").doc(inviteId).get()
        : null;
      const actorUid = typeof data.recipientUid === "string" ? data.recipientUid : "";
      const decision = recipientSessionInviteDecision(
        inviteSnap && inviteSnap.exists ? inviteSnap.data() : null,
        actorUid
      );
      if (!decision.ok) {
        return new Response(JSON.stringify({ ok: false, error: decision.error }), {
          status: decision.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const documentId =
      typeof data.documentId === "string" ? data.documentId : "";

    return new Response(
      JSON.stringify({
        ok: true,
        documentId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[esign/mobile-sign/validate]", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to validate mobile signing session",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
