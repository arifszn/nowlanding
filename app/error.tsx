"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page container">
      <div className="empty">
        <h2>This page did not load</h2>
        <p>The data service did not answer. Try again; if it keeps failing, come back in a few minutes.</p>
        <button className="btn" type="button" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
