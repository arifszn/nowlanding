import { daysBetween, todayIn } from "@/supabase/functions/_shared/dates.ts";
import { describeEvent, kindLabel } from "@/supabase/functions/_shared/format.ts";

export { describeEvent, kindLabel };

const d = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Nov 6" */
export const shortDate = (date: string) => d(date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
/** "Friday" */
export const weekday = (date: string) => d(date).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
/** "Nov 6, 2026" */
export const longDate = (date: string) => d(date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

export function relativeDay(date: string, timezone = "UTC"): string {
  const n = daysBetween(todayIn(timezone), date);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1 && n < 7) return weekday(date);
  return longDate(date);
}

export function isToday(date: string, timezone = "UTC") {
  return daysBetween(todayIn(timezone), date) === 0;
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const titleHref = (t: { media_type: string; tmdb_id: number }) => `/title/${t.media_type}/${t.tmdb_id}`;
