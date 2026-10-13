import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { recipientSessionInviteDecision } from "@/lib/esignRecipientSession";

export const runtime = "nodejs";

const MAX_SIGNATURE_BYTES = 300 * 1024;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const signatureDataUrl =
      typeof body?.signatureDataUrl === "string"
        ? body.signatureDataUrl.trim()
        : "";

    if (!sessionId || !token || !signatureDataUrl) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "sessionId, token and signatureDataUrl are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "signatureDataUrl must be a PNG data URL",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const base64 = signatureDataUrl.split(",")[1] || "";
    let raw: Buffer;
    try {
      raw = Buffer.from(base64, "base64");
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid signature PNG data" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!raw.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "Signature image is empty" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (raw.length > MAX_SIGNATURE_BYTES) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Signature image is too large. Keep it under 300KB.",
        }),
        {
          status: 413,
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
      const documentId = typeof data.documentId === "string" ? data.documentId : "";
      const inviteSnap = documentId
        ? await adminDb.collection("esign_documents").doc(documentId).collection("invites").doc(inviteId).get()
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

    await sessionRef.update({
      status: "submitted",
      signatureDataUrl,
      submittedAt: new Date(),
      usedAt: null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[esign/mobile-sign/submit]", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to submit mobile signature",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
