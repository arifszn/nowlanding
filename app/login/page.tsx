import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signUp } from "@/app/actions";
import { getUserId } from "@/lib/data";
import { safeNext } from "@/lib/safe-next";
import { OauthSignIn } from "@/components/oauth-sign-in";
import { emailPasswordAuthEnabled } from "@/lib/auth-config";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string }> }) {
  const { next: nextParam = "/upcoming", error, mode } = await searchParams;
  const next = safeNext(nextParam, "/upcoming");
  if (await getUserId()) redirect(next);
  const register = emailPasswordAuthEnabled && mode === "register";

  return (
    <div className="page container login-page">
      <div className="login-shell">
        <section className="login-intro" aria-labelledby="login-intro-title">
          <Link href="/" className="login-intro__brand"><img className="login__mark" src="/nowlanding-mark.png" alt="" width="56" height="56" />NowLanding</Link>
          <div className="login-intro__copy">
            <h1 id="login-intro-title">Keep your watchlist in time.</h1>
            <p>Follow titles. See every date. Get alerts when it matters.</p>
          </div>
          <div className="login-intro__steps" aria-label="How NowLanding works">
            <p><span>01</span> Follow what you want to watch</p>
            <p><span>02</span> See every date in one timeline</p>
            <p><span>03</span> Get the alert when it matters</p>
          </div>
        </section>
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login">
            <div>
              <h2 id="login-title">{register ? "Create your list" : "Welcome back"}</h2>
              <p className="login-panel__lead">{register ? "Save titles and get notified when dates change." : "Pick up where you left off."}</p>
            </div>
            {error && <p className="notice notice--error" role="alert">
              {error === "auth" ? "Sign-in did not finish. Try again." : error === "email_password_disabled" ? "Email and password sign-in is disabled. Use an OAuth provider." : error}
            </p>}
            <OauthSignIn next={next} />
            {emailPasswordAuthEnabled && <>
              <div className="login__divider"><span>or use email</span></div>
              <form action={register ? signUp : signIn} className="fieldset">
                <input type="hidden" name="next" value={next} />
                <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
                <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={6} autoComplete={register ? "new-password" : "current-password"} required /></div>
                <button className="btn" type="submit">{register ? "Create account" : "Sign in"}</button>
              </form>
              <p className="small muted login-panel__switch">
                {register
                  ? <>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>
                  : <>New here? <Link href={`/login?mode=register&next=${encodeURIComponent(next)}`}>Create an account</Link></>}
              </p>
            </>}
          </div>
        </section>
      </div>
    </div>
  );
}
