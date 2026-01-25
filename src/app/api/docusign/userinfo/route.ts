import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("DS_ACCESS_TOKEN")?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing DS_ACCESS_TOKEN cookie. Login again." },
      { status: 401 }
    );
  }

  const r = await fetch("https://account-d.docusign.com/oauth/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await r.json();

  if (!r.ok) {
    return NextResponse.json({ ok: false, data }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data });
}