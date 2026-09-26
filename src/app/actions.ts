"use server";
import { redirect } from "next/navigation";
import { db, loadTables } from "@/lib/server/db";
import { checkCredentials, endSession, isAuthed, startSession } from "@/lib/server/session";
import { TABLES, toState, type Op } from "@/lib/db-map";
import type { State } from "@/lib/types";

export async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!username.trim() || !password) return { ok: false, error: "Isi username dan password." };
  if (!checkCredentials(username, password)) return { ok: false, error: "Username atau password salah." };
  await startSession();
  return { ok: true };
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function loadState(): Promise<State> {
  if (!(await isAuthed())) throw new Error("Sesi habis. Silakan masuk lagi.");
  return toState(await loadTables());
}

/** Applies writes in order. Tables are whitelisted; Postgres constraints validate the rows. */
export async function save(ops: Op[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAuthed())) return { ok: false, error: "Sesi habis. Silakan masuk lagi." };
  const client = db();
  for (const op of ops) {
    if (!TABLES.includes(op.table)) return { ok: false, error: `Tabel tidak dikenal: ${op.table}` };
    const q = client.from(op.table);
    const { error } =
      "upsert" in op ? await q.upsert(op.upsert)
      : "update" in op ? await q.update(op.update).match(op.match)
      : await q.delete().match(op.delete);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
