import Link from "next/link";
import { followTitle, unfollowTitle } from "@/app/actions";
import type { ReleaseEntry } from "@/lib/data";
import { Poster } from "@/components/poster";
import { isToday, kindLabel, relativeDay, shortDate, titleHref } from "@/lib/format";

/** Releases grouped by day, each day's date as the row head. Today's date uses the accent. */
/** Pass `followed` (title ids) and `back` (the current path) to show a Follow/Unfollow button on each row. */
export function ReleaseList({ entries, timezone = "UTC", followed, back }: { entries: ReleaseEntry[]; timezone?: string; followed?: Set<number>; back?: string }) {
  const days = new Map<string, ReleaseEntry[]>();
  for (const e of entries) days.set(e.date, [...(days.get(e.date) ?? []), e]);

  return (
    <div className="release-list">
      {[...days.entries()].map(([date, list]) => {
        const today = isToday(date, timezone);
        return (
          <section className="release-day" key={date} aria-label={relativeDay(date, timezone)}>
            <div className="release-day__date">
              <p className={today ? "date date--today" : "date"}>{shortDate(date)}</p>
              <p className="release-day__weekday">{relativeDay(date, timezone)}</p>
            </div>
            <ul className="release-day__list">
              {list.map((e) => (
                <li className="release-item" key={`${e.title.media_type}-${e.title.tmdb_id}-${e.kind}-${e.season}-${e.episode}`}>
                  <Poster path={e.title.poster_path} name={e.title.name} size="w92" />
                  <div>
                    <Link className="release-item__title" href={titleHref(e.title)}>{e.title.name}</Link>
                    <p className="release-item__kind small">
                      {kindLabel(e)}
                      {e.region ? ` (${e.region})` : ""}
                    </p>
                  </div>
                  <div className="release-item__side">
                    {today && <span className="release-item__today small">Out today</span>}
                    {followed && e.title.id !== null && (
                      followed.has(e.title.id) ? (
                        <form action={unfollowTitle}>
                          <input type="hidden" name="titleId" value={e.title.id} />
                          <input type="hidden" name="back" value={back ?? "/discover"} />
                          <button className="linkish small" type="submit">Unfollow</button>
                        </form>
                      ) : (
                        <form action={followTitle}>
                          <input type="hidden" name="media" value={e.title.media_type} />
                          <input type="hidden" name="tmdbId" value={e.title.tmdb_id} />
                          <input type="hidden" name="back" value={back ?? "/discover"} />
                          <button className="btn btn--frame btn--xs" type="submit">Follow</button>
                        </form>
                      )
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
