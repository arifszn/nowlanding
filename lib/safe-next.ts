/** Returns `next` only when it is a same-site path. Rejects "//host", "/\host" and control characters. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !/^\/(?![/\\])[^\\\x00-\x1f]*$/.test(next)) return fallback;
  return next;
}
