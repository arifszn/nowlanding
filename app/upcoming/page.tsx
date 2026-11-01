import type { Metadata } from "next";
import Link from "next/link";
import { getFollowedReleases, getProfile } from "@/lib/data";
import { ReleaseList } from "@/components/release-list";

export const metadata: Metadata = { title: "My upcoming" };

export default async function Upcoming() {
  const [profile, releases] = await Promise.all([getProfile(), getFollowedReleases(120)]);
  return (
    <div className="page container">
      <div className="page__head">
        <h1 className="page__title">My upcoming</h1>
        <span className="small muted">Next 120 days for the titles you follow</span>
      </div>
      {releases.length ? (
        <ReleaseList entries={releases} timezone={profile?.timezone} />
      ) : (
        <div className="empty">
          <h2>Nothing upcoming yet</h2>
          <p>Follow a movie or series and its dates show up here.</p>
          <Link className="btn" href="/discover">Find titles to follow</Link>
        </div>
      )}
    </div>
  );
}
