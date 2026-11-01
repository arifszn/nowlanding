import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tmdb } from "@/lib/tmdb";
import { addDays, todayIn } from "@/supabase/functions/_shared/dates.ts";
import { FALLBACK_REGION, selectMovieRows } from "@/supabase/functions/_shared/events.ts";
import { mapMovieReleaseDates, mapTvDates, seasonsToFetch, type TmdbMovieReleaseDates, type TmdbSeasonDetails, type TmdbTvDetails } from "@/supabase/functions/_shared/tmdb-map.ts";
import type { MediaType, ReleaseDateRow, ReleaseKind, UserPrefs } from "@/supabase/functions/_shared/types.ts";

export type Profile = UserPrefs;

export interface TitleSummary {
  id: number | null; // null when not cached in our DB yet
  tmdb_id: number;
  media_type: MediaType;
  name: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  status?: string | null;
  primary_date?: string | null;
}

export interface ReleaseEntry {
  title: TitleSummary;
  kind: ReleaseKind;
  region: string | null;
  season: number | null;
  episode: number | null;
  date: string;
}

const RELEASE_KINDS: ReleaseKind[] = ["theatrical", "digital", "physical", "series_premiere", "season_premiere", "episode"];
const TITLE_COLS = "id, tmdb_id, media_type, name, poster_path, backdrop_path, overview, status, primary_date";

export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function getTelegramLink() {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("telegram_links").select("active, chat_id, linked_at").eq("user_id", userId).maybeSingle();
  return data as { active: boolean; chat_id: number | null; linked_at: string | null } | null;
}

