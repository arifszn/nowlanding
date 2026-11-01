import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followTitle, unfollowTitle } from "@/app/actions";
import { getProfile, getTitle, getTrailerKey, getUserId, isFollowing } from "@/lib/data";
import { Poster } from "@/components/poster";
import { Trailer } from "@/components/trailer";
import { kindLabel, longDate } from "@/lib/format";
import type { ReleaseKind } from "@/supabase/functions/_shared/types.ts";

type Params = Promise<{ media: string; id: string }>;

const MOVIE_ROWS: ReleaseKind[] = ["theatrical", "digital", "physical"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { media, id } = await params;
  if (media !== "movie" && media !== "tv") return {};
  const t = await getTitle(media, Number(id), "US");
  return { title: t?.title.name ?? "Title" };
}

export default async function TitlePage({ params }: { params: Params }) {
  const { media, id } = await params;
  const tmdbId = Number(id);
  if ((media !== "movie" && media !== "tv") || !Number.isInteger(tmdbId)) notFound();
  const profile = await getProfile();
  const region = profile?.region ?? "US";
  const detail = await getTitle(media, tmdbId, region);
  if (!detail) notFound();
  const [userId, following, trailerKey] = await Promise.all([getUserId(), isFollowing(detail.title.id), getTrailerKey(media, tmdbId)]);
  const t = detail.title;
  const today = new Date().toISOString().slice(0, 10);

  // Movies: one row per kind in the user's region; unknown dates show "Not announced".
  const movieRows = MOVIE_ROWS.map((kind) => {
    const local = detail.dates.find((d) => d.kind === kind && d.region === region);
    const us = detail.dates.find((d) => d.kind === kind && d.region === "US");
    return { kind, row: local ?? us };
  });
  const tvRows = detail.dates.filter((d) => d.kind !== "episode" || d.date >= today).slice(-12);

  return (
    <div className="page container">
      <div className="title-head">
        <Poster path={t.poster_path} name={t.name} size="w342" frame priority />
        <div>
          <h1>{t.name}</h1>
          <p className="title-head__meta muted">
            {media === "tv" ? "Series" : "Movie"}{t.status ? `, ${t.status.toLowerCase()}` : ""}
          </p>
          {t.overview && <p className="title-head__overview">{t.overview}</p>}
          <div className="title-head__actions">
            {!userId ? (
              <Link className="btn" href={`/login?next=/title/${media}/${tmdbId}`}>Sign in to follow</Link>
            ) : following && t.id ? (
              <form action={unfollowTitle}>
                <input type="hidden" name="titleId" value={t.id} />
                <input type="hidden" name="back" value={`/title/${media}/${tmdbId}`} />
                <button className="btn btn--frame" type="submit">Unfollow</button>
              </form>
            ) : (
              <form action={followTitle}>
                <input type="hidden" name="media" value={media} />
                <input type="hidden" name="tmdbId" value={tmdbId} />
                <button className="btn" type="submit">Follow</button>
              </form>
            )}
            {trailerKey && <Trailer videoKey={trailerKey} title={t.name} />}
            {following && <span className="small muted">You get every date for this title.</span>}
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="dates-title">
        <div className="section__head">
          <h2 id="dates-title">Dates</h2>
        </div>
        <dl className="particulars" style={{ maxWidth: 760 }}>
          {media === "movie"
            ? movieRows.map(({ kind, row }) => (
              <div className="particulars__row" key={kind}>
                <dt>{kindLabel({ kind, season: null, episode: null })}</dt>
                <dd>
                  {row ? `${longDate(row.date)}${row.region && row.region !== region ? ` (${row.region})` : ""}` : (
                    <span className="muted">Not announced</span>
                  )}
                </dd>
              </div>
            ))
            : tvRows.length
              ? tvRows.map((d) => (
                <div className="particulars__row" key={`${d.kind}-${d.season}-${d.episode}`}>
                  <dt>{kindLabel(d)}</dt>
                  <dd>{longDate(d.date)}</dd>
                </div>
              ))
              : (
                <div className="particulars__row">
                  <dt>Next air date</dt>
                  <dd><span className="muted">Not announced</span></dd>
                </div>
              )}
        </dl>
      </section>
    </div>
  );
}
