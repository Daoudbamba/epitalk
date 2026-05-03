import { NextRequest, NextResponse } from "next/server";

const TENOR_KEY = process.env.TENOR_API_KEY || "LIVDSRZULELA";
const TENOR_BASE = "https://api.tenor.com/v1";

interface TenorMediaItem {
  gif?: { url?: string };
  tinygif?: { url?: string };
}

interface TenorResult {
  id?: string | number;
  media?: TenorMediaItem[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "trending";
  const limit = Math.min(Number(searchParams.get("limit") || "24"), 50);

  const endpoint =
    q === "trending"
      ? `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=${limit}&media_filter=basic&contentfilter=medium`
      : `${TENOR_BASE}/search?key=${TENOR_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&media_filter=basic&contentfilter=medium`;

  const res = await fetch(endpoint);
  if (!res.ok) {
    return NextResponse.json({ error: "GIF service unavailable" }, { status: 503 });
  }

  const json = await res.json() as { results?: TenorResult[] };

  // Normalize Tenor format → { results: [{ id, url, preview, provider }] }
  const results = (json.results ?? [])
    .map((item: TenorResult) => ({
      id: String(item.id ?? ""),
      url: item.media?.[0]?.gif?.url ?? "",
      preview: item.media?.[0]?.tinygif?.url,
      provider: "tenor",
    }))
    .filter((r) => r.url !== "");

  return NextResponse.json({ results });
}
