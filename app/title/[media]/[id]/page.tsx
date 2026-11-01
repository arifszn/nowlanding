import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followTitle, unfollowTitle } from "@/app/actions";
import { getProfile, getTitle, getTrailerKey, getUserId, isFollowing } from "@/lib/data";
import { Poster } from "@/components/poster";
import { Trailer } from "@/components/trailer";
import { ActionSubmit } from "@/components/action-submit";
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
  const year = t.primary_date?.slice(0, 4);
  const status = t.status?.replace(/_/g, " ");

  return (
    <div className="page container">
      <div className="title-head">
        <Poster path={t.poster_path} name={t.name} size="w342" frame priority />
        <div>
          <h1>{t.name}</h1>
          <div className="title-tags" aria-label="Title details">
            <span className="title-pill title-pill--accent">{media === "tv" ? "Series" : "Movie"}</span>
            {status && <span className="title-status">{status}</span>}
          </div>
          <div className="title-facts">
            {year && <span>{year}</span>}
            {t.runtime ? <span>{media === "tv" ? `${t.runtime} min / episode` : `${t.runtime} min`}</span> : null}
            {t.vote_average ? <span>TMDB {t.vote_average.toFixed(1)} / 10</span> : null}
            {media === "tv" && t.number_of_seasons ? <span>{t.number_of_seasons} season{t.number_of_seasons === 1 ? "" : "s"}</span> : null}
          </div>
          {t.genres?.length ? <p className="title-genres">Genres: {t.genres.join(" · ")}</p> : null}
          {t.original_name && t.original_name !== t.name && <p className="title-original muted">Original title: {t.original_name}</p>}
          {t.overview && <p className="title-head__overview">{t.overview}</p>}
          <div className="title-head__actions">
            {!userId ? (
              <Link className="btn" href={`/login?next=/title/${media}/${tmdbId}`}>Sign in to follow</Link>
            ) : following && t.id ? (
              <form action={unfollowTitle}>
                <input type="hidden" name="titleId" value={t.id} />
                <input type="hidden" name="back" value={`/title/${media}/${tmdbId}`} />
                <ActionSubmit className="btn btn--frame" idle="Unfollow" pending="Unfollowing…" />
              </form>
            ) : (
              <form action={followTitle}>
                <input type="hidden" name="media" value={media} />
                <input type="hidden" name="tmdbId" value={tmdbId} />
                <ActionSubmit className="btn" idle="Follow" pending="Following…" />
              </form>
            )}
            {trailerKey && <Trailer videoKey={trailerKey} title={t.name} />}
            {following && <span className="small muted">You get every date for this title.</span>}
          </div>
        </div>
      </div>

      <section className="section title-dates" aria-labelledby="dates-title">
        <div className="section__head">
            <h2 id="dates-title">Release timeline</h2>
        </div>
        <dl className="particulars particulars--timeline" style={{ maxWidth: 760 }}>
          {media === "movie"
            ? movieRows.map(({ kind, row }) => (
              <div className={`particulars__row${row && row.date < today ? " particulars__row--past" : ""}`} key={kind}>
                <dt>{kindLabel({ kind, season: null, episode: null })}</dt>
                <dd>
                  {row ? <>{longDate(row.date)}{row.region && row.region !== region ? ` (${row.region})` : ""}</> : (
                    <span className="muted">Not announced</span>
                  )}
                </dd>
              </div>
            ))
            : tvRows.length
              ? tvRows.map((d) => (
                  <div className={`particulars__row${d.date < today ? " particulars__row--past" : ""}`} key={`${d.kind}-${d.season}-${d.episode}`}>
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
