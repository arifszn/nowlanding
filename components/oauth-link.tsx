"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PROVIDERS = [
  { id: "google", label: "Google", icon: "G" },
  { id: "github", label: "GitHub", icon: "⌘" },
] as const;

export function OauthLink() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function link(provider: string) {
    setPending(provider);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: provider as never,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fsettings` },
    });
    if (error) {
      setError(`${provider} could not be linked. Try signing in with that provider first.`);
      setPending(null);
    }
  }

  return (
    <div className="oauth">
      <p>Link another sign-in method so you can use the same NowLanding account.</p>
      <div className="oauth oauth--inline">
        {PROVIDERS.map((provider) => (
          <button key={provider.id} className="btn btn--frame btn--small" type="button" onClick={() => link(provider.id)} disabled={pending !== null}>
            <span className="icon" aria-hidden="true">{provider.icon}</span>
            {pending === provider.id ? `Opening ${provider.label}…` : `Link ${provider.label}`}
          </button>
        ))}
      </div>
      {error && <p role="alert" style={{ color: "var(--color-error)" }}>{error}</p>}
    </div>
  );
}
