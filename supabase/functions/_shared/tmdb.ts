// TMDB HTTP client built on ky (retries 429/5xx, honors Retry-After) with p-limit concurrency.
import ky, { type KyInstance } from "npm:ky@2.2.0";
import pLimit from "npm:p-limit@7.3.3";

export class TmdbClient {
  private http: KyInstance;
  private limit: ReturnType<typeof pLimit>;

  constructor(token: string, maxConcurrent = 8) {
    this.http = ky.create({
      baseUrl: "https://api.themoviedb.org/3/",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 15_000,
      retry: { limit: 5, maxRetryAfter: 30_000, backoffLimit: 10_000 },
    });
    this.limit = pLimit(maxConcurrent);
  }

  get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const searchParams: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined) searchParams[k] = v;
    // baseUrl resolution: a leading slash would drop the /3 prefix.
    return this.limit(() => this.http.get(path.replace(/^\//, ""), { searchParams }).json<T>());
  }
}

export interface TmdbListItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: "movie" | "tv" | "person";
}

export interface TmdbPage<T> {
  page: number;
  total_pages: number;
  results: T[];
}
