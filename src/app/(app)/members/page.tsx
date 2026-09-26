"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Award, BadgeCheck, FileClock, GraduationCap, Pencil, Plus, Search, UserCheck, Users, UserX } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysLeft, dueLabel, tenure } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import type { Member } from "@/lib/types";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, KelasBadge, PageHeader, Stat, cn, inputCls } from "@/components/ui";
import { MemberDialog } from "@/components/member-dialog";

export default function MembersPage() {
  const { s, today, sortMembers, setActive, toast } = useStore();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState<Member | null>(null);

  const pos = useMemo(() => Object.fromEntries(s.positions.map((p) => [p.id, p.name])), [s.positions]);
  const emp = useMemo(() => Object.fromEntries(s.empStatuses.map((p) => [p.id, p])), [s.empStatuses]);
  const active = s.members.filter((m) => m.active);
  const list = s.members
    .filter((m) => (showInactive ? true : m.active))
    .filter((m) => `${m.name} ${m.noreg} ${pos[m.positionId]} ${emp[m.statusId]?.name} ${m.kelas ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.active) - Number(a.active) || sortMembers(a, b));

  const statusTone = (id: string) => (emp[id]?.name === "Karyawan Tetap" ? "neutral" : emp[id]?.name === "PKWT" ? "info" : "warn");
  const contract = (m: Member) => {
    if (!emp[m.statusId]?.hasContract || !m.contractEnd) return <span className="text-muted">-</span>;
    const d = daysLeft(m.contractEnd, today);
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="tabular">{fmtDate(m.contractEnd)}</span>
        {d <= s.settings.reminderDays && <Badge tone={d < 0 ? "bad" : "warn"}>{dueLabel(d)}</Badge>}
      </span>
    );
  };
  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (m: Member) => { setEditing(m); setFormOpen(true); };

  return (
    <>
      <PageHeader title="Data Member" desc="Database member, kelas, masa kerja, dan kontrak." icon={Users} accent="blue"
        actions={<Button variant="primary" onClick={openNew}><Plus size={17} />Tambah member</Button>} />

      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Stat label="Total aktif" value={active.length} icon={Users} accent="blue" />
        <Stat icon={BadgeCheck} accent="green" label="Tetap" value={active.filter((m) => emp[m.statusId]?.name === "Karyawan Tetap").length} />
        <Stat icon={FileClock} accent="amber" label="PKWT" value={active.filter((m) => emp[m.statusId]?.name === "PKWT").length} />
        <Stat icon={GraduationCap} accent="teal" label="Vokasi" value={active.filter((m) => emp[m.statusId]?.name === "Vokasi").length} />
        <Stat icon={Award} accent="violet" label="Kelas 5–6" value={active.filter((m) => m.kelas && +m.kelas[0] >= 5).length} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <label className="relative block sm:w-80">
            <span className="sr-only">Cari member</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, NoReg, posisi, kelas" className={cn(inputCls, "pl-9")} />
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-[var(--color-brand-strong)]" />
            Tampilkan member nonaktif ({s.members.length - active.length})
          </label>
        </div>

        {list.length === 0 ? (
          <EmptyState title={q ? "Tidak ada member yang cocok" : "Belum ada member"} desc={q ? `Tidak ada hasil untuk "${q}". Coba kata kunci lain.` : "Tambahkan member pertama untuk mulai mengisi skill map dan absensi."}
            action={!q && <Button variant="primary" onClick={openNew}><Plus size={17} />Tambah member</Button>} />
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="zebra w-full whitespace-nowrap text-sm">
                <thead className="bg-info-soft text-left text-xs font-semibold text-info">
                  <tr>
                    <th className="px-4 py-2.5">Member</th><th className="px-3 py-2.5">Posisi</th><th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Kelas</th><th className="px-3 py-2.5">Join</th><th className="px-3 py-2.5">Kontrak</th>
                    <th className="px-3 py-2.5">Masa kerja</th><th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((m) => (
                    <tr key={m.id} className={cn(!m.active && "text-muted")}>
                      <td className="px-4 py-2.5">
                        <Link href={`/members/${m.id}`} className="flex items-center gap-3 hover:underline">
                          <Avatar name={m.name} photoUrl={m.photoUrl} />
                          <span><b className="block font-semibold text-ink">{m.name}</b><span className="tabular text-xs text-muted">{m.noreg}</span></span>
                        </Link>
                      </td>
                      <td className="px-3">{pos[m.positionId]}</td>
                      <td className="px-3">{m.active ? <Badge tone={statusTone(m.statusId)}>{emp[m.statusId]?.name}</Badge> : <Badge>Nonaktif</Badge>}</td>
                      <td className="px-3"><KelasBadge kelas={m.kelas} /></td>
                      <td className="tabular px-3">{fmtDate(m.joinDate)}</td>
                      <td className="px-3">{contract(m)}</td>
                      <td className="tabular px-3">{tenure(m.joinDate, today)}</td>
                      <td className="px-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(m)} aria-label={`Edit ${m.name}`} className="grid size-10 place-items-center rounded-md text-muted hover:bg-soft hover:text-ink"><Pencil size={17} /></button>
                          {m.active
                            ? <button onClick={() => setConfirm(m)} aria-label={`Nonaktifkan ${m.name}`} className="grid size-10 place-items-center rounded-md text-muted hover:bg-brand-soft hover:text-brand-strong"><UserX size={17} /></button>
                            : <button onClick={() => { setActive(m.id, true); toast(`${m.name} diaktifkan kembali.`); }} aria-label={`Aktifkan ${m.name}`} className="grid size-10 place-items-center rounded-md text-muted hover:bg-good-soft hover:text-good"><UserCheck size={17} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <ul className="zebra-list divide-y divide-line md:hidden">
              {list.map((m) => (
                <li key={m.id} className={cn("p-3", !m.active && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <Link href={`/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={m.name} photoUrl={m.photoUrl} size={40} />
                      <span className="min-w-0">
                        <b className="block truncate">{m.name}</b>
                        <span className="block truncate text-xs text-muted">{pos[m.positionId]} · {m.noreg}</span>
                      </span>
                    </Link>
                    {m.active ? <Badge tone={statusTone(m.statusId)}>{emp[m.statusId]?.name}</Badge> : <Badge>Nonaktif</Badge>}
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 pl-[52px] text-xs">
                    <div><dt className="text-muted">Kelas</dt><dd><KelasBadge kelas={m.kelas} /></dd></div>
                    <div><dt className="text-muted">Masa kerja</dt><dd className="tabular">{tenure(m.joinDate, today)}</dd></div>
                    <div><dt className="text-muted">Kontrak</dt><dd>{contract(m)}</dd></div>
                  </dl>
                  <div className="mt-2 flex gap-2 pl-[52px]">
                    <Button className="flex-1" onClick={() => openEdit(m)}><Pencil size={15} />Edit</Button>
                    {m.active
                      ? <Button variant="danger" className="flex-1" onClick={() => setConfirm(m)}><UserX size={15} />Nonaktifkan</Button>
                      : <Button className="flex-1" onClick={() => { setActive(m.id, true); toast(`${m.name} diaktifkan kembali.`); }}><UserCheck size={15} />Aktifkan</Button>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <MemberDialog open={formOpen} member={editing} onClose={() => setFormOpen(false)} />

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Nonaktifkan member?"
        footer={<>
          <Button onClick={() => setConfirm(null)}>Batal</Button>
          <Button variant="primary" onClick={() => { if (confirm) { setActive(confirm.id, false); toast(`${confirm.name} dinonaktifkan.`); } setConfirm(null); }}>Nonaktifkan</Button>
        </>}>
        <p className="text-sm">
          <b>{confirm?.name}</b> tidak akan muncul di absensi dan skill map. Riwayat absensi dan skill tetap tersimpan, dan member bisa diaktifkan kembali kapan saja.
        </p>
      </Dialog>
    </>
  );
}
