import type { Metadata } from "next";
import Link from "next/link";
import { markAllRead } from "@/app/actions";
import { getNotifications, getTelegramLink } from "@/lib/data";
import { Poster } from "@/components/poster";
import { describeEvent, timeAgo, titleHref } from "@/lib/format";

export const metadata: Metadata = { title: "Alerts" };

const DELIVERY: Record<string, string> = {
  sent: "Sent to Telegram",
  pending: "Sending to Telegram",
  sending: "Sending to Telegram",
  failed: "Telegram delivery failed",
};

export default async function Notifications() {
  const [items, link] = await Promise.all([getNotifications(), getTelegramLink()]);
  const unread = items.filter((i) => !i.read_at).length;
  return (
    <div className="page container">
      <div className="page__head">
        <h1 className="page__title">Alerts</h1>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn btn--frame btn--small" type="submit">Mark all read</button>
          </form>
        )}
      </div>
      {!link?.active && (
        <p className="notice" style={{ marginBottom: "var(--space-lg)" }}>
          Alerts show here only. <Link href="/settings">Connect Telegram</Link> to get them on your phone.
        </p>
      )}
      {items.length ? (
        <ul className="feed">
          {items.map((n) => (
            <li className="feed__item" key={n.id}>
              {n.read_at ? <span /> : <span className="feed__unread" role="img" aria-label="Unread" />}
              <Poster path={n.title.poster_path} name={n.title.name} size="w92" />
              <div>
                <Link className="table__title" href={titleHref(n.title)}>{n.title.name}</Link>
                <p>{describeEvent(n.event_type, n.payload)}</p>
              </div>
              <div className="feed__time">
                <div>{timeAgo(n.created_at)}</div>
                  {n.status !== "skipped" && <div>{DELIVERY[n.status] ?? n.status}</div>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <h2>No alerts yet</h2>
          <p>Alerts appear when a title you follow, or a popular one, gets a date or comes out.</p>
          <Link className="btn" href="/discover">Find titles to follow</Link>
        </div>
      )}
    </div>
  );
}
