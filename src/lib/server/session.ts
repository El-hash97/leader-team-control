import "server-only";
import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

// Leader: single shared login from env (PRD v3 D3). Member: per-member cookie, checked against member_accounts.
const LEADER_COOKIE = "ltc_session";
const MEMBER_COOKIE = "ltc_member";
const LEADER_TTL = 24 * 60 * 60; // PRD v3 D9
const MEMBER_TTL = 30 * 24 * 60 * 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET belum diisi (minimal 32 karakter).");
  return s;
}
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const cookieOpts = (maxAge: number) =>
  ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge }) as const;

/* ---------- leader ---------- */

export function checkCredentials(username: string, password: string) {
  const u = process.env.LTC_USERNAME, p = process.env.LTC_PASSWORD;
  if (!u || !p) throw new Error("LTC_USERNAME / LTC_PASSWORD belum diisi di environment.");
  return same(username.trim().toLowerCase(), u.toLowerCase()) && same(password, p);
}

export async function startSession() {
  const exp = String(Math.floor(Date.now() / 1000) + LEADER_TTL);
  (await cookies()).set(LEADER_COOKIE, `${exp}.${sign(exp)}`, cookieOpts(LEADER_TTL));
}

export async function endSession() {
  const c = await cookies();
  c.delete(LEADER_COOKIE);
  c.delete(MEMBER_COOKIE);
  c.delete("ltc_seen"); // next login starts a new visit (F-1503)
}

export async function isAuthed() {
  const v = (await cookies()).get(LEADER_COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  return !!exp && !!sig && same(sig, sign(exp)) && Number(exp) > Date.now() / 1000;
}

/* ---------- member ---------- */

// Payload "memberId.sessionVersion.exp". sessionVersion must still match the DB row (checked by the caller),
// so a password change or a new activation code logs out every old device.
export async function startMemberSession(memberId: string, sessionVersion: number) {
  const payload = `${memberId}.${sessionVersion}.${Math.floor(Date.now() / 1000) + MEMBER_TTL}`;
  (await cookies()).set(MEMBER_COOKIE, `${payload}.${sign(payload)}`, cookieOpts(MEMBER_TTL));
}

export async function readMemberSession(): Promise<{ memberId: string; sessionVersion: number } | null> {
  const v = (await cookies()).get(MEMBER_COOKIE)?.value;
  const parts = v?.split(".");
  if (!parts || parts.length !== 4) return null;
  const [memberId, ver, exp, sig] = parts;
  if (!same(sig, sign(`${memberId}.${ver}.${exp}`)) || Number(exp) <= Date.now() / 1000) return null;
  return { memberId, sessionVersion: Number(ver) };
}

// PRD v3 F-1503: "what counts as new" is frozen for one visit (8 h) so badges survive page changes.
// Not a secret (only a timestamp), so it is not signed; a forged value only changes which items say "Baru".
const SEEN_COOKIE = "ltc_seen";
export async function readSeenBase(): Promise<string | null> {
  const v = (await cookies()).get(SEEN_COOKIE)?.value;
  return v && !Number.isNaN(Date.parse(v)) ? v : null;
}
export async function setSeenBase(iso: string) {
  (await cookies()).set(SEEN_COOKIE, iso, cookieOpts(8 * 60 * 60));
}

/* ---------- secrets ---------- */

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await scryptAsync(password, salt, 32)).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  const [kind, salt, hash] = stored?.split("$") ?? [];
  if (kind !== "scrypt" || !salt || !hash) return false;
  const got = await scryptAsync(password, Buffer.from(salt, "base64url"), 32);
  return same(got.toString("base64url"), hash);
}

// Activation codes are short-lived and low-entropy, so a keyed HMAC is enough; the 5-try lock does the rest.
export const newActivationCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const hashCode = (code: string) => sign(`act:${code}`);
export const codeMatches = (code: string, stored: string | null) => !!stored && same(hashCode(code), stored);
