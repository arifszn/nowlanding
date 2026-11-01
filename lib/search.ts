import "server-only";
import { tmdb, type TmdbSearchItem } from "@/lib/tmdb";

export interface SearchResult {
  id: number;
  media_type: "movie" | "tv";
  name: string;
  year: string;
  poster_path: string | null;
}

export const MIN_QUERY = 2;

/** Movies and series matching `q`, or "error" when TMDB does not answer. */
export async function searchTitles(q: string): Promise<SearchResult[] | "error"> {
  try {
    const r = await tmdb.get("search/multi", { searchParams: { query: q, include_adult: "false" } }).json<{ results: TmdbSearchItem[] }>();
    return r.results
      .filter((x): x is TmdbSearchItem & { media_type: "movie" | "tv" } => x.media_type === "movie" || x.media_type === "tv")
      .slice(0, 18)
      .map((x) => ({
        id: x.id,
        media_type: x.media_type,
        name: x.title ?? x.name ?? "Untitled",
        year: (x.release_date ?? x.first_air_date ?? "").slice(0, 4),
        poster_path: x.poster_path ?? null,
      }));
  } catch {
    return "error";
  }
}
