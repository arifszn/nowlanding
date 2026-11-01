import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const TELEGRAM_PROVIDER = "custom:telegram";

/** Records the signed-in user's Telegram account id from their auth identity (never from user_metadata). */
export async function syncTelegramIdentity() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  const identity = user.identities?.find((i) => i.provider === TELEGRAM_PROVIDER);
  const raw = identity?.identity_data?.id ?? identity?.identity_data?.sub ?? identity?.id;
  const telegramUserId = raw != null && /^\d+$/.test(String(raw)) ? Number(raw) : null;
  const admin = createAdminClient();
  await admin.from("telegram_links").upsert(
    { user_id: user.id, ...(telegramUserId ? { telegram_user_id: telegramUserId } : {}) },
    { onConflict: "user_id" },
  );
}

/** Creates a one-time deep link (15 minutes) that binds the user's Telegram chat to their account. */
export async function createLinkUrl(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url"); // 32 chars, [A-Za-z0-9_-]
  const admin = createAdminClient();
  const { error } = await admin.from("telegram_links").upsert(
    { user_id: userId, link_token: token, link_token_expires_at: new Date(Date.now() + 15 * 60_000).toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;
}
