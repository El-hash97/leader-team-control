// Business rules from PRD §6. Pure functions only: no React, no path aliases,
// so `node --test src/lib/rules.test.ts` can run them directly.
// Dates are ISO strings "YYYY-MM-DD" (calendar dates, Asia/Jakarta).

export type ISODate = string;

export function todayJakarta(now = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

const toUTC = (d: ISODate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10);
const DAY = 86_400_000;

export const addDays = (d: ISODate, n: number) => fromUTC(toUTC(d) + n * DAY);
export const diffDays = (a: ISODate, b: ISODate) => Math.round((toUTC(a) - toUTC(b)) / DAY);
export const weekday = (d: ISODate) => new Date(toUTC(d)).getUTCDay();
export const monthStart = (m: string) => `${m}-01`;
export function monthEnd(m: string): ISODate {
  const [y, mo] = m.split("-").map(Number);
  return fromUTC(Date.UTC(y, mo, 0));
}
export const monthOf = (d: ISODate) => d.slice(0, 7);
export function shiftMonth(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
}

// §6.1 working days in [from, to] inclusive
export function groupWorkdays(from: ISODate, to: ISODate, workWeekdays: number[], holidays: ISODate[] = []): number {
  if (from > to) return 0;
  const off = new Set(holidays);
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (workWeekdays.includes(weekday(d)) && !off.has(d)) n++;
  return n;
}

export function isWorkday(d: ISODate, workWeekdays: number[], holidays: ISODate[] = []) {
  return workWeekdays.includes(weekday(d)) && !holidays.includes(d);
}

/** Latest working day on or before `d` (used by dashboard on weekends/holidays). */
export function lastWorkday(d: ISODate, workWeekdays: number[], holidays: ISODate[] = []): ISODate {
  for (let i = 0; i < 14; i++, d = addDays(d, -1)) if (isWorkday(d, workWeekdays, holidays)) return d;
  return d;
}

export type WorkCfg ={ workWeekdays: number[]; holidays: ISODate[]; today: ISODate };

export function memberWorkdays(month: string, m: { joinDate: ISODate; deactivatedAt?: ISODate | null }, cfg: WorkCfg): number {
  const from = [monthStart(month), m.joinDate].sort()[1];
  const to = [monthEnd(month), cfg.today, m.deactivatedAt ?? "9999-12-31"].sort()[0];
  return groupWorkdays(from, to, cfg.workWeekdays, cfg.holidays);
}

// §6.2 performance
export type AttCategory = "FULFILLED" | "SICK" | "LEAVE" | "PERMIT" | "ABSENT" | "OTHER";

export function performance(fulfilled: number, workdays: number): number | null {
  if (workdays <= 0) return null;
  return Math.min(100, Math.round((fulfilled / workdays) * 100));
}

export function perfTone(p: number | null): "good" | "warn" | "bad" | "none" {
  if (p === null) return "none";
  return p >= 95 ? "good" : p >= 80 ? "warn" : "bad";
}

// §6.3 tenure
export function tenure(joinDate: ISODate, today: ISODate): string {
  if (joinDate > today) return "Belum mulai";
  let months = (+today.slice(0, 4) - +joinDate.slice(0, 4)) * 12 + (+today.slice(5, 7) - +joinDate.slice(5, 7));
  if (+today.slice(8, 10) < +joinDate.slice(8, 10)) months--;
  return `${Math.floor(months / 12)} th ${months % 12} bln`;
}

export function addMonths(d: ISODate, n: number): ISODate {
  const y = +d.slice(0, 4), m = +d.slice(5, 7) - 1 + n, day = +d.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // clamp 31 Jan + 1 bln → 28/29 Feb
  return fromUTC(Date.UTC(y, m, Math.min(day, last)));
}

// Contract length rules (months). Karyawan Tetap has no contract.
export type ContractMonths = { vokasi: number; pkwt1: number; pkwt2Extra: number };
export type ContractKind = "vokasi" | "pkwt1" | "pkwt2" | null;

export function contractKind(statusName: string, positionName: string): ContractKind {
  if (statusName === "Vokasi") return "vokasi";
  if (statusName === "PKWT") return positionName === "PKWT 2" ? "pkwt2" : "pkwt1";
  return null;
}

/** PKWT 2 = PKWT 1 period plus the extension, counted from the original join date. */
export function contractMonthsFor(kind: ContractKind, c: ContractMonths): number | null {
  return kind === "vokasi" ? c.vokasi : kind === "pkwt1" ? c.pkwt1 : kind === "pkwt2" ? c.pkwt1 + c.pkwt2Extra : null;
}

/** Last day of contract: join + N months − 1 day (join 1 Jan 2025, 24 bln → 31 Des 2026). */
export function contractEndFor(kind: ContractKind, joinDate: ISODate, c: ContractMonths): ISODate | null {
  const months = contractMonthsFor(kind, c);
  return months === null ? null : addDays(addMonths(joinDate, months), -1);
}

// §6.4 contract / expiry alerts
export const daysLeft = (end: ISODate, today: ISODate) => diffDays(end, today);
export function dueLabel(days: number) {
  return days < 0 ? `Lewat ${-days} hari` : days === 0 ? "Hari ini" : `${days} hari lagi`;
}

// §6.5 – §6.7 skill
export type LevelMap = Record<string, number>; // processId -> level 0..4

export function countAtLeast(levels: LevelMap, activeProcessIds: string[], min: number) {
  return activeProcessIds.filter((p) => (levels[p] ?? 0) >= min).length;
}

export function isMultiSkill(levels: LevelMap, activeProcessIds: string[], minProcesses = 3, minLevel = 3) {
  return countAtLeast(levels, activeProcessIds, minLevel) >= minProcesses;
}

export function overallLevel(levels: LevelMap, activeProcessIds: string[], minProcesses = 3, minLevel = 3): 1 | 2 | 3 | 4 {
  const multi = isMultiSkill(levels, activeProcessIds, minProcesses, minLevel);
  if (multi && countAtLeast(levels, activeProcessIds, 4) > 0) return 4;
  if (multi) return 3;
  if (countAtLeast(levels, activeProcessIds, 3) > 0) return 2;
  return 1;
}

export const rate = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

// §6.6 members with level >= 3 on a process
export function backupCount(levelsByMember: LevelMap[], processId: string) {
  return levelsByMember.filter((l) => (l[processId] ?? 0) >= 3).length;
}

// §6.8 derived plan status
export type PlanStatus = "PLANNED" | "IN_PROGRESS" | "EVALUATION" | "ACHIEVED" | "CANCELLED";
export function displayStatus(p: { status: PlanStatus; dueDate: ISODate }, today: ISODate): PlanStatus | "OVERDUE" {
  return p.status !== "ACHIEVED" && p.status !== "CANCELLED" && p.dueDate < today ? "OVERDUE" : p.status;
}

// PRD v3 §6: a 7-digit input is a member NoReg; anything else is the leader username
export const isMemberLogin = (input: string) => /^\d{7}$/.test(input.trim());

// PRD v3 F-1106: 5 wrong passwords/codes in a row lock the account for 15 minutes, then the counter restarts
export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export function nextFailState(failed: number, now: number): { failed: number; lockedUntil: number | null } {
  const n = failed + 1;
  return n >= MAX_FAILS ? { failed: 0, lockedUntil: now + LOCK_MS } : { failed: n, lockedUntil: null };
}

// PRD v3 F-1205: same reminder window as the leader views
export function trainingAlert(expiresAt: ISODate | null, today: ISODate, reminderDays: number): "expired" | "soon" | null {
  if (!expiresAt) return null;
  const d = daysLeft(expiresAt, today);
  return d < 0 ? "expired" : d <= reminderDays ? "soon" : null;
}

// PRD v3 F-1206: day count per attendance category for one member
export function attendanceSummary(records: { category: AttCategory }[]): Record<AttCategory, number> {
  const out: Record<AttCategory, number> = { FULFILLED: 0, SICK: 0, LEAVE: 0, PERMIT: 0, ABSENT: 0, OTHER: 0 };
  for (const r of records) out[r.category]++;
  return out;
}

// PRD v3 §6 (cuti): the working days a leave covers; its length is workdayList(...).length
export function workdayList(from: ISODate, to: ISODate, workWeekdays: number[], holidays: ISODate[] = []): ISODate[] {
  const off = new Set(holidays), out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (workWeekdays.includes(weekday(d)) && !off.has(d)) out.push(d);
  return out;
}

// Inclusive ranges: touching on the same day counts as overlapping
export const leaveOverlaps = (a: { start: ISODate; end: ISODate }, b: { start: ISODate; end: ISODate }) => a.start <= b.end && b.start <= a.end;

/** F-1404: processes that fall under their minimum backup (level >= 3) on a day, and to which
 *  `memberId` contributes, i.e. the shortage is caused or worsened by approving this leave. */
export function backupShortfall(
  memberId: string, levels: Record<string, LevelMap>, offIds: Set<string>, processes: { id: string; name: string; minBackup: number }[],
): { id: string; name: string; count: number; min: number }[] {
  return processes.flatMap((p) => {
    if ((levels[memberId]?.[p.id] ?? 0) < 3) return [];
    const count = Object.entries(levels).filter(([m, l]) => m !== memberId && !offIds.has(m) && (l[p.id] ?? 0) >= 3).length;
    return count < p.minBackup ? [{ id: p.id, name: p.name, count, min: p.minBackup }] : [];
  });
}

// PRD v3 D6: one reply ends the voice
export type VoiceStatus = "SENT" | "READ" | "REPLIED";
export const voiceStatus = (v: { read_at: string | null; replied_at: string | null }): VoiceStatus =>
  v.replied_at ? "REPLIED" : v.read_at ? "READ" : "SENT";

// PRD v3 F-1503: newer than the member's previous visit. No baseline (first visit ever) = nothing is "new".
// Compares instants, not strings: Postgres "+00:00" and JS "Z" timestamps sort differently as text.
export const isNewSince = (when: string | null | undefined, base: string | null) =>
  !!when && !!base && Date.parse(when) > Date.parse(base);

// PRD v3 F-1502 / KPI: working days between a voice and its reply; a same-day reply is 0.
export const replyWorkdays = (sent: ISODate, replied: ISODate, workWeekdays: number[], holidays: ISODate[] = []) =>
  groupWorkdays(addDays(sent, 1), replied, workWeekdays, holidays);

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
