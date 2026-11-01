"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function ActionSubmit({ idle, pending, className }: { idle: ReactNode; pending: ReactNode; className?: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={isPending} aria-busy={isPending}>
      {isPending ? pending : idle}
    </button>
  );
}
