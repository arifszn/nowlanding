import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

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
