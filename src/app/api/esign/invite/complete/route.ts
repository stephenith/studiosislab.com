import { NextRequest } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type Placement = {
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  imageDataUrl: string;
  locked?: boolean;
};

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
    const { documentId, token, placements } = body as {
      documentId: string;
      token: string;
      placements: Placement[];
    };

    if (!documentId || !token || !Array.isArray(placements)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "documentId, token and placements are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const docRef = adminDb.collection("esign_documents").doc(documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return new Response(
        JSON.stringify({ ok: false, error: "Document not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const docData = docSnap.data() as any;
    const ownerUid = docData.ownerUid as string | undefined;

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

    // Ensure recipient is the one completing (or set on first completion).
    if (inviteData.recipientUid && inviteData.recipientUid !== uid) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "You are not allowed to complete this invite",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date();

    // Generate final signed PDF by reusing the existing export route.
    const origin = req.nextUrl.origin;
    const exportRes = await fetch(`${origin}/api/esign/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, placements }),
    });

    if (!exportRes.ok) {
      const text = await exportRes.text().catch(() => "");
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Failed to generate signed PDF: ${text || exportRes.status}`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const pdfArrayBuffer = await exportRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    let signedPdfUrl: string | null = null;
    let signedPdfPath: string | null = null;

    if (ownerUid) {
      const bucket = adminStorage.bucket();
      const filePath = `signed_esign/${ownerUid}/${documentId}/${inviteDoc.id}.pdf`;
      const file = bucket.file(filePath);
      await file.save(pdfBuffer, {
        contentType: "application/pdf",
      });
      signedPdfPath = filePath;
      // public URL (assuming default bucket public rules or signed URLs elsewhere)
      signedPdfUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    }

    await inviteDoc.ref.update({
      status: "completed",
      completedAt: now,
      updatedAt: now,
      recipientUid: uid,
      recipientEmail: email || inviteData.recipientEmail || null,
      signedPdfUrl: signedPdfUrl ?? null,
      signedPdfPath: signedPdfPath ?? null,
    });

    await docRef.set(
      {
        countersignStatus: "completed",
      },
      { merge: true }
    );

    return new Response(
      JSON.stringify({
        ok: true,
        signedPdfUrl,
        signedPdfPath,
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
    console.error("esign invite complete error", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to complete invite",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

