import "server-only";
import { cache } from "react";
import { db } from "./db";
import { readMemberSession, readSeenBase } from "./session";
import { displayStatus, isNewSince, monthOf, todayJakarta, type AttCategory, type ISODate, type PlanStatus } from "../rules";
import type { Cell, PlanMethod } from "../types";

export type PortalPlan = {
  id: string; processName: string; fromLevel: number; targetLevel: number; startDate: ISODate; dueDate: ISODate;
  method: PlanMethod; mentorName: string | null; status: PlanStatus | "OVERDUE"; note: string; isNew: boolean;
};
/** `isNew` / `newCount`: changed by the leader since the member's previous visit (PRD v3 F-1503). */
export type Portal = {
  today: ISODate; reminderDays: number; newCount: number;
  /** previous-visit baseline for "new" (null on the very first visit) */
  base: string | null;
  processes: { id: string; name: string; cell: Cell; isNew: boolean }[];
  logs: { id: string; processName: string; from: number; to: number; date: ISODate; note: string; isNew: boolean }[];
  plans: PortalPlan[];
  trainings: { id: string; name: string; trainedAt: ISODate | null; expiresAt: ISODate | null; isNew: boolean }[];
  month: string; attendance: { date: ISODate; statusName: string; category: AttCategory }[];
};

/** PRD v3 M12: everything the portal shows, always filtered by the session member. Leader notes never leave the server. */
export const loadPortal = cache(async (memberId: string): Promise<Portal> => {
  const c = db();
  const today = todayJakarta();
  const month = monthOf(today);
  const must = <T,>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data as T;
  };
  const [settings, processes, levels, logs, plans, mts, trainings, att, statuses, acc, cookieBase] = await Promise.all([
    c.from("settings").select("reminder_days").limit(1).maybeSingle(),
    c.from("processes").select("id, name, sort, active").order("sort"),
    c.from("skill_levels").select("process_id, level, target").eq("member_id", memberId),
    c.from("skill_logs").select("id, process_id, from_level, to_level, date, note, created_at").eq("member_id", memberId).order("date", { ascending: false }).limit(30),
    c.from("plans").select("id, process_id, from_level, target_level, start_date, due_date, method, mentor_id, status, note, created_at").eq("member_id", memberId).neq("status", "CANCELLED"),
    c.from("member_trainings").select("training_id, trained_at, expires_at").eq("member_id", memberId),
    c.from("trainings").select("id, name, sort").order("sort"),
    c.from("attendance").select("date, status_id").eq("member_id", memberId).gte("date", `${month}-01`).lte("date", today).order("date"),
    c.from("att_statuses").select("id, name, category"),
    c.from("member_accounts").select("last_seen_at").eq("member_id", memberId).maybeSingle(),
    readSeenBase(),
  ]);
  // Cookie = the baseline frozen at the start of this visit; before it exists, the DB value is the previous visit.
  const base = cookieBase ?? acc.data?.last_seen_at ?? null;
  const fresh = (ts: string | null | undefined) => isNewSince(ts, base);
  const procs = must(processes, "processes");
  const pname = new Map(procs.map((p) => [p.id, p.name as string]));
  const cells = new Map(must(levels, "skill_levels").map((l) => [l.process_id, { level: l.level, target: l.target } as Cell]));
  const planRows = must(plans, "plans");
  const mentorIds = [...new Set(planRows.map((p) => p.mentor_id).filter(Boolean))];
  const mentors = mentorIds.length ? must(await c.from("members").select("id, name").in("id", mentorIds), "mentors") : [];
  const mname = new Map(mentors.map((m) => [m.id, m.name as string]));
  const tname = new Map(must(trainings, "trainings").map((t) => [t.id, t.name as string]));
  const st = new Map(must(statuses, "att_statuses").map((s) => [s.id, s]));

  const logRows = must(logs, "skill_logs").map((l) => ({
    id: l.id, processId: l.process_id as string, processName: pname.get(l.process_id) ?? "-", from: l.from_level, to: l.to_level,
    date: l.date, note: l.note ?? "", isNew: fresh(l.created_at),
  }));
  const newProcs = new Set(logRows.filter((l) => l.isNew).map((l) => l.processId));
  const planList = planRows
    .map((p): PortalPlan => ({
      id: p.id, processName: pname.get(p.process_id) ?? "-", fromLevel: p.from_level, targetLevel: p.target_level,
      startDate: p.start_date, dueDate: p.due_date, method: p.method, mentorName: p.mentor_id ? mname.get(p.mentor_id) ?? null : null,
      status: displayStatus({ status: p.status, dueDate: p.due_date }, today), note: p.note ?? "", isNew: fresh(p.created_at),
    }))
    // active first (overdue, running, planned, evaluation), achieved last; then by due date
    .sort((a, b) => Number(a.status === "ACHIEVED") - Number(b.status === "ACHIEVED") || a.dueDate.localeCompare(b.dueDate));
  const trainList = must(mts, "member_trainings")
    .map((t) => ({ id: t.training_id, name: tname.get(t.training_id) ?? "-", trainedAt: t.trained_at, expiresAt: t.expires_at, isNew: fresh(t.trained_at) }))
    .sort((a, b) => (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999"));

  return {
    today, month, base,
    reminderDays: must(settings, "settings")?.reminder_days ?? 90,
    newCount: logRows.filter((l) => l.isNew).length + planList.filter((p) => p.isNew).length + trainList.filter((t) => t.isNew).length,
    processes: procs.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, cell: cells.get(p.id) ?? { level: 0, target: null }, isNew: newProcs.has(p.id) })),
    logs: logRows,
    plans: planList,
    trainings: trainList,
    attendance: must(att, "attendance").flatMap((a) => {
      const s = st.get(a.status_id);
      return s ? [{ date: a.date, statusName: s.name, category: s.category as AttCategory }] : [];
    }),
  };
});

export type MemberProfile = {
  id: string; name: string; noreg: string; photoUrl: string | null;
  position: string; status: string; joinDate: string; contractEnd: string | null;
};

// PRD v3 §8: the single gate for every member page and action. memberId comes from the signed cookie only,
// and the account must still be active with the same session_version. Columns are explicit: never `notes`.
// cache(): layout + page share one lookup per request.
export const requireMember = cache(async (): Promise<MemberProfile | null> => {
  const s = await readMemberSession();
  if (!s) return null;
  const client = db();
  const { data: acc } = await client.from("member_accounts").select("session_version").eq("member_id", s.memberId).maybeSingle();
  if (!acc || acc.session_version !== s.sessionVersion) return null;
  const { data: m } = await client
    .from("members")
    .select("id, name, noreg, photo_url, join_date, contract_end, active, position_id, status_id")
    .eq("id", s.memberId)
    .maybeSingle();
  if (!m || !m.active) return null;
  const [pos, emp] = await Promise.all([
    client.from("positions").select("name").eq("id", m.position_id).maybeSingle(),
    client.from("emp_statuses").select("name").eq("id", m.status_id).maybeSingle(),
  ]);
  return {
    id: m.id, name: m.name, noreg: m.noreg, photoUrl: m.photo_url, joinDate: m.join_date, contractEnd: m.contract_end,
    position: pos.data?.name ?? "", status: emp.data?.name ?? "",
  };
});
