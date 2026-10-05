import { redirect } from "next/navigation";
import { Info, LockKeyhole, LogOut } from "lucide-react";
import { requireMember } from "@/lib/server/member";
import { logout } from "@/app/actions";
import { tenure, todayJakarta } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { MemberHeader } from "@/components/member-ui";
import { mCard } from "@/components/member-style";
import { PasswordForm } from "./password-form";

// F-1202 profile (read-only, no leader notes) + F-1104 change password + logout. Ref: akun-me.html.
export default async function MemberAccount() {
  const me = await requireMember();
  if (!me) redirect("/login");
  const today = todayJakarta();
  const rows: [string, string][] = [
    ["Status karyawan", me.status || "-"],
    ["Posisi", me.position || "-"],
    ["Masa kerja", tenure(me.joinDate, today)],
    [me.contractEnd ? "Akhir kontrak" : "Tanggal masuk", fmtDate(me.contractEnd ?? me.joinDate)],
  ];

  return (
    <>
      <MemberHeader title="Akun" />

      <section className="relative overflow-hidden rounded-[26px] bg-brand p-6 text-white shadow-[0_12px_28px_-8px_rgba(200,0,26,0.45)]">
        <div aria-hidden className="pointer-events-none absolute -bottom-8 -right-6 size-32 rounded-full bg-white/15 blur-sm" />
        <div className="relative flex items-center gap-4">
          <span className="shrink-0 rounded-full ring-4 ring-m-surface"><Avatar name={me.name} photoUrl={me.photoUrl} size={64} /></span>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold tabular-nums">NoReg {me.noreg}</span>
        </div>
        <h2 className="relative mt-3 text-xl font-bold leading-tight tracking-tight">{me.name}</h2>
        <p className="relative text-[13px] text-white/85">{me.position} · Finishing Line</p>
        <dl className="relative mt-5 grid grid-cols-2 gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-[18px] bg-m-surface/95 p-3.5 text-m-text">
              <dt className="text-[11px] font-medium text-m-sub">{k}</dt>
              <dd className="mt-0.5 text-[15px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="relative mt-3 flex gap-2 rounded-2xl bg-white/15 p-3 text-[12px] leading-snug">
          <Info size={16} className="mt-px shrink-0" />Data profil dan foto dikelola Team Leader. Ada kekeliruan? Sampaikan ke leader.
        </p>
      </section>

      <section className={`${mCard} mt-4 p-5`}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-m-amber-soft text-[#7a4a00]"><LockKeyhole size={19} /></span>
          <div>
            <h3 className="text-base font-bold">Keamanan akun</h3>
            <p className="text-[12px] text-m-sub">Ganti password kapan saja</p>
          </div>
        </div>
        <PasswordForm />
      </section>

      <form action={logout} className="mt-4">
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-m-red-fixed text-[15px] font-semibold text-brand-strong transition active:scale-[0.98]">
          <LogOut size={18} />Keluar
        </button>
      </form>
      <p className="mt-4 text-center text-[11px] text-m-sub">Sesi login berlaku 30 hari di perangkat ini.</p>
    </>
  );
}
