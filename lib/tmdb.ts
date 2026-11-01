import "server-only";
import ky from "ky";

export const TMDB_IMG = "https://image.tmdb.org/t/p";

export const tmdb = ky.create({
  baseUrl: "https://api.themoviedb.org/3/",
  headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}`, Accept: "application/json" },
  timeout: 10_000,
  retry: { limit: 2 },
});

export interface TmdbSearchItem {
  id: number;
  media_type: "movie" | "tv" | "person";
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
}
