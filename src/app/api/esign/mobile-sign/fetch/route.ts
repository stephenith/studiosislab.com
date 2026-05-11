import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const MAX_SIGNATURE_BYTES = 300 * 1024;

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

export async function GET(req: NextRequest) {
  try {
    const decoded = await getUserFromRequest(req);
    const { uid } = decoded;

    const sessionId = (req.nextUrl.searchParams.get("sessionId") || "").trim();
    if (!sessionId) {
      return new Response(
        JSON.stringify({ ok: false, error: "sessionId is required" }),
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
    const ownerUid = typeof data.ownerUid === "string" ? data.ownerUid : "";
    if (!ownerUid || ownerUid !== uid) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const signatureDataUrl =
      typeof data.signatureDataUrl === "string" ? data.signatureDataUrl : "";
    if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Mobile signature has not been submitted yet",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const base64 = signatureDataUrl.split(",")[1] || "";
    const raw = Buffer.from(base64, "base64");
    if (!raw.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Mobile signature has not been submitted yet",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    if (raw.length > MAX_SIGNATURE_BYTES) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Submitted signature is too large",
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Best-effort fetch marker; should never block returning a valid signature.
    try {
      const status = typeof data.status === "string" ? data.status : null;
      await sessionRef.update({
        fetchedAt: new Date(),
        ...(status === "submitted" ? { status: "fetched" } : {}),
      });
    } catch (e) {
      console.warn("[esign/mobile-sign/fetch] failed to set fetched marker", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        signatureDataUrl,
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
    console.error("[esign/mobile-sign/fetch]", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to fetch mobile signature" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
