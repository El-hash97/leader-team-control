"use client";
import Link from "next/link";
import { useState } from "react";
import { Grid3x3, Search, ShieldAlert, Target, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { countAtLeast } from "@/lib/rules";
import { Badge, Button, Card, Dialog, EmptyState, Field, KelasBadge, LEVEL_TEXT, PageHeader, SkillDot, SkillLegend, Stat, cn, inputCls } from "@/components/ui";

type Sel = { memberId: string; processId: string } | null;

export default function SkillMapPage() {
  const { s, today, activeMembers, processes, pids, levels, multi, multiSkillRate, backup, setLevel, setTarget, toast } = useStore();
  const [q, setQ] = useState("");
  const [lv, setLv] = useState("all");
  const [sel, setSel] = useState<Sel>(null);
  const [draft, setDraft] = useState({ level: 0, target: "" as string, date: today, note: "" });

  const list = activeMembers.filter((m) => (lv === "all" || (lv === "V" ? !m.kelas : m.kelas?.[0] === lv)) && `${m.name} ${m.noreg}`.toLowerCase().includes(q.toLowerCase()));
  const gaps = activeMembers.reduce((n, m) => n + processes.filter((p) => { const c = s.skills[m.id]?.[p.id]; return c?.target != null && c.target > c.level; }).length, 0);
  const trainingCount = (id: string) => s.memberTrainings.filter((t) => t.memberId === id).length;

  const open = (memberId: string, processId: string) => {
    const c = s.skills[memberId]?.[processId] ?? { level: 0, target: null };
    setDraft({ level: c.level, target: c.target == null ? "" : String(c.target), date: today, note: "" });
    setSel({ memberId, processId });
  };
  const selMember = sel && s.members.find((m) => m.id === sel.memberId);
  const selProcess = sel && s.processes.find((p) => p.id === sel.processId);
  const cur = sel ? s.skills[sel.memberId]?.[sel.processId] : null;

  function save() {
    if (!sel || !cur) return;
    const changed = draft.level !== cur.level;
    if (changed && !draft.note.trim()) return toast("Isi catatan evaluasi dulu, misalnya hasil pengamatan OJT.");
    if (changed) setLevel(sel.memberId, sel.processId, draft.level, draft.date, draft.note.trim());
    const t = draft.target === "" ? null : Number(draft.target);
    if (t !== cur.target) setTarget(sel.memberId, sel.processId, t);
    toast(changed ? `Level ${selMember?.name} di ${selProcess?.name} jadi ${draft.level}/4. Riwayat tersimpan.` : "Target disimpan.");
    setSel(null);
  }

  return (
    <>
      <PageHeader title="Skill Map" desc="Kemampuan member per proses. Klik sel untuk mencatat hasil evaluasi." icon={Grid3x3} accent="violet"
        actions={<Link href="/plans" className="inline-flex min-h-11 items-center rounded-md border border-line bg-white px-4 text-sm font-semibold hover:bg-soft sm:min-h-10">Mapping peningkatan</Link>} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icon={Users} accent="violet" label="Member multi-skill" value={`${multiSkillRate}%`} hint={`Target ${s.settings.qccTargetPct}%`} />
        <Stat icon={ShieldAlert} accent="red" label="Proses tanpa cadangan" value={backup.filter((b) => !b.ok).length} tone={backup.some((b) => !b.ok) ? "bad" : "good"} hint={`dari ${processes.length} proses`} />
        <Stat icon={Target} accent="amber" label="Sel belum capai target" value={gaps} hint="Lingkaran putus-putus" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 flex-1 sm:max-w-72">
              <span className="sr-only">Cari member</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari member" className={cn(inputCls, "pl-9")} />
            </label>
            <select aria-label="Filter kelas" value={lv} onChange={(e) => setLv(e.target.value)} className={cn(inputCls, "sm:w-auto")}>
              <option value="all">Semua kelas</option>
              {["3", "4", "5", "6"].map((l) => <option key={l} value={l}>Kelas {l}A–{l}C</option>)}
              <option value="V">Vokasi</option>
            </select>
          </div>
          <SkillLegend />
        </div>

        {list.length === 0 ? <EmptyState title="Tidak ada member yang cocok" desc="Ubah kata kunci atau filter level." /> : (
          <>
            <p className="px-4 pt-2 text-xs text-muted md:hidden">Geser tabel ke samping untuk melihat semua proses.</p>
            <div className="overflow-x-auto">
              <table className="zebra w-full border-separate border-spacing-0 whitespace-nowrap text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-violet">
                    <th className="sticky left-0 z-10 border-b border-line bg-violet-soft px-3 py-2.5 text-left sm:px-4">Member</th>
                    {processes.map((p) => <th key={p.id} className="border-b border-line bg-violet-soft px-1 py-2.5 text-center">{p.name}</th>)}
                    <th className="border-b border-l border-line bg-violet-soft px-3 text-center">Kelas</th>
                    <th className="border-b border-line bg-violet-soft px-3 text-center">≥ 3/4</th>
                    <th className="border-b border-line bg-violet-soft px-3 text-center">Multi-skill</th>
                    <th className="border-b border-line bg-violet-soft px-3 text-center">Training</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id}>
                      <td className="sticky left-0 z-10 border-b border-line bg-[var(--row)] px-3 py-1 sm:px-4">
                        <Link href={`/members/${m.id}`} className="block max-w-32 truncate font-medium hover:underline sm:max-w-none">{m.name}</Link>
                        <span className="text-xs text-muted">{s.positions.find((p) => p.id === m.positionId)?.name}</span>
                      </td>
                      {processes.map((p) => {
                        const c = s.skills[m.id]?.[p.id] ?? { level: 0, target: null };
                        return (
                          <td key={p.id} className="border-b border-line p-0 text-center">
                            <button onClick={() => open(m.id, p.id)} aria-label={`${m.name}, ${p.name}: level ${c.level} dari 4. Ubah`}
                              className="mx-auto grid size-11 place-items-center rounded-md hover:bg-white hover:ring-1 hover:ring-violet/40">
                              <SkillDot level={c.level} target={c.target} />
                            </button>
                          </td>
                        );
                      })}
                      <td className="border-b border-l border-line px-3 text-center"><KelasBadge kelas={m.kelas} /></td>
                      <td className="tabular border-b border-line px-3 text-center">{countAtLeast(levels(m.id), pids, 3)}</td>
                      <td className="border-b border-line px-3 text-center">{multi(m.id) ? <Badge tone="good">Ya</Badge> : <span className="text-xs text-muted">Belum</span>}</td>
                      <td className="tabular border-b border-line px-3 text-center">{trainingCount(m.id)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-xs">
                    <th className="sticky left-0 z-10 bg-soft px-3 py-2.5 text-left font-semibold sm:px-4">Orang ≥ 3/4<span className="block font-normal text-muted">min. {s.settings.defaultMinBackup}</span></th>
                    {backup.map((b) => (
                      <td key={b.process.id} className="bg-soft px-1 text-center">
                        <span className={cn("tabular inline-block min-w-12 rounded px-1.5 py-1 font-semibold", b.ok ? "text-ink" : "bg-brand-strong text-white")}>
                          {b.count}{!b.ok && " kurang"}
                        </span>
                      </td>
                    ))}
                    <td colSpan={4} className="bg-soft px-3 text-muted">{activeMembers.filter((m) => multi(m.id)).length} dari {activeMembers.length} member multi-skill</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>

      <Dialog open={!!sel} onClose={() => setSel(null)} title={`${selMember?.name ?? ""} · ${selProcess?.name ?? ""}`}
        footer={<><Button onClick={() => setSel(null)}>Batal</Button><Button variant="primary" onClick={save}>Simpan</Button></>}>
        {cur && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Skill hasil evaluasi <span className="font-normal text-muted">(sekarang {cur.level}/4)</span></legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                {LEVEL_TEXT.map((t, i) => (
                  <button key={i} type="button" onClick={() => setDraft((d) => ({ ...d, level: i }))} aria-pressed={draft.level === i}
                    className={cn("flex min-h-12 items-center gap-3 rounded-md border px-3 text-left text-sm sm:flex-col sm:justify-center sm:gap-1 sm:px-1 sm:py-2 sm:text-center",
                      draft.level === i ? "border-brand-strong bg-brand-soft font-semibold" : "border-line hover:bg-soft")}>
                    <SkillDot level={i} size={24} />
                    <span><span className="tabular">{i ? `${i}/4` : "0"}</span> <span className="text-xs text-muted sm:block">{t}</span></span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal evaluasi">
                <input type="date" max={today} value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Target level" hint="Kosongkan jika tidak ada target">
                <select value={draft.target} onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))} className={inputCls}>
                  <option value="">Tanpa target</option>
                  {[1, 2, 3, 4].map((l) => <option key={l} value={l}>{l}/4 · {LEVEL_TEXT[l]}</option>)}
                </select>
              </Field>
            </div>
            <Field label={draft.level !== cur.level ? "Catatan evaluasi *" : "Catatan evaluasi"} hint="Wajib saat level berubah. Tersimpan di riwayat skill.">
              <textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} className={cn(inputCls, "min-h-20 py-2")} placeholder="Contoh: sudah 3x mandiri sesuai standar kualitas dan cycle time" />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
