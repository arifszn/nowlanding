import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <div className="page container">
      <div className="login">
        <h1 className="page__title">About</h1>
        <p>NowLanding sends release-day alerts to Telegram: theatrical, digital, Blu-ray and DVD, series premieres and new episodes.</p>
        <dl className="particulars">
          <div className="particulars__row"><dt>Data</dt><dd>TMDB</dd></div>
          <div className="particulars__row"><dt>Alerts</dt><dd>Telegram bot and this site</dd></div>
        </dl>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </div>
    </div>
  );
}
