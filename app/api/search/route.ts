import { MIN_QUERY, searchTitles } from "@/lib/search";

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < MIN_QUERY) return Response.json({ results: [] });
  const results = await searchTitles(q);
  if (results === "error") return Response.json({ error: "search" }, { status: 502 });
  return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=60" } });
}
