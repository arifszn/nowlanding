// Pure Telegram message building. No runtime-specific imports (shared by Deno and Vitest).
import { describeEvent } from "./format.ts";
import type { EventType, NotificationPayload } from "./types.ts";

export interface MessageRow {
  title_id: number;
  event_type: EventType;
  payload: NotificationPayload;
  poster_path?: string | null;
}

export const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Builds the HTML for one user's batch within `limit` characters, plus the poster URLs
 * (one per title, in list order, max `maxPhotos`) for the titles that made it into the text.
 */
export function buildMessage(rows: MessageRow[], appUrl: string, limit: number, maxPhotos = 10): { html: string; photos: string[] } {
  const lineFor = (n: MessageRow) => {
    const p = n.payload;
    const url = `${appUrl}/title/${p.media_type}/${p.tmdb_id}`;
    return `• <a href="${escapeHtml(url)}"><b>${escapeHtml(p.title)}</b></a>: ${escapeHtml(describeEvent(n.event_type, p))}`;
  };
  const moreLine = (n: number) => `…and ${n} more on <a href="${escapeHtml(appUrl)}/notifications">NowLanding</a>`;

  const lines: string[] = [];
  const included: MessageRow[] = [];
  let length = 0;
  for (let i = 0; i < rows.length; i++) {
    const line = lineFor(rows[i]);
    const remainingAfter = rows.length - i - 1;
    const reserve = remainingAfter > 0 ? moreLine(remainingAfter).length + 1 : 0;
    if (length + line.length + 1 + reserve > limit && lines.length > 0) break;
    lines.push(line);
    included.push(rows[i]);
    length += line.length + 1;
  }
  const more = rows.length - included.length;
  if (more > 0) lines.push(moreLine(more));

  const photos: string[] = [];
  const seen = new Set<number>();
  for (const r of included) {
    if (photos.length >= maxPhotos) break;
    if (!r.poster_path || seen.has(r.title_id)) continue;
    seen.add(r.title_id);
    photos.push(`${POSTER_BASE}${r.poster_path}`);
  }
  return { html: lines.join("\n"), photos };
}
