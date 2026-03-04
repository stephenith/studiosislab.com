import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: "Missing documentId" },
        { status: 400 }
      );
    }

    // Load e-sign document metadata
    const docRef = doc(db, "esign_documents", documentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return NextResponse.json(
        { ok: false, error: "Document not found" },
        { status: 404 }
      );
    }

    const data = docSnap.data() as any;
    const ownerUid = data.ownerUid as string | undefined;
    const fileName = (data.fileName as string | undefined) ?? "document";

    // Load original PDF from local storage (same source as /api/esign/download)
    const projectRoot = process.cwd();
    const pdfPath = path.join(projectRoot, "storage", "esign", `${documentId}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { ok: false, error: "Original PDF not found for this documentId" },
        { status: 404 }
      );
    }

    const originalBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(originalBytes);

    // Load placements from Firestore
    const placementsSnap = await getDocs(
      collection(db, "esign_documents", documentId, "placements")
    );

    const placements = placementsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    if (placements.length > 0) {
      for (const placement of placements) {
        const pageNumber = Number(placement.pageNumber ?? 1);
        const pageIndex = Math.max(0, Math.min(pdfDoc.getPageCount() - 1, pageNumber - 1));
        const page = pdfDoc.getPage(pageIndex);

        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const imageDataUrl = placement.imageDataUrl as string | undefined;
        if (!imageDataUrl) continue;

        const base64 = imageDataUrl.split(",")[1];
        if (!base64) continue;

        const pngBytes = Buffer.from(base64, "base64");
        const pngImage = await pdfDoc.embedPng(pngBytes);

        // Coordinates are expected as normalized [0,1] relative to page width/height.
        const nx = Number(placement.x ?? 0);
        const ny = Number(placement.y ?? 0);
        const nw = Number(placement.width ?? 0.2);
        const nh = Number(placement.height ?? 0.08);

        const drawWidth = nw * pageWidth;
        const drawHeight = nh * pageHeight;
        const x = nx * pageWidth;
        // PDF coordinate origin is bottom-left; placements stored with top-left origin
        const y = pageHeight - ny * pageHeight - drawHeight;

        page.drawImage(pngImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      }
    }

    const signedBytes = await pdfDoc.save();

    // Optionally upload to Firebase Storage for history / later download
    let signedPdfUrl: string | null = null;
    if (ownerUid) {
      const storagePath = `signed-documents/${ownerUid}/${documentId}.pdf`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, signedBytes);
      signedPdfUrl = await getDownloadURL(storageRef);

      await updateDoc(docRef, {
        signedPdfUrl,
        status: "signed",
        signedAt: serverTimestamp(),
      });
    }

    return new NextResponse(new Blob([signedBytes as BlobPart]), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="signed-${fileName}.pdf"`,
        "X-Signed-Pdf-Url": signedPdfUrl ?? "",
      },
    });
  } catch (e: any) {
    console.error("esign export error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to export signed PDF" },
      { status: 500 }
    );
  }
}

