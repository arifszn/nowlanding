import { describe, expect, it } from "vitest";
import { baseKey, planEvents, priorKey, selectMovieRows } from "./events.ts";
import type { ReleaseDateRow, TitleRow, UserPrefs } from "./types.ts";

const NOW = new Date("2026-11-01T12:00:00Z");
const SYNCED = "2026-10-01T00:00:00Z";

const movie: TitleRow = {
  id: 1, tmdb_id: 100, media_type: "movie", name: "Movie A", poster_path: null,
  is_tracked_popular: false, popular_regions: [], first_synced_at: SYNCED,
};
const series: TitleRow = {
  id: 2, tmdb_id: 200, media_type: "tv", name: "Series B", poster_path: null,
  is_tracked_popular: false, popular_regions: [], first_synced_at: SYNCED,
};

const user: UserPrefs = {
  id: "u1", region: "GB", timezone: "UTC", notify_popular: true, notify_announced: true,
  notify_reminder: true, notify_released: true, notify_physical: true, notify_episodes: true,
  reminder_days: 7,
};

let nextId = 1;
function rd(p: Partial<ReleaseDateRow> & Pick<ReleaseDateRow, "title_id" | "kind" | "date">): ReleaseDateRow {
  return {
    id: nextId++, region: null, season: null, episode: null, previous_date: null, note: null,
    first_seen_at: SYNCED, updated_at: SYNCED, ...p,
  };
}

function plan(dates: ReleaseDateRow[], opts: {
  users?: UserPrefs[]; follows?: number[]; prior?: string[]; titles?: TitleRow[]; now?: Date;
} = {}) {
  const titles = new Map((opts.titles ?? [movie, series]).map((t) => [t.id, t]));
  return planEvents({
    titles,
    dates,
    users: opts.users ?? [user],
    followsByUser: new Map([["u1", new Set(opts.follows ?? [1, 2])]]),
    priorKeys: new Set(opts.prior ?? []),
    now: opts.now ?? NOW,
  });
}

describe("selectMovieRows", () => {
  it("uses the user's region and falls back to US per kind", () => {
    const rows = [
      rd({ title_id: 1, kind: "theatrical", region: "GB", date: "2026-11-10" }),
      rd({ title_id: 1, kind: "theatrical", region: "US", date: "2026-11-05" }),
      rd({ title_id: 1, kind: "digital", region: "US", date: "2026-12-01" }),
      rd({ title_id: 1, kind: "premiere", region: "GB", date: "2026-10-20" }),
    ];
    const out = selectMovieRows(rows, "GB");
    expect(out.map((r) => `${r.kind}:${r.region}`)).toEqual(["theatrical:GB", "digital:US"]);
  });
});

