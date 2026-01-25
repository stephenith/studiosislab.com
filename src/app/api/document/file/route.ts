import { NextResponse, type NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const envelopeId = searchParams.get("envelopeId");
    const download = searchParams.get("download") === "1";
    const raw = searchParams.get("raw") === "1"; // optional helper mode
    const disposition = download ? "attachment" : "inline";

    if (!envelopeId) {
      return NextResponse.json({ ok: false, error: "Missing envelopeId" }, { status: 400 });
    }

    // ✅ Access token from cookie
    const token = req.cookies.get("DS_ACCESS_TOKEN")?.value;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing DS_ACCESS_TOKEN. Please login again." },
        { status: 401 }
      );
    }

    // Local cache path: /storage/signed/<envelopeId>.pdf
    const signedDir = path.join(process.cwd(), "storage", "signed");
    const signedPath = path.join(signedDir, `${envelopeId}.pdf`);

    if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });

    // Helper to return PDF response
    const returnPdf = (buf: Buffer) => {
      const filename = `signed-${envelopeId}.pdf`;
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="signed-${envelopeId}.pdf"`,
        },
      });
    };

    // ✅ If cached file exists, serve it
    if (fs.existsSync(signedPath)) {
      const buf = fs.readFileSync(signedPath);

      // If raw=0, return a JSON “link” (optional)
    

      return returnPdf(buf);
    }

    // ✅ Fetch userinfo to get accountId + baseUri
    const u = await fetch("https://account-d.docusign.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!u.ok) {
      const txt = await u.text();
      return NextResponse.json(
        { ok: false, error: `DocuSign userinfo failed (${u.status})`, details: txt },
        { status: u.status === 401 ? 401 : 500 }
      );
    }

    const userinfo = await u.json();

    // Safer: pick default account if available, else first
    const accounts = Array.isArray(userinfo?.accounts) ? userinfo.accounts : [];
    const account =
      accounts.find((a: any) => a?.is_default === true) ||
      accounts[0];

    const accountId = account?.account_id;
    const baseUri = account?.base_uri; // e.g. https://demo.docusign.net

    if (!accountId || !baseUri) {
      return NextResponse.json(
        { ok: false, error: "Could not read account_id/base_uri from userinfo" },
        { status: 500 }
      );
    }

    const basePath = `${baseUri}/restapi`;
    const downloadUrl = `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;

    const dsRes = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/pdf",
      },
    });

    if (!dsRes.ok) {
      const text = await dsRes.text();
      return NextResponse.json(
        { ok: false, error: `DocuSign download failed (${dsRes.status})`, details: text },
        { status: 500 }
      );
    }

    const arrayBuf = await dsRes.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // ✅ Save to disk for next time
    fs.writeFileSync(signedPath, buf);

    // If raw=0, return a JSON “link” (optional)
    if (!raw) {
      return NextResponse.json({
        ok: true,
        cached: false,
        fileUrl: `/api/document/file?envelopeId=${encodeURIComponent(envelopeId)}&download=${
          download ? "1" : "0"
        }&raw=1`,
      });
    }

    return returnPdf(buf);
  } catch (err: any) {
    console.error("❌ /api/document/file error:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Server error" }, { status: 500 });
  }
}