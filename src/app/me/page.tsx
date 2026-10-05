import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, CalendarCheck, CalendarDays, ChevronRight, MessageCircle, TrendingUp } from "lucide-react";
import { loadPortal, requireMember } from "@/lib/server/member";
import { attendanceSummary, countAtLeast, trainingAlert, type AttCategory } from "@/lib/rules";
import { fmtDate, fmtMonth } from "@/lib/format";
import { Avatar, SkillDot } from "@/components/ui";
import { MemberHeader } from "@/components/member-ui";
import { mCard } from "@/components/member-style";
import { DueLine } from "@/components/member-parts";
import { myLeaves, myVoices } from "@/app/inbox-actions";
import { LEAVE_STATUS, VOICE_CATEGORY } from "@/components/voice-meta";

const ATT: [AttCategory, string, string][] = [
  ["FULFILLED", "Hadir", "bg-[#dcf5ea] text-[#0b6b47]"],
  ["LEAVE", "Cuti", "bg-m-sky-soft text-[#1d4a8c]"],
  ["SICK", "Sakit", "bg-m-amber-soft text-[#7a4a00]"],
  ["PERMIT", "Izin", "bg-m-low text-m-text"],
];

// F-1201 greeting + summary cards, F-1206 attendance recap. Ref: beranda-me.html.
export default async function MemberHome() {
  const me = await requireMember();
  if (!me) redirect("/login");
  const [p, leaves, voices] = await Promise.all([loadPortal(me.id), myLeaves(), myVoices()]);
  const lastLeave = leaves[0];
  const reply = voices.find((v) => v.unseen) ?? voices.find((v) => v.reply);

  const levels = Object.fromEntries(p.processes.map((x) => [x.id, x.cell.level]));
  const ids = p.processes.map((x) => x.id);
  const mastered = countAtLeast(levels, ids, 3);
  const pct = ids.length ? Math.round((mastered / ids.length) * 100) : 0;
  const running = p.plans.filter((x) => x.status !== "ACHIEVED");
  const plan = running[0];
  const alerts = p.trainings.filter((t) => trainingAlert(t.expiresAt, p.today, p.reminderDays));
  const train = alerts[0];
  const sum = attendanceSummary(p.attendance);
  const offDays = p.attendance.filter((a) => a.category !== "FULFILLED");
  const extra = sum.ABSENT + sum.OTHER;

  return (
    <>
      <MemberHeader title="Beranda" />

      <section className="flex items-center gap-4">
        <span className="shrink-0 rounded-full shadow-sm ring-4 ring-m-surface"><Avatar name={me.name} photoUrl={me.photoUrl} size={64} /></span>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-m-sub">Selamat datang,</p>
          <h2 className="line-clamp-2 text-xl font-bold leading-tight tracking-tight">{me.name}</h2>
          <p className="mt-0.5 text-[13px] text-m-sub">{me.position} · NoReg <span className="tabular-nums">{me.noreg}</span></p>
        </div>
      </section>

      <Link href="/me/skill" className="relative mt-5 block overflow-hidden rounded-[26px] bg-brand p-6 text-white shadow-[0_12px_28px_-8px_rgba(200,0,26,0.45)] transition active:scale-[0.99]">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 size-36 rounded-full bg-white/15 blur-sm" />
        <span className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold"><span className="size-1.5 rounded-full bg-white" />Ringkasan keahlian</span>
          {p.newCount > 0 && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-brand-strong">{p.newCount} pembaruan baru</span>}
        </span>
        <h3 className="mt-3 text-[22px] font-bold leading-tight tracking-tight">{mastered} dari {ids.length} proses dikuasai</h3>
        <p className="text-[12px] text-white/85">Level 3/4 (mandiri) ke atas</p>
        <div className="relative mt-4">
          <div className="flex justify-between text-[12px] font-semibold"><span>Kemajuan multi-skill</span><span>{pct}%</span></div>
          <div className="mt-1.5 h-3 rounded-full bg-white/30 p-0.5"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium"><TrendingUp size={15} aria-hidden />{running.length ? `${running.length} rencana peningkatan berjalan` : "Belum ada rencana peningkatan berjalan"}</p>
        </div>
      </Link>

      <section className="mt-4 grid grid-cols-2 gap-3.5">
        <Link href="/me/skill#rencana" className="m-keep flex min-h-[176px] flex-col justify-between rounded-[26px] bg-m-amber p-[18px] shadow-[0_8px_24px_-4px_rgba(18,19,26,0.06)] transition active:scale-[0.98]">
          <div>
            <span className="inline-flex rounded-[14px] bg-white/60 px-2.5 py-0.5 text-[10px] font-bold">Rencana peningkatan</span>
            {plan ? (
              <>
                <h4 className="mt-2.5 text-[15px] font-bold leading-tight">{plan.processName}</h4>
                <p className="mt-2 flex items-center gap-1 text-[12px] font-bold"><SkillDot level={plan.fromLevel} size={16} />{plan.fromLevel}/4 → <SkillDot level={plan.targetLevel} size={16} />{plan.targetLevel}/4</p>
              </>
            ) : <p className="mt-2.5 text-[13px] font-semibold leading-snug">Belum ada rencana aktif</p>}
          </div>
          {plan && (
            <div className="text-[11px] leading-tight">
              <p className="text-m-text/80">Mentor: {plan.mentorName ?? "-"}</p>
              <p className="mt-0.5 font-bold"><DueLine due={plan.dueDate} today={p.today} /></p>
            </div>
          )}
        </Link>

        <Link href="/me/skill#training" className="m-keep flex min-h-[176px] flex-col justify-between rounded-[26px] bg-m-sky p-[18px] shadow-[0_8px_24px_-4px_rgba(18,19,26,0.06)] transition active:scale-[0.98]">
          <div>
            <span className="inline-flex rounded-[14px] bg-white/60 px-2.5 py-0.5 text-[10px] font-bold">Training</span>
            {train ? (
              <>
                <h4 className="mt-2.5 text-[15px] font-bold leading-tight">{train.name}</h4>
                <span className="mt-2 inline-flex items-center gap-1 rounded-xl bg-m-red-fixed px-2 py-0.5 text-[10px] font-bold text-brand-strong">
                  {trainingAlert(train.expiresAt, p.today, p.reminderDays) === "expired" ? "Kedaluwarsa" : "Segera diperbarui"}
                </span>
              </>
            ) : (
              <p className="mt-2.5 flex items-start gap-1.5 text-[13px] font-semibold leading-snug"><Award size={16} className="mt-px shrink-0" aria-hidden />{p.trainings.length ? "Semua training masih berlaku" : "Belum ada training dicatat"}</p>
            )}
          </div>
          <p className="text-[11px] font-bold leading-tight">{train ? `Berlaku s/d ${fmtDate(train.expiresAt)}` : `${p.trainings.length} training tercatat`}{alerts.length > 1 ? ` · +${alerts.length - 1} lainnya` : ""}</p>
        </Link>
      </section>

      <div className="mt-4 space-y-3">
        <Link href="/me/voice" className={`${mCard} block p-4 transition active:scale-[0.99]`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[15px] font-bold"><MessageCircle size={18} className="text-brand" aria-hidden />Voice ke leader</span>
            {reply?.unseen && <span className="rounded-full bg-m-red-fixed px-2.5 py-1 text-[11px] font-bold text-brand-strong">Balasan baru</span>}
          </div>
          {reply ? (
            <>
              <p className="mt-2 rounded-2xl bg-m-low px-3 py-2 text-[13px] leading-snug line-clamp-2">&ldquo;{reply.reply}&rdquo;</p>
              <p className="mt-1.5 text-[12px] text-m-sub">Balasan leader · {VOICE_CATEGORY[reply.category].label}</p>
            </>
          ) : <p className="mt-1.5 text-[13px] text-m-sub">{voices.length ? "Belum ada balasan. Leader akan menanggapi." : "Punya saran atau temuan K3? Kirim lewat Voice."}</p>}
        </Link>
        <Link href="/me/cuti" className={`${mCard} block p-4 transition active:scale-[0.99]`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[15px] font-bold"><CalendarCheck size={18} className="text-brand" aria-hidden />Status cuti terakhir</span>
            {lastLeave && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${LEAVE_STATUS[lastLeave.status].chip}`}>{LEAVE_STATUS[lastLeave.status].label}</span>}
          </div>
          <p className="mt-1.5 text-[13px] text-m-sub">
            {lastLeave ? `${lastLeave.typeName} · ${fmtDate(lastLeave.start)}${lastLeave.end !== lastLeave.start ? ` – ${fmtDate(lastLeave.end)}` : ""} · ${lastLeave.workdays} hari kerja` : "Belum ada pengajuan cuti."}
          </p>
        </Link>
      </div>

      <section className={`${mCard} mt-4 p-[18px]`}>
        <div className="flex items-center gap-2">
          <CalendarDays size={19} className="text-brand" aria-hidden />
          <h4 className="text-base font-bold">Rekap absensi {fmtMonth(p.month)}</h4>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {ATT.map(([cat, label, cls]) => (
            <div key={cat} className={`flex flex-col items-center rounded-[18px] px-1 py-2.5 ${cls}`}>
              <span className="text-[11px] font-medium">{label}</span>
              <b className="mt-0.5 text-xl leading-tight">{sum[cat]}</b>
              <span className="text-[10px]">hari</span>
            </div>
          ))}
        </div>
        {extra > 0 && <p className="mt-2 text-[12px] font-semibold text-brand-strong dark:text-[#ff6b7a]">Mangkir/lainnya: {extra} hari</p>}
        {offDays.length > 0 ? (
          <details className="mt-2">
            <summary className="flex min-h-10 items-center gap-1 text-[12px] font-semibold text-m-sub"><ChevronRight size={14} aria-hidden />Lihat tanggal tidak hadir ({offDays.length})</summary>
            <ul className="mt-1 divide-y divide-m-low text-[13px]">
              {offDays.map((a) => <li key={a.date} className="flex justify-between py-2"><span>{fmtDate(a.date)}</span><span className="font-semibold">{a.statusName}</span></li>)}
            </ul>
          </details>
        ) : p.attendance.length === 0 && <p className="mt-2 text-[12px] text-m-sub">Belum ada absensi tercatat bulan ini.</p>}
      </section>
    </>
  );
}
