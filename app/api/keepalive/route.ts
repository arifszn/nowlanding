import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily Vercel cron. Writes a heartbeat so the free-tier Supabase project never looks inactive.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("unauthorized", { status: 401 });
  }
  const db = createAdminClient();
  const { error } = await db.from("sync_state").upsert({
    job: "keepalive",
    last_success_at: new Date().toISOString(),
    details: { source: "vercel-cron" },
  });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
