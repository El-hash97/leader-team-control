"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, CalendarRange, Check, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { isWorkday } from "@/lib/rules";
import { fmtDateLong } from "@/lib/format";
import { Avatar, Button, Card, Dialog, EmptyState, PageHeader, cn, inputCls } from "@/components/ui";

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
