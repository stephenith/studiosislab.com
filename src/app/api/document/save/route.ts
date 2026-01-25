import { NextResponse, type NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("DS_ACCESS_TOKEN")?.value;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing DS_ACCESS_TOKEN. Login again." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const envelopeId = body?.envelopeId as string | undefined;

    if (!envelopeId) {
      return NextResponse.json({ ok: false, error: "Missing envelopeId" }, { status: 400 });
    }

    // 1) Get account info
    const u = await fetch("https://account-d.docusign.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userinfo = await u.json();

    if (!u.ok) return NextResponse.json({ ok: false, userinfo }, { status: 400 });

    const account = userinfo.accounts?.[0];
    const accountId = account?.account_id;
    const baseUri = account?.base_uri;

    if (!accountId || !baseUri) {
      return NextResponse.json(
        { ok: false, error: "Could not read account_id/base_uri from userinfo" },
        { status: 400 }
      );
    }

    // 2) Download combined signed PDF from DocuSign
    const pdfRes = await fetch(
      `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!pdfRes.ok) {
      const errText = await pdfRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: "Failed to download combined PDF", details: errText },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    // 3) Save to /storage/signed/<envelopeId>.pdf (project root)
    const projectRoot = process.cwd();
    const outDir = path.join(projectRoot, "storage", "signed");
    await fs.mkdir(outDir, { recursive: true });

    const outPath = path.join(outDir, `${envelopeId}.pdf`);
    await fs.writeFile(outPath, pdfBuffer);

    return NextResponse.json({
      ok: true,
      savedAs: `storage/signed/${envelopeId}.pdf`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}