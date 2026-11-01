import { describe, expect, it } from "vitest";
import { mapMovieReleaseDates, mapTvDates, seasonsToFetch } from "./tmdb-map.ts";

describe("mapMovieReleaseDates", () => {
  it("maps types, filters regions, keeps earliest per kind", () => {
    const out = mapMovieReleaseDates({
      results: [
        { iso_3166_1: "US", release_dates: [
          { type: 3, release_date: "2026-12-18T00:00:00.000Z" },
          { type: 3, release_date: "2026-12-11T00:00:00.000Z", note: "early" },
          { type: 5, release_date: "2027-03-02T00:00:00.000Z", note: "Blu-ray" },
          { type: 9, release_date: "2027-01-01T00:00:00.000Z" },
        ] },
        { iso_3166_1: "FR", release_dates: [{ type: 3, release_date: "2026-12-20T00:00:00.000Z" }] },
      ],
    }, new Set(["US", "GB"]));
    expect(out).toEqual([
      { kind: "theatrical", region: "US", season: null, episode: null, date: "2026-12-11", note: "early" },
      { kind: "physical", region: "US", season: null, episode: null, date: "2027-03-02", note: "Blu-ray" },
    ]);
  });
});

describe("mapTvDates", () => {
  const details = {
    id: 1, name: "S", first_air_date: "2024-01-05",
    seasons: [
      { season_number: 0, air_date: "2023-12-01" },
      { season_number: 1, air_date: "2024-01-05" },
      { season_number: 2, air_date: "2026-11-20" },
      { season_number: 3, air_date: null },
    ],
    next_episode_to_air: { season_number: 2, episode_number: 1, air_date: "2026-11-20" },
  };

  it("emits series and season premieres without duplicating episode 1", () => {
    const out = mapTvDates(details, [{ season_number: 2, episodes: [
      { season_number: 2, episode_number: 1, air_date: "2026-11-20" },
      { season_number: 2, episode_number: 2, air_date: "2026-11-27" },
      { season_number: 2, episode_number: 3, air_date: null },
    ] }]);
    expect(out.map((r) => `${r.kind}:${r.season}:${r.episode}:${r.date}`)).toEqual([
      "series_premiere:null:null:2024-01-05",
      "season_premiere:2:null:2026-11-20",
      "episode:2:2:2026-11-27",
    ]);
  });

  it("picks current and upcoming seasons to fetch", () => {
    expect(seasonsToFetch(details, "2026-11-01")).toEqual([2]);
  });
});
