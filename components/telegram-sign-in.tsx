"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function TelegramSignIn({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    // Custom OIDC provider configured in Supabase Auth (see SPEC.md).
    const { error } = await supabase.auth.signInWithOAuth({ provider: "custom:telegram" as never, options: { redirectTo } });
    if (error) {
      setError("Telegram sign-in is not available right now. Try again in a minute.");
      setPending(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-sm)", justifyItems: "start" }}>
      <button className="btn" type="button" onClick={signIn} disabled={pending}>
        {pending ? "Opening Telegram" : "Sign in with Telegram"}
      </button>
      {error && <p role="alert" style={{ color: "var(--color-error)" }}>{error}</p>}
    </div>
  );
}
