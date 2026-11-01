import type { Metadata } from "next";
import Link from "next/link";
import { unfollowTitle } from "@/app/actions";
import { ActionSubmit } from "@/components/action-submit";
import { getFollowing } from "@/lib/data";
import { Poster } from "@/components/poster";
import { kindLabel, longDate, titleHref } from "@/lib/format";

export const metadata: Metadata = { title: "Following" };

export default async function Following() {
  const titles = await getFollowing();
  return (
    <div className="page container">
      <div className="page__head">
        <h1 className="page__title">Following</h1>
        <span className="small muted">{titles.length} {titles.length === 1 ? "title" : "titles"}</span>
      </div>
      {titles.length ? (
        <table className="table">
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">Poster</span></th>
              <th scope="col">Title</th>
              <th scope="col" className="hide-sm">Type</th>
              <th scope="col">Next date</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {titles.map((t) => (
              <tr key={t.id}>
                <td style={{ width: 60 }}><Poster path={t.poster_path} name={t.name} size="w92" /></td>
                <td><Link className="table__title" href={titleHref(t)}>{t.name}</Link></td>
                <td className="hide-sm muted">{t.media_type === "tv" ? "Series" : "Movie"}</td>
                <td className="num">
                  {t.next ? <>{longDate(t.next.date)}<br /><span className="small muted">{kindLabel(t.next)}</span></> : <span className="muted">Not announced</span>}
                </td>
                <td style={{ textAlign: "right" }}>
                  <form action={unfollowTitle}>
                    <input type="hidden" name="titleId" value={t.id ?? ""} />
                  <ActionSubmit className="linkish small" idle={<>Unfollow<span className="visually-hidden"> {t.name}</span></>} pending="Unfollowing…" />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">
          <h2>You are not following anything</h2>
          <p>Follow a title to get every date for it, including each new episode.</p>
          <Link className="btn" href="/discover">Find titles to follow</Link>
        </div>
      )}
    </div>
  );
}
