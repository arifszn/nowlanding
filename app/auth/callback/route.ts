import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncTelegramIdentity } from "@/lib/telegram-link";
import { safeNext } from "@/lib/safe-next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/discover";
  const next = safeNext(nextParam, "/discover");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncTelegramIdentity();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
