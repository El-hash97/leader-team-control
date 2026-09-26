import { redirect } from "next/navigation";
import { ArrowRight, TrendingUp } from "lucide-react";
import { loadPortal, requireMember } from "@/lib/server/member";
import { fmtDate } from "@/lib/format";
import { SkillDot } from "@/components/ui";
import { MemberHeader } from "@/components/member-ui";
import { mCard } from "@/components/member-style";
import { Chip, EmptyNote, levelLabel, NewChip, PlanCard, SectionTitle, TrainingRow } from "@/components/member-parts";
import { LEVEL_TEXT } from "@/components/plan-meta";

// F-1203 skill per process + history, F-1204 plans, F-1205 trainings. Ref: skill-me.html. Read-only.
export default async function MemberSkill() {
  const me = await requireMember();
  if (!me) redirect("/login");
  const p = await loadPortal(me.id);
  const levels = p.processes.map((x) => x.cell.level);
  const count = (f: (l: number) => boolean) => levels.filter(f).length;
  const activePlans = p.plans.filter((x) => x.status !== "ACHIEVED");
  const donePlans = p.plans.filter((x) => x.status === "ACHIEVED");
  const tiles: [string, number, number][] = [
    ["Mandiri / mengajar", count((l) => l >= 3), 4],
    ["Dengan bantuan", count((l) => l === 2), 2],
    ["Belum / teori", count((l) => l <= 1), 1],
  ];

  return (
    <>
      <MemberHeader title="Skill" />

      <section className="relative overflow-hidden rounded-[26px] bg-brand p-6 text-white shadow-[0_12px_28px_-8px_rgba(200,0,26,0.45)]">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-white/15 blur-2xl" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold"><span className="size-1.5 rounded-full bg-white" />Skill map Toyota</span>
        <h2 className="mt-3 text-xl font-bold tracking-tight">Posisi skill saya</h2>
        <p className="text-[13px] text-white/85">{p.processes.length} proses di Finishing Line</p>
        <div className="relative mt-5 grid grid-cols-3 gap-2 text-center text-m-text">
          {tiles.map(([label, n, dot]) => (
            <div key={label} className="flex flex-col items-center rounded-[18px] bg-white/95 px-2 py-3">
              <SkillDot level={dot} size={20} />
              <b className="mt-1 text-xl leading-none">{n}</b>
              <span className="mt-1 text-[11px] leading-tight text-m-sub">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${mCard} mt-4 px-4 py-3`} aria-label="Arti simbol skill">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-m-sub">Arti simbol</p>
        <ul className="mt-2 grid grid-cols-5 gap-1 text-center">
          {LEVEL_TEXT.map((t, l) => (
            <li key={t} className="flex flex-col items-center gap-1">
              <SkillDot level={l} size={22} />
              <span className="text-[10px] font-semibold leading-tight">{l}/4</span>
              <span className="text-[10px] leading-tight text-m-sub">{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <SectionTitle title="Skill per proses" aside="Garis putus-putus = belum capai target" />
      {p.processes.length ? (
        <ul className="space-y-2.5">
          {p.processes.map(({ id, name, cell, isNew }) => {
            const gap = cell.target != null ? cell.target - cell.level : null;
            return (
              <li key={id} className={`${mCard} flex items-center gap-3 px-4 py-3.5`}>
                <SkillDot level={cell.level} target={cell.target} size={30} />
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-1.5 text-[15px] leading-snug">{name}{isNew && <NewChip />}</b>
                  <span className="text-[12px] text-m-sub">{levelLabel(cell.level)}</span>
                </span>
                {gap != null && (gap > 0
                  ? <Chip className="bg-m-amber-soft text-[#7a4a00]">Target {cell.target}/4</Chip>
                  : <Chip className="bg-[#dcf5ea] text-[#0b6b47]">Tercapai</Chip>)}
              </li>
            );
          })}
        </ul>
      ) : <EmptyNote>Belum ada proses yang dicatat leader.</EmptyNote>}

      <SectionTitle id="rencana" title="Rencana peningkatan" aside={activePlans.length ? `${activePlans.length} berjalan` : undefined} />
      {p.plans.length ? (
        <div className="space-y-3">
          {activePlans.map((x) => <PlanCard key={x.id} p={x} />)}
          {donePlans.length > 0 && (
            <details>
              <summary className="flex min-h-11 items-center gap-2 px-1 text-[13px] font-semibold text-m-sub"><TrendingUp size={15} aria-hidden />{donePlans.length} rencana sudah tercapai</summary>
              <div className="mt-2 space-y-3">{donePlans.map((x) => <PlanCard key={x.id} p={x} />)}</div>
            </details>
          )}
        </div>
      ) : <EmptyNote>Belum ada rencana peningkatan. Leader akan menyusunnya bersama kamu.</EmptyNote>}

      <SectionTitle id="training" title="Training saya" />
      {p.trainings.length
        ? <ul className={`${mCard} divide-y divide-m-low overflow-hidden`}>{p.trainings.map((t) => <TrainingRow key={t.id} t={t} today={p.today} reminderDays={p.reminderDays} />)}</ul>
        : <EmptyNote>Belum ada training yang dicatat.</EmptyNote>}

      <SectionTitle id="riwayat" title="Riwayat kenaikan level" />
      {p.logs.length ? (
        <ol className={`${mCard} relative px-5 py-4`}>
          <span aria-hidden className="absolute bottom-6 left-[25px] top-6 w-0.5 rounded-full bg-m-low" />
          {p.logs.map((l, i) => (
            <li key={l.id} className="relative flex gap-3 pb-4 last:pb-0">
              <span className={`relative mt-1 size-3 shrink-0 rounded-full ring-4 ${i === 0 ? "bg-brand ring-m-red-fixed" : "bg-[#c9ccd1] ring-white"}`} />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] text-m-sub">{fmtDate(l.date)}{l.isNew && <NewChip />}</p>
                <p className="text-[14px] font-bold leading-snug">{l.processName}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                  <SkillDot level={l.from} size={16} />{l.from}/4<ArrowRight size={12} className="text-m-sub" aria-label="naik ke" /><SkillDot level={l.to} size={16} />{l.to}/4 · {LEVEL_TEXT[l.to]}
                </p>
                {l.note && <p className="mt-0.5 text-[12px] text-m-sub">{l.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : <EmptyNote>Belum ada riwayat kenaikan level.</EmptyNote>}
    </>
  );
}
