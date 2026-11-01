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
            <Link href="/" className="wordmark">NowLanding</Link>
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
      </body>
    </html>
  );
}
