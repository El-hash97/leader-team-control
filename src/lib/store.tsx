"use client";
// App state loaded from Supabase by the (app) layout. Actions update the screen first,
// then persist through the `save` server action; a failed write reloads from the database.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { attKey, type State, type Member, type Plan, type Settings, type Process, type SkillLog, type Training } from "./types";
import {
  attRow, logRow, memberRow, planRow, processRow, settingsRow, skillRow, snapshotRow, trainingMasterRow, trainingRow, type Op,
} from "./db-map";
import { loadState, save } from "@/app/actions";
import {
  todayJakarta, memberWorkdays, performance, isMultiSkill, backupCount, daysLeft,
  displayStatus, lastWorkday, rate, type LevelMap, type PlanStatus, type ISODate,
} from "./rules";

type Toast = { id: number; msg: string };

export type MonthlyRow = {
  member: Member; records: number; workdays: number; fulfilled: number; perf: number | null;
  hadir: number; dinas: number; training: number; sakit: number; cuti: number; izin: number; alpa: number;
};

export type Alert = { kind: "contract" | "sio" | "plan" | "attendance"; title: string; detail: string; days?: number; href: string };

const uid = () => crypto.randomUUID();

function useStoreValue(initial: State) {
  const today = useMemo(() => todayJakarta(), []);
  const [s, setS] = useState<State>(initial);
  const latest = useRef(initial); // always the newest state, even between renders
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saving, setSaving] = useState(0);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  /** Apply `next` on screen now, write `ops` to Supabase in the background. */
  const commit = (next: State, ops: Op[]) => {
    latest.current = next;
    setS(next);
    if (!ops.length) return;
    setSaving((n) => n + 1);
    save(ops)
      .then(async (r) => {
        if (r.ok) return;
        toast(`Gagal menyimpan: ${r.error}. Data dimuat ulang.`);
        const fresh = await loadState();
        latest.current = fresh;
        setS(fresh);
      })
      .catch(() => toast("Koneksi ke server terputus. Perubahan terakhir mungkin belum tersimpan."))
      .finally(() => setSaving((n) => n - 1));
  };
  const cur = () => latest.current;

  const posOrder = useMemo(() => Object.fromEntries(s.positions.map((p) => [p.id, p.order])), [s.positions]);
  const sortMembers = useCallback(
    (a: Member, b: Member) => (posOrder[a.positionId] ?? 99) - (posOrder[b.positionId] ?? 99) || a.joinDate.localeCompare(b.joinDate),
    [posOrder],
  );
  const activeMembers = useMemo(() => s.members.filter((m) => m.active).sort(sortMembers), [s.members, sortMembers]);
  const processes = useMemo(() => s.processes.filter((p) => p.active).sort((a, b) => a.order - b.order), [s.processes]);
  const pids = useMemo(() => processes.map((p) => p.id), [processes]);
  const cfg = s.settings;
  const refDay = useMemo(() => lastWorkday(today, cfg.workWeekdays, s.holidays), [today, cfg.workWeekdays, s.holidays]);

  const levels = useCallback((memberId: string): LevelMap => {
    const row = s.skills[memberId] ?? {};
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.level]));
  }, [s.skills]);
  const multi = useCallback((id: string) => isMultiSkill(levels(id), pids, cfg.multiSkillMinProcesses, cfg.multiSkillMinLevel), [levels, pids, cfg]);

  const multiSkillRate = useMemo(() => rate(activeMembers.filter((m) => multi(m.id)).length, activeMembers.length), [activeMembers, multi]);
  const backup = useMemo(() => {
    const all = activeMembers.map((m) => levels(m.id));
    return processes.map((p) => {
      const count = backupCount(all, p.id);
      const min = p.minBackup ?? cfg.defaultMinBackup;
      return { process: p, count, min, ok: count >= min };
    });
  }, [activeMembers, processes, levels, cfg.defaultMinBackup]);

  const statusById = useMemo(() => Object.fromEntries(s.attStatuses.map((a) => [a.id, a])), [s.attStatuses]);
  const att = useCallback((date: ISODate, memberId: string) => s.attendance[attKey(date, memberId)], [s.attendance]);

  const monthly = useCallback((month: string): MonthlyRow[] => {
    const wcfg = { workWeekdays: cfg.workWeekdays, holidays: s.holidays, today };
    return activeMembers.map((m) => {
      const row: MonthlyRow = { member: m, records: 0, workdays: memberWorkdays(month, m, wcfg), fulfilled: 0, perf: null, hadir: 0, dinas: 0, training: 0, sakit: 0, cuti: 0, izin: 0, alpa: 0 };
      for (const [k, v] of Object.entries(s.attendance)) {
        if (!k.startsWith(month) || !k.endsWith(`|${m.id}`)) continue;
        const st = statusById[v.statusId];
        if (!st) continue;
        row.records++;
        if (st.category === "FULFILLED") row.fulfilled++;
        if (st.name === "Hadir") row.hadir++;
        else if (st.name === "Dinas") row.dinas++;
        else if (st.name === "Training") row.training++;
        else if (st.category === "SICK") row.sakit++;
        else if (st.category === "LEAVE") row.cuti++;
        else if (st.category === "PERMIT") row.izin++;
        else if (st.category === "ABSENT") row.alpa++;
      }
      row.perf = performance(row.fulfilled, row.workdays);
      return row;
    }).sort((a, b) => (b.perf ?? -1) - (a.perf ?? -1) || a.member.name.localeCompare(b.member.name));
  }, [activeMembers, s.attendance, s.holidays, statusById, cfg.workWeekdays, today]);

  const alerts = useMemo((): Alert[] => {
    const out: Alert[] = [];
    const contractIds = new Set(s.empStatuses.filter((e) => e.hasContract).map((e) => e.id));
    for (const m of activeMembers) {
      if (!m.contractEnd || !contractIds.has(m.statusId)) continue;
      const d = daysLeft(m.contractEnd, today);
      if (d <= cfg.reminderDays) out.push({ kind: "contract", title: m.name, detail: "Kontrak berakhir", days: d, href: `/members/${m.id}` });
    }
    for (const mt of s.memberTrainings) {
      const m = activeMembers.find((x) => x.id === mt.memberId);
      if (!m || !mt.expiresAt) continue;
      const d = daysLeft(mt.expiresAt, today);
      const t = s.trainings.find((x) => x.id === mt.trainingId);
      if (t && d <= cfg.reminderDays) out.push({ kind: "sio", title: m.name, detail: `${t.name} habis`, days: d, href: `/members/${m.id}` });
    }
    for (const p of s.plans) {
      if (displayStatus(p, today) !== "OVERDUE") continue;
      const m = s.members.find((x) => x.id === p.memberId);
      const pr = s.processes.find((x) => x.id === p.processId);
      if (m && pr) out.push({ kind: "plan", title: m.name, detail: `Rencana ${pr.name} lewat target`, days: daysLeft(p.dueDate, today), href: "/plans" });
    }
    const missing = activeMembers.filter((m) => !att(refDay, m.id)).length;
    if (missing)
      out.push({
        kind: "attendance", title: `${missing} member belum diabsen`,
        detail: refDay === today ? "Absensi hari ini belum lengkap" : "Absensi hari kerja terakhir belum lengkap",
        href: `/attendance?date=${refDay}`,
      });
    return out.sort((a, b) => (a.days ?? -999) - (b.days ?? -999));
  }, [activeMembers, s, today, refDay, cfg, att]);

  // ---------- actions ----------
  const cell = (st: State, memberId: string, processId: string) => st.skills[memberId]?.[processId] ?? { level: 0, target: null };
  const withCell = (st: State, memberId: string, processId: string, c: { level: number; target: number | null }): State =>
    ({ ...st, skills: { ...st.skills, [memberId]: { ...st.skills[memberId], [processId]: c } } });

  /** Level change + history row; returns the ops so callers can batch them. */
  const levelChange = (st: State, memberId: string, processId: string, level: number, date: ISODate, note: string, planId?: string): [State, Op[]] => {
    const prev = cell(st, memberId, processId);
    if (prev.level === level) return [st, []];
    const log: SkillLog = { id: uid(), memberId, processId, from: prev.level, to: level, date, note, planId };
    const next = { ...withCell(st, memberId, processId, { ...prev, level }), skillLogs: [log, ...st.skillLogs] };
    return [next, [
      { table: "skill_levels", upsert: [skillRow(memberId, processId, level, prev.target)] },
      { table: "skill_logs", upsert: [logRow(log)] },
    ]];
  };

  const setLevel = (memberId: string, processId: string, level: number, date: ISODate, note: string) =>
    commit(...levelChange(cur(), memberId, processId, level, date, note));

  const setTarget = (memberId: string, processId: string, target: number | null) => {
    const st = cur(), prev = cell(st, memberId, processId);
    commit(withCell(st, memberId, processId, { ...prev, target }), [{ table: "skill_levels", upsert: [skillRow(memberId, processId, prev.level, target)] }]);
  };

  const saveMember = (m: Member) => {
    const st = cur();
    const exists = st.members.some((x) => x.id === m.id);
    const member = exists ? m : { ...m, id: m.id || uid() };
    commit({ ...st, members: exists ? st.members.map((x) => (x.id === m.id ? member : x)) : [...st.members, member] },
      [{ table: "members", upsert: [memberRow(member)] }]);
  };

  const setActive = (id: string, active: boolean) => {
    const st = cur(), deactivatedAt = active ? null : today;
    commit({ ...st, members: st.members.map((m) => (m.id === id ? { ...m, active, deactivatedAt } : m)) },
      [{ table: "members", update: { active, deactivated_at: deactivatedAt }, match: { id } }]);
  };

  const setAttendance = (date: ISODate, memberId: string, statusId: string) => {
    const st = cur(), k = attKey(date, memberId), attendance = { ...st.attendance };
    if (!statusId) {
      delete attendance[k];
      return commit({ ...st, attendance }, [{ table: "attendance", delete: { member_id: memberId, date } }]);
    }
    const note = attendance[k]?.note ?? "";
    attendance[k] = { statusId, note };
    commit({ ...st, attendance }, [{ table: "attendance", upsert: [attRow(date, memberId, statusId, note)] }]);
  };

  // v1 behaviour: a note without status creates a "Hadir" record
  const setAttendanceNote = (date: ISODate, memberId: string, note: string) => {
    const st = cur(), k = attKey(date, memberId), prev = st.attendance[k];
    if (!prev && !note.trim()) return;
    const hadir = st.attStatuses.find((a) => a.name === "Hadir")?.id ?? "as0";
    const rec = { statusId: prev?.statusId ?? hadir, note: note.trim() };
    commit({ ...st, attendance: { ...st.attendance, [k]: rec } }, [{ table: "attendance", upsert: [attRow(date, memberId, rec.statusId, rec.note)] }]);
  };

  // F-702: fills only members that have no record on that date
  const fillUnfilled = (date: ISODate, statusId: string, memberIds: string[]) => {
    const st = cur(), attendance = { ...st.attendance };
    const ids = memberIds.filter((id) => !attendance[attKey(date, id)]);
    for (const id of ids) attendance[attKey(date, id)] = { statusId, note: "" };
    commit({ ...st, attendance }, ids.length ? [{ table: "attendance", upsert: ids.map((id) => attRow(date, id, statusId, "")) }] : []);
  };

  const setMemberTraining = (memberId: string, trainingId: string, data: { trainedAt: ISODate | null; expiresAt: ISODate | null } | null) => {
    const st = cur(), rest = st.memberTrainings.filter((t) => !(t.memberId === memberId && t.trainingId === trainingId));
    if (!data) return commit({ ...st, memberTrainings: rest }, [{ table: "member_trainings", delete: { member_id: memberId, training_id: trainingId } }]);
    const row = { memberId, trainingId, ...data };
    commit({ ...st, memberTrainings: [...rest, row] }, [{ table: "member_trainings", upsert: [trainingRow(row)] }]);
  };

  // ---------- training master ----------
  const addTraining = (name: string, hasExpiry: boolean) => {
    const st = cur();
    const t: Training = { id: uid(), name, hasExpiry, order: Math.max(-1, ...st.trainings.map((x) => x.order)) + 1 };
    commit({ ...st, trainings: [...st.trainings, t] }, [{ table: "trainings", upsert: [trainingMasterRow(t)] }]);
  };
  const updateTraining = (id: string, patch: Partial<Training>) => {
    const st = cur(), trainings = st.trainings.map((t) => (t.id === id ? { ...t, ...patch } : t));
    commit({ ...st, trainings }, [{ table: "trainings", upsert: trainings.filter((t) => t.id === id).map(trainingMasterRow) }]);
  };
  // only unused trainings: deleting a used one would cascade-delete member training history
  const removeTraining = (id: string) => {
    const st = cur();
    if (st.memberTrainings.some((m) => m.trainingId === id)) return;
    commit({ ...st, trainings: st.trainings.filter((t) => t.id !== id) }, [{ table: "trainings", delete: { id } }]);
  };

  const addPlan = (p: Plan) => {
    const st = cur(), plan = { ...p, id: uid() };
    commit({ ...st, plans: [plan, ...st.plans] }, [{ table: "plans", upsert: [planRow(plan)] }]);
  };

  // F-503: ACHIEVED also raises the skill level and writes history
  const setPlanStatus = (id: string, status: PlanStatus) => {
    const st = cur(), p = st.plans.find((x) => x.id === id);
    if (!p) return;
    const achievedAt = status === "ACHIEVED" ? today : null;
    let next: State = { ...st, plans: st.plans.map((x) => (x.id === id ? { ...x, status, achievedAt } : x)) };
    const ops: Op[] = [{ table: "plans", update: { status, achieved_at: achievedAt }, match: { id } }];
    if (status === "ACHIEVED") {
      const [n, more] = levelChange(next, p.memberId, p.processId, p.targetLevel, today, "Rencana peningkatan tercapai", p.id);
      next = n;
      ops.push(...more);
    }
    commit(next, ops);
  };

  const updateSettings = (patch: Partial<Settings>) => {
    const st = cur(), settings = { ...st.settings, ...patch };
    commit({ ...st, settings }, [{ table: "settings", update: settingsRow(settings), match: { id: 1 } }]);
  };

  const addProcess = (name: string) => {
    const st = cur();
    const p: Process = { id: uid(), name, order: st.processes.length, minBackup: null, active: true };
    commit({ ...st, processes: [...st.processes, p] }, [{ table: "processes", upsert: [processRow(p)] }]);
  };
  const updateProcess = (id: string, patch: Partial<Process>) => {
    const st = cur(), processes = st.processes.map((p) => (p.id === id ? { ...p, ...patch } : p));
    commit({ ...st, processes }, [{ table: "processes", upsert: processes.filter((p) => p.id === id).map(processRow) }]);
  };
  const moveProcess = (id: string, dir: -1 | 1) => {
    const st = cur(), list = [...st.processes].sort((a, b) => a.order - b.order);
    const i = list.findIndex((p) => p.id === id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const processes = list.map((p, k) => ({ ...p, order: k }));
    commit({ ...st, processes }, [{ table: "processes", upsert: [processes[i], processes[j]].map(processRow) }]);
  };

  const addHoliday = (d: ISODate) => {
    const st = cur();
    if (st.holidays.includes(d)) return;
    commit({ ...st, holidays: [...st.holidays, d].sort() }, [{ table: "holidays", upsert: [{ date: d }] }]);
  };
  const removeHoliday = (d: ISODate) => {
    const st = cur();
    commit({ ...st, holidays: st.holidays.filter((x) => x !== d) }, [{ table: "holidays", delete: { date: d } }]);
  };

  const takeBaseline = () => {
    const st = cur();
    const snap = { id: uid(), month: today.slice(0, 7), kind: "BASELINE" as const, multiSkillRate, safeProcesses: backup.filter((b) => b.ok).length };
    const settings = { ...st.settings, qccBaselineDate: today };
    commit({ ...st, settings, snapshots: [snap, ...st.snapshots.filter((x) => x.kind !== "BASELINE")] }, [
      { table: "snapshots", delete: { kind: "BASELINE" } },
      { table: "snapshots", upsert: [snapshotRow(snap)] },
      { table: "settings", update: { qcc_baseline_date: today }, match: { id: 1 } },
    ]);
  };

  return {
    s, today, refDay, toasts, toast, saving: saving > 0, activeMembers, processes, pids, levels, multi, multiSkillRate, backup,
    statusById, att, monthly, alerts, sortMembers,
    setLevel, setTarget, saveMember, setActive, setAttendance, setAttendanceNote, fillUnfilled, setMemberTraining, addPlan, setPlanStatus,
    updateSettings, addProcess, updateProcess, moveProcess, addTraining, updateTraining, removeTraining, addHoliday, removeHoliday, takeBaseline,
  };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ initial, children }: { initial: State; children: ReactNode }) {
  return <Ctx.Provider value={useStoreValue(initial)}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
