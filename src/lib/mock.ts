// Synthetic preview data. Every value here is a placeholder ("Member 01", "Proses 1")
// so nobody mistakes it for real people or real processes. Replace with DB later.
import { addDays, addMonths, contractMonthsFor, isWorkday, lastWorkday, monthOf, shiftMonth, monthStart, type ContractMonths, type ISODate, type PlanStatus, type AttCategory } from "./rules";

// Employee class (golongan). Vokasi has no class.
export const KELAS = ["3A", "3B", "3C", "4A", "4B", "4C", "5A", "5B", "5C", "6A", "6B", "6C"] as const;
export type Kelas = (typeof KELAS)[number];
export const kelasGroup = (k: Kelas | null) => (k ? k[0] : null);

export type Position ={ id: string; name: string; order: number };
export type EmpStatus = { id: string; name: string; hasContract: boolean };
export type AttStatus = { id: string; name: string; category: AttCategory };
export type Process = { id: string; name: string; order: number; minBackup: number | null; active: boolean };
export type Training = { id: string; name: string; hasExpiry: boolean };
export type Member = {
  id: string; name: string; noreg: string; positionId: string; statusId: string; kelas: Kelas | null;
  joinDate: ISODate; contractEnd: ISODate | null; photoUrl: string | null; notes: string;
  active: boolean; deactivatedAt: ISODate | null;
};
export type Cell = { level: number; target: number | null };
export type SkillLog = { id: string; memberId: string; processId: string; from: number; to: number; date: ISODate; note: string; planId?: string };
export type PlanMethod = "OJT" | "TJI" | "CLASS" | "MENTORING" | "OTHER";
export type Plan = {
  id: string; memberId: string; processId: string; fromLevel: number; targetLevel: number;
  startDate: ISODate; dueDate: ISODate; method: PlanMethod; mentorId: string | null;
  status: PlanStatus; achievedAt: ISODate | null; note: string;
};
export type MemberTraining = { memberId: string; trainingId: string; trainedAt: ISODate | null; expiresAt: ISODate | null };
export type AttRecord = { statusId: string; note: string };
export type Snapshot = { month: string; kind: "BASELINE" | "MONTHLY"; multiSkillRate: number; safeProcesses: number };
export type Settings = {
  reminderDays: number; multiSkillMinProcesses: number; multiSkillMinLevel: number; defaultMinBackup: number;
  workWeekdays: number[]; qccTargetPct: number; qccBaselineDate: ISODate | null;
  contractMonths: ContractMonths;
};

/** Vokasi 6 bulan, PKWT 1 = 2 tahun, PKWT 2 = PKWT 1 + 1 tahun. Karyawan Tetap tanpa kontrak. */
export const DEFAULT_CONTRACT: ContractMonths = { vokasi: 6, pkwt1: 24, pkwt2Extra: 12 };

export type State = {
  positions: Position[]; empStatuses: EmpStatus[]; attStatuses: AttStatus[]; processes: Process[]; trainings: Training[];
  members: Member[]; skills: Record<string, Record<string, Cell>>; skillLogs: SkillLog[]; plans: Plan[];
  memberTrainings: MemberTraining[]; attendance: Record<string, AttRecord>; holidays: ISODate[];
  snapshots: Snapshot[]; settings: Settings;
};