export async function getUnreadCount(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

function toEntries(rows: Array<ReleaseDateRow & { titles: TitleSummary }>, region: string, followedOnlyEpisodes: Set<number> | null): ReleaseEntry[] {
  const byTitle = new Map<number, Array<ReleaseDateRow & { titles: TitleSummary }>>();
  for (const r of rows) byTitle.set(r.title_id, [...(byTitle.get(r.title_id) ?? []), r]);
  const out: ReleaseEntry[] = [];
  for (const [titleId, list] of byTitle) {
    const t = list[0].titles;
    const chosen = t.media_type === "movie"
      ? selectMovieRows(list, region)
      : list.filter((r) => r.kind !== "episode" || (followedOnlyEpisodes?.has(titleId) ?? false));
    for (const r of chosen) {
      out.push({ title: t, kind: r.kind, region: r.region, season: r.season, episode: r.episode, date: r.date });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.name.localeCompare(b.title.name));
}

/** Upcoming popular releases (public). */
export async function getPopularReleases(days = 14, region = FALLBACK_REGION, timezone = "UTC"): Promise<ReleaseEntry[]> {
  const today = todayIn(timezone);
  const supabase = await createClient();
  const { data, error } = await supabase.from("release_dates")
    .select(`id, title_id, kind, region, season, episode, date, previous_date, note, first_seen_at, updated_at, titles!inner(${TITLE_COLS}, is_tracked_popular)`)
    .eq("titles.is_tracked_popular", true)
    .in("kind", RELEASE_KINDS)
    .gte("date", today).lte("date", addDays(today, days))
    .order("date").limit(500);
  if (error) throw error;
  // Airing series show only their next episode, and only when they have no premiere in the window.
  const rows = (data ?? []) as unknown as Array<ReleaseDateRow & { titles: TitleSummary }>;
  const hasPremiere = new Set(rows.filter((r) => r.kind !== "episode").map((r) => r.title_id));
  const seenEpisode = new Set<number>();
  const kept = rows.filter((r) => {
    if (r.kind !== "episode") return true;
    if (hasPremiere.has(r.title_id) || seenEpisode.has(r.title_id)) return false;
    seenEpisode.add(r.title_id);
    return true;
  });
  return toEntries(kept, region, seenEpisode);
}

/** Upcoming dates for the titles the user follows. */
export async function getFollowedReleases(days = 120): Promise<ReleaseEntry[]> {
  const userId = await getUserId();
  const profile = await getProfile();
  if (!userId || !profile) return [];
  const today = todayIn(profile.timezone);
  const supabase = await createClient();
  const { data: follows } = await supabase.from("follows").select("title_id").eq("user_id", userId);
  const ids = (follows ?? []).map((f) => f.title_id as number);
  if (!ids.length) return [];
  const { data, error } = await supabase.from("release_dates")
    .select(`id, title_id, kind, region, season, episode, date, previous_date, note, first_seen_at, updated_at, titles!inner(${TITLE_COLS})`)
    .in("title_id", ids).in("kind", RELEASE_KINDS)
    .gte("date", today).lte("date", addDays(today, days))
    .order("date").limit(1000);
  if (error) throw error;
  return toEntries((data ?? []) as never, profile.region, new Set(ids));
}

export async function getFollowing(): Promise<Array<TitleSummary & { next?: ReleaseEntry }>> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("follows")
    .select(`created_at, titles!inner(${TITLE_COLS})`).eq("user_id", userId).order("created_at", { ascending: false });
  const titles = (data ?? []).map((f) => f.titles as unknown as TitleSummary);
  const releases = await getFollowedReleases(3650);
  return titles.map((t) => ({ ...t, next: releases.find((b) => b.title.id === t.id) }));
}

export async function isFollowing(titleId: number | null): Promise<boolean> {
  const userId = await getUserId();
  if (!userId || !titleId) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("title_id").eq("user_id", userId).eq("title_id", titleId).maybeSingle();
  return !!data;
}

export async function getFollowedTitleIds(): Promise<Set<number>> {
  const userId = await getUserId();
  if (!userId) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("title_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.title_id as number));
}

export interface NotificationItem {
  id: number;
  event_type: "announced" | "upcoming_reminder" | "released" | "date_changed";
  payload: import("@/supabase/functions/_shared/types.ts").NotificationPayload;
  status: string;
  read_at: string | null;
  created_at: string;
  title: TitleSummary;
}

export async function getNotifications(limit = 100): Promise<NotificationItem[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications")
    .select(`id, event_type, payload, status, read_at, created_at, titles!inner(${TITLE_COLS})`)
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((n) => ({ ...(n as never as NotificationItem), title: n.titles as unknown as TitleSummary }));
}

export interface TitleDetail {
  title: TitleSummary;
  dates: Array<Pick<ReleaseDateRow, "kind" | "region" | "season" | "episode" | "date" | "note">>;
  live: boolean; // true when read straight from TMDB (not cached yet)
}

/** A title by TMDB id: from the cache when present, otherwise live from TMDB (not stored until followed). */
export async function getTitle(media: MediaType, tmdbId: number, region: string): Promise<TitleDetail | null> {
  const supabase = await createClient();
  const { data: cached } = await supabase.from("titles").select(TITLE_COLS)
    .eq("media_type", media).eq("tmdb_id", tmdbId).maybeSingle();
  if (cached?.id) {
    const { data: rows } = await supabase.from("release_dates")
      .select("kind, region, season, episode, date, note").eq("title_id", cached.id).order("date");
    const dates = (rows ?? []).filter((r) => r.region === null || r.region === region || r.region === FALLBACK_REGION);
    if (dates.length || cached.status) return { title: cached as TitleSummary, dates, live: false };
  }
  try {
    const regions = new Set([region, FALLBACK_REGION]);
    if (media === "movie") {
      const m = await tmdb.get(`movie/${tmdbId}`, { searchParams: { append_to_response: "release_dates" } })
        .json<{ id: number; title: string; poster_path: string | null; backdrop_path: string | null; overview: string; status: string; release_date: string; release_dates: TmdbMovieReleaseDates }>();
      return {
        title: { id: cached?.id ?? null, tmdb_id: m.id, media_type: "movie", name: m.title, poster_path: m.poster_path, backdrop_path: m.backdrop_path, overview: m.overview, status: m.status, primary_date: m.release_date || null },
        dates: mapMovieReleaseDates(m.release_dates, regions).sort((a, b) => a.date.localeCompare(b.date)),
        live: true,
      };
    }
    const d = await tmdb.get(`tv/${tmdbId}`).json<TmdbTvDetails & { poster_path: string | null; backdrop_path: string | null; overview: string; status: string }>();
    const today = new Date().toISOString().slice(0, 10);
    const seasons = await Promise.all(seasonsToFetch(d, today).slice(0, 2).map((n) => tmdb.get(`tv/${tmdbId}/season/${n}`).json<TmdbSeasonDetails>()));
    return {
      title: { id: cached?.id ?? null, tmdb_id: d.id, media_type: "tv", name: d.name, poster_path: d.poster_path, backdrop_path: d.backdrop_path, overview: d.overview, status: d.status, primary_date: d.first_air_date },
      dates: mapTvDates(d, seasons).sort((a, b) => a.date.localeCompare(b.date)),
      live: true,
    };
  } catch {
    return null;
  }
}

/** Ensures a TMDB title exists in our cache and returns its id. Server-only (secret key). */
export async function ensureTitle(media: MediaType, tmdbId: number): Promise<number> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("titles").select("id").eq("media_type", media).eq("tmdb_id", tmdbId).maybeSingle();
  if (existing) return existing.id;
  const item = await tmdb.get(`${media}/${tmdbId}`).json<{ id: number; title?: string; name?: string; original_title?: string; original_name?: string; overview?: string; poster_path?: string | null; backdrop_path?: string | null; popularity?: number; release_date?: string; first_air_date?: string }>();
  const date = media === "movie" ? item.release_date : item.first_air_date;
  const { data, error } = await admin.from("titles").upsert({
    tmdb_id: item.id,
    media_type: media,
    name: (media === "movie" ? item.title : item.name) ?? "Untitled",
    original_name: (media === "movie" ? item.original_title : item.original_name) ?? null,
    overview: item.overview || null,
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    popularity: item.popularity ?? 0,
    primary_date: date ? date.slice(0, 10) : null,
  }, { onConflict: "media_type,tmdb_id" }).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Asks the sync job to fetch these titles now (fire and wait briefly). */
export async function requestSync(titleIds: number[]) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-tmdb`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.SUPABASE_SECRET_KEY! },
      body: JSON.stringify({ titleIds }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // The scheduled refresh picks it up within 10 minutes.
  }
}

interface TmdbVideo { key: string; site: string; type: string; official: boolean; published_at: string }

/** YouTube key of the best trailer on TMDB (official first, then newest), or null. */
export async function getTrailerKey(media: MediaType, tmdbId: number): Promise<string | null> {
  try {
    const r = await tmdb.get(`${media}/${tmdbId}/videos`).json<{ results: TmdbVideo[] }>();
    const rank = (v: TmdbVideo) => (v.type === "Trailer" ? 2 : 0) + (v.official ? 1 : 0);
    const best = r.results
      .filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser") && /^[\w-]{11}$/.test(v.key))
      .sort((a, b) => rank(b) - rank(a) || b.published_at.localeCompare(a.published_at))[0];
    return best?.key ?? null;
  } catch {
    return null;
  }
}
