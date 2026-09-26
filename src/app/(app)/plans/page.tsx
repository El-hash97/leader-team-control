"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Lightbulb, Plus, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, daysLeft, diffDays, displayStatus, dueLabel, monthEnd, monthOf, monthStart, shiftMonth, type PlanStatus } from "@/lib/rules";
import { fmtDate, fmtMonthShort } from "@/lib/format";
import type { Plan, PlanMethod } from "@/lib/mock";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, LEVEL_TEXT, PageHeader, Segmented, SkillDot, cn, inputCls } from "@/components/ui";
import { PLAN_METHOD, PLAN_STATUS } from "@/components/plan-meta";

type Filter = "all" | "OVERDUE" | "IN_PROGRESS" | "EVALUATION" | "PLANNED" | "ACHIEVED";
type Draft = { memberId: string; processId: string; targetLevel: string; startDate: string; dueDate: string; method: PlanMethod; mentorId: string; note: string };

export default function PlansPage() {
  const { s, today, activeMembers, processes, backup, addPlan, setPlanStatus, toast } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"list" | "timeline">("list");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Plan | null>(null);
  const [err, setErr] = useState("");
  const blank: Draft = { memberId: "", processId: "", targetLevel: "3", startDate: today, dueDate: addDays(today, 60), method: "OJT", mentorId: "", note: "" };
  const [d, setD] = useState<Draft>(blank);

  const name = (id: string | null) => s.members.find((m) => m.id === id)?.name ?? "-";
  const pname = (id: string) => s.processes.find((p) => p.id === id)?.name ?? "-";
  const withStatus = s.plans.filter((p) => p.status !== "CANCELLED").map((p) => ({ p, st: displayStatus(p, today) }));
  const count = (f: Filter) => (f === "all" ? withStatus.length : withStatus.filter((x) => x.st === f).length);
  const order: (PlanStatus | "OVERDUE")[] = ["OVERDUE", "EVALUATION", "IN_PROGRESS", "PLANNED", "ACHIEVED"];
  const list = withStatus.filter((x) => filter === "all" || x.st === filter)
    .sort((a, b) => order.indexOf(a.st) - order.indexOf(b.st) || a.p.dueDate.localeCompare(b.p.dueDate));

  // F-505: unsafe process × best candidate below level 3 without an active plan
  // one candidate per process, never the same member twice
  const suggestions = useMemo(() => {
    const used = new Set<string>();
    return backup.filter((b) => !b.ok).flatMap((b) => {
      const cand = activeMembers
        .map((m) => ({ m, lv: s.skills[m.id]?.[b.process.id]?.level ?? 0 }))
        .filter((x) => x.lv < 3 && !used.has(x.m.id) && !s.plans.some((p) => p.memberId === x.m.id && p.processId === b.process.id && !["ACHIEVED", "CANCELLED"].includes(p.status)))
        .sort((a, z) => z.lv - a.lv)[0];
      if (!cand) return [];
      used.add(cand.m.id);
      return [{ process: b.process, member: cand.m, level: cand.lv, count: b.count, min: b.min }];
    });
  }, [backup, activeMembers, s.skills, s.plans]);

  const curLevel = d.memberId && d.processId ? s.skills[d.memberId]?.[d.processId]?.level ?? 0 : null;
  const mentors = d.processId ? activeMembers.filter((m) => m.id !== d.memberId && (s.skills[m.id]?.[d.processId]?.level ?? 0) >= 3) : [];

  const startNew = (preset?: Partial<Draft>) => { setD({ ...blank, ...preset }); setErr(""); setOpen(true); };
  function create() {
    if (!d.memberId || !d.processId) return setErr("Pilih member dan proses.");
    if (curLevel !== null && Number(d.targetLevel) <= curLevel) return setErr(`Target harus di atas level sekarang (${curLevel}/4).`);
    if (d.dueDate < d.startDate) return setErr("Target tanggal tidak boleh sebelum tanggal mulai.");
    if (s.plans.some((p) => p.memberId === d.memberId && p.processId === d.processId && !["ACHIEVED", "CANCELLED"].includes(p.status)))
      return setErr("Member ini sudah punya rencana aktif untuk proses tersebut.");
    addPlan({ id: `pl${Date.now()}`, memberId: d.memberId, processId: d.processId, fromLevel: curLevel ?? 0, targetLevel: Number(d.targetLevel),
      startDate: d.startDate, dueDate: d.dueDate, method: d.method, mentorId: d.mentorId || null, status: "PLANNED", achievedAt: null, note: d.note });
    toast("Rencana peningkatan dibuat.");
    setOpen(false);
  }

  // timeline window: previous month + 5 ahead
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(monthOf(today), i - 1));
  const winStart = monthStart(months[0]), winEnd = monthEnd(months[5]);
  const span = diffDays(winEnd, winStart) + 1;
  const pct = (iso: string) => Math.max(0, Math.min(100, (diffDays(iso, winStart) / span) * 100));

  return (
    <>
      <PageHeader title="Mapping Peningkatan" desc="Rencana kenaikan skill member per proses. Tercapai = skill map naik otomatis." icon={TrendingUp} accent="green"
        actions={<Button variant="primary" onClick={() => startNew()}><Plus size={17} />Buat rencana</Button>} />

      {suggestions.length > 0 && (
        <Card className="mb-4">
          <CardHeader icon={Lightbulb} accent="amber" title="Saran prioritas" desc="Proses tanpa cadangan dan kandidat terdekat untuk dinaikkan ke 3/4." />
          <ul className="zebra-list divide-y divide-line">
            {suggestions.map((x) => (
              <li key={x.process.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm"><b>{x.process.name}</b> baru {x.count} orang ≥ 3/4 (min. {x.min}). Kandidat: <b>{x.member.name}</b> di level {x.level}/4.</p>
                <Button onClick={() => startNew({ memberId: x.member.id, processId: x.process.id, targetLevel: "3" })}>Buat rencana</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <Segmented label="Filter status" value={filter} onChange={setFilter}
          options={(["all", "OVERDUE", "IN_PROGRESS", "EVALUATION", "PLANNED", "ACHIEVED"] as Filter[]).map((f) => ({ value: f, label: `${f === "all" ? "Semua" : PLAN_STATUS[f].label} ${count(f)}` }))} />
        <Segmented label="Tampilan" value={view} onChange={setView} options={[{ value: "list", label: "Daftar" }, { value: "timeline", label: "Timeline" }]} />
      </div>

      <Card>
        {list.length === 0 ? <EmptyState title="Tidak ada rencana di status ini" desc="Pilih filter lain atau buat rencana baru." /> : view === "list" ? (
          <ul className="zebra-list divide-y divide-line">
            {list.map(({ p, st }) => {
              const meta = PLAN_STATUS[st];
              const dl = daysLeft(p.dueDate, today);
              return (
                <li key={p.id} className="grid gap-3 px-4 py-3 sm:px-5 xl:grid-cols-[1.4fr_1fr_1fr_auto] xl:items-center sm:grid-cols-2">
                  <div className="min-w-0">
                    <Link href={`/members/${p.memberId}`} className="font-semibold hover:underline">{name(p.memberId)}</Link>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <span className="font-medium">{pname(p.processId)}</span>
                      <SkillDot level={p.fromLevel} size={18} /><span className="text-muted">→</span><SkillDot level={p.targetLevel} size={18} />
                      <span className="text-xs text-muted">{p.fromLevel}/4 → {p.targetLevel}/4</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-xs text-muted">Metode · pendamping</span>
                    <div>{PLAN_METHOD[p.method]} · {name(p.mentorId)}</div>
                  </div>
                  <div className="text-sm">
                    <span className="text-xs text-muted">Target tanggal</span>
                    <div className="tabular">{fmtDate(p.dueDate)} {st !== "ACHIEVED" && <span className={cn("text-xs font-semibold", dl < 0 ? "text-brand-strong" : "text-muted")}>· {dueLabel(dl)}</span>}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {p.status === "PLANNED" && <Button onClick={() => { setPlanStatus(p.id, "IN_PROGRESS"); toast("Rencana mulai berjalan."); }}>Mulai</Button>}
                    {p.status === "IN_PROGRESS" && <Button onClick={() => { setPlanStatus(p.id, "EVALUATION"); toast("Rencana masuk tahap evaluasi."); }}>Evaluasi</Button>}
                    {p.status === "EVALUATION" && <>
                      <Button onClick={() => { setPlanStatus(p.id, "IN_PROGRESS"); toast("Belum lulus. Kembali ke OJT."); }}>Belum lulus</Button>
                      <Button variant="primary" onClick={() => setConfirm(p)}>Lulus</Button>
                    </>}
                    {p.status === "ACHIEVED" && <span className="tabular text-xs text-muted">{fmtDate(p.achievedAt)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[220px_1fr] border-b border-line bg-good-soft text-xs font-semibold text-good">
                <div className="px-4 py-2">Member · proses</div>
                <div className="grid grid-cols-6">{months.map((m) => <div key={m} className="border-l border-line px-2 py-2">{fmtMonthShort(m)}</div>)}</div>
              </div>
              <div className="relative">
                <div aria-hidden className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-ink/60" style={{ left: `calc(220px + (100% - 220px) * ${pct(today) / 100})` }} />
                {list.map(({ p, st }) => (
                  <div key={p.id} className="grid grid-cols-[220px_1fr] items-center border-b border-line even:bg-zebra">
                    <div className="truncate px-4 py-2 text-sm"><b>{name(p.memberId)}</b> <span className="text-muted">· {pname(p.processId)} → {p.targetLevel}/4</span></div>
                    <div className="relative h-10">
                      <div className={cn("absolute top-2 flex h-6 items-center overflow-hidden rounded px-2 text-xs font-semibold", PLAN_STATUS[st].bar)}
                        style={{ left: `${pct(p.startDate)}%`, width: `${Math.max(3, pct(p.dueDate) - pct(p.startDate))}%` }}>
                        <span className="truncate">{PLAN_STATUS[st].label}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="px-4 py-2 text-xs text-muted">Garis putus-putus = hari ini ({fmtDate(today)}).</p>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="Buat rencana peningkatan" wide
        footer={<><Button onClick={() => setOpen(false)}>Batal</Button><Button variant="primary" onClick={create}>Simpan rencana</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Member *">
            <select className={inputCls} value={d.memberId} onChange={(e) => setD({ ...d, memberId: e.target.value })}>
              <option value="">Pilih member</option>
              {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Proses *">
            <select className={inputCls} value={d.processId} onChange={(e) => setD({ ...d, processId: e.target.value, mentorId: "" })}>
              <option value="">Pilih proses</option>
              {processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3 rounded-md bg-soft px-3 py-2 text-sm sm:col-span-2">
            {curLevel === null ? <span className="text-muted">Pilih member dan proses untuk melihat level sekarang.</span> : (
              <><SkillDot level={curLevel} /> Level sekarang: <b>{curLevel}/4 · {LEVEL_TEXT[curLevel]}</b></>
            )}
          </div>
          <Field label="Target level *">
            <select className={inputCls} value={d.targetLevel} onChange={(e) => setD({ ...d, targetLevel: e.target.value })}>
              {[1, 2, 3, 4].map((l) => <option key={l} value={l} disabled={curLevel !== null && l <= curLevel}>{l}/4 · {LEVEL_TEXT[l]}</option>)}
            </select>
          </Field>
          <Field label="Metode *">
            <select className={inputCls} value={d.method} onChange={(e) => setD({ ...d, method: e.target.value as PlanMethod })}>
              {Object.entries(PLAN_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Tanggal mulai *"><input type="date" className={inputCls} value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} /></Field>
          <Field label="Target tanggal *"><input type="date" className={inputCls} value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} /></Field>
          <Field label="Pendamping" hint={d.processId ? `${mentors.length} member level ≥ 3/4 di proses ini` : "Pilih proses dulu"} className="sm:col-span-2">
            <select className={inputCls} value={d.mentorId} disabled={!d.processId} onChange={(e) => setD({ ...d, mentorId: e.target.value })}>
              <option value="">Tanpa pendamping</option>
              {mentors.map((m) => <option key={m.id} value={m.id}>{m.name} · {s.skills[m.id]?.[d.processId]?.level}/4</option>)}
            </select>
          </Field>
          <Field label="Catatan" className="sm:col-span-2"><textarea className={cn(inputCls, "min-h-16 py-2")} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></Field>
          {err && <p role="alert" className="text-sm font-medium text-brand-strong sm:col-span-2">{err}</p>}
        </div>
      </Dialog>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Tandai rencana tercapai?"
        footer={<><Button onClick={() => setConfirm(null)}>Batal</Button>
          <Button variant="primary" onClick={() => { if (confirm) { setPlanStatus(confirm.id, "ACHIEVED"); toast(`${name(confirm.memberId)} naik ke ${confirm.targetLevel}/4 di ${pname(confirm.processId)}.`); } setConfirm(null); }}>Ya, tercapai</Button></>}>
        {confirm && <p className="text-sm">Level <b>{name(confirm.memberId)}</b> di <b>{pname(confirm.processId)}</b> akan diubah menjadi <b>{confirm.targetLevel}/4</b> di skill map, dan tercatat di riwayat skill.</p>}
      </Dialog>
    </>
  );
}
