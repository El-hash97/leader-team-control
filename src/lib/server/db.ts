import "server-only";
import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";
import { TABLES, type Op, type Row, type Tables } from "../db-map";

// Keep the shapes the app was written against: dates stay "YYYY-MM-DD", timestamps become ISO strings.
const DATE = 1082, TIMESTAMPTZ = 1184;
const parsers = {
  getTypeParser: (oid: number, format?: "text" | "binary") =>
    oid === DATE ? (v: string) => v
    : oid === TIMESTAMPTZ ? (v: string) => (types.getTypeParser(oid, format)(v) as Date).toISOString()
    : types.getTypeParser(oid, format),
};

let client: NeonQueryFunction<false, false> | null = null;

// Server-only. The connection string carries the owner password, so it never reaches the browser.
export function sql() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi di environment.");
  client = neon(url);
  return client;
}

// The driver ignores `types` given to neon(); it only honours it per query (transactions included).
const run = (text: string, params: unknown[] = []) => sql().query(text, params, { types: parsers });

/** Rows of one parameterized query. */
export const q = <T = Row,>(text: string, params: unknown[] = []) => run(text, params) as Promise<T[]>;
/** First row or null. */
export const one = async <T = Row,>(text: string, params: unknown[] = []) => (await q<T>(text, params))[0] ?? null;

// One round trip, one consistent snapshot of every table.
export async function loadTables(): Promise<Tables> {
  const rows = await sql().transaction(TABLES.map((t) => run(`select * from ${t}`)), { readOnly: true });
  return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]])) as Tables;
}

/* ---------- generic writes for the leader store (save(ops)) ---------- */

const PK: Record<string, string[]> = {
  settings: ["id"], positions: ["id"], emp_statuses: ["id"], att_statuses: ["id"], trainings: ["id"], processes: ["id"],
  members: ["id"], skill_levels: ["member_id", "process_id"], plans: ["id"], skill_logs: ["id"],
  member_trainings: ["member_id", "training_id"], attendance: ["member_id", "date"], holidays: ["date"], snapshots: ["id"],
};

// Column names come from the browser: only plain identifiers, always quoted. Values go in as JSON parameters.
function cols(keys: string[]): string {
  for (const k of keys) if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`Kolom tidak valid: ${k}`);
  return keys.map((k) => `"${k}"`).join(", ");
}

/** All ops in one transaction: either every write lands or none. Table is whitelisted by the caller. */
export async function applyOps(ops: Op[]) {
  await sql().transaction(ops.map((op) => {
    const t = op.table;
    if ("upsert" in op) {
      // union of keys, like PostgREST upsert: a key missing from one row is written as null
      const keys = [...new Set(op.upsert.flatMap((r) => Object.keys(r)))];
      const pk = PK[t];
      const rest = keys.filter((k) => !pk.includes(k));
      const conflict = rest.length ? `do update set ${rest.map((k) => `"${k}" = excluded."${k}"`).join(", ")}` : "do nothing";
      return run(`insert into ${t} (${cols(keys)}) select ${cols(keys)} from json_populate_recordset(null::${t}, $1::json)
        on conflict (${cols(pk)}) ${conflict}`, [JSON.stringify(op.upsert)]);
    }
    const match = "update" in op ? op.match : op.delete;
    const mk = Object.keys(match);
    if (!mk.length) throw new Error("Perubahan tanpa kunci ditolak.");
    const where = `(${cols(mk)}) = (select ${cols(mk)} from json_populate_record(null::${t}, $1::json))`;
    if ("delete" in op) return run(`delete from ${t} where ${where}`, [JSON.stringify(match)]);
    const uk = Object.keys(op.update);
    return run(`update ${t} set (${cols(uk)}) = (select ${cols(uk)} from json_populate_record(null::${t}, $2::json)) where ${where}`,
      [JSON.stringify(match), JSON.stringify(op.update)]);
  }));
}
