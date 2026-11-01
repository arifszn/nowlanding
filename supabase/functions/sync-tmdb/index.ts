// Discovers popular upcoming titles and refreshes release dates for tracked titles.
// Body: { "mode": "discover" } finds popular titles (daily);
//       {} or { "mode": "refresh" } re-fetches up to REFRESH_BATCH due titles (every few minutes);
//       { "titleIds": number[] } syncs specific titles on demand (e.g. after a follow).
import { withSupabase } from "npm:@supabase/server@1.9.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { addDays } from "../_shared/dates.ts";
import { TmdbClient, type TmdbListItem, type TmdbPage } from "../_shared/tmdb.ts";
import {
  mapMovieReleaseDates,
  mapTvDates,
  seasonsToFetch,
  type TmdbMovieReleaseDates,
  type TmdbSeasonDetails,
  type TmdbTvDetails,
} from "../_shared/tmdb-map.ts";
import type { MediaType, ReleaseDateInput } from "../_shared/types.ts";

const POPULAR_PER_LIST = 50;
const WINDOW_DAYS = 180;
const REFRESH_HOURS = 20; // every tracked title is re-fetched daily (well inside TMDB's 6-month cache limit)
const REFRESH_BATCH = 25; // keeps each invocation under the Edge Function CPU limit
const PURGE_DAYS = 180;

type Admin = SupabaseClient;

interface TitleUpsert {
  tmdb_id: number;
  media_type: MediaType;
  name: string;
  original_name: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
  primary_date: string | null;
  is_tracked_popular?: boolean;
  popular_regions?: string[];
}

function toTitle(item: TmdbListItem, media: MediaType): TitleUpsert {
  const date = media === "movie" ? item.release_date : item.first_air_date;
  return {
    tmdb_id: item.id,
    media_type: media,
    name: (media === "movie" ? item.title : item.name) ?? "Untitled",
    original_name: (media === "movie" ? item.original_title : item.original_name) ?? null,
    overview: item.overview || null,
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    popularity: item.popularity ?? 0,
    primary_date: date ? date.slice(0, 10) : null,
  };
}

async function topPages(tmdb: TmdbClient, path: string, params: Record<string, string>, limit: number) {
  const out: TmdbListItem[] = [];
  for (let page = 1; out.length < limit && page <= 5; page++) {
    const r = await tmdb.get<TmdbPage<TmdbListItem>>(path, { ...params, page });
    out.push(...r.results);
    if (page >= r.total_pages) break;
  }
  return out.slice(0, limit);
}

async function discoverPopular(tmdb: TmdbClient, regions: string[], today: string) {
  const until = addDays(today, WINDOW_DAYS);
  const movies = new Map<number, { item: TmdbListItem; regions: string[] }>();
  for (const region of regions) {
    const items = await topPages(tmdb, "/discover/movie", {
      region,
      with_release_type: "3|2",
      "release_date.gte": today,
      "release_date.lte": until,
      sort_by: "popularity.desc",
      include_adult: "false",
    }, POPULAR_PER_LIST);
    for (const item of items) {
      const e = movies.get(item.id) ?? { item, regions: [] };
      e.regions.push(region);
      movies.set(item.id, e);
    }
  }
  const newSeries = await topPages(tmdb, "/discover/tv", {
    "first_air_date.gte": today,
    "first_air_date.lte": until,
    sort_by: "popularity.desc",
    include_adult: "false",
  }, POPULAR_PER_LIST);
  // Returning series with episodes in the next 60 days (season premieres).
  const returning = await topPages(tmdb, "/discover/tv", {
    "air_date.gte": today,
    "air_date.lte": addDays(today, 60),
    sort_by: "popularity.desc",
    include_adult: "false",
  }, POPULAR_PER_LIST);
  const series = new Map<number, TmdbListItem>();
  for (const s of [...newSeries, ...returning]) series.set(s.id, s);

  const rows: TitleUpsert[] = [
    ...[...movies.values()].map(({ item, regions }) => ({ ...toTitle(item, "movie"), is_tracked_popular: true, popular_regions: regions })),
    ...[...series.values()].map((item) => ({ ...toTitle(item, "tv"), is_tracked_popular: true, popular_regions: [] })),
  ];
  return rows;
}

