"use client";
import { useState } from "react";
import { CalendarX, Check, ChevronDown, Clock, ChevronUp, Database, Download, FileClock, GraduationCap, Info, Layers, ListChecks, Pencil, Plus, Settings, SlidersHorizontal, Trash, Upload, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { Badge, Button, Card, CardHeader, Dialog, Field, PageHeader, cn, inputCls } from "@/components/ui";
import { addDays, contractEndFor, weekday } from "@/lib/rules";

const EXAMPLE_JOIN = "2026-01-01";

const DAYS = [["Sen", 1], ["Sel", 2], ["Rab", 3], ["Kam", 4], ["Jum", 5], ["Sab", 6], ["Min", 0]] as const;
const CAT: Record<string, string> = { FULFILLED: "Memenuhi", SICK: "Sakit", LEAVE: "Cuti", PERMIT: "Izin", ABSENT: "Alpa", OTHER: "Lainnya" };
const V1_SNIPPET = `const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({members:JSON.parse(localStorage.LTC_MEMBERS||'[]'),attendance:JSON.parse(localStorage.LTC_ATTENDANCE||'[]')})],{type:'application/json'}));a.download='ltc-v1-backup.json';a.click();`;

type V1Preview = { members: number; attendance: number; conflicts: string[]; unknownPositions: string[] } | { error: string };

export default function SettingsPage() {
  const st = useStore();
  const { s, today, updateSettings, addProcess, updateProcess, moveProcess, addTraining, updateTraining, removeTraining, addHoliday, removeHoliday, takeBaseline, toast } = st;
  const [p, setP] = useState(s.settings);
  const [newProc, setNewProc] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newTraining, setNewTraining] = useState({ name: "", hasExpiry: false });
  const [editTraining, setEditTraining] = useState<{ id: string; name: string } | null>(null);
  const trainingUse = (id: string) => s.memberTrainings.filter((m) => m.trainingId === id).length;
  const trainingNameTaken = (name: string, except?: string) => s.trainings.some((t) => t.id !== except && t.name.toLowerCase() === name.toLowerCase());
  const [holiday, setHoliday] = useState("");
  const [baseline, setBaseline] = useState(false);
  const [typed, setTyped] = useState("");
  const [v1, setV1] = useState<V1Preview | null>(null);
  // contract rules have their own card and save button, so they are excluded here
  const dirty = JSON.stringify({ ...p, contractMonths: null }) !== JSON.stringify({ ...s.settings, contractMonths: null });
  const [cm, setCm] = useState(s.settings.contractMonths);
  const cmDirty = JSON.stringify(cm) !== JSON.stringify(s.settings.contractMonths);
  const procs = [...s.processes].sort((a, b) => a.order - b.order);
  // same rule as the DB function auto_fill_hadir: weeks counted from the anchor's Monday, even = morning
  const monday = (d: string) => addDays(d, -((weekday(d) + 6) % 7));
  const weeksFromAnchor = Math.round((Date.parse(monday(today)) - Date.parse(monday(s.settings.shiftAnchorDate))) / (7 * 864e5));
  const morningWeek = ((weeksFromAnchor % 2) + 2) % 2 === 0;

  function exportJson() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }));
    a.download = `ltc-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup JSON diunduh.");
  }

  async function readV1(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const members: { nik?: string; position?: string }[] = data.members ?? [];
      const noreg = new Set(s.members.map((m) => m.noreg));
      const posNames = new Set(s.positions.map((x) => x.name));
      setV1({
        members: members.length,
        attendance: (data.attendance ?? []).length,
        conflicts: members.filter((m) => m.nik && noreg.has(m.nik)).map((m) => m.nik!), // v1 stored NoReg in field "nik"
        unknownPositions: [...new Set(members.map((m) => m.position ?? "").filter((x) => x && !posNames.has(x)))],
      });
    } catch {
      setV1({ error: "File tidak bisa dibaca. Pastikan file berasal dari snippet di atas (format JSON)." });
    }
  }

  return (
    <>
      <PageHeader title="Pengaturan" desc="Parameter grup, master data, dan pengelolaan data." icon={Settings} accent="gray" />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={SlidersHorizontal} accent="blue" title="Parameter grup" desc="Dipakai di semua perhitungan dashboard dan laporan." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field label="Reminder kontrak & sertifikat" hint="Hari sebelum berakhir">
              <input type="number" min={7} max={365} className={inputCls} value={p.reminderDays} onChange={(e) => setP({ ...p, reminderDays: +e.target.value })} />
            </Field>
            <Field label="Target QCC multi-skill" hint="Persen member">
              <input type="number" min={1} max={100} className={inputCls} value={p.qccTargetPct} onChange={(e) => setP({ ...p, qccTargetPct: +e.target.value })} />
            </Field>
            <Field label="Multi-skill: minimal proses">
              <input type="number" min={1} max={10} className={inputCls} value={p.multiSkillMinProcesses} onChange={(e) => setP({ ...p, multiSkillMinProcesses: +e.target.value })} />
            </Field>
            <Field label="Multi-skill: minimal level">
              <select className={inputCls} value={p.multiSkillMinLevel} onChange={(e) => setP({ ...p, multiSkillMinLevel: +e.target.value })}>
                <option value={3}>3/4 · Mandiri</option><option value={4}>4/4 · Bisa mengajar</option>
              </select>
            </Field>
            <Field label="Mulai pencatatan absensi" hint="Hari kerja sebelumnya tidak dihitung kelewat maupun di performance">
              <input type="date" required max={today} className={inputCls} value={p.attendanceStartDate}
                onChange={(e) => e.target.value && setP({ ...p, attendanceStartDate: e.target.value })} />
            </Field>
            <Field label="Acuan minggu shift pagi" hint="Tanggal mana saja di minggu pagi. Minggu berikutnya malam, lalu bergantian">
              <input type="date" required className={inputCls} value={p.shiftAnchorDate}
                onChange={(e) => e.target.value && setP({ ...p, shiftAnchorDate: e.target.value })} />
            </Field>
            <Field label="Cadangan minimal per proses" hint="Orang ≥ 3/4, bisa diubah per proses">
              <input type="number" min={1} max={10} className={inputCls} value={p.defaultMinBackup} onChange={(e) => setP({ ...p, defaultMinBackup: +e.target.value })} />
            </Field>
            <fieldset className="text-sm sm:col-span-2">
              <legend className="mb-1.5 font-medium">Hari kerja</legend>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(([l, n]) => {
                  const on = p.workWeekdays.includes(n);
                  return (
                    <button key={n} type="button" aria-pressed={on} onClick={() => setP({ ...p, workWeekdays: on ? p.workWeekdays.filter((x) => x !== n) : [...p.workWeekdays, n] })}
                      className={cn("min-h-11 min-w-12 rounded-md border px-3 font-semibold sm:min-h-10", on ? "border-ink bg-ink text-white" : "border-line bg-white text-muted")}>{l}</button>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button disabled={!dirty} onClick={() => setP(s.settings)}>Batal</Button>
            <Button variant="primary" disabled={!dirty} onClick={() => { updateSettings({ ...p, contractMonths: s.settings.contractMonths }); toast("Parameter disimpan."); }}>Simpan parameter</Button>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Clock} accent="teal" title="Absensi otomatis" desc="Hadir terisi sendiri di hari kerja, tinggal ditimpa kalau berbeda." />
          <div className="space-y-3 p-4 text-sm sm:p-5">
            <p className="flex flex-wrap items-center gap-2">
              Minggu ini <Badge tone={morningWeek ? "good" : "warn"}>{morningWeek ? "Shift pagi · diisi 07:00" : "Shift malam · diisi 21:00"}</Badge>
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-muted">
              <li>Berlaku di hari kerja yang bukan hari libur. Minggu pagi diisi <b className="text-ink">07:00 WIB</b>, minggu malam <b className="text-ink">21:00 WIB</b> (tanggal absensi = tanggal shift dimulai).</li>
              <li>Seluruh tim bergantian shift tiap minggu. Acuannya diatur di “Acuan minggu shift pagi” pada Parameter grup.</li>
              <li>Hanya member aktif yang belum punya absensi hari itu yang diisi. Cuti yang sudah disetujui dan absensi manual tidak tertimpa.</li>
              <li>Baris otomatis diberi catatan <b className="text-ink">Otomatis 07:00</b> atau <b className="text-ink">Otomatis 21:00</b>. Kalau ada yang training, sakit, cuti, atau izin, timpa statusnya di menu Absensi.</li>
            </ul>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={FileClock} accent="amber" title="Aturan masa kontrak"
            desc="Dipakai untuk mengisi akhir kontrak otomatis saat menambah atau mengedit member." />
          <div className="overflow-x-auto">
            <table className="zebra w-full text-sm">
              <thead className="bg-warn-soft text-left text-xs font-semibold text-warn">
                <tr><th className="px-4 py-2.5">Status / posisi</th><th className="px-3">Masa kontrak</th><th className="px-4">Contoh (join {fmtDate(EXAMPLE_JOIN)})</th></tr>
              </thead>
              <tbody>
                {([
                  ["Vokasi", "vokasi", "bulan"],
                  ["PKWT 1", "pkwt1", "bulan"],
                  ["PKWT 2", "pkwt2Extra", "bulan tambahan setelah PKWT 1"],
                ] as const).map(([label, key, unit]) => (
                  <tr key={key}>
                    <td className="px-4 py-2 font-semibold">{label}</td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input type="number" min={1} max={120} aria-label={`Masa kontrak ${label} (bulan)`} value={cm[key]}
                          onChange={(e) => setCm({ ...cm, [key]: Math.max(1, +e.target.value || 1) })} className={cn(inputCls, "w-16! px-2 text-center")} />
                        {unit}
                      </label>
                    </td>
                    <td className="tabular px-4 py-2 text-muted">
                      s/d {fmtDate(contractEndFor(key === "pkwt2Extra" ? "pkwt2" : key, EXAMPLE_JOIN, cm))}
                      <span className="block text-xs">
                        {key === "pkwt2Extra" ? `total ${cm.pkwt1 + cm.pkwt2Extra} bulan dari join` : `${cm[key] % 12 === 0 ? `${cm[key] / 12} tahun` : `${cm[key]} bulan`}`}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-2 font-semibold">Karyawan Tetap</td>
                  <td className="px-3 py-2 text-muted" colSpan={2}>Tidak ada masa kontrak</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2 text-xs text-muted sm:px-5">
            Akhir kontrak = join date + masa kontrak − 1 hari. PKWT 2 dihitung dari join date awal (PKWT 1 + perpanjangan).
            Perubahan aturan hanya berlaku untuk member yang ditambah atau diedit setelahnya.
          </p>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button disabled={!cmDirty} onClick={() => setCm(s.settings.contractMonths)}>Batal</Button>
            <Button variant="primary" disabled={!cmDirty} onClick={() => { updateSettings({ contractMonths: cm }); toast("Aturan masa kontrak disimpan."); }}>Simpan aturan</Button>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Layers} accent="violet" title="Proses" desc="Ubah nama, urutan, dan cadangan minimal. Urutan di sini = urutan kolom skill map." />
          <ul className="zebra-list divide-y divide-line">
            {procs.map((pr, i) => (
              <li key={pr.id} className="flex items-start gap-2 px-3 py-2 sm:items-center sm:px-4">
                <div className="flex flex-col pt-0.5 sm:pt-0">
                  <button aria-label={`Naikkan ${pr.name}`} disabled={i === 0} onClick={() => moveProcess(pr.id, -1)} className="grid h-5 w-8 place-items-center text-muted disabled:opacity-30"><ChevronUp size={16} /></button>
                  <button aria-label={`Turunkan ${pr.name}`} disabled={i === procs.length - 1} onClick={() => moveProcess(pr.id, 1)} className="grid h-5 w-8 place-items-center text-muted disabled:opacity-30"><ChevronDown size={16} /></button>
                </div>
                <div className="min-w-0 flex-1 space-y-1 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
                {renaming?.id === pr.id ? (
                  <form className="flex min-w-0 flex-1 gap-1.5" onSubmit={(e) => {
                    e.preventDefault();
                    const name = renaming.name.trim();
                    if (!name) return toast("Nama proses tidak boleh kosong.");
                    if (s.processes.some((x) => x.id !== pr.id && x.name.toLowerCase() === name.toLowerCase())) return toast(`Nama "${name}" sudah dipakai proses lain.`);
                    updateProcess(pr.id, { name });
                    toast(`${pr.name} diubah menjadi ${name}.`);
                    setRenaming(null);
                  }}>
                    <input autoFocus aria-label={`Nama baru untuk ${pr.name}`} value={renaming.name} onChange={(e) => setRenaming({ id: pr.id, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} className={cn(inputCls, "min-w-0 flex-1")} />
                    <button type="submit" aria-label="Simpan nama" className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-strong text-white"><Check size={17} /></button>
                    <button type="button" onClick={() => setRenaming(null)} aria-label="Batal ubah nama" className="grid size-10 shrink-0 place-items-center rounded-md border border-line text-muted"><X size={17} /></button>
                  </form>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", !pr.active && "text-muted")}>{pr.name}{!pr.active && " (nonaktif)"}</span>
                    <button onClick={() => setRenaming({ id: pr.id, name: pr.name })} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-violet hover:bg-violet-soft">
                      <Pencil size={14} />Ubah nama
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    Min. cadangan
                    <input aria-label={`Cadangan minimal ${pr.name}`} type="number" min={1} placeholder={String(s.settings.defaultMinBackup)} value={pr.minBackup ?? ""}
                      onChange={(e) => updateProcess(pr.id, { minBackup: e.target.value ? +e.target.value : null })} className={cn(inputCls, "w-14! px-2 text-center")} />
                  </label>
                  <label className="flex min-h-10 items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={pr.active} onChange={(e) => updateProcess(pr.id, { active: e.target.checked })} className="size-4 accent-[var(--color-brand-strong)]" />Aktif
                  </label>
                </div>
                </div>
              </li>
            ))}
          </ul>
          <form className="flex gap-2 border-t border-line p-3 sm:px-4" onSubmit={(e) => { e.preventDefault(); if (!newProc.trim()) return; addProcess(newProc.trim()); setNewProc(""); toast("Proses ditambahkan ke skill map."); }}>
            <input value={newProc} onChange={(e) => setNewProc(e.target.value)} placeholder="Nama proses baru" aria-label="Nama proses baru" className={inputCls} />
            <Button type="submit"><Plus size={16} />Tambah</Button>
          </form>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">Kolom angka = cadangan minimal khusus proses itu. Kosong = pakai default grup. Proses nonaktif disembunyikan tanpa menghapus riwayat.</p>
        </Card>

        <Card>
          <CardHeader icon={GraduationCap} accent="amber" title="Training" desc="Daftar training untuk matriks training dan profil member." />
          <ul className="zebra-list divide-y divide-line">
            {[...s.trainings].sort((a, b) => a.order - b.order).map((t) => {
              const used = trainingUse(t.id);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
                  {editTraining?.id === t.id ? (
                    <form className="flex min-w-0 flex-1 basis-full gap-1.5 sm:basis-auto" onSubmit={(e) => {
                      e.preventDefault();
                      const name = editTraining.name.trim().toUpperCase();
                      if (!name) return toast("Nama training tidak boleh kosong.");
                      if (trainingNameTaken(name, t.id)) return toast(`Training "${name}" sudah ada.`);
                      updateTraining(t.id, { name });
                      toast(`${t.name} diubah menjadi ${name}.`);
                      setEditTraining(null);
                    }}>
                      <input autoFocus aria-label={`Nama baru untuk ${t.name}`} value={editTraining.name} onChange={(e) => setEditTraining({ id: t.id, name: e.target.value })}
                        onKeyDown={(e) => e.key === "Escape" && setEditTraining(null)} className={cn(inputCls, "min-w-0 flex-1 uppercase")} />
                      <button type="submit" aria-label="Simpan nama training" className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-strong text-white"><Check size={17} /></button>
                      <button type="button" onClick={() => setEditTraining(null)} aria-label="Batal ubah nama" className="grid size-10 shrink-0 place-items-center rounded-md border border-line text-muted"><X size={17} /></button>
                    </form>
                  ) : (
                    <div className="flex min-w-0 flex-1 basis-full items-center gap-1 sm:basis-auto">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                      <span className="tabular shrink-0 text-xs text-muted">{used} member</span>
                      <button onClick={() => setEditTraining({ id: t.id, name: t.name })} aria-label={`Ubah nama ${t.name}`}
                        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-warn hover:bg-warn-soft"><Pencil size={14} />Ubah</button>
                    </div>
                  )}
                  <label className="flex min-h-10 items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={t.hasExpiry} onChange={(e) => { updateTraining(t.id, { hasExpiry: e.target.checked }); toast(e.target.checked ? `${t.name} sekarang punya masa berlaku.` : `${t.name} tanpa masa berlaku.`); }}
                      className="size-4 accent-[var(--color-brand-strong)]" />Masa berlaku
                  </label>
                  <button disabled={used > 0} onClick={() => { removeTraining(t.id); toast(`${t.name} dihapus.`); }}
                    title={used ? "Sudah dipakai member, tidak bisa dihapus" : "Hapus training"} aria-label={`Hapus ${t.name}`}
                    className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-brand-soft hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"><Trash size={16} /></button>
                </li>
              );
            })}
          </ul>
          <form className="flex flex-wrap items-center gap-2 border-t border-line p-3 sm:px-4" onSubmit={(e) => {
            e.preventDefault();
            const name = newTraining.name.trim().toUpperCase();
            if (!name) return;
            if (trainingNameTaken(name)) return toast(`Training "${name}" sudah ada.`);
            addTraining(name, newTraining.hasExpiry);
            setNewTraining({ name: "", hasExpiry: false });
            toast(`Training ${name} ditambahkan.`);
          }}>
            <input value={newTraining.name} onChange={(e) => setNewTraining({ ...newTraining, name: e.target.value })} placeholder="Nama training baru" aria-label="Nama training baru" className={cn(inputCls, "min-w-0 flex-1 basis-full uppercase placeholder:normal-case sm:basis-auto")} />
            <label className="flex min-h-10 items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={newTraining.hasExpiry} onChange={(e) => setNewTraining({ ...newTraining, hasExpiry: e.target.checked })} className="size-4 accent-[var(--color-brand-strong)]" />Masa berlaku
            </label>
            <Button type="submit" disabled={!newTraining.name.trim()}><Plus size={16} />Tambah</Button>
          </form>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">Centang &quot;Masa berlaku&quot; untuk sertifikat seperti SIO, supaya tanggal kedaluwarsa wajib diisi dan muncul di pengingat. Training yang sudah dipakai member tidak bisa dihapus.</p>
        </Card>

        <Card>
          <CardHeader icon={CalendarX} accent="red" title="Hari libur" desc="Tidak dihitung sebagai hari kerja di laporan." />
          <form className="flex gap-2 p-3 sm:px-4" onSubmit={(e) => { e.preventDefault(); if (holiday) { addHoliday(holiday); setHoliday(""); } }}>
            <input type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} aria-label="Tanggal libur" className={inputCls} />
            <Button type="submit" disabled={!holiday}><Plus size={16} />Tambah</Button>
          </form>
          {s.holidays.length === 0 ? <p className="px-4 pb-4 text-sm text-muted">Belum ada hari libur. Tambahkan libur nasional dan libur perusahaan tahun ini.</p> : (
            <ul className="flex flex-wrap gap-2 px-4 pb-4">
              {s.holidays.map((h) => (
                <li key={h} className="inline-flex items-center gap-1 rounded-md border border-line py-1 pl-3 pr-1 text-sm">
                  <span className="tabular">{fmtDate(h)}</span>
                  <button onClick={() => removeHoliday(h)} aria-label={`Hapus ${fmtDate(h)}`} className="grid size-8 place-items-center text-muted hover:text-brand-strong"><X size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader icon={ListChecks} accent="teal" title="Master data lain" desc="Edit penuh tersedia setelah backend terhubung." />
          <div className="space-y-4 p-4 sm:p-5">
            {[
              ["Posisi (urutan hirarki)", [...s.positions].sort((a, b) => a.order - b.order).map((x) => x.name)],
              ["Status karyawan", s.empStatuses.map((x) => `${x.name}${x.hasContract ? " · kontrak" : ""}`)],
              ["Status absensi", s.attStatuses.map((x) => `${x.name} · ${CAT[x.category]}`)],
            ].map(([title, items]) => (
              <div key={title as string}>
                <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
                <div className="flex flex-wrap gap-1.5">{(items as string[]).map((t) => <Badge key={t}>{t}</Badge>)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Database} accent="green" title="Data dan baseline QCC" />
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm"><b className="block">Backup data grup</b><span className="text-muted">Unduh seluruh data grup dalam format JSON.</span></p>
              <Button onClick={exportJson}><Download size={16} />Export JSON</Button>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm"><b className="block">Snapshot baseline QCC</b><span className="text-muted">Sekarang: {s.settings.qccBaselineDate ? fmtDate(s.settings.qccBaselineDate) : "belum ada"}. Ambil setelah evaluasi skill awal selesai.</span></p>
              <Button onClick={() => { setTyped(""); setBaseline(true); }}>Ambil baseline</Button>
            </div>
            <p className="rounded-md bg-soft px-3 py-2 text-xs text-muted">Tidak ada tombol hapus semua data. Member dinonaktifkan, dan proses disembunyikan, supaya riwayat tetap utuh.</p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Upload} accent="amber" title="Import dari web lama (v1.0)" desc="Pindahkan data member dan absensi dari localStorage browser lama." />
          <div className="space-y-3 p-4 sm:p-5 text-sm">
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Buka web lama di browser yang biasa dipakai.</li>
              <li>Tekan F12, buka tab Console, tempel kode di bawah, lalu Enter.</li>
              <li>Unggah file <code className="text-ink">ltc-v1-backup.json</code> yang terunduh.</li>
            </ol>
            <div className="flex gap-2">
              <code className="block min-w-0 flex-1 truncate rounded-md bg-soft px-3 py-2.5 text-xs">{V1_SNIPPET}</code>
              <Button onClick={() => navigator.clipboard?.writeText(V1_SNIPPET).then(() => toast("Kode disalin."))}>Salin</Button>
            </div>
            <input type="file" accept="application/json,.json" aria-label="File backup v1" onChange={(e) => e.target.files?.[0] && readV1(e.target.files[0])} className={cn(inputCls, "py-2")} />
            {v1 && ("error" in v1 ? <p role="alert" className="font-medium text-brand-strong">{v1.error}</p> : (
              <div className="rounded-md border border-line p-3">
                <p><b>{v1.members}</b> member dan <b>{v1.attendance}</b> record absensi terbaca.</p>
                {v1.conflicts.length > 0 && <p className="mt-1 text-warn">{v1.conflicts.length} NoReg sudah ada dan akan dilewati: {v1.conflicts.slice(0, 5).join(", ")}{v1.conflicts.length > 5 ? "…" : ""}</p>}
                {v1.unknownPositions.length > 0 && <p className="mt-1 text-muted">Posisi baru akan dibuat: {v1.unknownPositions.join(", ")}</p>}
                <Button variant="primary" disabled className="mt-3" title="Tersedia setelah backend terhubung">Import sekarang</Button>
                <p className="mt-1 text-xs text-muted">Import otomatis belum tersedia. Pratinjau ini hanya membaca file untuk mengecek isinya.</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Info} accent="gray" title="Informasi sistem" />
          <dl className="divide-y divide-line text-sm">
            {[["Versi", "2.0"], ["Penyimpanan", "Supabase PostgreSQL (Singapore)"], ["Reminder", `H-${s.settings.reminderDays}`], ["Skala skill", "0, 1/4, 2/4, 3/4, 4/4"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5 sm:px-5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>
      </div>

      <Dialog open={baseline} onClose={() => setBaseline(false)} title="Ambil snapshot baseline?"
        footer={<><Button onClick={() => setBaseline(false)}>Batal</Button>
          <Button variant="primary" disabled={typed !== "BASELINE"} onClick={() => { takeBaseline(); toast("Baseline QCC diambil dari skill map saat ini."); setBaseline(false); }}>Ambil baseline</Button></>}>
        <div className="space-y-3 text-sm">
          <p>Kondisi skill map saat ini akan dipakai sebagai data <b>before</b> QCC dan menggantikan baseline lama. Laporan before–after akan dihitung dari titik ini.</p>
          <Field label='Ketik "BASELINE" untuk konfirmasi'><input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputCls} autoComplete="off" /></Field>
        </div>
      </Dialog>
    </>
  );
}
