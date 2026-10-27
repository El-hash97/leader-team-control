// One-shot copy Supabase -> Neon (all rows, same ids). Re-runnable: wipes the Neon tables first.
// Run: node --env-file=.env.local scripts/copy-from-supabase.mjs
import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";

// parents before children (FK order)
const TABLES = ["settings", "positions", "emp_statuses", "att_statuses", "trainings", "processes", "members",
  "skill_levels", "plans", "skill_logs", "member_trainings", "leave_requests", "attendance", "holidays",
  "snapshots", "member_accounts", "voices"];

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sql = neon(process.env.DATABASE_URL);

async function readAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const canon = (rows) => rows.map((r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]))).sort();

const src = {};
for (const t of TABLES) src[t] = await readAll(t);

// generated columns (voices.has_photo) are computed by Postgres, never inserted
const gen = new Set((await sql.query(`select table_name || '.' || column_name as c from information_schema.columns
  where table_schema = 'public' and is_generated = 'ALWAYS'`)).map((r) => r.c));
const cols = (t) => Object.keys(src[t][0] ?? {}).filter((c) => !gen.has(`${t}.${c}`)).map((c) => `"${c}"`).join(", ");

await sql.transaction([
  sql.query(`truncate ${TABLES.join(", ")} cascade`),
  ...TABLES.filter((t) => src[t].length).map((t) =>
    sql.query(`insert into ${t} (${cols(t)}) select ${cols(t)} from json_populate_recordset(null::${t}, $1::json)`, [JSON.stringify(src[t])])),
]);

let bad = 0;
for (const t of TABLES) {
  const [{ rows }] = await sql.query(`select coalesce(json_agg(x), '[]') as rows from ${t} x`);
  const a = canon(src[t]), b = canon(rows);
  const same = a.length === b.length && a.every((v, i) => v === b[i]);
  if (!same) bad++;
  console.log(`${same ? "OK " : "BEDA"} ${t.padEnd(17)} supabase=${a.length} neon=${b.length}`);
}
if (bad) { console.error(`${bad} tabel tidak sama`); process.exit(1); }
console.log("Semua tabel identik.");
