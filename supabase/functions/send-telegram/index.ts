// Delivers pending notifications to Telegram. One grouped message per user per run,
// with posters (a photo or an album) when the titles have them.
import { withSupabase } from "npm:@supabase/server@1.9.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { buildMessage } from "../_shared/message.ts";
import { CAPTION_LIMIT, TelegramClient } from "../_shared/telegram.ts";
import type { EventType, NotificationPayload } from "../_shared/types.ts";

const BATCH = 500;
const MAX_ATTEMPTS = 5;
const TEXT_LIMIT = 3500; // plain messages allow 4096
const GAP_MS = 40; // about 25 msg/s, under Telegram's ~30/s bulk limit

interface Claimed {
  id: number;
  user_id: string;
  title_id: number;
  event_type: EventType;
  payload: NotificationPayload;
  attempts: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setStatus(db: SupabaseClient, ids: number[], fields: Record<string, unknown>) {
  if (!ids.length) return;
  const { error } = await db.from("notifications").update(fields).in("id", ids);
  if (error) throw error;
}

async function run(db: SupabaseClient, tg: TelegramClient, appUrl: string) {
  await db.rpc("requeue_stuck_notifications");
  const { data, error } = await db.rpc("claim_notifications", { batch_size: BATCH });
  if (error) throw error;
  const claimed = (data ?? []) as Claimed[];
  const stats = { claimed: claimed.length, sent: 0, skipped: 0, failed: 0, requeued: 0 };
  if (!claimed.length) return stats;

  const byUser = new Map<string, Claimed[]>();
  for (const n of claimed) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n]);

  const { data: titleRows } = await db.from("titles").select("id, poster_path").in("id", [...new Set(claimed.map((c) => c.title_id))]);
  const posterById = new Map((titleRows ?? []).map((t) => [t.id as number, t.poster_path as string | null]));

  const { data: links, error: lErr } = await db.from("telegram_links")
    .select("user_id, chat_id, active").in("user_id", [...byUser.keys()]);
  if (lErr) throw lErr;
  const linkByUser = new Map((links ?? []).map((l) => [l.user_id as string, l]));

  const groups = [...byUser.entries()];
  for (let i = 0; i < groups.length; i++) {
    const [userId, rows] = groups[i];
    const ids = rows.map((r) => r.id);
    const link = linkByUser.get(userId);

    // No Telegram: the alert stays visible in the web feed.
    if (!link?.active || !link.chat_id) {
      await setStatus(db, ids, { status: "skipped", claimed_at: null });
      stats.skipped += ids.length;
      continue;
    }

    const withPosters = rows.map((r) => ({ ...r, poster_path: posterById.get(r.title_id) ?? null }));
    let msg = buildMessage(withPosters, appUrl, CAPTION_LIMIT);
    if (!msg.photos.length) msg = buildMessage(withPosters, appUrl, TEXT_LIMIT);
    const res = await tg.send(Number(link.chat_id), msg.html, msg.photos);
    if (res.ok) {
      await setStatus(db, ids, { status: "sent", sent_at: new Date().toISOString(), claimed_at: null, last_error: null });
      stats.sent += ids.length;
    } else if (res.kind === "blocked") {
      await db.from("telegram_links").update({ active: false }).eq("user_id", userId);
      await setStatus(db, ids, { status: "skipped", claimed_at: null, last_error: res.error });
      stats.skipped += ids.length;
    } else if (res.kind === "rate_limited") {
      // Put this and every remaining group back; the next run picks them up.
      const rest = groups.slice(i).flatMap(([, r]) => r.map((x) => x.id));
      await setStatus(db, rest, { status: "pending", claimed_at: null, last_error: res.error });
      stats.requeued += rest.length;
      break;
    } else {
      const exhausted = rows.filter((r) => r.attempts >= MAX_ATTEMPTS).map((r) => r.id);
      const retry = rows.filter((r) => r.attempts < MAX_ATTEMPTS).map((r) => r.id);
      await setStatus(db, exhausted, { status: "failed", claimed_at: null, last_error: res.error });
      await setStatus(db, retry, { status: "pending", claimed_at: null, last_error: res.error });
      stats.failed += exhausted.length;
      stats.requeued += retry.length;
    }
    await sleep(GAP_MS * Math.max(1, msg.photos.length)); // an album counts as one message per photo
  }
  return stats;
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return Response.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
    const appUrl = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
    try {
      return Response.json({ ok: true, ...(await run(ctx.supabaseAdmin, new TelegramClient(token), appUrl)) });
    } catch (e) {
      console.error(e);
      return Response.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }),
};
