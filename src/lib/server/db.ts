import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TABLES, type Row, type Tables } from "../db-map";
import { RETRY_DELAYS_MS, shouldRetry } from "../retry";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every Supabase call goes through here, so one transient failure no longer breaks a whole page
 *  (the "Data tidak bisa dimuat" screen). Policy lives in lib/retry.ts. */
async function retryingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  for (let attempt = 0; ; attempt++) {
    // A skewed Supabase node keeps failing every request on the same keep-alive socket, so a retry
    // asks for that socket to be closed: the next attempt is guaranteed a fresh connection.
    let opts = init;
    if (attempt > 0) {
      const headers = new Headers(init?.headers);
      headers.set("connection", "close");
      opts = { ...init, headers };
    }
    let res: Response;
    try {
      res = await fetch(input, opts);
    } catch (e) {
      if (!shouldRetry({ method, networkError: true, attempt })) throw e;
      console.warn(`[db] network error on ${method}, retry ${attempt + 1}:`, (e as Error).message);
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    if (res.ok) return res;
    const body = res.status === 401 ? await res.clone().text() : undefined;
    if (!shouldRetry({ method, status: res.status, body, attempt })) return res;
    console.warn(`[db] ${res.status} on ${method}, retry ${attempt + 1}${body ? `: ${body.slice(0, 120)}` : ""}`);
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

let client: SupabaseClient | null = null;

// Server-only client with the secret key. RLS denies anon/authenticated, so this is the only way in.
export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY belum diisi di environment.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: retryingFetch } });
  return client;
}

// PostgREST returns at most 1000 rows per request, so page through big tables (attendance grows daily).
async function selectAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export async function loadTables(): Promise<Tables> {
  const rows = await Promise.all(TABLES.map(selectAll));
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]])) as Tables;
}
