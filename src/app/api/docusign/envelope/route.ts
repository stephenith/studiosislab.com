import { NextResponse, type NextRequest } from "next/server";

// We use Buffer in GET, so force Node runtime (important for Vercel too)
export const runtime = "nodejs";

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
    const { pdfBase64, signerEmail, signerName } = body;

    if (!pdfBase64 || !signerEmail || !signerName) {
      return NextResponse.json(
        { ok: false, error: "Missing pdfBase64 / signerEmail / signerName" },
        { status: 400 }
      );
    }

    // 1) Get userinfo (account_id + base_uri)
    const u = await fetch("https://account-d.docusign.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const userinfo = await u.json();
    if (!u.ok) return NextResponse.json({ ok: false, userinfo }, { status: 400 });

    const account = userinfo.accounts?.[0];
    const accountId = account?.account_id;
    const baseUri = account?.base_uri; // e.g. https://demo.docusign.net

    if (!accountId || !baseUri) {
      return NextResponse.json(
        { ok: false, error: "Could not read account_id/base_uri from userinfo" },
        { status: 400 }
      );
    }

    // 2) Create envelope (send email signing)
    const envelopeBody = {
      emailSubject: "Please sign this document",
      status: "sent",
      documents: [
        {
          documentBase64: pdfBase64, // ONLY base64 string, no "data:application/pdf;base64,"
          name: "StudiosisLab-Document.pdf",
          fileExtension: "pdf",
          documentId: "1",
        },
      ],
      recipients: {
        signers: [
          // Signer 1 = YOU (Company A) — signs first
          {
            email: "stephenpereira750@gmail.com",
            name: "Stephen Pereira",
            recipientId: "1",
            routingOrder: "1",
            tabs: {
              signHereTabs: [
                { documentId: "1", pageNumber: "1", xPosition: "150", yPosition: "720" },
              ],
            },
          },

          // Signer 2 = CLIENT (Company B) — signs after you
          {
            email: signerEmail,
            name: signerName,
            recipientId: "2",
            routingOrder: "2",
            tabs: {
              signHereTabs: [
                { documentId: "1", pageNumber: "1", xPosition: "420", yPosition: "720" },
              ],
            },
          },
        ],
      },
    };

    const createUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`;

    const r = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopeBody),
    });

    const data = await r.json();
    if (!r.ok) return NextResponse.json({ ok: false, data }, { status: 400 });

    // ✅ IMPORTANT: return envelopeId clearly (this is what your frontend needs)
    const envelopeId = data?.envelopeId;
    if (!envelopeId) {
      return NextResponse.json(
        { ok: false, error: "Envelope created but envelopeId missing in response", data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        envelopeId, // ✅ clean + explicit
        raw: data,  // optional: keep full response for debugging
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("DS_ACCESS_TOKEN")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing DS_ACCESS_TOKEN" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const envelopeId = searchParams.get("envelopeId");

    if (!envelopeId) {
      return NextResponse.json({ ok: false, error: "Missing envelopeId" }, { status: 400 });
    }

    // get account info
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

    // download combined signed PDF
    const pdfRes = await fetch(
      `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!pdfRes.ok) {
      const errText = await pdfRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: "Failed to download combined PDF", details: errText },
        { status: 400 }
      );
    }

    const pdfBuffer = await pdfRes.arrayBuffer();

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        // inline = preview in browser (still downloadable)
        "Content-Disposition": 'inline; filename="Signed-Agreement.pdf"',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}