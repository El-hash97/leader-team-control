"use server";
import { redirect } from "next/navigation";
import { db, loadTables } from "@/lib/server/db";
import {
  checkCredentials, codeMatches, endSession, hashCode, hashPassword, isAuthed, newActivationCode,
  readSeenBase, setSeenBase, startMemberSession, startSession, verifyPassword,
} from "@/lib/server/session";
import { requireMember } from "@/lib/server/member";
import { isMemberLogin, nextFailState } from "@/lib/rules";
import { TABLES, toState, type Op } from "@/lib/db-map";
import type { State } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };
const BAD_LOGIN = "NoReg/username atau password salah.";

/** One login form for both roles (PRD v3 D1): 7 digits = member NoReg, anything else = leader username. */
export async function login(username: string, password: string): Promise<{ ok: true; to: "/me" | "/dashboard" } | { ok: false; error: string }> {
  if (!username.trim() || !password) return { ok: false, error: "Isi NoReg/username dan password." };
  if (isMemberLogin(username)) {
    const r = await memberLogin(username.trim(), password);
    return r.ok ? { ok: true, to: "/me" } : r;
  }
  if (!checkCredentials(username, password)) return { ok: false, error: BAD_LOGIN };
  await startSession();
  return { ok: true, to: "/dashboard" };
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
export async function save(ops: Op[]): Promise<Result> {
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

/* ---------- member accounts (PRD v3 M11) ---------- */

type Account = {
  member_id: string; password_hash: string | null; activation_hash: string | null; activation_expires: string | null;
  session_version: number; failed_attempts: number; locked_until: string | null; activated_at: string | null;
};

/** Active member + account row for a NoReg. Inactive or unknown NoReg returns null (F-1108). */
async function accountByNoreg(noreg: string): Promise<{ memberId: string; acc: Account | null } | null> {
  const { data: m } = await db().from("members").select("id, active").eq("noreg", noreg).maybeSingle();
  if (!m?.active) return null;
  const { data: acc } = await db().from("member_accounts").select("*").eq("member_id", m.id).maybeSingle();
  return { memberId: m.id, acc };
}

function lockedMessage(acc: Account | null): string | null {
  const left = acc?.locked_until ? new Date(acc.locked_until).getTime() - Date.now() : 0;
  return left > 0 ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(left / 60000)} menit.` : null;
}

async function recordFail(acc: Account) {
  const n = nextFailState(acc.failed_attempts, Date.now());
  await db().from("member_accounts")
    .update({ failed_attempts: n.failed, locked_until: n.lockedUntil ? new Date(n.lockedUntil).toISOString() : null })
    .eq("member_id", acc.member_id);
}

async function memberLogin(noreg: string, password: string): Promise<Result> {
  const found = await accountByNoreg(noreg);
  const acc = found?.acc ?? null;
  if (!found || !acc?.password_hash) return { ok: false, error: BAD_LOGIN };
  const locked = lockedMessage(acc);
  if (locked) return { ok: false, error: locked };
  if (!(await verifyPassword(password, acc.password_hash))) {
    await recordFail(acc);
    return { ok: false, error: BAD_LOGIN };
  }
  await db().from("member_accounts")
    .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq("member_id", found.memberId);
  await startMemberSession(found.memberId, acc.session_version);
  return { ok: true };
}

const passwordError = (p: string) =>
  p.length < 6 ? "Password minimal 6 karakter." : p.length > 128 ? "Password maksimal 128 karakter." : null;

/** F-1103: NoReg + 6-digit code from the leader + new password. Success logs the member straight in. */
export async function activate(noreg: string, code: string, password: string): Promise<Result> {
  const bad = passwordError(password);
  if (bad) return { ok: false, error: bad };
  const BAD_CODE = "NoReg atau kode aktivasi salah, atau kode sudah kedaluwarsa.";
  const found = await accountByNoreg(noreg.trim());
  const acc = found?.acc ?? null;
  if (!found || !acc?.activation_hash) return { ok: false, error: BAD_CODE };
  const locked = lockedMessage(acc);
  if (locked) return { ok: false, error: locked };
  const expired = !acc.activation_expires || new Date(acc.activation_expires).getTime() < Date.now();
  if (expired || !codeMatches(code.trim(), acc.activation_hash)) {
    await recordFail(acc);
    return { ok: false, error: BAD_CODE };
  }
  const now = new Date().toISOString();
  const version = acc.session_version + 1;
  const { error } = await db().from("member_accounts").update({
    password_hash: await hashPassword(password), activation_hash: null, activation_expires: null,
    session_version: version, failed_attempts: 0, locked_until: null,
    activated_at: acc.activated_at ?? now, last_login_at: now,
  }).eq("member_id", found.memberId);
  if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  await startMemberSession(found.memberId, version);
  return { ok: true };
}

/** F-1104: bumps session_version so every other device is logged out; this device gets a fresh cookie. */
export async function changePassword(current: string, next: string): Promise<Result> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Sesi habis. Silakan masuk lagi." };
  const bad = passwordError(next);
  if (bad) return { ok: false, error: bad };
  const { data: acc } = await db().from("member_accounts").select("*").eq("member_id", me.id).single<Account>();
  if (!acc) return { ok: false, error: "Akun tidak ditemukan." };
  const locked = lockedMessage(acc);
  if (locked) return { ok: false, error: locked };
  if (!(await verifyPassword(current, acc.password_hash))) {
    await recordFail(acc);
    return { ok: false, error: "Password saat ini salah." };
  }
  const version = acc.session_version + 1;
  const { error } = await db().from("member_accounts")
    .update({ password_hash: await hashPassword(next), session_version: version, failed_attempts: 0 })
    .eq("member_id", me.id);
  if (error) return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  await startMemberSession(me.id, version);
  return { ok: true };
}

/** F-1503: the first request of a visit freezes the previous visit time in a cookie, then records this visit. */
export async function beginVisit(): Promise<void> {
  const me = await requireMember();
  if (!me || (await readSeenBase())) return;
  const { data } = await db().from("member_accounts").select("last_seen_at").eq("member_id", me.id).maybeSingle();
  const now = new Date().toISOString();
  await setSeenBase(data?.last_seen_at ?? now); // first visit ever: nothing counts as new
  await db().from("member_accounts").update({ last_seen_at: now }).eq("member_id", me.id);
}

/* ---------- leader side ---------- */

export type AccountSummary = {
  memberId: string; activated: boolean; codeValidUntil: string | null; lockedUntil: string | null;
  activatedAt: string | null; lastLoginAt: string | null;
};

/** Status only, never hashes. */
export async function listAccounts(): Promise<AccountSummary[]> {
  if (!(await isAuthed())) return [];
  const { data } = await db().from("member_accounts")
    .select("member_id, password_hash, activation_hash, activation_expires, locked_until, activated_at, last_login_at");
  const now = Date.now();
  return (data ?? []).map((a) => ({
    memberId: a.member_id,
    activated: !!a.password_hash,
    codeValidUntil: a.activation_hash && a.activation_expires && new Date(a.activation_expires).getTime() > now ? a.activation_expires : null,
    lockedUntil: a.locked_until && new Date(a.locked_until).getTime() > now ? a.locked_until : null,
    activatedAt: a.activated_at,
    lastLoginAt: a.last_login_at,
  }));
}

/** F-1102: new 6-digit code, valid 24 h, shown once. Also the password reset: the old password and every
 *  session stop working until the member activates again (covers a lost phone, not just a forgotten password). */
export async function createActivationCode(memberId: string): Promise<{ ok: true; code: string; validUntil: string } | { ok: false; error: string }> {
  if (!(await isAuthed())) return { ok: false, error: "Sesi habis. Silakan masuk lagi." };
  const client = db();
  const { data: m } = await client.from("members").select("active").eq("id", memberId).maybeSingle();
  if (!m?.active) return { ok: false, error: "Member tidak aktif." };
  const { data: acc } = await client.from("member_accounts").select("session_version").eq("member_id", memberId).maybeSingle();
  const code = newActivationCode();
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await client.from("member_accounts").upsert({
    member_id: memberId, password_hash: null, activation_hash: hashCode(code), activation_expires: validUntil,
    session_version: (acc?.session_version ?? 0) + 1, failed_attempts: 0, locked_until: null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code, validUntil };
}
