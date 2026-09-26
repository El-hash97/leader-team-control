"use client";
// In-memory preview store. Mirrors the PRD data model so pages can later swap
// these actions for Server Actions without changing their markup.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { buildMock, attKey, type State, type Member, type Plan, type Settings, type Process } from "./mock";
import {
  todayJakarta, memberWorkdays, performance, isMultiSkill, backupCount, daysLeft,
  displayStatus, lastWorkday, rate, type LevelMap, type PlanStatus, type ISODate,
} from "./rules";

/** sessionStorage flag set by the preview login page. */
export const AUTH_KEY = "ltc-auth";

type Toast = { id: number; msg: string };

export type MonthlyRow = {
  member: Member; records: number; workdays: number; fulfilled: number; perf: number | null;
  hadir: number; dinas: number; training: number; sakit: number; cuti: number; izin: number; alpa: number;
};

export type Alert = { kind: "contract" | "sio" | "plan" | "attendance"; title: string; detail: string; days?: number; href: string };

function useStoreValue() {
  const today = useMemo(() => todayJakarta(), []);
  const [s, setS] = useState<State>(() => buildMock(today));
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

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
  const setLevel = (memberId: string, processId: string, level: number, date: ISODate, note: string, planId?: string) =>
    setS((st) => {
      const prev = st.skills[memberId]?.[processId] ?? { level: 0, target: null };
      if (prev.level === level) return st;
      return {
        ...st,
        skills: { ...st.skills, [memberId]: { ...st.skills[memberId], [processId]: { ...prev, level } } },
        skillLogs: [{ id: `sl${Date.now()}`, memberId, processId, from: prev.level, to: level, date, note, planId }, ...st.skillLogs],
      };
    });

  const setTarget = (memberId: string, processId: string, target: number | null) =>
    setS((st) => {
      const prev = st.skills[memberId]?.[processId] ?? { level: 0, target: null };
      return { ...st, skills: { ...st.skills, [memberId]: { ...st.skills[memberId], [processId]: { ...prev, target } } } };
    });

  const saveMember = (m: Member) =>
    setS((st) => {
      const exists = st.members.some((x) => x.id === m.id);
      const skills = exists ? st.skills : { ...st.skills, [m.id]: Object.fromEntries(st.processes.map((p) => [p.id, { level: 0, target: null }])) };
      return { ...st, skills, members: exists ? st.members.map((x) => (x.id === m.id ? m : x)) : [...st.members, m] };
    });

  const setActive = (id: string, active: boolean) =>
    setS((st) => ({ ...st, members: st.members.map((m) => (m.id === id ? { ...m, active, deactivatedAt: active ? null : today } : m)) }));

  const setAttendance = (date: ISODate, memberId: string, statusId: string) =>
    setS((st) => {
      const k = attKey(date, memberId);
      const attendance = { ...st.attendance };
      if (!statusId) delete attendance[k];
      else attendance[k] = { statusId, note: attendance[k]?.note ?? "" };
      return { ...st, attendance };
    });

  // v1 behaviour: a note without status creates a "Hadir" record
  const setAttendanceNote = (date: ISODate, memberId: string, note: string) =>
    setS((st) => {
      const k = attKey(date, memberId);
      const cur = st.attendance[k];
      if (!cur && !note.trim()) return st;
      return { ...st, attendance: { ...st.attendance, [k]: { statusId: cur?.statusId ?? "as0", note: note.trim() } } };
    });

  // F-702: fills only members that have no record on that date
  const fillUnfilled = (date: ISODate, statusId: string, memberIds: string[]) =>
    setS((st) => {
      const attendance = { ...st.attendance };
      for (const id of memberIds) if (!attendance[attKey(date, id)]) attendance[attKey(date, id)] = { statusId, note: "" };
      return { ...st, attendance };
    });

  const setMemberTraining = (memberId: string, trainingId: string, data: { trainedAt: ISODate | null; expiresAt: ISODate | null } | null) =>
    setS((st) => {
      const rest = st.memberTrainings.filter((t) => !(t.memberId === memberId && t.trainingId === trainingId));
      return { ...st, memberTrainings: data ? [...rest, { memberId, trainingId, ...data }] : rest };
    });

  const addPlan = (p: Plan) => setS((st) => ({ ...st, plans: [p, ...st.plans] }));

  // F-503: ACHIEVED also raises the skill level and writes history
  const setPlanStatus = (id: string, status: PlanStatus) => {
    const p = s.plans.find((x) => x.id === id);
    if (!p) return;
    setS((st) => ({ ...st, plans: st.plans.map((x) => (x.id === id ? { ...x, status, achievedAt: status === "ACHIEVED" ? today : null } : x)) }));
    if (status === "ACHIEVED") setLevel(p.memberId, p.processId, p.targetLevel, today, "Rencana peningkatan tercapai", p.id);
  };

  const updateSettings = (patch: Partial<Settings>) => setS((st) => ({ ...st, settings: { ...st.settings, ...patch } }));

  const addProcess = (name: string) =>
    setS((st) => {
      const id = `pr${Date.now()}`;
      const skills = Object.fromEntries(Object.entries(st.skills).map(([m, row]) => [m, { ...row, [id]: { level: 0, target: null } }]));
      return { ...st, skills, processes: [...st.processes, { id, name, order: st.processes.length, minBackup: null, active: true }] };
    });
  const updateProcess = (id: string, patch: Partial<Process>) =>
    setS((st) => ({ ...st, processes: st.processes.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const moveProcess = (id: string, dir: -1 | 1) =>
    setS((st) => {
      const list = [...st.processes].sort((a, b) => a.order - b.order);
      const i = list.findIndex((p) => p.id === id), j = i + dir;
      if (j < 0 || j >= list.length) return st;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...st, processes: list.map((p, k) => ({ ...p, order: k })) };
    });

  const addHoliday = (d: ISODate) => setS((st) => (st.holidays.includes(d) ? st : { ...st, holidays: [...st.holidays, d].sort() }));
  const removeHoliday = (d: ISODate) => setS((st) => ({ ...st, holidays: st.holidays.filter((x) => x !== d) }));

  const takeBaseline = () =>
    setS((st) => ({
      ...st,
      settings: { ...st.settings, qccBaselineDate: today },
      snapshots: [
        { month: today.slice(0, 7), kind: "BASELINE", multiSkillRate, safeProcesses: backup.filter((b) => b.ok).length },
        ...st.snapshots.filter((x) => x.kind !== "BASELINE"),
      ],
    }));

  const resetDemo = () => setS(buildMock(today));

  return {
    s, today, refDay, toasts, toast, activeMembers, processes, pids, levels, multi, multiSkillRate, backup,
    statusById, att, monthly, alerts, sortMembers,
    setLevel, setTarget, saveMember, setActive, setAttendance, setAttendanceNote, fillUnfilled, setMemberTraining, addPlan, setPlanStatus,
    updateSettings, addProcess, updateProcess, moveProcess, addHoliday, removeHoliday, takeBaseline, resetDemo,
  };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useStoreValue()}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