export const attKey = (date: ISODate, memberId: string) => `${date}|${memberId}`;

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMock(today: ISODate): State {
  const r = rng(7);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];

  const positions: Position[] = ["Group Leader", "Group Expert", "Team Leader", "Team Expert", "Team Member", "PKWT 2", "PKWT 1", "Vokasi"]
    .map((name, i) => ({ id: `pos${i}`, name, order: i }));
  const empStatuses: EmpStatus[] = [
    { id: "es0", name: "Karyawan Tetap", hasContract: false },
    { id: "es1", name: "PKWT", hasContract: true },
    { id: "es2", name: "Vokasi", hasContract: true },
  ];
  const attStatuses: AttStatus[] = ([
    ["Hadir", "FULFILLED"], ["Sakit", "SICK"], ["Sakit + Dokter", "SICK"], ["Cuti", "LEAVE"], ["Izin", "PERMIT"],
    ["Izin Pribadi", "PERMIT"], ["Dinas", "FULFILLED"], ["Training", "FULFILLED"], ["Alpa", "ABSENT"], ["Lainnya", "OTHER"],
  ] as const).map(([name, category], i) => ({ id: `as${i}`, name, category }));
  const processes: Process[] = Array.from({ length: 8 }, (_, i) => ({ id: `pr${i + 1}`, name: `Proses ${i + 1}`, order: i, minBackup: null, active: true }));
  const trainings: Training[] = ["FS CASTING", "BASIC TJI", "TJI", "BASIC TPS", "TPS SW & KAIZEN", "G-QCC", "SGK TYPE A", "SGK TYPE B", "SGK TYPE C",
    "TL ROLE", "GL ROLE", "FF & KODOKAN", "SIO FORKLIFT", "SIO CRANE", "SAFETY HIGH PLACE"]
    .map((name, i) => ({ id: `tr${i}`, name, hasExpiry: name.startsWith("SIO") }));

  // rank index per member (index into positions)
  const ranks = [0, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7];
  const joinYearsAgo = [18, 15, 12, 11, 9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1.6, 1, 0.9, 0.7, 0.35, 0.3];
  // days until contract end, in order: PKWT 2 ×3, PKWT 1 ×3, Vokasi ×2 (vokasi ≤ 6 bulan)
  const contractOffsets = [-3, 12, 45, 80, 150, 200, 40, 150];
  const kelasByMember: Kelas[] = ["6A", "5C", "5B", "5A", "4C", "4C", "4B", "4B", "4A", "4A", "4A", "3C", "3C", "3C", "3B", "3B", "3B", "3A", "3A", "3A", "3A", "3A", "3A", "3A"];
  let c = 0;
  const members: Member[] = ranks.map((rank, i) => {
    const statusId = rank >= 7 ? "es2" : rank >= 5 ? "es1" : "es0";
    const n = String(i + 1).padStart(2, "0");
    // contract members: pick the end date, then derive join date from the contract rules
    const kind = rank === 7 ? "vokasi" : rank === 5 ? "pkwt2" : rank === 6 ? "pkwt1" : null;
    const contractEnd = kind ? addDays(today, contractOffsets[c++]) : null;
    return {
      id: `m${n}`, name: `Member ${n}`, noreg: String(1_020_311 + i * 137), positionId: `pos${rank}`, statusId,
      kelas: statusId === "es2" ? null : kelasByMember[i],
      joinDate: contractEnd ? addMonths(addDays(contractEnd, 1), -contractMonthsFor(kind, DEFAULT_CONTRACT)!) : addDays(today, -Math.round(joinYearsAgo[i] * 365)),
      contractEnd,
      photoUrl: null, notes: "", active: true, deactivatedAt: null,
    };
  });

  // skill levels: seniors higher; Proses 7 & 8 deliberately thin to show "tanpa cadangan"
  const base = [4, 4, 3, 3, 2, 1, 1, 0];
  const skills: State["skills"] = {};
  members.forEach((m, i) => {
    skills[m.id] = {};
    processes.forEach((p, pi) => {
      let lv = Math.max(0, Math.min(4, base[ranks[i]] + Math.floor(r() * 4) - 2));
      if (pi >= 6 && lv >= 3 && i !== pi - 5) lv = 2;
      const target = lv < 3 && r() < 0.22 ? 3 : null;
      skills[m.id][p.id] = { level: lv, target };
    });
  });

  // skill history (last 6 months)
  const skillLogs: SkillLog[] = [];
  for (let k = 0; k < 26; k++) {
    const m = pick(members), p = pick(processes), to = skills[m.id][p.id].level;
    if (to === 0) continue;
    skillLogs.push({ id: `sl${k}`, memberId: m.id, processId: p.id, from: to - 1, to, date: addDays(today, -Math.floor(r() * 180)), note: "Evaluasi OJT (data contoh)" });
  }
  skillLogs.sort((a, b) => b.date.localeCompare(a.date));

  // plans: from cells that have a target
  const statuses: PlanStatus[] = ["IN_PROGRESS", "IN_PROGRESS", "PLANNED", "EVALUATION", "IN_PROGRESS", "PLANNED", "IN_PROGRESS", "EVALUATION", "PLANNED", "IN_PROGRESS", "PLANNED", "IN_PROGRESS"];
  const dueOffsets = [-9, 20, 75, 5, 40, 110, -2, 14, 140, 60, 95, 30];
  const methods: PlanMethod[] = ["OJT", "OJT", "MENTORING", "TJI", "OJT", "CLASS"];
  const plans: Plan[] = [];
  for (const m of members) for (const p of processes) {
    const cell = skills[m.id][p.id];
    if (cell.target === null || plans.length >= statuses.length) continue;
    const k = plans.length, due = dueOffsets[k];
    plans.push({
      id: `pl${k}`, memberId: m.id, processId: p.id, fromLevel: cell.level, targetLevel: cell.target,
      startDate: addDays(today, due - 90), dueDate: addDays(today, due), method: methods[k % methods.length],
      mentorId: members[k % 4].id === m.id ? null : members[k % 4].id, status: statuses[k], achievedAt: null, note: "",
    });
  }
  // two achieved plans for history
  [members[10], members[14]].forEach((m, k) => {
    const p = processes[k + 1];
    plans.push({
      id: `pla${k}`, memberId: m.id, processId: p.id, fromLevel: Math.max(0, skills[m.id][p.id].level - 1), targetLevel: skills[m.id][p.id].level,
      startDate: addDays(today, -150), dueDate: addDays(today, -40 + k * 10), method: "OJT", mentorId: members[2].id,
      status: "ACHIEVED", achievedAt: addDays(today, -45 + k * 10), note: "",
    });
  });

  // trainings
  const memberTrainings: MemberTraining[] = [];
  const give = (m: Member, tid: string, daysAgo: number, expiresIn: number | null = null) =>
    memberTrainings.push({ memberId: m.id, trainingId: tid, trainedAt: addDays(today, -daysAgo), expiresAt: expiresIn === null ? null : addDays(today, expiresIn) });
  members.forEach((m, i) => {
    give(m, "tr0", 900 - i * 30);
    if (ranks[i] <= 5) give(m, "tr3", 700 - i * 20);
    if (ranks[i] <= 3) { give(m, "tr1", 1200); give(m, "tr2", 1000); give(m, "tr5", 600); }
    if (ranks[i] <= 2) give(m, "tr9", 1500);
    if (ranks[i] === 0) give(m, "tr10", 2000);
    if (i % 3 === 0) give(m, "tr14", 400);
  });
  [[4, -5], [6, 20], [8, 60], [11, 200], [13, 400], [3, 500]].forEach(([i, exp]) => give(members[i], "tr12", 700, exp));
  [[2, 30], [5, 300], [7, 700]].forEach(([i, exp]) => give(members[i], "tr13", 600, exp));

  // attendance: previous month + current month until today
  const attendance: State["attendance"] = {};
  const wd = [1, 2, 3, 4, 5];
  const roll = () => {
    const x = r();
    return x < 0.89 ? "as0" : x < 0.92 ? "as1" : x < 0.935 ? "as2" : x < 0.955 ? "as3" : x < 0.965 ? "as4" : x < 0.975 ? "as6" : x < 0.99 ? "as7" : x < 0.995 ? "as8" : "as5";
  };
  const lastDay = lastWorkday(today, wd);
  for (let d = monthStart(shiftMonth(monthOf(today), -1)); d <= today; d = addDays(d, 1)) {
    if (!isWorkday(d, wd)) continue;
    members.forEach((m, i) => {
      if (m.joinDate > d) return;
      if (d === lastDay && (i === 7 || i === 15 || i === 20)) return; // not yet filled on latest workday
      // Member 03 is the only 3/4 on Proses 8: absent on the latest workday to show the backup card
      const statusId = d === lastDay && i === 2 ? "as1" : roll();
      attendance[attKey(d, m.id)] = { statusId, note: statusId === "as0" ? "" : "Catatan contoh" };
    });
  }

  const cur = monthOf(today);
  const snapshots: Snapshot[] = [
    { month: shiftMonth(cur, -3), kind: "BASELINE", multiSkillRate: 29, safeProcesses: 4 },
    { month: shiftMonth(cur, -2), kind: "MONTHLY", multiSkillRate: 33, safeProcesses: 5 },
    { month: shiftMonth(cur, -1), kind: "MONTHLY", multiSkillRate: 38, safeProcesses: 5 },
  ];

  return {
    positions, empStatuses, attStatuses, processes, trainings, members, skills, skillLogs, plans,
    memberTrainings, attendance, holidays: [], snapshots,
    settings: {
      reminderDays: 90, multiSkillMinProcesses: 3, multiSkillMinLevel: 3, defaultMinBackup: 2,
      workWeekdays: wd, qccTargetPct: 70, qccBaselineDate: monthStart(shiftMonth(cur, -3)), contractMonths: DEFAULT_CONTRACT,
    },
  };
}
