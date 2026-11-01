"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTitle, getUserId, requestSync } from "@/lib/data";
import { createLinkUrl } from "@/lib/telegram-link";
import { safeNext } from "@/lib/safe-next";
import { isValidTimezone } from "@/supabase/functions/_shared/dates.ts";

async function requireUser(next = "/discover") {
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  return userId;
}

export async function followTitle(formData: FormData) {
  const media = formData.get("media") === "tv" ? "tv" : "movie";
  const tmdbId = Number(formData.get("tmdbId"));
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return;
  const back = safeNext(String(formData.get("back") ?? ""), `/title/${media}/${tmdbId}`);
  const userId = await requireUser(back);
  const titleId = await ensureTitle(media, tmdbId);
  const supabase = await createClient();
  const { error } = await supabase.from("follows").upsert({ user_id: userId, title_id: titleId }, { onConflict: "user_id,title_id", ignoreDuplicates: true });
  if (error) throw error;
  await requestSync([titleId]);
  revalidatePath(`/title/${media}/${tmdbId}`);
  revalidatePath(back.split("?")[0]);
  revalidatePath("/following");
}

export async function unfollowTitle(formData: FormData) {
  const titleId = Number(formData.get("titleId"));
  const back = String(formData.get("back") ?? "/following");
  const userId = await requireUser();
  const supabase = await createClient();
  await supabase.from("follows").delete().eq("user_id", userId).eq("title_id", titleId);
  revalidatePath(safeNext(back, "/following").split("?")[0]);
  revalidatePath("/following");
}

export type SettingsState = { ok: boolean; message: string } | null;

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const userId = await requireUser("/settings");
  const region = String(formData.get("region") ?? "US").toUpperCase();
  const timezone = String(formData.get("timezone") ?? "UTC");
  const reminderDays = Number(formData.get("reminder_days") ?? 7);
  if (!/^[A-Z]{2}$/.test(region)) return { ok: false, message: "Pick a country from the list." };
  if (!isValidTimezone(timezone)) return { ok: false, message: "Pick a time zone from the list." };
  if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 60) {
    return { ok: false, message: "Reminder must be between 1 and 60 days." };
  }
  const flag = (k: string) => formData.get(k) === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    region,
    timezone,
    reminder_days: reminderDays,
    notify_popular: flag("notify_popular"),
    notify_announced: flag("notify_announced"),
    notify_reminder: flag("notify_reminder"),
    notify_released: flag("notify_released"),
    notify_physical: flag("notify_physical"),
    notify_episodes: flag("notify_episodes"),
  }).eq("id", userId);
  if (error) return { ok: false, message: "Settings were not saved. Try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

export async function connectTelegram() {
  const userId = await requireUser("/settings");
  redirect(await createLinkUrl(userId));
}

export async function disconnectTelegram() {
  const userId = await requireUser("/settings");
  await createAdminClient().from("telegram_links")
    .update({ active: false, chat_id: null, link_token: null, link_token_expires_at: null })
    .eq("user_id", userId);
  revalidatePath("/settings");
}

export async function markAllRead() {
  const userId = await requireUser("/notifications");
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = String(formData.get("next") || "/discover");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(safeNext(next, "/discover"));
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = String(formData.get("next") || "/discover");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&mode=register`);
  if (!data.session) redirect(`/login?error=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`);
  redirect(safeNext(next, "/discover"));
}

/** Sets the browser's time zone on the profile, only while it is still the UTC default. */
export async function detectTimezone(timezone: string) {
  const userId = await getUserId();
  if (!userId || timezone === "UTC" || !isValidTimezone(timezone)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").update({ timezone }).eq("id", userId).eq("timezone", "UTC").select("id");
  if (data?.length) revalidatePath("/", "layout");
}
