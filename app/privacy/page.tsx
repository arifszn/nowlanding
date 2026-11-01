import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="page container">
      <div className="login">
        <h1 className="page__title">Privacy</h1>
        <p>When you sign in with email, Google or GitHub, NowLanding stores your email address or provider account ID. If you connect Telegram, it stores your Telegram user ID and chat ID. It also stores the titles you follow, your alerts and your settings (region, timezone).</p>
        <p>Your password is never seen by NowLanding; sign-in is handled by Supabase Auth. There is no tracking or analytics, and no payment data.</p>
        <p>Third parties involved: Supabase (accounts, database), TMDB (release data), Telegram (alert delivery, only if connected), and your chosen sign-in provider.</p>
        <p>To delete your account and data, email swazan.arif@gmail.com.</p>
      </div>
    </div>
  );
}
