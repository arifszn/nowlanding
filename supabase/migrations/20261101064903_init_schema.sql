-- NowLanding initial schema. See SPEC.md.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Enums
create type public.media_type as enum ('movie', 'tv');
create type public.release_kind as enum (
  'premiere', 'theatrical_limited', 'theatrical', 'digital', 'physical', 'tv',
  'series_premiere', 'season_premiere', 'episode'
);
create type public.event_type as enum ('announced', 'upcoming_reminder', 'released', 'date_changed');
create type public.notification_status as enum ('pending', 'sending', 'sent', 'failed', 'skipped');

-- profiles: user-editable preferences
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  region text not null default 'US' check (region ~ '^[A-Z]{2}$'),
  timezone text not null default 'UTC',
  notify_popular boolean not null default true,
  notify_announced boolean not null default true,
  notify_reminder boolean not null default true,
  notify_released boolean not null default true,
  notify_physical boolean not null default true,
  notify_episodes boolean not null default true,
  reminder_days smallint not null default 7 check (reminder_days between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- telegram_links: written by service role only
create table public.telegram_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  telegram_user_id bigint unique,
  chat_id bigint unique,
  active boolean not null default false,
  link_token text unique check (link_token ~ '^[A-Za-z0-9_-]{16,64}$'),
  link_token_expires_at timestamptz,
  linked_at timestamptz,
  updated_at timestamptz not null default now()
);

-- titles: cached TMDB titles
create table public.titles (
  id bigint generated always as identity primary key,
  tmdb_id integer not null,
  media_type public.media_type not null,
  name text not null,
  original_name text,
  overview text,
  poster_path text,
  backdrop_path text,
  popularity real not null default 0,
  primary_date date,
  status text,
  is_tracked_popular boolean not null default false,
  popular_regions text[] not null default '{}',
  first_synced_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (media_type, tmdb_id)
);
create index titles_popular_idx on public.titles (popularity desc) where is_tracked_popular;
create index titles_last_synced_idx on public.titles (last_synced_at);

-- release_dates: one row per (title, kind, region, season, episode)
create table public.release_dates (
  id bigint generated always as identity primary key,
  title_id bigint not null references public.titles (id) on delete cascade,
  kind public.release_kind not null,
  region text check (region is null or region ~ '^[A-Z]{2}$'),
  season integer,
  episode integer,
  date date not null,
  previous_date date,
  note text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (title_id, kind, region, season, episode)
);
create index release_dates_date_idx on public.release_dates (date);

-- follows
create table public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  title_id bigint not null references public.titles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id)
);
create index follows_title_idx on public.follows (title_id);

-- notifications: the unique key makes event detection idempotent
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title_id bigint not null references public.titles (id) on delete cascade,
  release_date_id bigint references public.release_dates (id) on delete set null,
  event_type public.event_type not null,
  event_key text not null,
  payload jsonb not null default '{}',
  status public.notification_status not null default 'pending',
  attempts smallint not null default 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz, -- web feed read state
  created_at timestamptz not null default now(),
  unique (user_id, title_id, event_type, event_key)
);
create index notifications_user_feed_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (created_at) where status = 'pending';
create index notifications_sending_idx on public.notifications (claimed_at) where status = 'sending';
create index notifications_title_idx on public.notifications (title_id);
create index notifications_release_date_idx on public.notifications (release_date_id);

-- sync_state: job bookkeeping (service role only)
create table public.sync_state (
  job text primary key,
  last_success_at timestamptz,
  details jsonb not null default '{}'
);

-- updated_at trigger
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger telegram_links_touch before update on public.telegram_links
  for each row execute function private.touch_updated_at();

-- Create profile on signup
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Atomic claim for the sender. Service role only.
create function private.claim_notifications(batch_size integer)
returns setof public.notifications
language sql set search_path = '' as $$
  update public.notifications n
     set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
   where n.id in (
     select id from public.notifications
      where status = 'pending'
      order by created_at
      for update skip locked
      limit batch_size)
  returning n.*;
$$;

create function private.requeue_stuck_notifications(stuck_after interval default '10 minutes')
returns integer
language sql set search_path = '' as $$
  with r as (
    update public.notifications
       set status = 'pending', claimed_at = null
     where status = 'sending' and claimed_at < now() - stuck_after
    returning 1)
  select count(*)::integer from r;
$$;
revoke execute on function private.claim_notifications(integer) from public, anon, authenticated;
revoke execute on function private.requeue_stuck_notifications(interval) from public, anon, authenticated;

-- Public wrappers callable only by service_role (Edge Functions use supabase-js rpc)
create function public.claim_notifications(batch_size integer)
returns setof public.notifications
language sql set search_path = '' as $$
  select * from private.claim_notifications(batch_size);
$$;
create function public.requeue_stuck_notifications()
returns integer
language sql set search_path = '' as $$
  select private.requeue_stuck_notifications('10 minutes');
$$;
revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;
revoke execute on function public.requeue_stuck_notifications() from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.claim_notifications(integer) to service_role;
grant execute on function private.requeue_stuck_notifications(interval) to service_role;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.requeue_stuck_notifications() to service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.telegram_links enable row level security;
alter table public.titles enable row level security;
alter table public.release_dates enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.sync_state enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "telegram_links: read own" on public.telegram_links for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "titles: read" on public.titles for select to anon, authenticated using (true);
create policy "release_dates: read" on public.release_dates for select to anon, authenticated using (true);

create policy "follows: read own" on public.follows for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "follows: insert own" on public.follows for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "follows: delete own" on public.follows for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "notifications: read own" on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "notifications: mark own read" on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Grants (explicit, in case the Data API does not auto-expose new tables)
revoke all on all tables in schema public from anon, authenticated;
grant select on public.titles, public.release_dates to anon, authenticated;
grant select, update (region, timezone, notify_popular, notify_announced, notify_reminder,
  notify_released, notify_physical, notify_episodes, reminder_days) on public.profiles to authenticated;
grant select on public.telegram_links to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant all on all tables in schema public to service_role;
