import { redirect } from "next/navigation";
import { requireMember } from "@/lib/server/member";
import { tenure, todayJakarta } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { MemberHeader } from "@/components/member-ui";
import { mCard } from "@/components/member-style";

// F-1201 (phase 1 slice): greeting + profile summary. Skill, plans, training and attendance cards land in phase 2.
export default async function MemberHome() {
  const me = await requireMember();
  if (!me) redirect("/login");
  const today = todayJakarta();

  return (
    <>
      <MemberHeader title="Beranda" />

      <section className="flex items-center gap-4">
        <span className="rounded-full ring-4 ring-white shadow-sm"><Avatar name={me.name} photoUrl={me.photoUrl} size={64} /></span>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-m-sub">Selamat datang,</p>
          <h2 className="line-clamp-2 text-xl font-bold leading-tight tracking-tight">{me.name}</h2>
          <p className="mt-0.5 text-[13px] text-m-sub">{me.position}</p>
          <p className="text-[13px] text-m-sub">NoReg <span className="tabular-nums">{me.noreg}</span></p>
        </div>
      </section>

      <section className="relative mt-5 overflow-hidden rounded-[26px] bg-brand p-6 text-white shadow-[0_12px_28px_-8px_rgba(200,0,26,0.45)]">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 size-36 rounded-full bg-white/15 blur-sm" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">
          <span className="size-1.5 rounded-full bg-white" />Profil dari Team Leader
        </span>
        <h3 className="mt-3 text-xl font-bold tracking-tight">{me.status || "Member"}{me.kelas ? ` · Kelas ${me.kelas}` : ""}</h3>
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-[18px] bg-white/95 p-4 text-m-text">
            <p className="text-[11px] font-medium text-m-sub">Masa kerja</p>
            <p className="mt-0.5 text-base font-bold">{tenure(me.joinDate, today)}</p>
            <p className="mt-1 text-[11px] text-m-sub">Masuk {fmtDate(me.joinDate)}</p>
          </div>
          <div className="rounded-[18px] bg-white/95 p-4 text-m-text">
            <p className="text-[11px] font-medium text-m-sub">{me.contractEnd ? "Akhir kontrak" : "Posisi"}</p>
            <p className="mt-0.5 text-base font-bold">{me.contractEnd ? fmtDate(me.contractEnd) : me.position || "-"}</p>
            <p className="mt-1 text-[11px] text-m-sub">Finishing Line</p>
          </div>
        </div>
      </section>

      <section className={`${mCard} mt-4 p-5`}>
        <h3 className="text-base font-bold">Segera hadir di portal ini</h3>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-[13px] font-semibold">
          <li className="rounded-[18px] bg-m-amber-soft px-4 py-3">Skill map &amp; target</li>
          <li className="rounded-[18px] bg-m-sky-soft px-4 py-3">Rencana &amp; training</li>
          <li className="rounded-[18px] bg-m-red-fixed px-4 py-3">Voice ke leader</li>
          <li className="rounded-[18px] bg-m-low px-4 py-3">Pengajuan cuti</li>
        </ul>
        <p className="mt-3 text-[12px] text-m-sub">Data profil dikelola Team Leader. Ada yang salah? Sampaikan langsung ke leader.</p>
      </section>
    </>
  );
}
