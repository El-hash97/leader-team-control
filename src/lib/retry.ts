// Retry policy for Supabase HTTP calls (pure, unit-tested in rules.test.ts).
//
// "JWT issued at future": with sb_secret_ keys the Supabase gateway mints the JWT per request, and
// clock skew between its nodes sometimes rejects it with 401 before anything runs. Safe to resend,
// writes included. Network failures and 5xx are only retried for reads: a lost write response may
// mean the write already happened.

// 5 attempts, ~5 s worst case. Seen in the wild: one request failing 4× over 2.7 s on the same socket.
export const RETRY_DELAYS_MS = [300, 700, 1500, 2500] as const;

export function shouldRetry(o: { method: string; status?: number; body?: string; networkError?: boolean; attempt: number }): boolean {
  if (o.attempt >= RETRY_DELAYS_MS.length) return false;
  if (o.status === 401 && o.body?.includes("JWT issued at future")) return true;
  const read = o.method === "GET" || o.method === "HEAD";
  if (!read) return false;
  return !!o.networkError || (o.status !== undefined && (o.status >= 500 || o.status === 429));
}
