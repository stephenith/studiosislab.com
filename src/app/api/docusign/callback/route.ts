import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Missing code" },
      { status: 400 }
    );
  }

  const clientId = process.env.DOCUSIGN_INTEGRATION_KEY!;
  const clientSecret = process.env.DOCUSIGN_CLIENT_SECRET!;
  const redirectUri = process.env.DOCUSIGN_REDIRECT_URI!;

  const basicAuth = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const tokenRes = await fetch(
    "https://account-d.docusign.com/oauth/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json(
      { ok: false, tokenJson },
      { status: 400 }
    );
  }

  const accessToken = tokenJson.access_token as string;

  // ✅ Save token in httpOnly cookie (not visible in browser JS)
  const res = NextResponse.redirect(new URL("/api/docusign/userinfo", req.url));
  res.cookies.set("DS_ACCESS_TOKEN", accessToken, {
    httpOnly: true,
    secure: false, // localhost
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}