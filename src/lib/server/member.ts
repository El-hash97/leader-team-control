import "server-only";
import { cache } from "react";
import { one, q } from "./db";
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
  const today = todayJakarta();
  const month = monthOf(today);
  type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const [settings, procs, levels, logs, planRows, mts, trainings, att, statuses, acc, cookieBase] = await Promise.all([
    one<R>("select reminder_days from settings limit 1"),
    q<R>("select id, name, sort, active from processes order by sort"),
    q<R>("select process_id, level, target from skill_levels where member_id = $1", [memberId]),
    q<R>("select id, process_id, from_level, to_level, date, note, created_at from skill_logs where member_id = $1 order by date desc limit 30", [memberId]),
    // mentor name joined here (the old client looked mentors up in a second request)
    q<R>(`select p.id, p.process_id, p.from_level, p.target_level, p.start_date, p.due_date, p.method, p.mentor_id, p.status, p.note, p.created_at,
        m.name as mentor_name from plans p left join members m on m.id = p.mentor_id where p.member_id = $1 and p.status <> 'CANCELLED'`, [memberId]),
    q<R>("select training_id, trained_at, expires_at from member_trainings where member_id = $1", [memberId]),
    q<R>("select id, name, sort from trainings order by sort"),
    q<R>("select date, status_id from attendance where member_id = $1 and date between $2 and $3 order by date", [memberId, `${month}-01`, today]),
    q<R>("select id, name, category from att_statuses"),
    one<{ last_seen_at: string | null }>("select last_seen_at from member_accounts where member_id = $1", [memberId]),
    readSeenBase(),
  ]);
  // Cookie = the baseline frozen at the start of this visit; before it exists, the DB value is the previous visit.
  const base = cookieBase ?? acc?.last_seen_at ?? null;
  const fresh = (ts: string | null | undefined) => isNewSince(ts, base);
  const pname = new Map(procs.map((p) => [p.id, p.name as string]));
  const cells = new Map(levels.map((l) => [l.process_id, { level: l.level, target: l.target } as Cell]));
  const tname = new Map(trainings.map((t) => [t.id, t.name as string]));
  const st = new Map(statuses.map((s) => [s.id, s]));

  const logRows = logs.map((l) => ({
    id: l.id, processId: l.process_id as string, processName: pname.get(l.process_id) ?? "-", from: l.from_level, to: l.to_level,
    date: l.date, note: l.note ?? "", isNew: fresh(l.created_at),
  }));
  const newProcs = new Set(logRows.filter((l) => l.isNew).map((l) => l.processId));
  const planList = planRows
    .map((p): PortalPlan => ({
      id: p.id, processName: pname.get(p.process_id) ?? "-", fromLevel: p.from_level, targetLevel: p.target_level,
      startDate: p.start_date, dueDate: p.due_date, method: p.method, mentorName: p.mentor_name ?? null,
      status: displayStatus({ status: p.status, dueDate: p.due_date }, today), note: p.note ?? "", isNew: fresh(p.created_at),
    }))
    // active first (overdue, running, planned, evaluation), achieved last; then by due date
    .sort((a, b) => Number(a.status === "ACHIEVED") - Number(b.status === "ACHIEVED") || a.dueDate.localeCompare(b.dueDate));
  const trainList = mts
    .map((t) => ({ id: t.training_id, name: tname.get(t.training_id) ?? "-", trainedAt: t.trained_at, expiresAt: t.expires_at, isNew: fresh(t.trained_at) }))
    .sort((a, b) => (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999"));

  return {
    today, month, base,
    reminderDays: settings?.reminder_days ?? 90,
    newCount: logRows.filter((l) => l.isNew).length + planList.filter((p) => p.isNew).length + trainList.filter((t) => t.isNew).length,
    processes: procs.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, cell: cells.get(p.id) ?? { level: 0, target: null }, isNew: newProcs.has(p.id) })),
    logs: logRows,
    plans: planList,
    trainings: trainList,
    attendance: att.flatMap((a) => {
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
  const m = await one<{
    id: string; name: string; noreg: string; photo_url: string | null; join_date: string; contract_end: string | null;
    position: string | null; status: string | null;
  }>(`select m.id, m.name, m.noreg, m.photo_url, m.join_date, m.contract_end, p.name as position, e.name as status
    from members m join member_accounts a on a.member_id = m.id
    left join positions p on p.id = m.position_id left join emp_statuses e on e.id = m.status_id
    where m.id = $1 and m.active and a.session_version = $2`, [s.memberId, s.sessionVersion]);
  if (!m) return null;
  return {
    id: m.id, name: m.name, noreg: m.noreg, photoUrl: m.photo_url, joinDate: m.join_date, contractEnd: m.contract_end,
    position: m.position ?? "", status: m.status ?? "",
  };
});