const rowKey = (r: { kind: string; region: string | null; season: number | null; episode: number | null }) =>
  `${r.kind}|${r.region ?? ""}|${r.season ?? ""}|${r.episode ?? ""}`;

async function reconcile(db: Admin, titleId: number, inputs: ReleaseDateInput[]) {
  const { data: existing, error } = await db.from("release_dates")
    .select("id, kind, region, season, episode, date").eq("title_id", titleId);
  if (error) throw error;
  const byKey = new Map((existing ?? []).map((r) => [rowKey(r), r]));
  const seen = new Set<string>();
  const inserts: Record<string, unknown>[] = [];
  for (const input of inputs) {
    const key = rowKey(input);
    seen.add(key);
    const prev = byKey.get(key);
    if (!prev) {
      inserts.push({ title_id: titleId, ...input });
    } else if (prev.date !== input.date) {
      const { error: e } = await db.from("release_dates")
        .update({ date: input.date, previous_date: prev.date, note: input.note, updated_at: new Date().toISOString() })
        .eq("id", prev.id);
      if (e) throw e;
    }
  }
  if (inserts.length) {
    const { error: e } = await db.from("release_dates").insert(inserts);
    if (e) throw e;
  }
  const stale = (existing ?? []).filter((r) => !seen.has(rowKey(r))).map((r) => r.id);
  if (stale.length) {
    const { error: e } = await db.from("release_dates").delete().in("id", stale);
    if (e) throw e;
  }
}

async function syncTitle(
  db: Admin,
  tmdb: TmdbClient,
  t: { id: number; tmdb_id: number; media_type: MediaType; first_synced_at: string | null },
  regions: Set<string>,
  followed: boolean,
  today: string,
) {
  let inputs: ReleaseDateInput[];
  let meta: Partial<TitleUpsert> & { status?: string | null };
  if (t.media_type === "movie") {
    const m = await tmdb.get<TmdbListItem & { status?: string; release_dates?: TmdbMovieReleaseDates }>(
      `/movie/${t.tmdb_id}`, { append_to_response: "release_dates" },
    );
    inputs = mapMovieReleaseDates(m.release_dates, regions);
    meta = { ...toTitle(m, "movie"), status: m.status ?? null };
  } else {
    const d = await tmdb.get<TmdbTvDetails & TmdbListItem>(`/tv/${t.tmdb_id}`);
    const seasons: TmdbSeasonDetails[] = followed
      ? await Promise.all(seasonsToFetch(d, today).map((n) => tmdb.get<TmdbSeasonDetails>(`/tv/${t.tmdb_id}/season/${n}`)))
      : [];
    inputs = mapTvDates(d, seasons);
    meta = { ...toTitle(d, "tv"), status: d.status ?? null };
  }
  await reconcile(db, t.id, inputs);
  const now = new Date().toISOString();
  const { tmdb_id: _a, media_type: _b, ...fields } = meta as TitleUpsert & { status?: string | null };
  const { error } = await db.from("titles").update({
    ...fields,
    last_synced_at: now,
    first_synced_at: t.first_synced_at ?? now,
  }).eq("id", t.id);
  if (error) throw error;
}

type Mode = "discover" | "refresh";

