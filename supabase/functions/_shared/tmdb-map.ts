// Pure mapping from TMDB responses to release_dates rows. No runtime-specific imports.
import type { ReleaseDateInput, ReleaseKind } from "./types.ts";

export const RELEASE_TYPE_TO_KIND: Record<number, ReleaseKind> = {
  1: "premiere",
  2: "theatrical_limited",
  3: "theatrical",
  4: "digital",
  5: "physical",
  6: "tv",
};

export interface TmdbMovieReleaseDates {
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ type: number; release_date: string; note?: string; certification?: string }>;
  }>;
}

export interface TmdbEpisodeRef {
  air_date: string | null;
  episode_number: number;
  season_number: number;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  first_air_date: string | null;
  status?: string;
  seasons?: Array<{ air_date: string | null; season_number: number; episode_count?: number }>;
  next_episode_to_air?: TmdbEpisodeRef | null;
  last_episode_to_air?: TmdbEpisodeRef | null;
}

export interface TmdbSeasonDetails {
  season_number: number;
  episodes: TmdbEpisodeRef[];
}

const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}/.test(s);

/** Movie release dates for the given regions. Keeps the earliest date per (region, kind). */
export function mapMovieReleaseDates(
  data: TmdbMovieReleaseDates | undefined,
  regions: Set<string>,
): ReleaseDateInput[] {
  const best = new Map<string, ReleaseDateInput>();
  for (const country of data?.results ?? []) {
    if (!regions.has(country.iso_3166_1)) continue;
    for (const r of country.release_dates) {
      const kind = RELEASE_TYPE_TO_KIND[r.type];
      if (!kind || !isDate(r.release_date)) continue;
      const date = r.release_date.slice(0, 10);
      const key = `${country.iso_3166_1}:${kind}`;
      const prev = best.get(key);
      if (!prev || date < prev.date) {
        best.set(key, { kind, region: country.iso_3166_1, season: null, episode: null, date, note: r.note || null });
      }
    }
  }
  return [...best.values()];
}

/**
 * Series dates. Season 1's premiere is the series premiere; episode 1 of a season is
 * covered by its season premiere, so neither is duplicated.
 */
export function mapTvDates(details: TmdbTvDetails, seasons: TmdbSeasonDetails[] = []): ReleaseDateInput[] {
  const out: ReleaseDateInput[] = [];
  const firstSeason = (details.seasons ?? []).find((s) => s.season_number === 1);
  const premiere = isDate(details.first_air_date) ? details.first_air_date : firstSeason?.air_date;
  if (isDate(premiere)) {
    out.push({ kind: "series_premiere", region: null, season: null, episode: null, date: premiere.slice(0, 10), note: null });
  }
  for (const s of details.seasons ?? []) {
    if (s.season_number <= 1 || !isDate(s.air_date)) continue; // 0 = specials
    out.push({ kind: "season_premiere", region: null, season: s.season_number, episode: null, date: s.air_date.slice(0, 10), note: null });
  }
  const seen = new Set<string>();
  const addEpisode = (e: TmdbEpisodeRef) => {
    if (!isDate(e.air_date) || e.season_number < 1 || e.episode_number <= 1) return;
    const k = `${e.season_number}:${e.episode_number}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ kind: "episode", region: null, season: e.season_number, episode: e.episode_number, date: e.air_date.slice(0, 10), note: null });
  };
  for (const season of seasons) season.episodes.forEach(addEpisode);
  if (details.next_episode_to_air) addEpisode(details.next_episode_to_air);
  return out;
}

/** Season numbers whose episode lists are worth fetching (current or upcoming). */
export function seasonsToFetch(details: TmdbTvDetails, today: string): number[] {
  const set = new Set<number>();
  if (details.next_episode_to_air?.season_number) set.add(details.next_episode_to_air.season_number);
  for (const s of details.seasons ?? []) {
    if (s.season_number >= 1 && isDate(s.air_date) && s.air_date >= today) set.add(s.season_number);
  }
  return [...set].sort((a, b) => a - b);
}
