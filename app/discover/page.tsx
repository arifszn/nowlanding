import Link from "next/link";
import type { Metadata } from "next";
import { getFollowedTitleIds, getPopularReleases, getProfile } from "@/lib/data";
import { MIN_QUERY, searchTitles } from "@/lib/search";
import { LiveSearch } from "@/components/live-search";
import { ReleaseList } from "@/components/release-list";

export const metadata: Metadata = { title: "Discover" };

export default async function Discover({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; view?: string }> }) {
  const { q = "", type, view } = await searchParams;
  const query = q.trim().slice(0, 100);
  const profile = await getProfile();
  const kind = type === "movie" || type === "tv" ? type : "all";
  const homeOnly = view === "home";
  const [results, releases, followed] = await Promise.all([
    query.length >= MIN_QUERY ? searchTitles(query) : Promise.resolve(null),
    getPopularReleases(30, profile?.region, profile?.timezone),
    getFollowedTitleIds(),
  ]);
  const filtered = releases.filter((b) => {
    const matchesType = kind === "all" || b.title.media_type === kind;
    const matchesView = !homeOnly || b.title.media_type === "tv" || b.kind === "digital";
    return matchesType && matchesView;
  });
  const tab = (t: string) => {
    const params = new URLSearchParams();
    if (t !== "all") params.set("type", t);
    if (homeOnly) params.set("view", "home");
    const query = params.toString();
    return query ? `/discover?${query}` : "/discover";
  };
  const viewTab = (home: boolean) => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("type", kind);
    if (home) params.set("view", "home");
    const query = params.toString();
    return query ? `/discover?${query}` : "/discover";
  };

  return (
    <div className="page container">
      <LiveSearch initialQuery={query} initialResults={results}>
      <div className="discover-head">
        <div>
            <h1>Discover what to watch next</h1>
          <p className="discover-head__lead">
            {homeOnly
              ? "Digital releases and new episodes, without the cinema-only dates."
              : "A simple timeline of what’s arriving soon."}
          </p>
        </div>
        <nav className="view-switch" aria-label="Choose how you watch">
          <Link href={viewTab(false)} aria-current={!homeOnly ? "page" : undefined}>All releases</Link>
          <Link href={viewTab(true)} aria-current={homeOnly ? "page" : undefined}>At home</Link>
        </nav>
      </div>
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
          <p>{homeOnly ? "No digital releases or episodes are scheduled in this window yet." : "Popular releases appear here after the first daily sync. Search for a title above in the meantime."}</p>
        </div>
      )}
      </LiveSearch>
    </div>
  );
}