async function run(db: Admin, tmdb: TmdbClient, mode: Mode, titleIds?: number[]) {
  const today = new Date().toISOString().slice(0, 10);
  const stats = { mode: titleIds ? "titles" : mode, discovered: 0, synced: 0, failed: 0, purged: 0, remaining: 0 };

  const { data: profileRegions, error: pErr } = await db.from("profiles").select("region");
  if (pErr) throw pErr;
  const regions = [...new Set(["US", ...(profileRegions ?? []).map((p) => p.region as string)])].sort();

  const { data: followRows, error: fErr } = await db.from("follows").select("title_id");
  if (fErr) throw fErr;
  const followedIds = new Set((followRows ?? []).map((f) => f.title_id as number));

  if (!titleIds && mode === "discover") {
    const popular = await discoverPopular(tmdb, regions, today);
    stats.discovered = popular.length;
    if (popular.length) {
      const { error } = await db.from("titles").upsert(popular, { onConflict: "media_type,tmdb_id" });
      if (error) throw error;
    }
    // Un-flag titles that dropped out of the popular set.
    const keep = new Set(popular.map((p) => `${p.media_type}:${p.tmdb_id}`));
    const { data: flagged } = await db.from("titles").select("id, media_type, tmdb_id").eq("is_tracked_popular", true);
    const drop = (flagged ?? []).filter((t) => !keep.has(`${t.media_type}:${t.tmdb_id}`)).map((t) => t.id);
    for (let i = 0; i < drop.length; i += 200) {
      await db.from("titles").update({ is_tracked_popular: false, popular_regions: [] }).in("id", drop.slice(i, i + 200));
    }
    // Purge untracked, unfollowed titles not refreshed within TMDB's 6-month cache limit.
    const cutoff = new Date(Date.now() - PURGE_DAYS * 86_400_000).toISOString();
    const { data: old } = await db.from("titles").select("id")
      .eq("is_tracked_popular", false)
      .or(`last_synced_at.lt.${cutoff},and(last_synced_at.is.null,created_at.lt.${cutoff})`);
    const purge = (old ?? []).map((t) => t.id).filter((id) => !followedIds.has(id));
    if (purge.length) {
      await db.from("titles").delete().in("id", purge);
      stats.purged = purge.length;
    }
    await db.from("sync_state").upsert({ job: "discover", last_success_at: new Date().toISOString(), details: stats });
    return stats;
  }

  // Refresh: titles never synced or older than REFRESH_HOURS, popular or followed, oldest first.
  let toSync: Array<{ id: number; tmdb_id: number; media_type: MediaType; first_synced_at: string | null }>;
  if (titleIds) {
    const { data, error } = await db.from("titles").select("id, tmdb_id, media_type, first_synced_at").in("id", titleIds);
    if (error) throw error;
    toSync = (data ?? []) as typeof toSync;
  } else {
    const dueBefore = new Date(Date.now() - REFRESH_HOURS * 3_600_000).toISOString();
    const followed = [...followedIds];
    let q = db.from("titles").select("id, tmdb_id, media_type, first_synced_at", { count: "exact" })
      .or(`last_synced_at.is.null,last_synced_at.lt.${dueBefore}`);
    q = followed.length
      ? q.or(`is_tracked_popular.eq.true,id.in.(${followed.join(",")})`)
      : q.eq("is_tracked_popular", true);
    const { data, error, count } = await q.order("last_synced_at", { ascending: true, nullsFirst: true }).limit(REFRESH_BATCH);
    if (error) throw error;
    toSync = (data ?? []) as typeof toSync;
    stats.remaining = Math.max(0, (count ?? 0) - toSync.length);
  }

  const regionSet = new Set(regions);
  const results = await Promise.allSettled(toSync.map((t) =>
    syncTitle(db, tmdb, t, regionSet, followedIds.has(t.id), today)
  ));
  for (const [i, r] of results.entries()) {
    if (r.status === "fulfilled") stats.synced++;
    else {
      stats.failed++;
      console.error(`sync failed for title ${toSync[i].id}:`, r.reason);
    }
  }
  return stats;
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const token = Deno.env.get("TMDB_READ_TOKEN");
    if (!token) return Response.json({ error: "TMDB_READ_TOKEN not set" }, { status: 500 });
    let titleIds: number[] | undefined;
    let mode: Mode = "refresh";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.mode === "discover") mode = "discover";
      if (Array.isArray(body?.titleIds)) titleIds = body.titleIds.map(Number).filter(Number.isFinite).slice(0, REFRESH_BATCH);
    }
    try {
      const stats = await run(ctx.supabaseAdmin, new TmdbClient(token), mode, titleIds);
      return Response.json({ ok: true, ...stats });
    } catch (e) {
      console.error(e);
      return Response.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }),
};
