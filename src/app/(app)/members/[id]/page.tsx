"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, ChevronLeft, GraduationCap, Grid3x3, History, Pencil, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysLeft, displayStatus, dueLabel, monthOf, shiftMonth, tenure } from "@/lib/rules";
import { fmtDate, fmtMonth } from "@/lib/format";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, KelasBadge, LEVEL_TEXT, PerfValue, SkillDot } from "@/components/ui";
import { MemberDialog } from "@/components/member-dialog";
import { PLAN_STATUS } from "@/components/plan-meta";

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { s, today, multi, monthly, processes } = useStore();
  const [edit, setEdit] = useState(false);
  const m = s.members.find((x) => x.id === id);

  if (!m) {
    return (
      <Card><EmptyState title="Member tidak ditemukan" desc="Member ini tidak ada di grup Anda atau sudah dihapus dari data contoh."
        action={<Link href="/members" className="font-semibold text-brand-strong">Kembali ke Data Member</Link>} /></Card>
    );
  }

  const pos = s.positions.find((p) => p.id === m.positionId)?.name;
  const emp = s.empStatuses.find((e) => e.id === m.statusId);
  const row = s.skills[m.id] ?? {};
  const plans = s.plans.filter((p) => p.memberId === m.id && p.status !== "CANCELLED");
  const logs = s.skillLogs.filter((l) => l.memberId === m.id).slice(0, 8);
  const trainings = s.memberTrainings.filter((t) => t.memberId === m.id);
  const pname = (pid: string) => s.processes.find((p) => p.id === pid)?.name ?? "-";
  const months = [0, -1, -2].map((n) => shiftMonth(monthOf(today), n));
  const contractDays = m.contractEnd && emp?.hasContract ? daysLeft(m.contractEnd, today) : null;

  return (
    <>
      <Link href="/members" className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ChevronLeft size={16} />Data Member</Link>

      <Card className="mb-4">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <Avatar name={m.name} photoUrl={m.photoUrl} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{m.name}</h1>
              <KelasBadge kelas={m.kelas} />
              {!m.active && <Badge>Nonaktif</Badge>}
              {multi(m.id) && <Badge tone="good">Multi-skill</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted">{pos} · <span className="tabular">{m.noreg}</span> · {emp?.name}</p>
          </div>
          <Button onClick={() => setEdit(true)}><Pencil size={16} />Edit data</Button>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {[
            ["Kelas", m.kelas ?? "Vokasi (tanpa kelas)"],
            ["Join date", fmtDate(m.joinDate)],
            ["Masa kerja", tenure(m.joinDate, today)],
            ["Akhir kontrak", emp?.hasContract ? `${fmtDate(m.contractEnd)}${contractDays !== null && contractDays <= s.settings.reminderDays ? ` · ${dueLabel(contractDays)}` : ""}` : "-"],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-3"><dt className="text-xs text-muted">{k}</dt><dd className="tabular mt-0.5 text-sm font-semibold">{v}</dd></div>
          ))}
        </dl>
        {m.notes && <p className="border-t border-line px-5 py-3 text-sm text-muted">{m.notes}</p>}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Grid3x3} accent="violet" title="Skill per proses" desc="Lingkaran putus-putus = belum mencapai target" action={<Link href="/skill-map" className="text-sm font-semibold text-brand-strong">Buka skill map</Link>} />
          <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
            {processes.map((p) => {
              const c = row[p.id] ?? { level: 0, target: null };
              return (
                <li key={p.id} className="flex items-center gap-3 bg-white px-4 py-3">
                  <SkillDot level={c.level} target={c.target} size={26} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm">{p.name}</b>
                    <span className="text-xs text-muted">{c.level ? `${c.level}/4 ` : ""}{LEVEL_TEXT[c.level]}{c.target != null && c.target > c.level ? ` · target ${c.target}/4` : ""}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={TrendingUp} accent="green" title="Rencana peningkatan" action={<Link href="/plans" className="text-sm font-semibold text-brand-strong">Semua rencana</Link>} />
          {plans.length === 0 ? <EmptyState title="Belum ada rencana" desc="Buat rencana dari halaman Mapping Peningkatan." /> : (
            <ul className="zebra-list divide-y divide-line">
              {plans.map((p) => {
                const st = PLAN_STATUS[displayStatus(p, today)];
                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm">{pname(p.processId)} · {p.fromLevel}/4 → {p.targetLevel}/4</b>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="tabular mt-0.5 text-xs text-muted">Target {fmtDate(p.dueDate)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader icon={History} accent="blue" title="Riwayat skill" />
          {logs.length === 0 ? <EmptyState title="Belum ada riwayat" desc="Riwayat muncul setelah level di skill map diubah." /> : (
            <ol className="space-y-3 p-4">
              {logs.map((l) => (
                <li key={l.id} className="flex gap-3 text-sm">
                  <SkillDot level={l.to} size={18} />
                  <span>
                    <b>{pname(l.processId)}</b> {l.from}/4 → {l.to}/4
                    <span className="tabular block text-xs text-muted">{fmtDate(l.date)} · {l.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader icon={GraduationCap} accent="amber" title="Training" />
          <ul className="zebra-list divide-y divide-line">
            {trainings.map((t) => {
              const tr = s.trainings.find((x) => x.id === t.trainingId);
              const d = t.expiresAt ? daysLeft(t.expiresAt, today) : null;
              return (
                <li key={t.trainingId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span><b className="block">{tr?.name}</b><span className="tabular text-xs text-muted">{fmtDate(t.trainedAt)}{t.expiresAt ? ` · berlaku s/d ${fmtDate(t.expiresAt)}` : ""}</span></span>
                  {d !== null && d <= s.settings.reminderDays && <Badge tone={d < 0 ? "bad" : "warn"}>{dueLabel(d)}</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={CalendarCheck} accent="teal" title="Absensi 3 bulan terakhir" />
          <table className="zebra w-full text-sm">
            <thead className="bg-teal-soft text-left text-xs font-semibold text-teal"><tr><th className="px-4 py-2">Bulan</th><th className="px-2">Hadir</th><th className="px-2">Tdk hadir</th><th className="px-4 text-right">Perf.</th></tr></thead>
            <tbody className="divide-y divide-line">
              {months.map((mo) => {
                const r = monthly(mo).find((x) => x.member.id === m.id);
                return (
                  <tr key={mo}>
                    <td className="px-4 py-2">{fmtMonth(mo)}</td>
                    <td className="tabular px-2">{r ? `${r.fulfilled}/${r.workdays}` : "-"}</td>
                    <td className="tabular px-2">{r ? r.sakit + r.cuti + r.izin + r.alpa : "-"}</td>
                    <td className="px-4 text-right"><PerfValue p={r?.perf ?? null} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <MemberDialog open={edit} member={m} onClose={() => setEdit(false)} />
    </>
  );
}
