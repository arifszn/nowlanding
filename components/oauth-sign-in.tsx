"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const;

export function OauthSignIn({ next }: { next: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: string) {
    setPending(provider);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as never,
      options: { redirectTo, skipBrowserRedirect: false },
    });
    if (error) {
      setError(`${provider} sign-in is not available right now. Try again in a minute.`);
      setPending(null);
    }
  }

  return (
    <div className="oauth">
      {PROVIDERS.map((p) => (
        <button key={p.id} className="btn btn--frame" type="button" onClick={() => signIn(p.id)} disabled={pending !== null}>
          {pending === p.id ? "Opening " + p.label + "…" : "Continue with " + p.label}
        </button>
      ))}
      {error && <p role="alert" style={{ color: "var(--color-error)" }}>{error}</p>}
    </div>
  );
}
