import { describe, expect, it } from "vitest";
import { buildMessage, type MessageRow } from "./message.ts";

const row = (id: number, title: string, poster: string | null = `/p${id}.jpg`): MessageRow => ({
  title_id: id,
  event_type: "released",
  poster_path: poster,
  payload: { title, media_type: "movie", tmdb_id: 100 + id, kind: "physical", region: "US", season: null, episode: null, date: "2026-11-01" },
});

describe("buildMessage", () => {
  it("lists every row and one poster per title when it fits", () => {
    const { html, photos } = buildMessage([row(1, "A & B"), row(2, "C"), row(1, "A & B")], "https://x.app", 1024);
    expect(html.split("\n")).toHaveLength(3);
    expect(html).toContain("A &amp; B");
    expect(html).toContain("Physical release (Blu-ray/DVD) out today (US)");
    expect(photos).toEqual(["https://image.tmdb.org/t/p/w500/p1.jpg", "https://image.tmdb.org/t/p/w500/p2.jpg"]);
  });

  it("stays within the caption limit and points to the web feed for the rest", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(i + 1, `Title number ${i + 1}`));
    const { html, photos } = buildMessage(rows, "https://x.app", 1024);
    expect(html.length).toBeLessThanOrEqual(1024);
    expect(html).toMatch(/…and \d+ more on <a href="https:\/\/x.app\/notifications">NowLanding<\/a>$/);
    expect(photos.length).toBeLessThanOrEqual(10);
  });

  it("skips titles without posters", () => {
    expect(buildMessage([row(1, "A", null)], "https://x.app", 1024).photos).toEqual([]);
  });
});
