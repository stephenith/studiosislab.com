import { NextRequest, NextResponse } from "next/server";

type IconifySearchResponse = {
  icons?: string[];
};

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!query) {
    return NextResponse.json({ items: [] });
  }

  try {
    const url = new URL("https://api.iconify.design/search");
    url.searchParams.set("query", query);
    url.searchParams.set("limit", "40");

    const upstream = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ items: [] });
    }

    const data = (await upstream.json()) as IconifySearchResponse;
    const items = (data.icons || []).map((id) => ({
      id,
      name: id,
      svgUrl: `https://api.iconify.design/${encodeURIComponent(id)}.svg`,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
