import Link from "next/link";
import type { Metadata } from "next";
import { getFollowedTitleIds, getPopularReleases, getProfile } from "@/lib/data";
import { MIN_QUERY, searchTitles } from "@/lib/search";
import { LiveSearch } from "@/components/live-search";
import { ReleaseList } from "@/components/release-list";

export const metadata: Metadata = { title: "Discover" };

export default async function Discover({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const { q = "", type } = await searchParams;
  const query = q.trim().slice(0, 100);
  const profile = await getProfile();
  const kind = type === "movie" || type === "tv" ? type : "all";
  const [results, releases, followed] = await Promise.all([
    query.length >= MIN_QUERY ? searchTitles(query) : Promise.resolve(null),
    getPopularReleases(30, profile?.region, profile?.timezone),
    getFollowedTitleIds(),
  ]);
  const filtered = releases.filter((b) => kind === "all" || b.title.media_type === kind);
  const tab = (t: string) => (t === "all" ? "/discover" : `/discover?type=${t}`);

  return (
    <div className="page container">
      <LiveSearch initialQuery={query} initialResults={results}>
      <nav className="tabs" aria-label="Filter releases">
        {(["all", "movie", "tv"] as const).map((t) => (
          <Link key={t} href={tab(t)} aria-current={kind === t ? "page" : undefined}>
            {t === "all" ? "Everything" : t === "movie" ? "Movies" : "Series"}
          </Link>
        ))}
      </nav>
      {filtered.length ? (
        <ReleaseList entries={filtered} timezone={profile?.timezone} followed={followed} back={tab(kind)} />
      ) : (
        <div className="empty">
          <h2>Nothing here yet</h2>
          <p>Popular releases appear here after the first daily sync. Search for a title above in the meantime.</p>
        </div>
      )}
      </LiveSearch>
    </div>
  );
}
