// Mapping between Supabase rows (snake_case) and app types (camelCase).
// Shared by the server loader and the client-side save builders.
import type { AttCategory, PlanStatus } from "./rules";
import {
  attKey, type Member, type MemberTraining, type Plan, type PlanMethod, type Process, type Training,
  type Settings, type SkillLog, type Snapshot, type State,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export const TABLES = [
  "settings", "positions", "emp_statuses", "att_statuses", "trainings", "processes", "members",
  "skill_levels", "plans", "skill_logs", "member_trainings", "attendance", "holidays", "snapshots",
] as const;
export type Table = (typeof TABLES)[number];
export type Tables = Record<Table, Row[]>;

/** One write: upsert rows, update matching rows, or delete matching rows. */
export type Op =
  | { table: Table; upsert: Row[] }
  | { table: Table; update: Row; match: Row }
  | { table: Table; delete: Row };

export function toState(t: Tables): State {
  const s = t.settings[0] ?? {};
  const skills: State["skills"] = {};
  for (const r of t.skill_levels) (skills[r.member_id] ??= {})[r.process_id] = { level: r.level, target: r.target };
  const attendance: State["attendance"] = {};
  for (const r of t.attendance) attendance[attKey(r.date, r.member_id)] = { statusId: r.status_id, note: r.note, fromLeave: !!r.leave_request_id };
  return {
    positions: t.positions.map((r) => ({ id: r.id, name: r.name, order: r.sort })),
    empStatuses: t.emp_statuses.map((r) => ({ id: r.id, name: r.name, hasContract: r.has_contract })),
    attStatuses: [...t.att_statuses].sort((a, b) => a.sort - b.sort).map((r) => ({ id: r.id, name: r.name, category: r.category as AttCategory })),
    trainings: [...t.trainings].sort((a, b) => a.sort - b.sort).map((r) => ({ id: r.id, name: r.name, hasExpiry: r.has_expiry, order: r.sort })),
    processes: t.processes.map((r): Process => ({ id: r.id, name: r.name, order: r.sort, minBackup: r.min_backup, active: r.active })),
    members: t.members.map((r): Member => ({
      id: r.id, name: r.name, noreg: r.noreg, positionId: r.position_id, statusId: r.status_id,
      joinDate: r.join_date, contractEnd: r.contract_end, photoUrl: r.photo_url, notes: r.notes, active: r.active, deactivatedAt: r.deactivated_at,
    })),
    skills,
    skillLogs: t.skill_logs
      .map((r): SkillLog => ({ id: r.id, memberId: r.member_id, processId: r.process_id, from: r.from_level, to: r.to_level, date: r.date, note: r.note, planId: r.plan_id }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    plans: t.plans.map((r): Plan => ({
      id: r.id, memberId: r.member_id, processId: r.process_id, fromLevel: r.from_level, targetLevel: r.target_level,
      startDate: r.start_date, dueDate: r.due_date, method: r.method as PlanMethod, mentorId: r.mentor_id,
      status: r.status as PlanStatus, achievedAt: r.achieved_at, note: r.note,
    })),
    memberTrainings: t.member_trainings.map((r): MemberTraining => ({ memberId: r.member_id, trainingId: r.training_id, trainedAt: r.trained_at, expiresAt: r.expires_at })),
    attendance,
    holidays: t.holidays.map((r) => r.date).sort(),
    snapshots: t.snapshots.map((r): Snapshot => ({ id: r.id, month: r.month, kind: r.kind, multiSkillRate: r.multi_skill_rate, safeProcesses: r.safe_processes })),
    settings: {
      reminderDays: s.reminder_days ?? 90, multiSkillMinProcesses: s.multi_skill_min_processes ?? 3, multiSkillMinLevel: s.multi_skill_min_level ?? 3,
      defaultMinBackup: s.default_min_backup ?? 2, workWeekdays: s.work_weekdays ?? [1, 2, 3, 4, 5], qccTargetPct: s.qcc_target_pct ?? 70,
      qccBaselineDate: s.qcc_baseline_date ?? null,
      contractMonths: { vokasi: s.contract_vokasi ?? 6, pkwt1: s.contract_pkwt1 ?? 24, pkwt2Extra: s.contract_pkwt2_extra ?? 12 },
      attendanceStartDate: s.attendance_start_date ?? "2026-10-01",
    },
  };
}

// ---------- app → row ----------
export const memberRow = (m: Member): Row => ({
  id: m.id, name: m.name, noreg: m.noreg, position_id: m.positionId, status_id: m.statusId,
  join_date: m.joinDate, contract_end: m.contractEnd, photo_url: m.photoUrl, notes: m.notes, active: m.active, deactivated_at: m.deactivatedAt,
});
export const processRow = (p: Process): Row => ({ id: p.id, name: p.name, sort: p.order, min_backup: p.minBackup, active: p.active });
export const skillRow = (memberId: string, processId: string, level: number, target: number | null): Row =>
  ({ member_id: memberId, process_id: processId, level, target });
export const logRow = (l: SkillLog): Row => ({
  id: l.id, member_id: l.memberId, process_id: l.processId, from_level: l.from, to_level: l.to, date: l.date, note: l.note, plan_id: l.planId ?? null,
});
export const planRow = (p: Plan): Row => ({
  id: p.id, member_id: p.memberId, process_id: p.processId, from_level: p.fromLevel, target_level: p.targetLevel,
  start_date: p.startDate, due_date: p.dueDate, method: p.method, mentor_id: p.mentorId, status: p.status, achieved_at: p.achievedAt, note: p.note,
});
export const trainingMasterRow = (t: Training): Row => ({ id: t.id, name: t.name, has_expiry: t.hasExpiry, sort: t.order });
export const trainingRow = (t: MemberTraining): Row => ({ member_id: t.memberId, training_id: t.trainingId, trained_at: t.trainedAt, expires_at: t.expiresAt });
// Any manual write unlinks the row from a leave request, so cancelling that leave later leaves this row alone (PRD v3 F-1406/F-1407).
export const attRow = (date: string, memberId: string, statusId: string, note: string): Row => ({ member_id: memberId, date, status_id: statusId, note, leave_request_id: null });
export const snapshotRow = (x: Snapshot): Row => ({ id: x.id, month: x.month, kind: x.kind, multi_skill_rate: x.multiSkillRate, safe_processes: x.safeProcesses });
export const settingsRow = (s: Settings): Row => ({
  reminder_days: s.reminderDays, multi_skill_min_processes: s.multiSkillMinProcesses, multi_skill_min_level: s.multiSkillMinLevel,
  default_min_backup: s.defaultMinBackup, work_weekdays: s.workWeekdays, qcc_target_pct: s.qccTargetPct, qcc_baseline_date: s.qccBaselineDate,
  contract_vokasi: s.contractMonths.vokasi, contract_pkwt1: s.contractMonths.pkwt1, contract_pkwt2_extra: s.contractMonths.pkwt2Extra,
  attendance_start_date: s.attendanceStartDate,
});
