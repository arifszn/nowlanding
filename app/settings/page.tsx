import type { Metadata } from "next";
import { connectTelegram, disconnectTelegram, signOut } from "@/app/actions";
import { getProfile, getTelegramLink } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { OauthLink } from "@/components/oauth-link";

export const metadata: Metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [profile, link] = await Promise.all([getProfile(), getTelegramLink()]);
  const { error } = await searchParams;
  if (!profile) {
    // Signed-in session whose account no longer exists (e.g. after a local DB reset).
    return (
      <div className="page container">
        <div className="empty">
          <h2>Session expired</h2>
          <p>Your account was not found. Sign out and sign in again.</p>
          <form action={signOut}><button className="btn" type="submit">Sign out</button></form>
        </div>
      </div>
    );
  }
  return (
    <div className="page container">
      <div className="page__head">
        <h1 className="page__title">Settings</h1>
      </div>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <div className="form">
        <fieldset className="fieldset">
          <legend>Telegram</legend>
          {link?.active ? (
            <>
              <p><span className="status-ok">Connected.</span> Alerts go to your Telegram chat with the bot.</p>
              <form action={disconnectTelegram}><button className="btn btn--frame btn--small" type="submit">Disconnect Telegram</button></form>
            </>
          ) : (
            <>
              <p>{link?.chat_id ? "Paused. Send /resume to the bot, or connect again." : "Not connected. Alerts show on the Alerts page only."}</p>
              <form action={connectTelegram}><button className="btn btn--small" type="submit">Connect Telegram</button></form>
              <p className="small muted">Opens the bot in Telegram. Press Start there to finish. The link works for 15 minutes.</p>
            </>
          )}
        </fieldset>
        <SettingsForm profile={profile} />
        <fieldset className="fieldset">
          <legend>Account</legend>
          <OauthLink />
          <form action={signOut}><button className="btn btn--frame btn--small" type="submit">Sign out</button></form>
        </fieldset>
      </div>
    </div>
  );
}
