"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, CalendarClock, CalendarRange, Check, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, isWorkday, type ISODate } from "@/lib/rules";
import { fmtDate, fmtDateLong } from "@/lib/format";
import { listLeaves } from "@/app/inbox-actions";
import { Avatar, Button, Card, CardHeader, Dialog, EmptyState, PageHeader, cn, inputCls } from "@/components/ui";

export default function AttendancePage() {
  return <Suspense><Attendance /></Suspense>;
}

function Attendance() {
  const params = useSearchParams();
  const { s, today, activeMembers, att, setAttendance, setAttendanceNote, fillUnfilled, toast } = useStore();
  const [date, setDate] = useState(params.get("date") ?? today);
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState<string | null>(null);

  const pos = Object.fromEntries(s.positions.map((p) => [p.id, p.name]));
  const hadirId = s.attStatuses.find((a) => a.name === "Hadir")!.id;
  const trainingId = s.attStatuses.find((a) => a.name === "Training")!.id;
  const eligible = activeMembers.filter((m) => m.joinDate <= date);
  const list = eligible.filter((m) => `${m.name} ${m.noreg}`.toLowerCase().includes(q.toLowerCase()));
  const empty = list.filter((m) => !att(date, m.id));
  const counts = s.attStatuses.map((a) => ({ a, n: list.filter((m) => att(date, m.id)?.statusId === a.id).length }));
  const workday = isWorkday(date, s.settings.workWeekdays, s.holidays);
  const bulkName = s.attStatuses.find((a) => a.id === bulk)?.name;

  return (
    <>
      <PageHeader title="Absensi Harian" desc={fmtDateLong(date)} icon={CalendarCheck} accent="teal"
        actions={<input type="date" aria-label="Tanggal absensi" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "w-auto")} />} />

      {!workday && (
        <p className="mb-3 rounded-md border border-warn/30 bg-warn-soft px-4 py-2.5 text-sm text-warn">
          Tanggal ini bukan hari kerja. Absensi tetap bisa diisi, tapi tidak dihitung sebagai hari kerja di laporan.
        </p>
      )}

      <MissedPanel onOpen={(d) => { setDate(d); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

      {/* equal-width grid, every status always shown so the layout never shifts */}
      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <div className={cn("min-w-0 rounded-md border px-3 py-2", empty.length ? "border-brand-strong/40 bg-brand-soft" : "border-line bg-white")}>
          <div className="truncate text-xs text-muted">Belum diisi</div>
          <div className={cn("tabular text-lg font-bold leading-tight", empty.length && "text-brand-strong")}>{empty.length}</div>
        </div>
        {counts.map(({ a, n }) => (
          <div key={a.id} className="min-w-0 rounded-md border border-line bg-white px-3 py-2">
            <div className="truncate text-xs text-muted" title={a.name}>{a.name}</div>
            <div className={cn("tabular text-lg font-bold leading-tight", n === 0 && "text-muted/60")}>{n}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <label className="relative block sm:w-72">
            <span className="sr-only">Cari member</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NoReg" className={cn(inputCls, "pl-9")} />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="primary" disabled={!empty.length} onClick={() => setBulk(hadirId)}><Check size={16} />Sisanya hadir</Button>
            <Button disabled={!empty.length} onClick={() => setBulk(trainingId)}>Sisanya training</Button>
          </div>
        </div>

        {list.length === 0 ? <EmptyState title="Tidak ada member" desc={q ? "Tidak ada member yang cocok dengan pencarian." : "Belum ada member aktif pada tanggal ini."} /> : (
          <>
            {/* desktop */}
            <table className="zebra hidden w-full text-sm md:table">
              <thead className="bg-teal-soft text-left text-xs font-semibold text-teal">
                <tr><th className="px-4 py-2.5">Member</th><th className="px-3">Posisi</th><th className="w-56 px-3">Status</th><th className="px-4">Catatan</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((m) => {
                  const rec = att(date, m.id);
                  return (
                    <tr key={m.id} className={cn(!rec && "[--row:#fdecee]!")}>
                      <td className="px-4 py-2"><div className="flex items-center gap-3"><Avatar name={m.name} photoUrl={m.photoUrl} size={32} /><span><b className="block">{m.name}</b><span className="tabular text-xs text-muted">{m.noreg}</span></span></div></td>
                      <td className="px-3 text-muted">{pos[m.positionId]}</td>
                      <td className="px-3">
                        <select aria-label={`Status ${m.name}`} value={rec?.statusId ?? ""} onChange={(e) => setAttendance(date, m.id, e.target.value)} className={cn(inputCls, !rec && "border-brand-strong/50")}>
                          <option value="">Belum diisi</option>
                          {s.attStatuses.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        {rec?.fromLeave && <span className="mt-1 flex items-center gap-1 text-xs text-muted"><CalendarRange size={12} aria-hidden />dari pengajuan cuti</span>}
                      </td>
                      <td className="px-4">
                        <input key={`${date}${m.id}`} aria-label={`Catatan ${m.name}`} defaultValue={rec?.note ?? ""} onBlur={(e) => e.target.value !== (rec?.note ?? "") && setAttendanceNote(date, m.id, e.target.value)} placeholder="Tambah catatan" className={inputCls} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* mobile */}
            <ul className="zebra-list divide-y divide-line md:hidden">
              {list.map((m) => {
                const rec = att(date, m.id);
                const isHadir = rec?.statusId === hadirId;
                return (
                  <li key={m.id} className={cn("p-3", !rec && "bg-brand-soft!")}>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} photoUrl={m.photoUrl} size={36} />
                      <div className="min-w-0 flex-1"><b className="block truncate">{m.name}</b><span className="text-xs text-muted">{pos[m.positionId]}{rec?.fromLeave && " · dari pengajuan cuti"}</span></div>
                      {!rec && <span className="text-xs font-semibold text-brand-strong">Belum diisi</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-[1fr_1.2fr] gap-2">
                      <button onClick={() => setAttendance(date, m.id, isHadir ? "" : hadirId)} aria-pressed={isHadir}
                        className={cn("flex min-h-12 items-center justify-center gap-2 rounded-md border text-[15px] font-semibold",
                          isHadir ? "border-good bg-good text-white" : "border-line bg-white")}>
                        <Check size={18} />Hadir
                      </button>
                      <select aria-label={`Status lain ${m.name}`} value={rec && !isHadir ? rec.statusId : ""} onChange={(e) => setAttendance(date, m.id, e.target.value)}
                        className={cn(inputCls, "min-h-12", rec && !isHadir && "border-ink font-semibold")}>
                        <option value="">Status lain…</option>
                        {s.attStatuses.filter((a) => a.id !== hadirId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    {rec && !isHadir && (
                      <input key={`${date}${m.id}`} aria-label={`Catatan ${m.name}`} defaultValue={rec.note} onBlur={(e) => e.target.value !== rec.note && setAttendanceNote(date, m.id, e.target.value)}
                        placeholder="Catatan (opsional)" className={cn(inputCls, "mt-2")} />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Dialog open={!!bulk} onClose={() => setBulk(null)} title={`Isi sebagai ${bulkName}?`}
        footer={<><Button onClick={() => setBulk(null)}>Batal</Button>
          <Button variant="primary" onClick={() => { if (bulk) { fillUnfilled(date, bulk, empty.map((m) => m.id)); toast(`${empty.length} member diisi ${bulkName}.`); } setBulk(null); }}>Isi {empty.length} member</Button></>}>
        <p className="text-sm">{empty.length} member yang belum diabsen akan diisi <b>{bulkName}</b>. Member yang sudah punya status tidak diubah.</p>
      </Dialog>
    </>
  );
}

/** Quick attendance: past working days (since the attendance start date) that still have empty members.
 *  Fills only empty cells, never overwrites, and skips members with a leave request still pending that day. */
function MissedPanel({ onOpen }: { onOpen: (date: ISODate) => void }) {
  const { s, missed, fillCells, toast } = useStore();
  const [pending, setPending] = useState<Set<string> | null>(null); // "date|memberId" with a PENDING leave
  const [confirm, setConfirm] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    listLeaves().then((ls) => {
      const set = new Set<string>();
      for (const l of ls) if (l.status === "PENDING") for (let d = l.start; d <= l.end; d = addDays(d, 1)) set.add(`${d}|${l.memberId}`);
      setPending(set);
    }, () => setPending(new Set()));
  }, []);

  if (!missed.length) return null;
  const hadirId = s.attStatuses.find((a) => a.name === "Hadir")!.id;
  const days = missed.map(({ date, memberIds }) => ({
    date,
    fill: memberIds.filter((id) => !pending?.has(`${date}|${id}`)),
    wait: memberIds.filter((id) => pending?.has(`${date}|${id}`)).length,
  })).reverse(); // newest first
  const cells = days.flatMap((d) => d.fill.map((memberId) => ({ date: d.date, memberId })));
  const shown = showAll ? days : days.slice(0, 5);
  const ready = pending !== null;

  return (
    <Card className="mb-4 border-warn/40">
      <div id="kelewat" className="scroll-mt-24">
        <CardHeader icon={CalendarClock} accent="amber" title={`${days.length} hari kerja belum lengkap`}
          desc={`Sejak ${fmtDate(s.settings.attendanceStartDate)}. Hanya yang kosong yang diisi, status lain dan cuti tidak ditimpa.`}
          action={<Button variant="primary" disabled={!ready || !cells.length} onClick={() => setConfirm(true)}><Check size={16} />Semua sisanya hadir</Button>} />
      </div>
      <ul className="divide-y divide-line">
        {shown.map((d) => (
          <li key={d.date} className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
            <span className="min-w-0 flex-1 text-sm">
              <b className="block">{fmtDateLong(d.date)}</b>
              <span className="text-muted">{d.fill.length + d.wait} belum diisi{d.wait ? ` · ${d.wait} menunggu keputusan cuti` : ""}</span>
            </span>
            <Button disabled={!ready || !d.fill.length} onClick={() => {
              const n = fillCells(d.fill.map((memberId) => ({ date: d.date, memberId })), hadirId);
              toast(`${n} member diisi Hadir pada ${fmtDate(d.date)}.`);
            }}><Check size={15} />Sisanya hadir</Button>
            <Button variant="ghost" onClick={() => onOpen(d.date)}>Buka</Button>
          </li>
        ))}
      </ul>
      {days.length > 5 && (
        <button onClick={() => setShowAll((x) => !x)} className="w-full border-t border-line py-2.5 text-sm font-semibold text-brand-strong hover:bg-soft">
          {showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua (${days.length} hari)`}
        </button>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Isi semua sebagai Hadir?"
        footer={<><Button onClick={() => setConfirm(false)}>Batal</Button>
          <Button variant="primary" onClick={() => { const n = fillCells(cells, hadirId); toast(`${n} absensi diisi Hadir di ${days.filter((d) => d.fill.length).length} hari.`); setConfirm(false); }}>Isi {cells.length} absensi</Button></>}>
        <p className="text-sm">
          {cells.length} absensi kosong di {days.filter((d) => d.fill.length).length} hari kerja akan diisi <b>Hadir</b>.
          Yang sudah punya status, termasuk cuti, tidak diubah. Member yang cutinya masih menunggu keputusan dilewati.
        </p>
        <p className="mt-2 text-sm text-muted">Kalau ada yang sakit, izin, atau cuti, ubah lewat tombol Buka di tanggal tersebut.</p>
      </Dialog>
    </Card>
  );
}
