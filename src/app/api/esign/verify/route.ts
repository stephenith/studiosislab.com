import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const verificationId =
      typeof body?.verificationId === "string"
        ? body.verificationId.trim()
        : "";

    if (!verificationId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Verification ID is required.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const docSnap = await adminDb
      .collection("esign_documents")
      .where("auditId", "==", verificationId)
      .limit(1)
      .get();

    if (docSnap.empty) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid verification code or no matching document found.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const doc = docSnap.docs[0];
    const documentId = doc.id;
    const docData = doc.data() as Record<string, unknown>;
    const fileName =
      (typeof docData.fileName === "string" ? docData.fileName : null) ?? null;

    const invitesSnap = await adminDb
      .collection("esign_documents")
      .doc(documentId)
      .collection("invites")
      .get();

    let audit: Record<string, unknown> | null = null;
    for (const inv of invitesSnap.docs) {
      const data = inv.data() as Record<string, unknown>;
      if (data.status === "completed" && data.audit && typeof data.audit === "object") {
        audit = data.audit as Record<string, unknown>;
        break;
      }
    }

    if (!audit) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No completed agreement found for this verification code.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const completedAt = audit.completedAt;
    let completedAtFormatted = "";
    if (completedAt != null) {
      if (completedAt instanceof Date) {
        completedAtFormatted = completedAt.toISOString();
      } else if (typeof (completedAt as { toDate?: () => Date }).toDate === "function") {
        completedAtFormatted = (completedAt as { toDate: () => Date }).toDate().toISOString();
      } else {
        completedAtFormatted = String(completedAt);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        verificationId: audit.verificationId ?? verificationId,
        documentId,
        fileName,
        senderEmail: audit.senderEmail ?? "",
        recipientEmail: audit.recipientEmail ?? "",
        completedAt: completedAtFormatted,
        recipientIp: audit.recipientIp ?? "",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[esign/verify]", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Verification failed. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