describe("planEvents", () => {
  it("emits released on the day in the user's timezone", () => {
    // 2026-11-01T12:00Z is already 2026-11-02 in Pacific/Auckland (UTC+13).
    const dates = [rd({ title_id: 1, kind: "theatrical", region: "US", date: "2026-11-02" })];
    expect(plan(dates)).toHaveLength(1); // reminder in UTC
    expect(plan(dates)[0].event_type).toBe("upcoming_reminder");
    const nz = plan(dates, { users: [{ ...user, timezone: "Pacific/Auckland" }] });
    expect(nz.map((n) => n.event_type)).toEqual(["released"]);
  });

  it("physical releases notify in the week ahead and on release day", () => {
    const physical = (date: string, extra: Partial<ReleaseDateRow> = {}) =>
      rd({ title_id: 1, kind: "physical", region: "US", date, first_seen_at: "2026-10-31T00:00:00Z", ...extra });
    expect(plan([physical("2026-11-05")]).map((n) => n.event_type)).toEqual(["announced"]);
    expect(plan([physical("2026-11-08", { previous_date: "2026-11-03" })], {
      prior: [priorKey("u1", 1, "announced", "physical:US:-:-")],
    }).map((n) => n.event_type)).toEqual(["date_changed", "upcoming_reminder"]);
    const day = plan([physical("2026-11-01")]);
    expect(day.map((n) => [n.event_type, n.event_key])).toEqual([["released", "physical:US:-:-:2026-11-01"]]);
  });

  it("respects notify_physical", () => {
    const dates = [rd({ title_id: 1, kind: "physical", region: "US", date: "2026-11-01" })];
    expect(plan(dates, { users: [{ ...user, notify_physical: false }] })).toEqual([]);
  });

  it("does not announce dates present at the first sync (baseline)", () => {
    const dates = [rd({ title_id: 1, kind: "theatrical", region: "US", date: "2027-03-01", first_seen_at: SYNCED })];
    expect(plan(dates)).toEqual([]);
  });

  it("announces a future date that appeared after the baseline, without a same-run reminder", () => {
    const dates = [rd({ title_id: 1, kind: "theatrical", region: "US", date: "2026-11-04", first_seen_at: "2026-10-31T00:00:00Z" })];
    expect(plan(dates).map((n) => n.event_type)).toEqual(["announced"]);
  });

  it("sends a reminder once per date, inside the window only", () => {
    const row = rd({ title_id: 1, kind: "digital", region: "US", date: "2026-11-08" });
    expect(plan([row]).map((n) => n.event_key)).toEqual(["digital:US:-:-:2026-11-08"]);
    expect(plan([row], { prior: [priorKey("u1", 1, "upcoming_reminder", "digital:US:-:-:2026-11-08")] })).toEqual([]);
    expect(plan([{ ...row, date: "2026-11-09" }])).toEqual([]); // 8 days out
  });

  it("emits date_changed only if the user was alerted about the old date", () => {
    const row = rd({ title_id: 1, kind: "theatrical", region: "US", date: "2027-01-10", previous_date: "2026-12-01" });
    expect(plan([row])).toEqual([]);
    const out = plan([row], { prior: [priorKey("u1", 1, "announced", baseKey(row))] });
    expect(out.map((n) => [n.event_type, n.event_key])).toEqual([
      ["date_changed", "theatrical:US:-:-:2026-12-01>2027-01-10"],
    ]);
  });

  it("never alerts on past dates (no episode backfill on follow)", () => {
    const eps = [1, 2, 3].map((e) =>
      rd({ title_id: 2, kind: "episode", season: 1, episode: e, date: `2026-10-0${e}`, first_seen_at: "2026-10-31T00:00:00Z" })
    );
    expect(plan(eps)).toEqual([]);
  });

  it("episodes: release day only, followers only", () => {
    const ep = rd({ title_id: 2, kind: "episode", season: 2, episode: 4, date: "2026-11-01" });
    expect(plan([ep]).map((n) => n.event_key)).toEqual(["episode:-:2:4:2026-11-01"]);
    const popularSeries = { ...series, is_tracked_popular: true };
    expect(plan([ep], { follows: [], titles: [movie, popularSeries] })).toEqual([]);
    expect(plan([ep], { users: [{ ...user, notify_episodes: false }] })).toEqual([]);
  });

  it("popular titles reach non-followers with notify_popular, by region for movies", () => {
    const pm = { ...movie, is_tracked_popular: true, popular_regions: ["DE"] };
    const row = rd({ title_id: 1, kind: "theatrical", region: "US", date: "2026-11-01" });
    expect(plan([row], { follows: [], titles: [pm, series] })).toEqual([]); // not popular in GB or US
    const pmUS = { ...pm, popular_regions: ["US"] };
    expect(plan([row], { follows: [], titles: [pmUS, series] })).toHaveLength(1);
    expect(plan([row], { follows: [], titles: [pmUS, series], users: [{ ...user, notify_popular: false }] })).toEqual([]);
  });

  it("season premieres go to popular-series subscribers", () => {
    const ps = { ...series, is_tracked_popular: true };
    const row = rd({ title_id: 2, kind: "season_premiere", season: 3, date: "2026-11-05" });
    expect(plan([row], { follows: [], titles: [movie, ps]}).map((n) => n.event_type)).toEqual(["upcoming_reminder"]);
  });
});
