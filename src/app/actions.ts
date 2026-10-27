"use server";
import { redirect } from "next/navigation";
import { applyOps, loadTables, one, q } from "@/lib/server/db";
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
  const bad = ops.find((op) => !TABLES.includes(op.table));
  if (bad) return { ok: false, error: `Tabel tidak dikenal: ${bad.table}` };
  try {
    await applyOps(ops);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
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
  const m = await one<{ id: string; active: boolean }>("select id, active from members where noreg = $1", [noreg]);
  if (!m?.active) return null;
  const acc = await one<Account>("select * from member_accounts where member_id = $1", [m.id]);
  return { memberId: m.id, acc };
}

function lockedMessage(acc: Account | null): string | null {
  const left = acc?.locked_until ? new Date(acc.locked_until).getTime() - Date.now() : 0;
  return left > 0 ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(left / 60000)} menit.` : null;
}

async function recordFail(acc: Account) {
  const n = nextFailState(acc.failed_attempts, Date.now());
  await q("update member_accounts set failed_attempts = $1, locked_until = $2 where member_id = $3",
    [n.failed, n.lockedUntil ? new Date(n.lockedUntil).toISOString() : null, acc.member_id]);
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
  await q("update member_accounts set failed_attempts = 0, locked_until = null, last_login_at = now() where member_id = $1", [found.memberId]);
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
  try {
    await q(`update member_accounts set password_hash = $1, activation_hash = null, activation_expires = null,
      session_version = $2, failed_attempts = 0, locked_until = null, activated_at = $3, last_login_at = $4 where member_id = $5`,
      [await hashPassword(password), version, acc.activated_at ?? now, now, found.memberId]);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  }
  await startMemberSession(found.memberId, version);
  return { ok: true };
}

/** F-1104: bumps session_version so every other device is logged out; this device gets a fresh cookie. */
export async function changePassword(current: string, next: string): Promise<Result> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Sesi habis. Silakan masuk lagi." };
  const bad = passwordError(next);
  if (bad) return { ok: false, error: bad };
  const acc = await one<Account>("select * from member_accounts where member_id = $1", [me.id]);
  if (!acc) return { ok: false, error: "Akun tidak ditemukan." };
  const locked = lockedMessage(acc);
  if (locked) return { ok: false, error: locked };
  if (!(await verifyPassword(current, acc.password_hash))) {
    await recordFail(acc);
    return { ok: false, error: "Password saat ini salah." };
  }
  const version = acc.session_version + 1;
  try {
    await q("update member_accounts set password_hash = $1, session_version = $2, failed_attempts = 0 where member_id = $3",
      [await hashPassword(next), version, me.id]);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  }
  await startMemberSession(me.id, version);
  return { ok: true };
}

/** F-1503: the first request of a visit freezes the previous visit time in a cookie, then records this visit. */
export async function beginVisit(): Promise<void> {
  const me = await requireMember();
  if (!me || (await readSeenBase())) return;
  const data = await one<{ last_seen_at: string | null }>("select last_seen_at from member_accounts where member_id = $1", [me.id]);
  const now = new Date().toISOString();
  await setSeenBase(data?.last_seen_at ?? now); // first visit ever: nothing counts as new
  await q("update member_accounts set last_seen_at = $1 where member_id = $2", [now, me.id]);
}

/* ---------- leader side ---------- */

export type AccountSummary = {
  memberId: string; activated: boolean; codeValidUntil: string | null; lockedUntil: string | null;
  activatedAt: string | null; lastLoginAt: string | null;
};

/** Status only, never hashes. */
export async function listAccounts(): Promise<AccountSummary[]> {
  if (!(await isAuthed())) return [];
  const data = await q<Account & { last_login_at: string | null }>(
    "select member_id, password_hash, activation_hash, activation_expires, locked_until, activated_at, last_login_at from member_accounts");
  const now = Date.now();
  return data.map((a) => ({
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
  const m = await one<{ active: boolean }>("select active from members where id = $1", [memberId]);
  if (!m?.active) return { ok: false, error: "Member tidak aktif." };
  const code = newActivationCode();
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  try {
    await q(`insert into member_accounts (member_id, password_hash, activation_hash, activation_expires, session_version, failed_attempts, locked_until)
      values ($1, null, $2, $3, 1, 0, null)
      on conflict (member_id) do update set password_hash = null, activation_hash = excluded.activation_hash,
        activation_expires = excluded.activation_expires, session_version = member_accounts.session_version + 1,
        failed_attempts = 0, locked_until = null`, [memberId, hashCode(code), validUntil]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, code, validUntil };
}
