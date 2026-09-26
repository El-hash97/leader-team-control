"use client";
// PRD v3 M14 leader side: list (F-1403), conflict check (F-1404), approve/reject (F-1405, F-1406),
// cancel an approved leave (F-1407), month calendar (F-1408).
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, Check, ChevronLeft, ChevronRight, LoaderCircle, Undo2, X } from "lucide-react";
import { cancelApprovedLeave, decideLeave, leaveCheck, listLeaves, type LeaveDay, type LeaveRow } from "@/app/inbox-actions";
import { useStore } from "@/lib/store";
import { addDays, isWorkday, monthEnd, monthOf, shiftMonth, weekday } from "@/lib/rules";
import { fmtDate, fmtMonth } from "@/lib/format";
import { announceInboxChange } from "@/components/use-inbox";
import { LEAVE_STATUS } from "@/components/voice-meta";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, Segmented, cn, inputCls } from "@/components/ui";

type Tab = "PENDING" | "APPROVED" | "CLOSED" | "CALENDAR";
const range = (l: LeaveRow) => (l.start === l.end ? fmtDate(l.start) : `${fmtDate(l.start)} – ${fmtDate(l.end)}`);

export default function LeavePage() {
  const { reload, toast } = useStore();
  const [list, setList] = useState<LeaveRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => listLeaves().then(setList, () => setList([]));
  useEffect(() => { load(); }, []);

  const pending = (list ?? []).filter((l) => l.status === "PENDING").sort((a, b) => a.start.localeCompare(b.start));
  const shown = tab === "PENDING" ? pending
    : tab === "APPROVED" ? (list ?? []).filter((l) => l.status === "APPROVED")
    : (list ?? []).filter((l) => l.status === "REJECTED" || l.status === "CANCELLED");
  const open = list?.find((l) => l.id === openId) ?? null;

  const changed = (msg: string) => { toast(msg); setOpenId(null); load(); reload(); announceInboxChange(); };

  return (
    <>
      <PageHeader title="Pengajuan Cuti" icon={CalendarRange} accent="green"
        desc={list ? `${pending.length} menunggu keputusan. Cuti yang disetujui otomatis mengisi absensi.` : "Memuat…"} />

      <div className="mb-3">
        <Segmented label="Tampilan" value={tab} onChange={setTab} options={[
          { value: "PENDING", label: `Menunggu${pending.length ? ` (${pending.length})` : ""}` },
          { value: "APPROVED", label: "Disetujui" },
          { value: "CLOSED", label: "Ditolak / batal" },
          { value: "CALENDAR", label: "Kalender" },
        ]} />
      </div>

      {tab === "CALENDAR" ? <LeaveCalendar list={list ?? []} onOpen={setOpenId} /> : (
        <Card>
          {!list ? <p className="flex items-center gap-2 p-6 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" />Memuat…</p>
          : shown.length === 0 ? <EmptyState title="Tidak ada pengajuan" desc={tab === "PENDING" ? "Semua pengajuan sudah diputuskan." : "Belum ada data di tab ini."} />
          : (
            <ul className="divide-y divide-line">
              {shown.map((l) => (
                <li key={l.id}>
                  <button onClick={() => setOpenId(l.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-rowhover sm:px-5">
                    <Avatar name={l.memberName} photoUrl={l.photoUrl} size={36} />
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm">{l.memberName} <span className="tabular font-normal text-muted">· {l.noreg}</span></b>
                      <span className="block text-sm text-muted">{l.typeName} · {range(l)} · <b className="text-ink">{l.workdays} hari kerja</b></span>
                      <span className="line-clamp-1 block text-xs text-muted">{l.reason}</span>
                    </span>
                    <Badge tone={LEAVE_STATUS[l.status].tone}>{LEAVE_STATUS[l.status].label}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {open && <LeaveDialog key={open.id} l={open} onClose={() => setOpenId(null)} onDone={changed} />}
    </>
  );
}

function LeaveDialog({ l, onClose, onDone }: { l: LeaveRow; onClose: () => void; onDone: (msg: string) => void }) {
  const [days, setDays] = useState<LeaveDay[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const decidable = l.status === "PENDING";

  useEffect(() => {
    if (l.status === "PENDING") leaveCheck(l.id).then((r) => (r.ok ? setDays(r.days) : setError(r.error)));
  }, [l.id, l.status]);

  async function act(kind: "approve" | "reject" | "cancel") {
    if (kind === "reject" && !note.trim()) return setError("Alasan penolakan wajib diisi.");
    if (kind === "cancel" && !confirm(`Batalkan cuti ${l.memberName} yang sudah disetujui? Absensi dari cuti ini akan dihapus.`)) return;
    setBusy(kind);
    const r = await (kind === "cancel" ? cancelApprovedLeave(l.id, note) : decideLeave(l.id, kind === "approve", note))
      .catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi." }));
    setBusy(null);
    if (!r.ok) return setError(r.error);
    onDone(kind === "approve" ? `Cuti ${l.memberName} disetujui, absensi terisi.` : kind === "reject" ? "Pengajuan ditolak." : "Cuti dibatalkan, absensi dari cuti ini dihapus.");
  }

  const warn = days?.filter((d) => d.others.length || d.short.length) ?? [];

  return (
    <Dialog open onClose={onClose} title="Keputusan cuti" wide
      footer={decidable ? (
        <>
          <Button variant="danger" disabled={!!busy} onClick={() => act("reject")}>{busy === "reject" ? <LoaderCircle size={16} className="animate-spin" /> : <X size={16} />}Tolak</Button>
          <Button variant="primary" disabled={!!busy} onClick={() => act("approve")} className="bg-good hover:bg-[#12673a]">{busy === "approve" ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}Setujui</Button>
        </>
      ) : l.status === "APPROVED" ? (
        <><Button onClick={onClose}>Tutup</Button><Button variant="danger" disabled={!!busy} onClick={() => act("cancel")}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Undo2 size={16} />}Batalkan cuti</Button></>
      ) : <Button onClick={onClose}>Tutup</Button>}>
      <div className="flex items-center gap-3">
        <Avatar name={l.memberName} photoUrl={l.photoUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{l.memberName} <span className="tabular text-sm font-normal text-muted">· {l.noreg}</span></p>
          <p className="text-sm text-muted">{l.typeName} · {range(l)} · <b className="text-ink">{l.workdays} hari kerja</b></p>
        </div>
        <Badge tone={LEAVE_STATUS[l.status].tone}>{LEAVE_STATUS[l.status].label}</Badge>
      </div>
      <p className="mt-3 rounded-md bg-soft px-3 py-2 text-sm"><span className="text-muted">Alasan: </span>{l.reason}</p>

      {decidable && (
        <div className="mt-4">
          {!days && !error && <p className="flex items-center gap-2 text-sm text-muted"><LoaderCircle size={14} className="animate-spin" />Memeriksa bentrok dan cadangan proses…</p>}
          {days && (warn.length ? (
            <div className="rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-warn"><AlertTriangle size={16} aria-hidden />Perlu diperhatikan (tidak memblokir)</p>
              <ul className="mt-1.5 space-y-1">
                {warn.map((d) => (
                  <li key={d.date}>
                    <b className="tabular">{fmtDate(d.date)}</b>
                    {d.others.length > 0 && <> · juga cuti: {d.others.join(", ")}</>}
                    {d.short.map((x) => <span key={x.name} className="block pl-3 text-brand-strong">proses {x.name} tinggal {x.count} orang ≥ 3/4 (minimum {x.min})</span>)}
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="rounded-md bg-good-soft px-3 py-2 text-sm text-good">Tidak ada bentrok cuti dan cadangan proses tetap aman.</p>)}
        </div>
      )}

      {l.decisionNote && !decidable && <p className="mt-3 rounded-md bg-soft px-3 py-2 text-sm"><span className="text-muted">Catatan leader: </span>{l.decisionNote}</p>}

      {(decidable || l.status === "APPROVED") && (
        <Field className="mt-4" label={decidable ? "Catatan untuk member (wajib jika ditolak)" : "Alasan pembatalan (opsional)"} error={error || undefined}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={cn(inputCls, "py-2")} />
        </Field>
      )}
      {!decidable && l.status !== "APPROVED" && error && <p className="mt-2 text-sm text-brand-strong">{error}</p>}
    </Dialog>
  );
}

/** F-1408: month grid, initials of members on leave (approved solid, pending outlined). Non-working days greyed. */
function LeaveCalendar({ list, onOpen }: { list: LeaveRow[]; onOpen: (id: string) => void }) {
  const { s, today } = useStore();
  const [month, setMonth] = useState(monthOf(today));
  const live = useMemo(() => list.filter((l) => l.status === "APPROVED" || l.status === "PENDING"), [list]);
  const first = `${month}-01`, last = monthEnd(month);
  const lead = (weekday(first) + 6) % 7; // Monday first
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <Button variant="ghost" aria-label="Bulan sebelumnya" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></Button>
        <b>{fmtMonth(month)}</b>
        <Button variant="ghost" aria-label="Bulan berikutnya" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-line text-xs">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => <div key={d} className="bg-soft py-1.5 text-center font-semibold text-muted">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`x${i}`} className="bg-white" />;
          const work = isWorkday(d, s.settings.workWeekdays, s.holidays);
          const off = live.filter((l) => l.start <= d && d <= l.end);
          return (
            <div key={d} className={cn("min-h-16 p-1", work ? "bg-white" : "bg-soft", d === today && "ring-2 ring-inset ring-brand-strong")}>
              <span className={cn("tabular", work ? "font-semibold" : "text-muted")}>{+d.slice(8)}</span>
              {work && (
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {off.map((l) => (
                    <button key={l.id} onClick={() => onOpen(l.id)} title={`${l.memberName} · ${LEAVE_STATUS[l.status].label}`}
                      className={cn("grid size-6 place-items-center rounded-full text-[9px] font-bold", l.status === "APPROVED" ? "bg-ink text-white" : "border border-dashed border-ink bg-white text-ink")}>
                      {initials(l.memberName)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="flex gap-4 px-4 py-2 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="size-3 rounded-full bg-ink" />Disetujui</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-full border border-dashed border-ink" />Menunggu</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-soft" />Libur</span>
      </p>
    </Card>
  );
}
