import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/upcoming", "/x")).toBe("/upcoming");
    expect(safeNext("/title/movie/1?a=1#b", "/x")).toBe("/title/movie/1?a=1#b");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "/a\\b", "/a\nb", ""])(
    "falls back for %j",
    (value) => expect(safeNext(value, "/x")).toBe("/x"),
  );

  it("falls back for missing values", () => {
    expect(safeNext(undefined, "/x")).toBe("/x");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});
