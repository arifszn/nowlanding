import type { Metadata } from "next";
import Link from "next/link";
import { getProfile, getUnreadCount, getUserId } from "@/lib/data";
import { TimezoneDetect } from "@/components/timezone-detect";
import { NavLink } from "@/components/nav-link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NowLanding", template: "%s | NowLanding" },
  description: "Release-day alerts for movies and series, on Telegram or in the app.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();
  const unread = userId ? await getUnreadCount() : 0;
  const profile = userId ? await getProfile() : null;

  return (
    <html lang="en">
      <body style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <header className="topbar">
          <div className="container topbar__inner">
            <Link href="/" className="wordmark" aria-label="NowLanding home">
              <img className="wordmark__mark" src="/nowlanding-mark.png" alt="" width="36" height="36" />
              NowLanding
            </Link>
            <nav className="nav" aria-label="Main">
              <NavLink href="/discover">Discover</NavLink>
              {userId ? (
                <>
                  <NavLink href="/upcoming">My upcoming</NavLink>
                  <NavLink href="/following">Following</NavLink>
                  <NavLink href="/notifications">
                    Alerts{unread > 0 && <span className="nav__count"> {unread}</span>}
                    {unread > 0 && <span className="visually-hidden"> unread</span>}
                  </NavLink>
                  <NavLink href="/settings">Settings</NavLink>
                </>
              ) : (
                <NavLink href="/login">Sign in</NavLink>
              )}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        {profile?.timezone === "UTC" && <TimezoneDetect />}
        <footer className="site-footer">
          <div className="container site-footer__inner">
          <div><Link href="/" className="wordmark"><img className="wordmark__mark" src="/nowlanding-mark.png" alt="" width="36" height="36" />NowLanding</Link><p className="small">Release dates, kept in one calm place.</p></div>
            <nav className="site-footer__links" aria-label="Footer"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link></nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
