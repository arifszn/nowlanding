export type MediaType = "movie" | "tv";

export type ReleaseKind =
  | "premiere"
  | "theatrical_limited"
  | "theatrical"
  | "digital"
  | "physical"
  | "tv"
  | "series_premiere"
  | "season_premiere"
  | "episode";

export type EventType = "announced" | "upcoming_reminder" | "released" | "date_changed";

export interface TitleRow {
  id: number;
  tmdb_id: number;
  media_type: MediaType;
  name: string;
  poster_path: string | null;
  is_tracked_popular: boolean;
  popular_regions: string[];
  first_synced_at: string | null;
}

export interface ReleaseDateRow {
  id: number;
  title_id: number;
  kind: ReleaseKind;
  region: string | null;
  season: number | null;
  episode: number | null;
  date: string; // YYYY-MM-DD
  previous_date: string | null;
  note: string | null;
  first_seen_at: string;
  updated_at: string;
}

export interface UserPrefs {
  id: string;
  region: string;
  timezone: string;
  notify_popular: boolean;
  notify_announced: boolean;
  notify_reminder: boolean;
  notify_released: boolean;
  notify_physical: boolean;
  notify_episodes: boolean;
  reminder_days: number;
}

/** A release date as it should be stored (output of TMDB mapping). */
export interface ReleaseDateInput {
  kind: ReleaseKind;
  region: string | null;
  season: number | null;
  episode: number | null;
  date: string;
  note: string | null;
}

export interface PlannedNotification {
  user_id: string;
  title_id: number;
  release_date_id: number;
  event_type: EventType;
  event_key: string;
  payload: NotificationPayload;
}

export interface NotificationPayload {
  title: string;
  media_type: MediaType;
  tmdb_id: number;
  kind: ReleaseKind;
  region: string | null;
  season: number | null;
  episode: number | null;
  date: string;
  previous_date?: string | null;
  days_until?: number;
}
