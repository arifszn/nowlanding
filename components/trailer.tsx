"use client";

import { useEffect, useRef, useState } from "react";

/** "Watch trailer" button that opens the YouTube player in a full-screen dialog. Nothing loads from YouTube until it is clicked. */
export function Trailer({ videoKey, title }: { videoKey: string; title: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button className="btn btn--frame" type="button" onClick={() => setOpen(true)}>Watch trailer</button>
      <dialog
        ref={dialog}
        className="trailer-dialog"
        aria-label={`${title} trailer`}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === dialog.current) setOpen(false); }}
      >
        <button className="trailer-dialog__close" type="button" onClick={() => setOpen(false)} aria-label="Close trailer">&times;</button>
        {open && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`}
            title={`${title} trailer`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}
      </dialog>
    </>
  );
}
