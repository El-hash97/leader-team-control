"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowRight, Award, CalendarCheck, CalendarX, CircleAlert, FileClock, GraduationCap, Layers, LayoutDashboard, Medal, Network, ShieldAlert, Target, UserCheck, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { displayStatus, dueLabel, monthOf, rate } from "@/lib/rules";
import { fmtDate, fmtDateLong, fmtMonth, fmtMonthShort } from "@/lib/format";
import { Avatar, Badge, Bar, Card, CardHeader, PageHeader, PerfValue, SkillDot, Stat, TrendChart, cn, inputCls } from "@/components/ui";

export default function DashboardPage() {
  const st = useStore();
  const { s, today, refDay, activeMembers, processes, levels, multiSkillRate, backup, statusById, att, monthly, alerts } = st;
  const [month, setMonth] = useState(monthOf(today));

  const todayStats = useMemo(() => {
    let hadir = 0, trainDinas = 0, absent = 0, empty = 0;
    const present = new Set<string>();
    for (const m of activeMembers) {
      const rec = att(refDay, m.id);
      const status = rec && statusById[rec.statusId];
      if (!status) { empty++; continue; }
      if (status.name === "Hadir") { hadir++; present.add(m.id); }
      else if (status.category === "FULFILLED") { trainDinas++; if (status.name === "Dinas") present.add(m.id); }
      else absent++;
    }
    return { hadir, trainDinas, absent, empty, present };
  }, [activeMembers, att, statusById, refDay]);

  // F-207: processes whose experts are not present today, with present backups
  const backupToday = useMemo(() => processes.map((p) => {
    const experts = activeMembers.filter((m) => (levels(m.id)[p.id] ?? 0) >= 3);
    const away = experts.filter((m) => !todayStats.present.has(m.id));
    const available = experts.filter((m) => todayStats.present.has(m.id));
    return { p, away, available };
  }).filter((x) => x.away.length > 0 && x.available.length < 2), [processes, activeMembers, levels, todayStats.present]);

  const dayLabel = refDay === today ? "hari ini" : fmtDate(refDay);
  const rows = monthly(month);
  const scored = rows.filter((r) => r.perf !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.perf ?? 0), 0) / scored.length) : 0;
  const contractCount = alerts.filter((a) => a.kind === "contract").length;
  const overdue = s.plans.filter((p) => displayStatus(p, today) === "OVERDUE").length;
  const unsafe = backup.filter((b) => !b.ok);
  const kelasRows = [
    { key: "3", label: "3A–3C", fill: "bg-teal" },
    { key: "4", label: "4A–4C", fill: "bg-info" },
    { key: "5", label: "5A–5C", fill: "bg-violet" },
    { key: "6", label: "6A–6C", fill: "bg-[#b07a00]" },
    { key: null, label: "Vokasi", fill: "bg-muted" },
  ].map((k) => ({ ...k, n: activeMembers.filter((m) => (k.key ? m.kelas?.[0] === k.key : !m.kelas)).length }));
  const trend: { label: string; value: number; live?: boolean }[] = [...s.snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((x) => ({ label: fmtMonthShort(x.month), value: x.multiSkillRate }));
  trend.push({ label: fmtMonthShort(monthOf(today)), value: multiSkillRate, live: true });

  return (
    <>
      <PageHeader
        title="Leader Control Center"
        desc={fmtDateLong(today)}
        icon={LayoutDashboard}
        accent="red"
        actions={<Link href="/attendance" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-strong px-4 text-sm font-semibold text-white hover:bg-[#a80016] sm:min-h-10"><CalendarCheck size={17} />Input absensi</Link>}
      />

      {refDay !== today && (
        <p className="mb-3 rounded-md border border-line bg-white px-4 py-2.5 text-sm text-muted">
          Hari ini bukan hari kerja. Data absensi dan cadangan proses memakai hari kerja terakhir: <b className="text-ink">{fmtDateLong(refDay)}</b>.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Users} accent="blue" label="Member aktif" value={activeMembers.length} hint={`${s.processes.filter((p) => p.active).length} proses`} />
        <Stat icon={UserCheck} accent="green" label="Hadir" value={todayStats.hadir} hint={`${rate(todayStats.hadir, activeMembers.length)}% · ${dayLabel}`} />
        <Stat icon={CalendarX} accent="red" label="Belum diabsen" value={todayStats.empty} tone={todayStats.empty ? "bad" : "good"} hint={todayStats.empty ? `Perlu diisi · ${dayLabel}` : dayLabel} />
        <Stat icon={GraduationCap} accent="amber" label="Training / dinas" value={todayStats.trainDinas} hint={dayLabel} />
        <Stat icon={Activity} accent="teal" label="Rata-rata performance" value={`${avg}%`} hint={fmtMonth(month)} />
        <Stat icon={FileClock} accent="violet" label="Kontrak ≤ H-90" value={contractCount} tone={contractCount ? "warn" : undefined} hint="Termasuk yang lewat" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={ShieldAlert} accent="red" title={`Cadangan proses · ${dayLabel}`} desc="Proses yang orang ≥ 3/4-nya tidak hadir, dan siapa yang bisa menggantikan." />
          {backupToday.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Semua proses punya minimal 2 orang ≥ 3/4 yang hadir hari ini.</p>
          ) : (
            <ul className="zebra-list divide-y divide-line">
              {backupToday.map(({ p, away, available }) => (
                <li key={p.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[120px_1fr_1fr] sm:px-5">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm">
                    <span className="text-xs text-muted">Tidak hadir</span>
                    <div>{away.map((m) => m.name).join(", ")}</div>
                  </div>
                  <div className="text-sm">
                    <span className="text-xs text-muted">Bisa menggantikan</span>
                    {available.length ? <div className="font-medium text-good">{available.map((m) => m.name).join(", ")}</div>
                      : <div className="font-semibold text-brand-strong">Tidak ada, perlu pinjam dari grup lain</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={CircleAlert} accent="amber" title="Perlu tindakan" desc="Kontrak, sertifikat, dan rencana yang mendekati atau lewat batas." />
          <ul className="zebra-list divide-y divide-line">
            {alerts.filter((a) => a.kind !== "attendance").slice(0, 6).map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-soft sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted">{a.detail}</span>
                  </span>
                  <Badge tone={(a.days ?? 0) < 0 ? "bad" : "warn"}>{dueLabel(a.days ?? 0)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          {alerts.filter((a) => a.kind !== "attendance").length === 0 && <p className="px-5 py-6 text-sm text-muted">Tidak ada kontrak atau sertifikat yang perlu follow up.</p>}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={Target} accent="violet" title="QCC: % member multi-skill" desc={`Multi-skill = ≥ ${s.settings.multiSkillMinProcesses} proses di level ≥ 3/4`}
            action={<Link href="/reports?tab=qcc" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-strong">Laporan QCC<ArrowRight size={15} /></Link>} />
          <div className="grid gap-4 p-4 sm:grid-cols-[200px_1fr] sm:p-5">
            <div className="space-y-4">
              <div>
                <div className="tabular text-4xl font-bold">{multiSkillRate}%</div>
                <div className="mt-2"><Bar value={(multiSkillRate / s.settings.qccTargetPct) * 100} tone="brand" /></div>
                <div className="mt-1 text-xs text-muted">Target {s.settings.qccTargetPct}% · kurang {Math.max(0, s.settings.qccTargetPct - multiSkillRate)} poin</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-1">
                <div><div className={cn("tabular text-xl font-bold", unsafe.length && "text-brand-strong")}>{unsafe.length}</div><div className="text-xs text-muted">Proses tanpa cadangan</div></div>
                <div><div className={cn("tabular text-xl font-bold", overdue && "text-brand-strong")}>{overdue}</div><div className="text-xs text-muted">Rencana terlambat</div></div>
              </div>
            </div>
            <TrendChart points={trend} target={s.settings.qccTargetPct} label="Tren persentase member multi-skill per bulan" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Medal} accent="teal" title="Ranking performance absensi"
            desc={<span className="flex items-center gap-2">Bulan <input type="month" aria-label="Pilih bulan" value={month} max={monthOf(today)} onChange={(e) => e.target.value && setMonth(e.target.value)} className={cn(inputCls, "!min-h-8 w-auto px-2 py-0 text-xs")} /></span>}
            action={<Link href="/reports" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-strong">Detail<ArrowRight size={15} /></Link>} />
          <ol className="zebra-list divide-y divide-line">
            {rows.slice(0, 5).map((r, i) => (
              <li key={r.member.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="tabular w-5 text-sm font-semibold text-muted">{i + 1}</span>
                <Avatar name={r.member.name} photoUrl={r.member.photoUrl} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.member.name}</span>
                <span className="tabular text-xs text-muted">{r.fulfilled}/{r.workdays} hari</span>
                <PerfValue p={r.perf} />
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader icon={Award} accent="blue" title="Komposisi kelas" desc="Member aktif per kelas" />
          <div className="space-y-3 p-4 sm:p-5">
            {kelasRows.map((k) => (
              <div key={k.label} className="grid grid-cols-[64px_1fr_56px] items-center gap-3 text-sm">
                <span className="tabular font-semibold">{k.label}</span>
                <Bar value={rate(k.n, activeMembers.length)} fill={k.fill} />
                <span className="tabular text-right text-muted">{k.n} org</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Layers} accent="violet" title="Cadangan per proses" desc={`Orang ≥ 3/4, minimal ${s.settings.defaultMinBackup}`}
            action={<Link href="/skill-map" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-strong">Skill map<ArrowRight size={15} /></Link>} />
          <ul className="grid grid-cols-2 gap-px bg-line">
            {backup.map((b) => (
              <li key={b.process.id} className="flex items-center justify-between bg-white px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2"><SkillDot level={3} size={16} />{b.process.name}</span>
                <span className={cn("tabular font-semibold", !b.ok && "text-brand-strong")}>{b.count}{!b.ok && " · kurang"}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader icon={Network} accent="blue" title="Hirarki grup" desc="Member aktif per posisi" />
          <ul className="zebra-list divide-y divide-line">
            {[...s.positions].sort((a, b) => a.order - b.order).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm sm:px-5">
                <span>{p.name}</span>
                <span className="tabular font-semibold">{activeMembers.filter((m) => m.positionId === p.id).length}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader icon={CalendarCheck} accent="teal" title={`Absensi · ${dayLabel}`} action={<Link href={`/attendance?date=${refDay}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-strong">Buka absensi<ArrowRight size={15} /></Link>} />
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[["Hadir", todayStats.hadir, ""], ["Training / dinas", todayStats.trainDinas, ""], ["Tidak hadir", todayStats.absent, ""], ["Belum diabsen", todayStats.empty, todayStats.empty ? "text-brand-strong" : ""]].map(([l, v, c]) => (
            <div key={l as string} className="bg-white px-4 py-3 sm:px-5">
              <div className="text-xs text-muted">{l}</div>
              <div className={cn("tabular text-2xl font-bold", c as string)}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
