import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    const final = searchParams.get("final");

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: "Missing documentId" },
        { status: 400 }
      );
    }

    // If final=1, stream the final signed PDF: prefer Storage path on completed invite, then fall back to stored URL.
    if (final === "1") {
      const docSnap = await adminDb
        .collection("esign_documents")
        .doc(documentId)
        .get();

      if (!docSnap.exists) {
        return NextResponse.json(
          { ok: false, error: "Document not found" },
          { status: 404 }
        );
      }

      const data = docSnap.data() as any;
      const finalPdfUrl = data.finalPdfUrl as string | undefined | null;

      /** Pick latest completed invite that has a Storage path (avoids stale signed URLs in Firestore). */
      let resolvedPath: string | null = null;
      try {
        const invitesSnap = await adminDb
          .collection("esign_documents")
          .doc(documentId)
          .collection("invites")
          .where("status", "==", "completed")
          .get();

        const completed = invitesSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (row: any) =>
              typeof row.signedPdfPath === "string" && row.signedPdfPath.length > 0
          );

        const byTime = (a: any, b: any) => {
          const ta =
            a.completedAt?.toMillis?.() ??
            (a.completedAt instanceof Date ? a.completedAt.getTime() : 0);
          const tb =
            b.completedAt?.toMillis?.() ??
            (b.completedAt instanceof Date ? b.completedAt.getTime() : 0);
          return tb - ta;
        };
        completed.sort(byTime);
        if (completed.length > 0) {
          resolvedPath = completed[0].signedPdfPath as string;
        }
      } catch {
        // non-fatal; fall through to URL fallback
      }

      // Preferred: read final bytes from Storage using invite.signedPdfPath (stable; not a long-lived browser URL).
      if (resolvedPath) {
        try {
          const fileRef = adminStorage.file(resolvedPath);
          const [exists] = await fileRef.exists();
          if (!exists) {
            return NextResponse.json(
              {
                ok: false,
                error: "Final PDF file missing in storage",
                detail: { path: resolvedPath },
              },
              { status: 404 }
            );
          }
          const [buf] = await fileRef.download();
          const bytes = new Uint8Array(buf);
          return new NextResponse(bytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename="esign-final-${documentId}.pdf"`,
            },
          });
        } catch (storageErr: any) {
          return NextResponse.json(
            {
              ok: false,
              error: "Failed to read final PDF from storage",
              detail: storageErr?.message ?? String(storageErr),
            },
            { status: 500 }
          );
        }
      }

      if (!finalPdfUrl) {
        return NextResponse.json(
          {
            ok: false,
            error: "Final PDF not found",
            detail: "No completed invite with signedPdfPath and no finalPdfUrl on document",
          },
          { status: 404 }
        );
      }

      const res = await fetch(finalPdfUrl);
      if (!res.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to fetch final signed PDF",
            detail: { upstreamStatus: res.status },
          },
          { status: res.status }
        );
      }

      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="esign-final-${documentId}.pdf"`,
        },
      });
    }

    const exts = [".pdf", ".docx", ".doc"];
    let foundExt: string | null = null;
    let fileBuffer: Buffer | null = null;

    for (const ext of exts) {
      const objectPath = `esign/original/${documentId}${ext}`;
      const fileRef = adminStorage.file(objectPath);
      const [exists] = await fileRef.exists();
      if (exists) {
        const [downloadedBuffer] = await fileRef.download();
        fileBuffer = downloadedBuffer;
        foundExt = ext;
        break;
      }
    }

    if (!fileBuffer || !foundExt) {
      return NextResponse.json(
        { ok: false, error: "Original file not found" },
        { status: 404 }
      );
    }

    const bytes = new Uint8Array(fileBuffer);

    const contentType =
      foundExt === ".pdf"
        ? "application/pdf"
        : foundExt === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="esign-${documentId}${foundExt}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to download file" },
      { status: 500 }
    );
  }
}

