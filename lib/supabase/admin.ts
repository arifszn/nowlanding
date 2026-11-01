import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Secret-key client. Bypasses RLS: server code only, never import from client components. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
