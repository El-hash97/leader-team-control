import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Single shared leader login (PRD phase-1 simplification). Credentials live in env, never in the bundle.
const COOKIE = "ltc_session";
const TTL_SECONDS = 12 * 60 * 60;

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

export function checkCredentials(username: string, password: string) {
  const u = process.env.LTC_USERNAME, p = process.env.LTC_PASSWORD;
  if (!u || !p) throw new Error("LTC_USERNAME / LTC_PASSWORD belum diisi di environment.");
  return same(username.trim().toLowerCase(), u.toLowerCase()) && same(password, p);
}

export async function startSession() {
  const exp = String(Math.floor(Date.now() / 1000) + TTL_SECONDS);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAuthed() {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  return !!exp && !!sig && same(sig, sign(exp)) && Number(exp) > Date.now() / 1000;
}
