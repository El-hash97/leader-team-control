// Server-safe display pieces for the member portal (no hooks). Ref: skill-me.html / beranda-me.html, red instead of lavender.
import type { ReactNode } from "react";
import { ArrowRight, Award, CalendarClock, UserRound } from "lucide-react";
import type { PortalPlan } from "@/lib/server/member";
import { daysLeft, dueLabel, trainingAlert, type ISODate } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import { SkillDot } from "@/components/ui";
import { LEVEL_TEXT, PLAN_METHOD, PLAN_STATUS } from "@/components/plan-meta";

const CHIP: Record<PortalPlan["status"], string> = {
  PLANNED: "bg-m-low text-m-text",
  IN_PROGRESS: "bg-m-sky-soft text-[#1d4a8c]",
  EVALUATION: "bg-m-amber-soft text-[#7a4a00]",
  ACHIEVED: "bg-[#dcf5ea] text-[#0b6b47]",
  CANCELLED: "bg-m-low text-m-sub",
  OVERDUE: "bg-m-red-fixed text-brand-strong",
};

export function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}>{children}</span>;
}

export function SectionTitle({ id, title, aside }: { id?: string; title: string; aside?: ReactNode }) {
  return (
    <div id={id} className="mb-3 mt-7 flex scroll-mt-4 items-baseline justify-between px-1">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      {aside && <span className="text-[12px] font-medium text-m-sub">{aside}</span>}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-[22px] bg-white px-5 py-6 text-center text-[13px] text-m-sub shadow-[0_8px_24px_-4px_rgba(18,19,26,0.05)]">{children}</p>;
}

export const levelLabel = (l: number) => `${l ? `${l}/4 · ` : ""}${LEVEL_TEXT[l]}`;

/** F-1503: set by the leader since the member's previous visit. */
export const NewChip = () => <Chip className="bg-m-red-fixed text-brand-strong">Baru</Chip>;

/** F-1204: one improvement plan. Amber card like the refs' "Rencana Peningkatan". */
export function PlanCard({ p }: { p: PortalPlan }) {
  const done = p.status === "ACHIEVED";
  return (
    <article className={`rounded-[26px] p-5 ${done ? "bg-white" : "bg-m-amber"} shadow-[0_8px_24px_-4px_rgba(18,19,26,0.06)]`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[17px] font-bold leading-snug">{p.processName}</h3>
        <span className="flex shrink-0 gap-1">{p.isNew && <NewChip />}<Chip className={CHIP[p.status]}>{PLAN_STATUS[p.status].label}</Chip></span>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-[13px] font-semibold">
        <SkillDot level={p.fromLevel} size={22} /><span>{levelLabel(p.fromLevel)}</span>
        <ArrowRight size={15} className="shrink-0 text-m-sub" aria-label="menjadi" />
        <SkillDot level={p.targetLevel} size={22} /><span>{p.targetLevel}/4</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
        <div><dt className="text-m-text/70">Periode</dt><dd className="font-semibold">{fmtDate(p.startDate)} – {fmtDate(p.dueDate)}</dd></div>
        <div><dt className="text-m-text/70">Metode</dt><dd className="font-semibold">{PLAN_METHOD[p.method] ?? p.method}</dd></div>
        <div className="col-span-2 flex items-center gap-1.5"><UserRound size={14} aria-hidden /><span>Mentor: <b>{p.mentorName ?? "Belum ditentukan"}</b></span></div>
      </dl>
      {p.note && <p className="mt-2 text-[12px] leading-snug text-m-text/80">{p.note}</p>}
    </article>
  );
}

/** F-1205: one training row with the same reminder window as the leader views. */
export function TrainingRow({ t, today, reminderDays }: { t: { name: string; trainedAt: ISODate | null; expiresAt: ISODate | null; isNew?: boolean }; today: ISODate; reminderDays: number }) {
  const alert = trainingAlert(t.expiresAt, today, reminderDays);
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${alert ? "bg-m-red-fixed text-brand-strong" : "bg-m-sky-soft text-[#1d4a8c]"}`}><Award size={19} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <b className="flex items-center gap-1.5 text-[14px] leading-snug">{t.name}{t.isNew && <NewChip />}</b>
        <span className="text-[12px] text-m-sub">
          {t.trainedAt ? `Ikut ${fmtDate(t.trainedAt)}` : "Tanggal belum dicatat"}
          {t.expiresAt ? ` · berlaku s/d ${fmtDate(t.expiresAt)}` : " · tanpa masa berlaku"}
        </span>
      </span>
      {alert && <Chip className="bg-m-red-fixed text-brand-strong">{alert === "expired" ? "Kedaluwarsa" : dueLabel(daysLeft(t.expiresAt!, today))}</Chip>}
    </li>
  );
}

export function DueLine({ due, today }: { due: ISODate; today: ISODate }) {
  return <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden />{dueLabel(daysLeft(due, today))}</span>;
}
