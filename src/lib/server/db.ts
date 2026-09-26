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
