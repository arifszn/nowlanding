// Telegram webhook: account linking and bot commands.
// Public endpoint; authenticated by the X-Telegram-Bot-Api-Secret-Token header.
import { withSupabase } from "npm:@supabase/server@1.9.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { formatDate, kindLabel } from "../_shared/format.ts";
import { escapeHtml, safeEqual, TelegramClient } from "../_shared/telegram.ts";
import type { NotificationPayload } from "../_shared/types.ts";

interface TgUpdate {
  message?: {
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number };
  };
  my_chat_member?: {
    chat: { id: number; type: string };
    new_chat_member: { status: string };
  };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

async function handleStart(db: SupabaseClient, chatId: number, fromId: number, token: string | undefined, appUrl: string) {
  if (!token || !TOKEN_RE.test(token)) {
    return `Open <a href="${appUrl}/settings">NowLanding settings</a> and press "Connect Telegram" to link this chat.`;
  }
  const { data: link, error } = await db.from("telegram_links")
    .select("user_id, telegram_user_id, link_token_expires_at")
    .eq("link_token", token).maybeSingle();
  if (error) throw error;
  if (!link || !link.link_token_expires_at || Date.parse(link.link_token_expires_at) < Date.now()) {
    return `This link has expired. Generate a new one in <a href="${appUrl}/settings">settings</a>.`;
  }
  if (link.telegram_user_id && Number(link.telegram_user_id) !== fromId) {
    return "This link belongs to a different Telegram account. Sign in to NowLanding with this account instead.";
  }
  // A chat can belong to one NowLanding account only.
  await db.from("telegram_links").update({ chat_id: null, active: false }).eq("chat_id", chatId).neq("user_id", link.user_id);
  const { error: uErr } = await db.from("telegram_links").update({
    chat_id: chatId,
    telegram_user_id: fromId,
    active: true,
    link_token: null,
    link_token_expires_at: null,
    linked_at: new Date().toISOString(),
  }).eq("user_id", link.user_id);
  if (uErr) throw uErr;
  return "Connected. You will get alerts here. Commands: /upcoming, /stop, /resume.";
}

async function handleUpcoming(db: SupabaseClient, chatId: number, appUrl: string) {
  const { data: link } = await db.from("telegram_links").select("user_id").eq("chat_id", chatId).maybeSingle();
  if (!link) return "This chat is not linked. Use the Connect button in NowLanding settings.";
  const { data: follows } = await db.from("follows").select("title_id").eq("user_id", link.user_id);
  const ids = (follows ?? []).map((f) => f.title_id);
  if (!ids.length) return `You are not following anything yet. <a href="${appUrl}/discover">Discover titles</a>.`;
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows } = await db.from("release_dates")
    .select("kind, region, season, episode, date, titles!inner(name, media_type, tmdb_id)")
    .in("title_id", ids).gte("date", today)
    .in("kind", ["theatrical", "digital", "physical", "series_premiere", "season_premiere", "episode"])
    .order("date").limit(5);
  if (!rows?.length) return "No upcoming dates for the titles you follow.";
  return rows.map((r) => {
    const t = r.titles as unknown as { name: string };
    const label = kindLabel(r as unknown as NotificationPayload);
    return `• <b>${escapeHtml(t.name)}</b>: ${escapeHtml(label)}, ${formatDate(r.date)}${r.region ? ` (${r.region})` : ""}`;
  }).join("\n");
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
    const header = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!secret || !safeEqual(header, secret)) return new Response("unauthorized", { status: 401 });

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return new Response("bot token missing", { status: 500 });
    const tg = new TelegramClient(token);
    const appUrl = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
    const db = ctx.supabaseAdmin as SupabaseClient;

    const update = (await req.json().catch(() => ({}))) as TgUpdate;
    try {
      const member = update.my_chat_member;
      if (member && member.chat.type === "private" && ["kicked", "left"].includes(member.new_chat_member.status)) {
        await db.from("telegram_links").update({ active: false }).eq("chat_id", member.chat.id);
        return new Response("ok");
      }

      const msg = update.message;
      if (!msg?.text || !msg.from || msg.chat.type !== "private") return new Response("ok");
      const [command, arg] = msg.text.trim().split(/\s+/, 2);
      const chatId = msg.chat.id;
      let reply: string | null = null;

      switch (command.split("@")[0]) {
        case "/start":
          reply = await handleStart(db, chatId, msg.from.id, arg, appUrl);
          break;
        case "/stop": {
          const { data } = await db.from("telegram_links").update({ active: false }).eq("chat_id", chatId).select("user_id");
          reply = data?.length ? "Paused. Send /resume to turn alerts back on." : "This chat is not linked.";
          break;
        }
        case "/resume": {
          const { data } = await db.from("telegram_links").update({ active: true }).eq("chat_id", chatId).select("user_id");
          reply = data?.length ? "Alerts are on." : "This chat is not linked.";
          break;
        }
        case "/upcoming":
          reply = await handleUpcoming(db, chatId, appUrl);
          break;
        default:
          reply = "Commands: /upcoming, /stop, /resume.";
      }
      if (reply) await tg.call("sendMessage", { chat_id: chatId, text: reply, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    } catch (e) {
      console.error(e);
    }
    // Always 200 so Telegram does not retry a poisoned update forever.
    return new Response("ok");
  }),
};
