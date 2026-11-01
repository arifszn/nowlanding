import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { devSignIn } from "@/app/actions";
import { getUserId } from "@/lib/data";
import { safeNext } from "@/lib/safe-next";
import { TelegramSignIn } from "@/components/telegram-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: nextParam = "/upcoming", error } = await searchParams;
  const next = safeNext(nextParam, "/upcoming");
  if (await getUserId()) redirect(next);
  const dev = process.env.NODE_ENV !== "production";

  return (
    <div className="page container">
      <div className="login">
        <h1 className="page__title">Sign in</h1>
        <p>NowLanding uses your Telegram account. No email or password.</p>
        {error && <p className="notice notice--error" role="alert">{error === "auth" ? "Sign-in did not finish. Try again." : error}</p>}
        <TelegramSignIn next={next} />
        {dev && (
          <form action={devSignIn} className="fieldset">
            <legend>Local development sign-in</legend>
            <input type="hidden" name="next" value={next} />
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required defaultValue="dev@example.com" /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={6} defaultValue="dev-pass-123" /></div>
            <button className="btn btn--frame btn--small" type="submit" style={{ justifySelf: "start" }}>Sign in (dev)</button>
          </form>
        )}
      </div>
    </div>
  );
}
