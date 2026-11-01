import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signUp } from "@/app/actions";
import { getUserId } from "@/lib/data";
import { safeNext } from "@/lib/safe-next";
import { OauthSignIn } from "@/components/oauth-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string }> }) {
  const { next: nextParam = "/upcoming", error, mode } = await searchParams;
  const next = safeNext(nextParam, "/upcoming");
  if (await getUserId()) redirect(next);
  const register = mode === "register";

  return (
    <div className="page container">
      <div className="login">
        <h1 className="page__title">{register ? "Create account" : "Sign in"}</h1>
        {error && <p className="notice notice--error" role="alert">{error === "auth" ? "Sign-in did not finish. Try again." : error}</p>}
        <OauthSignIn next={next} />
        <div className="login__divider"><span>or</span></div>
        <form action={register ? signUp : signIn} className="fieldset">
          <input type="hidden" name="next" value={next} />
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={6} autoComplete={register ? "new-password" : "current-password"} required /></div>
          <button className="btn" type="submit">{register ? "Create account" : "Sign in"}</button>
        </form>
        <p className="small muted">
          {register
            ? <>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>
            : <>New here? <Link href={`/login?mode=register&next=${encodeURIComponent(next)}`}>Create an account</Link></>}
        </p>
      </div>
    </div>
  );
}
