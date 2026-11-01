// Pure message formatting shared by Telegram and the web feed.
import type { EventType, NotificationPayload } from "./types.ts";

const KIND_LABEL: Record<string, string> = {
  premiere: "Premiere",
  theatrical_limited: "Limited theatrical release",
  theatrical: "In theaters",
  digital: "Digital release",
  physical: "Physical release (Blu-ray/DVD)",
  tv: "TV broadcast",
  series_premiere: "Series premiere",
  season_premiere: "Season premiere",
  episode: "New episode",
};

export function kindLabel(p: Pick<NotificationPayload, "kind" | "season" | "episode">): string {
  const base = KIND_LABEL[p.kind] ?? p.kind;
  if (p.kind === "season_premiere" && p.season) return `Season ${p.season} premiere`;
  if (p.kind === "episode" && p.season && p.episode) {
    return `${base} S${String(p.season).padStart(2, "0")}E${String(p.episode).padStart(2, "0")}`;
  }
  return base;
}

export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

/** One plain-text line describing an event, e.g. "Physical release (Blu-ray/DVD) out today (US)". */
export function describeEvent(type: EventType, p: NotificationPayload): string {
  const label = kindLabel(p);
  const where = p.region ? ` (${p.region})` : "";
  switch (type) {
    case "released":
      return `${label} out today${where}`;
    case "announced":
      return `${label} date announced: ${formatDate(p.date)}${where}`;
    case "upcoming_reminder": {
      const n = p.days_until ?? 0;
      return `${label} in ${n} day${n === 1 ? "" : "s"}: ${formatDate(p.date)}${where}`;
    }
    case "date_changed":
      return `${label} moved${p.previous_date ? ` from ${formatDate(p.previous_date)}` : ""} to ${formatDate(p.date)}${where}`;
  }
}
