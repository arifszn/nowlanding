"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Poster } from "@/components/poster";
import { titleHref } from "@/lib/format";
import type { SearchResult } from "@/lib/search";

const MIN_QUERY = 2;
const DELAY_MS = 250;

type State = { status: "idle" | "loading" | "error" } | { status: "done"; results: SearchResult[] };

/** The Discover header with a search box that updates results as you type. Children show while there is no query. */
export function LiveSearch({ initialQuery, initialResults, children }: {
  initialQuery: string;
  initialResults: SearchResult[] | "error" | null;
  children: React.ReactNode;
}) {
  const [q, setQ] = useState(initialQuery);
  const [state, setState] = useState<State>(
    initialResults === "error" ? { status: "error" } : initialResults ? { status: "done", results: initialResults } : { status: "idle" },
  );
  const first = useRef(true);

  useEffect(() => {
    // The server already rendered the results for the initial query.
    if (first.current) {
      first.current = false;
      if (initialResults !== null || q.trim().length < MIN_QUERY) return;
    }
    const query = q.trim();
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);

    if (query.length < MIN_QUERY) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { results: SearchResult[] };
        setState({ status: "done", results: data.results });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState({ status: "error" });
      }
    }, DELAY_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = q.trim().length >= MIN_QUERY;

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Discover</h1>
        <form className="search" action="/discover" role="search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="q" className="visually-hidden">Search movies and series</label>
          <input id="q" name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search movies and series" autoComplete="off" />
        </form>
      </div>

      {active ? (
        <div aria-live="polite" aria-busy={state.status === "loading"}>
          {state.status === "error" && <p className="notice notice--error">Search is not answering right now. Try again in a minute.</p>}
          {state.status === "done" && (
            state.results.length === 0 ? (
              <p className="notice">Nothing matches &ldquo;{q.trim()}&rdquo;. Try the original title or fewer words.</p>
            ) : (
              <ul className="results" aria-label={`Results for ${q.trim()}`}>
                {state.results.map((r) => (
                  <li className="result" key={`${r.media_type}-${r.id}`}>
                    <Link href={titleHref({ media_type: r.media_type, tmdb_id: r.id })}>
                      <Poster path={r.poster_path} name={r.name} size="w185" />
                      <span className="result__name">{r.name}</span>
                      <span className="small muted">{r.media_type === "tv" ? "Series" : "Movie"}{r.year ? `, ${r.year}` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}
          {state.status === "loading" && <p className="small muted">Searching...</p>}
        </div>
      ) : children}
    </>
  );
}
