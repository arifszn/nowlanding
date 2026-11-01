-- Schedules for the Edge Function jobs.
-- Requires two Vault secrets per environment (not stored in migrations):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<sb_secret_... key>', 'secret_key');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function private.invoke_function(fn text, body jsonb default '{}')
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
    ),
    body := body,
    timeout_milliseconds := 150000
  );
$$;
revoke execute on function private.invoke_function(text, jsonb) from public, anon, authenticated;

select cron.schedule('nowlanding-discover', '0 5 * * *', $$ select private.invoke_function('sync-tmdb', '{"mode":"discover"}') $$);
select cron.schedule('nowlanding-refresh', '*/10 * * * *', $$ select private.invoke_function('sync-tmdb', '{"mode":"refresh"}') $$);
select cron.schedule('nowlanding-detect', '5,35 * * * *', $$ select private.invoke_function('detect-events') $$);
select cron.schedule('nowlanding-send', '* * * * *', $$ select private.invoke_function('send-telegram') $$);
