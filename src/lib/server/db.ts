import "server-only";
import { createClient } from "@supabase/supabase-js";
import { TABLES, type Row, type Tables } from "../db-map";

// Server-only client with the secret key. RLS denies anon/authenticated, so this is the only way in.
export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY belum diisi di environment.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Supabase occasionally rejects a fresh request with "JWT issued at future" due to
// clock skew between its own edge nodes; it's transient and clears itself within ~1s.
async function selectPage(table: string, from: number) {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await db().from(table).select("*").range(from, from + 999);
    if (!error) return data;
    if (attempt >= 2 || !error.message.includes("JWT issued at future")) throw new Error(`${table}: ${error.message}`);
    await sleep(400 * (attempt + 1));
  }
}

// PostgREST returns at most 1000 rows per request, so page through big tables (attendance grows daily).
async function selectAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const data = await selectPage(table, from);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export async function loadTables(): Promise<Tables> {
  const rows = await Promise.all(TABLES.map(selectAll));
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]])) as Tables;
}
