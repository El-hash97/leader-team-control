"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowDown, ArrowUp, BarChart3, ChartColumn, Check, ClipboardList, Clock, Download, Layers, MessageSquareText, Printer, Target, Timer, TrendingUp, Users } from "lucide-react";
import { listVoices, type LeaderVoice } from "@/app/inbox-actions";
import { VOICE_CATEGORIES, VOICE_CATEGORY, VOICE_STATUS } from "@/components/voice-meta";
import { useStore } from "@/lib/store";
import { groupWorkdays, median, monthEnd, monthOf, monthStart, replyWorkdays, shiftMonth } from "@/lib/rules";
import { fmtDate, fmtMonth, fmtMonthShort } from "@/lib/format";
import { Bar, Button, Card, CardHeader, PageHeader, PerfValue, Segmented, Stat, TrendChart, cn, inputCls } from "@/components/ui";

type Tab = "performance" | "skill" | "qcc" | "voice";

export default function ReportsPage() {
  return <Suspense><Reports /></Suspense>;
}

function Reports() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (["performance", "skill", "qcc", "voice"].includes(params.get("tab") ?? "") ? params.get("tab") : "performance") as Tab;
  return (
    <>
      <PageHeader title="Laporan" desc="Performance absensi, perkembangan skill, hasil QCC, dan voice member." icon={ChartColumn} accent="blue" />
      <div className="mb-4">
        <Segmented label="Jenis laporan" value={tab} onChange={(t) => router.replace(`/reports?tab=${t}`)}
          options={[{ value: "performance", label: "Performance" }, { value: "skill", label: "Skill" }, { value: "qcc", label: "QCC before–after" }, { value: "voice", label: "Voice" }]} />
      </div>
      {tab === "performance" ? <Performance /> : tab === "skill" ? <Skill /> : tab === "qcc" ? <Qcc /> : <VoiceReport />}
    </>
  );
}

function Performance() {
  const { s, today, monthly, toast } = useStore();
  const [month, setMonth] = useState(monthOf(today));
  const rows = monthly(month);
  const scored = rows.filter((r) => r.perf !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.perf ?? 0), 0) / scored.length) : 0;
  const end = [monthEnd(month), today].sort()[0];
  const groupDays = groupWorkdays(monthStart(month), end, s.settings.workWeekdays, s.holidays);
  const target = rows.reduce((a, r) => a + r.workdays, 0);
  const records = rows.reduce((a, r) => a + r.records, 0);
  const fulfilled = rows.reduce((a, r) => a + r.fulfilled, 0);
  const pos = Object.fromEntries(s.positions.map((p) => [p.id, p.name]));
  const emp = Object.fromEntries(s.empStatuses.map((p) => [p.id, p.name]));

  function exportCsv() {
    const head = ["Rank", "NoReg", "Nama", "Posisi", "Status", "Kelas", "Join Date", "Total Record", "Hadir", "Dinas", "Training", "Sakit", "Cuti", "Izin", "Alpa", "Performance"];
    const body = rows.map((r, i) => [i + 1, r.member.noreg, r.member.name, pos[r.member.positionId], emp[r.member.statusId], r.member.kelas ?? "Vokasi", r.member.joinDate,
      r.records, r.hadir, r.dinas, r.training, r.sakit, r.cuti, r.izin, r.alpa, r.perf === null ? "-" : `${r.perf}%`]);
    const csv = [head, ...body].map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Leader-Team-Control-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Laporan CSV diunduh.");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="month" aria-label="Bulan laporan" max={monthOf(today)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={cn(inputCls, "w-auto")} />
        <Button onClick={exportCsv}><Download size={16} />Export CSV</Button>
        <Button disabled title="Tersedia setelah backend terhubung">Export Excel</Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Activity} accent="teal" label="Rata-rata performance" value={`${avg}%`} hint={fmtMonth(month)} />
        <Stat icon={ArrowUp} accent="green" label="Tertinggi" value={`${scored[0]?.perf ?? 0}%`} hint={scored[0]?.member.name} />
        <Stat icon={ArrowDown} accent="red" label="Terendah" value={`${scored.at(-1)?.perf ?? 0}%`} hint={scored.at(-1)?.member.name} tone={(scored.at(-1)?.perf ?? 100) < 80 ? "bad" : undefined} />
        <Stat icon={ClipboardList} accent="blue" label="Total record" value={records} />
      </div>

      <Card className="mb-4">
        <CardHeader icon={BarChart3} accent="blue" title="Monthly control" desc={`Hari kerja dihitung sampai ${fmtDate(end)}, dikurangi hari libur.`} />
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
          {[["Hari kerja grup", groupDays], ["Member aktif", rows.length], ["Target record", target], ["Belum diisi", Math.max(0, target - records)], ["Performance tim", `${target ? Math.round((fulfilled / target) * 100) : 0}%`]]
            .map(([k, v]) => <div key={k as string} className="bg-white px-4 py-3"><div className="text-xs text-muted">{k}</div><div className="tabular text-xl font-bold">{v}</div></div>)}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="zebra w-full whitespace-nowrap text-sm">
            <thead className="bg-info-soft text-left text-xs font-semibold text-info">
              <tr>{["#", "Member", "Posisi", "Hari kerja", "Hadir", "Dinas", "Training", "Sakit", "Cuti", "Izin", "Alpa", "Performance"].map((h, i) => <th key={h} className={cn("px-3 py-2.5", i > 2 && "text-right", i === 0 && "pl-4")}>{h}</th>)}</tr>
            </thead>
            <tbody className="tabular divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={r.member.id}>
                  <td className="py-2 pl-4 pr-3 text-muted">{i + 1}</td>
                  <td className="px-3"><b className="block">{r.member.name}</b><span className="text-xs text-muted">{r.member.noreg}</span></td>
                  <td className="px-3 text-muted">{pos[r.member.positionId]}</td>
                  {[r.workdays, r.hadir, r.dinas, r.training, r.sakit, r.cuti, r.izin, r.alpa].map((v, k) => <td key={k} className={cn("px-3 text-right", k === 7 && v > 0 && "font-semibold text-brand-strong")}>{v}</td>)}
                  <td className="px-3 text-right"><PerfValue p={r.perf} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">Performance = (Hadir + Dinas + Training) ÷ hari kerja member × 100%. Hijau ≥ 95%, kuning 80–94%, merah &lt; 80%.</p>
      </Card>
    </>
  );
}

