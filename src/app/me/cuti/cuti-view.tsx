"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CalendarCheck, CalendarDays, Info, LoaderCircle, Plus, Send, X } from "lucide-react";
import { cancelMyLeave, requestLeave, type LeaveRow } from "@/app/inbox-actions";
import { workdayList, type ISODate } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import { Sheet } from "@/components/member-ui";
import { mButtonDark, mCard, mInput } from "@/components/member-style";
import { LEAVE_STATUS } from "@/components/voice-meta";
import { cn } from "@/components/ui";

type Form = { types: { id: string; name: string }[]; workWeekdays: number[]; holidays: ISODate[]; today: ISODate };
const range = (l: { start: ISODate; end: ISODate }) => (l.start === l.end ? fmtDate(l.start) : `${fmtDate(l.start)} – ${fmtDate(l.end)}`);
const jktDate = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(ts));

export function CutiView({ form, leaves }: { form: Form; leaves: LeaveRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function cancel(id: string) {
    if (!confirm("Batalkan pengajuan cuti ini?")) return;
    setBusyId(id);
    const r = await cancelMyLeave(id).catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi." }));
    setBusyId(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-[26px] bg-brand p-6 text-white shadow-[0_12px_28px_-8px_rgba(200,0,26,0.45)]">
        <div aria-hidden className="pointer-events-none absolute -bottom-8 -right-6 size-36 rounded-full bg-white/15 blur-xl" />
        <span className="inline-flex items-center gap-1.5 rounded-[14px] bg-white/20 px-3 py-1 text-[11px] font-semibold"><CalendarDays size={14} aria-hidden />Pengajuan cuti</span>
        <h2 className="mt-3 text-xl font-bold tracking-tight">Ajukan cuti baru</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-white/90">Hari kerja dihitung otomatis dari kalender kerja grup. Tanpa formulir kertas.</p>
        <button type="button" onClick={() => setOpen(true)} disabled={!form.types.length}
          className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-m-dock px-6 text-[14px] font-semibold text-white shadow-md active:scale-95 disabled:opacity-50">
          <Plus size={18} />Buat pengajuan
        </button>
        {!form.types.length && <p className="mt-2 text-[12px] text-white/90">Jenis cuti belum diatur leader.</p>}
      </section>

      <p className="mt-4 flex items-start gap-3 rounded-[20px] bg-m-amber-soft p-3.5 text-[12px] leading-relaxed">
        <Info size={18} className="mt-px shrink-0" aria-hidden />Cuti yang disetujui otomatis masuk ke absensi. Kamu bisa membatalkan selama statusnya masih Menunggu.
      </p>

      <div className="mb-3 mt-6 flex items-baseline justify-between px-1">
        <h2 className="text-base font-bold">Riwayat pengajuan</h2>
        {leaves.length > 0 && <span className="text-[12px] text-m-sub">{leaves.length} pengajuan</span>}
      </div>
      {error && <p role="alert" className="mb-2 text-[13px] font-medium text-brand-strong">{error}</p>}
      {leaves.length === 0 ? (
        <p className={`${mCard} px-5 py-6 text-center text-[13px] text-m-sub`}>Belum ada pengajuan cuti.</p>
      ) : (
        <ul className="space-y-3">
          {leaves.map((l) => (
            <li key={l.id} className={cn(mCard, "p-5")}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("rounded-[14px] px-3 py-1 text-[11px] font-bold", LEAVE_STATUS[l.status].chip)}>{LEAVE_STATUS[l.status].label}</span>
                <span className="text-[11px] text-m-sub">Diajukan {fmtDate(jktDate(l.createdAt))}</span>
              </div>
              <h3 className="mt-3 text-[16px] font-bold">{l.typeName}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-brand-strong"><CalendarCheck size={16} aria-hidden />{range(l)} · {l.workdays} hari kerja</p>
              <div className="mt-3 rounded-[18px] bg-m-low p-3.5">
                <p className="text-[11px] text-m-sub">Alasan</p>
                <p className="text-[14px]">{l.reason}</p>
              </div>
              {l.decisionNote && (
                <div className={cn("mt-2 rounded-[18px] p-3.5", l.status === "APPROVED" ? "bg-[#dcf5ea]" : "bg-m-red-fixed")}>
                  <p className="text-[11px] text-m-sub">Catatan leader{l.decidedAt ? ` · ${fmtDate(jktDate(l.decidedAt))}` : ""}</p>
                  <p className="text-[14px] font-medium">{l.decisionNote}</p>
                </div>
              )}
              {l.status === "APPROVED" && <p className="mt-2 text-[12px] font-semibold text-[#0b6b47]">Disetujui leader, sudah tercatat di absensi.</p>}
              {l.status === "PENDING" && (
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={() => cancel(l.id)} disabled={busyId === l.id}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-m-red-fixed px-4 text-[12px] font-semibold text-brand-strong active:scale-95 disabled:opacity-50">
                    {busyId === l.id ? <LoaderCircle size={15} className="animate-spin" /> : <X size={15} />}Batalkan
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Form pengajuan cuti" subtitle="Hari kerja dihitung otomatis">
        {open && <LeaveForm form={form} onDone={() => { setOpen(false); router.refresh(); }} />}
      </Sheet>
    </>
  );
}

function LeaveForm({ form, onDone }: { form: Form; onDone: () => void }) {
  const [type, setType] = useState(form.types[0]?.id ?? "");
  const [start, setStart] = useState(form.today);
  const [end, setEnd] = useState(form.today);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const days = start && end && end >= start ? workdayList(start, end, form.workWeekdays, form.holidays).length : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (end < start) return setError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    if (!days) return setError("Rentang tanggal itu tidak berisi hari kerja.");
    if (reason.trim().length < 5) return setError("Alasan wajib diisi, minimal 5 karakter.");
    setBusy(true);
    const r = await requestLeave({ attStatusId: type, start, end, reason })
      .catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi. Coba lagi." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Jenis cuti</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className={mInput}>
          {form.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Mulai</span>
          <input type="date" value={start} min={form.today} required className={cn(mInput, "px-3")}
            onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Sampai</span>
          <input type="date" value={end} min={start || form.today} required className={cn(mInput, "px-3")} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <p className="flex items-center justify-between rounded-2xl bg-m-sky-soft px-4 py-3 text-[13px] text-[#1d4a8c]" aria-live="polite">
        Hari kerja<b className="text-[15px]">{days} hari</b>
      </p>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Alasan</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required
          placeholder="Tulis alasan singkat dan jelas" className="w-full resize-none rounded-[18px] bg-m-low p-4 text-[15px] placeholder:text-m-sub/70 focus:outline-none focus:ring-2 focus:ring-brand/40" />
      </label>
      <p role="alert" className="min-h-5 text-[13px] font-medium text-brand-strong">{error}</p>
      <button type="submit" disabled={busy} className={mButtonDark}>
        {busy ? <><LoaderCircle size={18} className="animate-spin" />Mengirim…</> : <><Send size={18} />Kirim pengajuan</>}
      </button>
    </form>
  );
}
