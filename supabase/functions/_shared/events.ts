// Pure event planning. No runtime-specific imports (shared by Deno and Vitest).
import { daysBetween, todayIn } from "./dates.ts";
import type {
  EventType,
  PlannedNotification,
  ReleaseDateRow,
  ReleaseKind,
  TitleRow,
  UserPrefs,
} from "./types.ts";

export const FALLBACK_REGION = "US";
const MOVIE_KINDS: ReleaseKind[] = ["theatrical", "digital", "physical"];
/** A date first seen this long after the title's first sync counts as "newly announced". */
const BASELINE_GRACE_MS = 60_000;

export interface PlanInput {
  titles: Map<number, TitleRow>;
  dates: ReleaseDateRow[];
  users: UserPrefs[];
  followsByUser: Map<string, Set<number>>;
  /** Keys of notifications that already exist: `${user}|${title}|${event_type}|${event_key}`. */
  priorKeys: Set<string>;
  now?: Date;
}

export function baseKey(r: Pick<ReleaseDateRow, "kind" | "region" | "season" | "episode">): string {
  return `${r.kind}:${r.region ?? "-"}:${r.season ?? "-"}:${r.episode ?? "-"}`;
}

export function priorKey(userId: string, titleId: number, type: EventType, key: string): string {
  return `${userId}|${titleId}|${type}|${key}`;
}

/** Movie rows for the user's region per kind, falling back to US when the region has none. */
export function selectMovieRows(rows: ReleaseDateRow[], region: string): ReleaseDateRow[] {
  const out: ReleaseDateRow[] = [];
  for (const kind of MOVIE_KINDS) {
    const ofKind = rows.filter((r) => r.kind === kind);
    const local = ofKind.filter((r) => r.region === region);
    const chosen = local.length ? local : ofKind.filter((r) => r.region === FALLBACK_REGION);
    // Several entries of the same kind in one region: keep the earliest.
    chosen.sort((a, b) => a.date.localeCompare(b.date));
    if (chosen[0]) out.push(chosen[0]);
  }
  return out;
}

function isPopularFor(title: TitleRow, region: string): boolean {
  if (!title.is_tracked_popular) return false;
  if (title.media_type === "tv") return true;
  return title.popular_regions.includes(region) || title.popular_regions.includes(FALLBACK_REGION);
}

export function planEvents(input: PlanInput): PlannedNotification[] {
  const now = input.now ?? new Date();
  const byTitle = new Map<number, ReleaseDateRow[]>();
  for (const d of input.dates) {
    const list = byTitle.get(d.title_id) ?? [];
    list.push(d);
    byTitle.set(d.title_id, list);
  }

  const planned: PlannedNotification[] = [];

  for (const user of input.users) {
    const today = todayIn(user.timezone, now);
    const follows = input.followsByUser.get(user.id) ?? new Set<number>();

    for (const [titleId, rows] of byTitle) {
      const title = input.titles.get(titleId);
      if (!title) continue;
      const followed = follows.has(titleId);
      const popular = user.notify_popular && isPopularFor(title, user.region);
      if (!followed && !popular) continue;

      const candidates = title.media_type === "movie"
        ? selectMovieRows(rows, user.region)
        : rows.filter((r) =>
          r.kind === "series_premiere" || r.kind === "season_premiere" ||
          (r.kind === "episode" && followed && user.notify_episodes)
        );

      for (const row of candidates) {
        const d = daysBetween(today, row.date);
        if (d < 0) continue; // never alert on the past (no backfill)

        const base = baseKey(row);
        const emit = (type: EventType, key: string) => {
          if (input.priorKeys.has(priorKey(user.id, titleId, type, key))) return;
          planned.push({
            user_id: user.id,
            title_id: titleId,
            release_date_id: row.id,
            event_type: type,
            event_key: key,
            payload: {
              title: title.name,
              media_type: title.media_type,
              tmdb_id: title.tmdb_id,
              kind: row.kind,
              region: row.region,
              season: row.season,
              episode: row.episode,
              date: row.date,
              previous_date: row.previous_date,
              days_until: d,
            },
          });
        };

        if (row.kind === "physical" && !user.notify_physical) continue;

        if (row.kind === "episode") {
          if (d === 0 && user.notify_released) emit("released", `${base}:${row.date}`);
          continue;
        }

        if (d === 0) {
          if (user.notify_released) emit("released", `${base}:${row.date}`);
          continue;
        }

        // Future date (d > 0)
        const newlySeen = title.first_synced_at !== null &&
          Date.parse(row.first_seen_at) > Date.parse(title.first_synced_at) + BASELINE_GRACE_MS;
        const announcing = newlySeen && user.notify_announced &&
          !input.priorKeys.has(priorKey(user.id, titleId, "announced", base));
        if (announcing) emit("announced", base);

        if (row.previous_date && row.previous_date !== row.date) {
          const alertedBefore =
            input.priorKeys.has(priorKey(user.id, titleId, "announced", base)) ||
            input.priorKeys.has(priorKey(user.id, titleId, "upcoming_reminder", `${base}:${row.previous_date}`));
          if (alertedBefore) emit("date_changed", `${base}:${row.previous_date}>${row.date}`);
        }

        if (!announcing && user.notify_reminder && d <= user.reminder_days) {
          emit("upcoming_reminder", `${base}:${row.date}`);
        }
      }
    }
  }

  return planned;
}