function Skill() {
  const { s, today, activeMembers, backup } = useStore();
  const gap = backup.map((b) => ({
    ...b,
    gaps: activeMembers.filter((m) => { const c = s.skills[m.id]?.[b.process.id]; return c?.target != null && c.target > c.level; }).length,
  }));
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(monthOf(today), i - 5));
  const ups = months.map((m) => ({ m, n: s.skillLogs.filter((l) => l.to > l.from && l.date.startsWith(m)).length }));
  const maxUp = Math.max(1, ...ups.map((u) => u.n));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader icon={Layers} accent="violet" title="Cadangan dan gap per proses" desc={`Orang ≥ 3/4 dibanding kebutuhan minimal`} />
        <ul className="zebra-list divide-y divide-line">
          {gap.map((g) => (
            <li key={g.process.id} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
              <b>{g.process.name}</b>
              <Bar value={(g.count / Math.max(g.min, 4)) * 100} tone={g.ok ? "ink" : "brand"} />
              <span className="tabular text-right text-xs"><b className={cn(!g.ok && "text-brand-strong")}>{g.count}/{g.min}</b> · {g.gaps} gap</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={TrendingUp} accent="green" title="Kenaikan skill per bulan" desc="Jumlah evaluasi yang menaikkan level, 6 bulan terakhir" />
        <div className="flex h-56 items-end gap-3 px-5 pb-4 pt-6">
          {ups.map(({ m, n }) => (
            <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="tabular text-xs font-semibold">{n}</span>
              <div className="w-full max-w-12 rounded-t bg-good" style={{ height: `${(n / maxUp) * 80}%`, minHeight: n ? 4 : 1 }} />
              <span className="text-xs text-muted">{fmtMonthShort(m)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Qcc() {
  const { s, today, multiSkillRate, backup, activeMembers, multi } = useStore();
  const base = s.snapshots.find((x) => x.kind === "BASELINE");
  const safeNow = backup.filter((b) => b.ok).length;
  const since = s.settings.qccBaselineDate ?? "0000";
  const ups = s.skillLogs.filter((l) => l.to > l.from && l.date >= since).length;
  const trend: { label: string; value: number; live?: boolean }[] = [...s.snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((x) => ({ label: fmtMonthShort(x.month), value: x.multiSkillRate }));
  trend.push({ label: fmtMonthShort(monthOf(today)), value: multiSkillRate, live: true });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Baseline: {base ? fmtMonth(base.month) : "belum diambil"} · Target {s.settings.qccTargetPct}%</p>
        <Button onClick={() => window.print()}><Printer size={16} />Cetak / simpan PDF</Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Target} accent="gray" label="Multi-skill (before)" value={`${base?.multiSkillRate ?? 0}%`} hint="Baseline" />
        <Stat icon={Target} accent="violet" label="Multi-skill (sekarang)" value={`${multiSkillRate}%`} hint={`${multiSkillRate - (base?.multiSkillRate ?? 0) >= 0 ? "+" : ""}${multiSkillRate - (base?.multiSkillRate ?? 0)} poin`} tone={multiSkillRate >= s.settings.qccTargetPct ? "good" : undefined} />
        <Stat icon={Layers} accent="green" label="Proses aman" value={`${base?.safeProcesses ?? 0} → ${safeNow}`} hint={`dari ${backup.length} proses`} />
        <Stat icon={TrendingUp} accent="blue" label="Kenaikan skill" value={ups} hint="Sejak baseline" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={Target} accent="violet" title="Tren % member multi-skill" />
          <div className="p-4"><TrendChart points={trend} target={s.settings.qccTargetPct} label="Tren persentase member multi-skill" /></div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader icon={Users} accent="blue" title="Status per member" desc={`${activeMembers.filter((m) => multi(m.id)).length} dari ${activeMembers.length} sudah multi-skill`} />
          <ul className="grid grid-cols-2 gap-px bg-line text-sm">
            {activeMembers.map((m) => (
              <li key={m.id} className="flex items-center justify-between bg-white px-3 py-2">
                <span className="truncate">{m.name}</span>
                <span className={cn("text-xs font-semibold", multi(m.id) ? "text-good" : "text-muted")}>{multi(m.id) ? "Ya" : "Belum"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

const jktDay = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(ts));

/** PRD v3 F-1502: voices per category for a month, median reply time in working days (KPI ≤ 2), still unanswered. */
function VoiceReport() {
  const { s, today, toast } = useStore();
  const [month, setMonth] = useState(monthOf(today));
  const [all, setAll] = useState<LeaderVoice[] | null>(null);
  useEffect(() => { listVoices().then(setAll, () => setAll([])); }, []);

  const inMonth = (all ?? []).filter((v) => monthOf(jktDay(v.createdAt)) === month);
  const replyDays = inMonth.filter((v) => v.repliedAt)
    .map((v) => replyWorkdays(jktDay(v.createdAt), jktDay(v.repliedAt!), s.settings.workWeekdays, s.holidays));
  const med = median(replyDays);
  const rows = VOICE_CATEGORIES.map((c) => {
    const list = inMonth.filter((v) => v.category === c);
    return { c, total: list.length, replied: list.filter((v) => v.repliedAt).length };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));
  const open = inMonth.filter((v) => !v.repliedAt).length;

  function exportCsv() {
    const head = ["Tanggal", "NoReg", "Nama", "Kategori", "Proses", "Isi", "Status", "Dibalas", "Hari kerja sampai dibalas", "Balasan"];
    const body = inMonth.map((v) => [jktDay(v.createdAt), v.noreg, v.memberName, VOICE_CATEGORY[v.category].label, v.processName ?? "", v.body,
      VOICE_STATUS[v.status].label, v.repliedAt ? jktDay(v.repliedAt) : "",
      v.repliedAt ? replyWorkdays(jktDay(v.createdAt), jktDay(v.repliedAt), s.settings.workWeekdays, s.holidays) : "", v.reply ?? ""]);
    const csv = [head, ...body].map((row) => row.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Voice-Member-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Rekap voice CSV diunduh.");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="month" aria-label="Bulan laporan" max={monthOf(today)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={cn(inputCls, "w-auto")} />
        <Button onClick={exportCsv} disabled={!inMonth.length}><Download size={16} />Export CSV</Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={MessageSquareText} accent="red" label="Voice masuk" value={all ? inMonth.length : "…"} hint={fmtMonth(month)} />
        <Stat icon={Check} accent="green" label="Sudah dibalas" value={inMonth.length - open} />
        <Stat icon={Clock} accent="amber" label="Belum dibalas" value={open} tone={open ? "warn" : undefined} />
        <Stat icon={Timer} accent="blue" label="Median waktu balas" value={med === null ? "-" : `${med} hari`} hint="Hari kerja · target ≤ 2" tone={med !== null && med > 2 ? "bad" : med !== null ? "good" : undefined} />
      </div>
      <Card>
        <CardHeader icon={BarChart3} accent="red" title="Voice per kategori" desc="Batang = jumlah voice bulan ini, angka kanan = sudah dibalas / total." />
        {!all ? <p className="px-5 py-4 text-sm text-muted">Memuat…</p> : !inMonth.length ? <p className="px-5 py-4 text-sm text-muted">Belum ada voice di bulan ini.</p> : (
          <ul className="space-y-3 px-4 py-4 sm:px-5">
            {rows.map((r) => (
              <li key={r.c} className="grid grid-cols-[150px_1fr_64px] items-center gap-3 text-sm">
                <span className={cn(r.c === "K3" && "font-semibold text-brand-strong")}>{VOICE_CATEGORY[r.c].label}</span>
                <Bar value={(r.total / max) * 100} tone={r.c === "K3" ? "brand" : "ink"} />
                <span className="tabular text-right">{r.replied}/{r.total}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
