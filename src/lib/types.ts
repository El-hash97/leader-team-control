import type { ContractMonths, ISODate, PlanStatus, AttCategory } from "./rules";

// Employee class (golongan). Vokasi has no class.
export const KELAS = ["3A", "3B", "3C", "4A", "4B", "4C", "5A", "5B", "5C", "6A", "6B", "6C"] as const;
export type Kelas = (typeof KELAS)[number];

export type Position = { id: string; name: string; order: number };
export type EmpStatus = { id: string; name: string; hasContract: boolean };
export type AttStatus = { id: string; name: string; category: AttCategory };
export type Process = { id: string; name: string; order: number; minBackup: number | null; active: boolean };
export type Training = { id: string; name: string; hasExpiry: boolean; order: number };
export type Member = {
  id: string; name: string; noreg: string; positionId: string; statusId: string; kelas: Kelas | null;
  joinDate: ISODate; contractEnd: ISODate | null; photoUrl: string | null; notes: string;
  active: boolean; deactivatedAt: ISODate | null;
};
export type Cell = { level: number; target: number | null };
export type SkillLog = { id: string; memberId: string; processId: string; from: number; to: number; date: ISODate; note: string; planId?: string | null };
export type PlanMethod = "OJT" | "TJI" | "CLASS" | "MENTORING" | "OTHER";
export type Plan = {
  id: string; memberId: string; processId: string; fromLevel: number; targetLevel: number;
  startDate: ISODate; dueDate: ISODate; method: PlanMethod; mentorId: string | null;
  status: PlanStatus; achievedAt: ISODate | null; note: string;
};
export type MemberTraining = { memberId: string; trainingId: string; trainedAt: ISODate | null; expiresAt: ISODate | null };
export type AttRecord = { statusId: string; note: string; fromLeave?: boolean }; // fromLeave: filled by an approved leave (PRD v3 F-1406)
export type Snapshot = { id: string; month: string; kind: "BASELINE" | "MONTHLY"; multiSkillRate: number; safeProcesses: number };
export type Settings = {
  reminderDays: number; multiSkillMinProcesses: number; multiSkillMinLevel: number; defaultMinBackup: number;
  workWeekdays: number[]; qccTargetPct: number; qccBaselineDate: ISODate | null;
  contractMonths: ContractMonths;
};

export type State = {
  positions: Position[]; empStatuses: EmpStatus[]; attStatuses: AttStatus[]; processes: Process[]; trainings: Training[];
  members: Member[]; skills: Record<string, Record<string, Cell>>; skillLogs: SkillLog[]; plans: Plan[];
  memberTrainings: MemberTraining[]; attendance: Record<string, AttRecord>; holidays: ISODate[];
  snapshots: Snapshot[]; settings: Settings;
};

export const attKey = (date: ISODate, memberId: string) => `${date}|${memberId}`;
