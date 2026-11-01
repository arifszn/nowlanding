import Link from "next/link";
import { getPopularReleases, getUserId } from "@/lib/data";
import { Poster } from "@/components/poster";
import { isToday, kindLabel, relativeDay, shortDate, titleHref } from "@/lib/format";

const SENDS: Array<[string, string]> = [
  ["In theaters", "A week ahead and on the day"],
  ["Digital", "A week ahead and on the day"],
  ["Blu-ray and DVD", "On release day only"],
  ["New series", "When announced, a week ahead, on the day"],
  ["New episodes", "On air day, for series you follow"],
];

export default async function Home() {
  const [userId, all] = await Promise.all([getUserId(), getPopularReleases(21)]);
  const releases = all.filter((b) => b.kind !== "episode");
  const next = releases.find((b) => b.title.media_type === "movie" && b.title.poster_path) ?? releases.find((b) => b.title.poster_path) ?? releases[0];
  const days = [...new Set(releases.map((b) => b.date))].slice(0, 3);

  return (
    <>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero__grid">
          <div>
            <h1 id="hero-title" className="hero__head">Know the day it lands</h1>
            <p className="hero__lead">Theaters, streaming, Blu-ray and new episodes. Alerts on Telegram or in the app.</p>
            <div className="hero__actions">
              {userId ? (
                <Link className="btn" href="/upcoming">Open my upcoming</Link>
              ) : (
                <Link className="btn" href="/login">Get started</Link>
              )}
              <Link className="btn btn--frame" href="/discover">See what is coming</Link>
            </div>
          </div>
          {next && (
            <div className="hero__next">
              <div className="hero__next-date">
                <p className="hero__next-label">Next up</p>
                <p className={isToday(next.date) ? "date date--today" : "date"}>{shortDate(next.date)}</p>
                <p className="hero__next-title">{next.title.name}</p>
                <p className="small muted">{kindLabel(next)}{next.region ? ` (${next.region})` : ""}, {relativeDay(next.date)}</p>
              </div>
              <Link href={titleHref(next.title)} aria-label={next.title.name}>
                <Poster path={next.title.poster_path} name={next.title.name} size="w342" frame priority />
              </Link>
            </div>
          )}
        </div>
      </section>

      {days.length > 0 && (
        <section className="section container" aria-labelledby="week-title">
          <div className="section__head">
            <h2 id="week-title">The next three days</h2>
            <Link href="/discover">See everything</Link>
          </div>
          <div className="week">
            {days.map((date) => (
              <div className="week__col" key={date}>
                <p className={isToday(date) ? "date date--today" : "date"}>{shortDate(date)}</p>
                <p className="release-day__weekday">{relativeDay(date)}</p>
                <ul className="week__list">
                  {releases.filter((b) => b.date === date).slice(0, 6).map((b) => (
                    <li key={`${b.title.tmdb_id}-${b.kind}`}>
                      <Link href={titleHref(b.title)}>{b.title.name}</Link>
                      <p className="small muted">{kindLabel(b)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section container" aria-labelledby="sends-title">
        <div className="section__head">
          <h2 id="sends-title">What the bot sends</h2>
        </div>
        <dl className="particulars" style={{ maxWidth: 760 }}>
          {SENDS.map(([k, v]) => (
            <div className="particulars__row" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
