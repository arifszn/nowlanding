"use client";

import { useFormStatus } from "react-dom";

export function DeleteAccountButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn--danger btn--small"
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm("Delete your account and all of its follows, alerts, and settings? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Deleting…" : "Delete account"}
    </button>
  );
}
