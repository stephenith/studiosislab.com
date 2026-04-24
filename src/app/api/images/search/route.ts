import { NextRequest, NextResponse } from "next/server";

type PixabayHit = {
  id: number;
  previewURL?: string;
  webformatURL?: string;
  largeImageURL?: string;
  imageWidth?: number;
  imageHeight?: number;
  user?: string;
};

type PixabayResponse = {
  hits?: PixabayHit[];
};

type NormalizedImage = {
  id: string;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  photographer: string;
  source: "pixabay";
};

const PIXABAY_BASE = "https://pixabay.com/api/";
const SUGGESTED_KEYWORDS = ["office", "workspace", "technology", "business"];
const SUGGESTED_CACHE_TTL_MS = 15 * 60 * 1000;

let suggestedCache: { items: NormalizedImage[]; expiresAt: number } | null = null;

function normalizeHit(hit: PixabayHit): NormalizedImage | null {
  const id = String(hit.id ?? "");
  const previewUrl = hit.previewURL || "";
  const fullUrl = hit.webformatURL || hit.largeImageURL || "";
  if (!id || !previewUrl || !fullUrl) return null;

  return {
    id,
    previewUrl,
    fullUrl,
    width: Number(hit.imageWidth || 0),
    height: Number(hit.imageHeight || 0),
    photographer: hit.user || "",
    source: "pixabay",
  };
}

async function searchPixabay(apiKey: string, q: string, perPage: number): Promise<NormalizedImage[]> {
  const url = new URL(PIXABAY_BASE);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", q);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", String(perPage));

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as PixabayResponse;
    return (data.hits || [])
      .map(normalizeHit)
      .filter((item): item is NormalizedImage => item !== null);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ items: [] });
  }

  const query = (req.nextUrl.searchParams.get("q") || "").trim();

  if (query) {
    const items = await searchPixabay(apiKey, query, 30);
    return NextResponse.json({ items: items.slice(0, 40) });
  }

  const now = Date.now();
  if (suggestedCache && suggestedCache.expiresAt > now) {
    return NextResponse.json({ items: suggestedCache.items });
  }

  const groups = await Promise.all(
    SUGGESTED_KEYWORDS.map((keyword) => searchPixabay(apiKey, keyword, 12))
  );
  const merged = groups.flat();

  const dedup = Array.from(new Map(merged.map((item) => [item.id, item])).values()).slice(0, 40);
  suggestedCache = {
    items: dedup,
    expiresAt: now + SUGGESTED_CACHE_TTL_MS,
  };

  return NextResponse.json({ items: dedup });
}
