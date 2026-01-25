import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("DS_ACCESS_TOKEN")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const envelopeId = searchParams.get("envelopeId");

    if (!envelopeId) {
      return NextResponse.json({ ok: false, error: "Missing envelopeId" }, { status: 400 });
    }

    // 1️⃣ Get account info
    const u = await fetch("https://account-d.docusign.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userinfo = await u.json();

    const account = userinfo.accounts?.[0];
    const accountId = account.account_id;
    const baseUri = account.base_uri;

    // 2️⃣ Get envelope status
    const res = await fetch(
      `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      status: data.status,           // sent / completed
      recipients: data.recipients,   // who signed
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}