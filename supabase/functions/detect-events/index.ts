// Plans notifications from release dates and inserts them idempotently.
import { withSupabase } from "npm:@supabase/server@1.9.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { addDays } from "../_shared/dates.ts";
import { planEvents, priorKey } from "../_shared/events.ts";
import type { ReleaseDateRow, TitleRow, UserPrefs } from "../_shared/types.ts";

const PAGE = 1000;

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function run(db: SupabaseClient, now = new Date()) {
  const utcToday = now.toISOString().slice(0, 10);
  // Timezones span roughly UTC-12..UTC+14, so look one day either side.
  const from = addDays(utcToday, -1);
  const to = addDays(utcToday, 62); // max reminder_days (60) + slack
  const recent = new Date(now.getTime() - 2 * 86_400_000).toISOString();

  const cols = "id, title_id, kind, region, season, episode, date, previous_date, note, first_seen_at, updated_at";
  const [inWindow, recentlyChanged] = await Promise.all([
    all<ReleaseDateRow>((a, b) => db.from("release_dates").select(cols).gte("date", from).lte("date", to).order("id").range(a, b)),
    all<ReleaseDateRow>((a, b) => db.from("release_dates").select(cols).gte("date", from).gte("updated_at", recent).order("id").range(a, b)),
  ]);
  const dates = [...new Map([...inWindow, ...recentlyChanged].map((d) => [d.id, d])).values()];
  if (!dates.length) return { dates: 0, planned: 0, inserted: 0 };

  const titleIds = [...new Set(dates.map((d) => d.title_id))];
  const titles = new Map<number, TitleRow>();
  for (let i = 0; i < titleIds.length; i += 500) {
    const { data, error } = await db.from("titles")
      .select("id, tmdb_id, media_type, name, poster_path, is_tracked_popular, popular_regions, first_synced_at")
      .in("id", titleIds.slice(i, i + 500));
    if (error) throw error;
    for (const t of data ?? []) titles.set(t.id, t as TitleRow);
  }

  const users = await all<UserPrefs>((a, b) => db.from("profiles")
    .select("id, region, timezone, notify_popular, notify_announced, notify_reminder, notify_released, notify_physical, notify_episodes, reminder_days")
    .order("id").range(a, b));

  const follows = await all<{ user_id: string; title_id: number }>((a, b) =>
    db.from("follows").select("user_id, title_id").in("title_id", titleIds.slice(0, 1000)).order("user_id").range(a, b)
  );
  const followsByUser = new Map<string, Set<number>>();
  for (const f of follows) {
    const s = followsByUser.get(f.user_id) ?? new Set<number>();
    s.add(f.title_id);
    followsByUser.set(f.user_id, s);
  }

  const prior = await all<{ user_id: string; title_id: number; event_type: string; event_key: string }>((a, b) =>
    db.from("notifications").select("user_id, title_id, event_type, event_key")
      .in("title_id", titleIds.slice(0, 1000)).neq("status", "failed").order("id").range(a, b)
  );
  const priorKeys = new Set(prior.map((p) => priorKey(p.user_id, p.title_id, p.event_type as never, p.event_key)));

  const planned = planEvents({ titles, dates, users, followsByUser, priorKeys, now });

  let inserted = 0;
  for (let i = 0; i < planned.length; i += 500) {
    const { data, error } = await db.from("notifications")
      .upsert(planned.slice(i, i + 500), { onConflict: "user_id,title_id,event_type,event_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    inserted += data?.length ?? 0;
  }
  return { dates: dates.length, planned: planned.length, inserted };
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    try {
      return Response.json({ ok: true, ...(await run(ctx.supabaseAdmin)) });
    } catch (e) {
      console.error(e);
      return Response.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }),
};
