import { NextRequest } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";

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

async function deleteInvitesInBatches(documentId: string) {
  const invitesRef = adminDb
    .collection("esign_documents")
    .doc(documentId)
    .collection("invites");

  for (;;) {
    try {
      const snap = await invitesRef.limit(500).get();
      if (snap.empty) break;

      const batch = adminDb.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      console.error("[esign/delete] invites batch delete failed", {
        documentId,
        error: e,
      });
      break;
    }
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
    const snap = await docRef.get();

    if (!snap.exists) {
      return new Response(JSON.stringify({ ok: false, error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = snap.data() as Record<string, unknown> | undefined;
    const ownerUid = typeof data?.ownerUid === "string" ? data.ownerUid : "";

    if (!ownerUid || ownerUid !== uid) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await deleteInvitesInBatches(documentId);

    const originalPaths = [
      `esign/original/${documentId}.pdf`,
      `esign/original/${documentId}.docx`,
      `esign/original/${documentId}.doc`,
    ];

    for (const path of originalPaths) {
      try {
        const file = adminStorage.file(path);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete({ ignoreNotFound: true });
        }
      } catch (e) {
        console.error("[esign/delete] original file delete failed", {
          documentId,
          path,
          error: e,
        });
      }
    }

    const signedPrefix = `signed_esign/${ownerUid}/${documentId}/`;
    try {
      const [files] = await adminStorage.getFiles({ prefix: signedPrefix });
      for (const f of files) {
        try {
          await f.delete({ ignoreNotFound: true });
        } catch (e) {
          console.error("[esign/delete] signed file delete failed", {
            documentId,
            path: f.name,
            error: e,
          });
        }
      }
    } catch (e) {
      console.error("[esign/delete] list signed files failed", {
        documentId,
        prefix: signedPrefix,
        error: e,
      });
    }

    try {
      await docRef.delete();
    } catch (e) {
      console.error("[esign/delete] firestore document delete failed", {
        documentId,
        error: e,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to delete Firestore document",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) {
      return e;
    }

    console.error("[esign/delete]", e);

    return new Response(
      JSON.stringify({ ok: false, error: "Delete failed. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
