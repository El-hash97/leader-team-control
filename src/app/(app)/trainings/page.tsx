"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, CalendarClock, CircleAlert, GraduationCap, Hourglass, Table2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysLeft, dueLabel } from "@/lib/rules";
import { fmtDate } from "@/lib/format";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, PageHeader, SkillDot, Stat, cn, inputCls } from "@/components/ui";

type Sel = { memberId: string; trainingId: string } | null;

export default function TrainingsPage() {
  const { s, today, activeMembers, setMemberTraining, toast } = useStore();
  const [sel, setSel] = useState<Sel>(null);
  const [draft, setDraft] = useState({ level: 0, trainedAt: "", expiresAt: "" });
  const [err, setErr] = useState("");

  const find = (memberId: string, trainingId: string) => s.memberTrainings.find((t) => t.memberId === memberId && t.trainingId === trainingId);
  const expiring = s.memberTrainings
    .filter((t) => t.expiresAt && activeMembers.some((m) => m.id === t.memberId))
    .map((t) => ({ t, d: daysLeft(t.expiresAt!, today) }))
    .sort((a, b) => a.d - b.d);
  const soon = expiring.filter((x) => x.d >= 0 && x.d <= s.settings.reminderDays).length;
  const expired = expiring.filter((x) => x.d < 0).length;
  const name = (id: string) => s.members.find((m) => m.id === id)?.name ?? "-";
  const tname = (id: string) => s.trainings.find((t) => t.id === id)?.name ?? "-";
  const selTraining = sel && s.trainings.find((t) => t.id === sel.trainingId);

  const open = (memberId: string, trainingId: string) => {
    const t = find(memberId, trainingId);
    setDraft({ level: t?.level ?? 0, trainedAt: t?.trainedAt ?? today, expiresAt: t?.expiresAt ?? "" });
    setErr("");
    setSel({ memberId, trainingId });
  };
  function save() {
    if (!sel) return;
    if (draft.level > 0 && selTraining?.hasExpiry && !draft.expiresAt) return setErr("Masa berlaku wajib diisi untuk sertifikat ini.");
    setMemberTraining(sel.memberId, sel.trainingId, draft.level > 0 ? { level: draft.level, trainedAt: draft.trainedAt || null, expiresAt: draft.expiresAt || null } : null);
    toast("Data training disimpan.");
    setSel(null);
  }

  return (
    <>
      <PageHeader title="Training" desc="Riwayat training member dan masa berlaku sertifikat (SIO)." icon={GraduationCap} accent="amber" />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icon={BookOpen} accent="blue" label="Jenis training" value={s.trainings.length} />
        <Stat icon={Hourglass} accent="amber" label={`Habis ≤ ${s.settings.reminderDays} hari`} value={soon} tone={soon ? "warn" : undefined} />
        <Stat icon={CircleAlert} accent="red" label="Sudah lewat" value={expired} tone={expired ? "bad" : "good"} />
      </div>

      <Card className="mb-4">
        <CardHeader icon={CalendarClock} accent="amber" title="Masa berlaku sertifikat" desc="Urut dari yang paling dekat habis" />
        {expiring.length === 0 ? <EmptyState title="Belum ada sertifikat bermasa berlaku" desc="Isi masa berlaku saat mencatat training SIO." /> : (
          <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {expiring.map(({ t, d }) => (
              <li key={`${t.memberId}${t.trainingId}`} className="flex items-center justify-between gap-3 bg-white px-4 py-2.5">
                <span className="min-w-0 text-sm">
                  <Link href={`/members/${t.memberId}`} className="block truncate font-semibold hover:underline">{name(t.memberId)}</Link>
                  <span className="tabular text-xs text-muted">{tname(t.trainingId)} · {fmtDate(t.expiresAt)}</span>
                </span>
                <Badge tone={d < 0 ? "bad" : d <= s.settings.reminderDays ? "warn" : "neutral"}>{dueLabel(d)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader icon={Table2} accent="blue" title="Matriks training" desc="Soft skill map member" />
        <p className="px-4 pt-2 text-xs text-muted md:hidden">Geser tabel ke samping untuk melihat semua training.</p>
        <div className="overflow-x-auto">
          <table className="zebra w-full border-separate border-spacing-0 whitespace-nowrap text-xs">
            <thead>
              <tr className="font-semibold text-warn">
                <th className="sticky left-0 z-10 border-b border-line bg-warn-soft px-3 py-2 text-left sm:px-4">Member</th>
                {s.trainings.map((t) => <th key={t.id} className="border-b border-line bg-warn-soft px-1 py-2 text-center"><span className="block max-w-20 whitespace-normal leading-tight">{t.name}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => (
                <tr key={m.id}>
                  <td className="sticky left-0 z-10 border-b border-line bg-[var(--row)] px-3 py-1 text-sm font-medium sm:px-4">{m.name}</td>
                  {s.trainings.map((t) => {
                    const mt = find(m.id, t.id);
                    const d = mt?.expiresAt ? daysLeft(mt.expiresAt, today) : null;
                    return (
                      <td key={t.id} className="border-b border-line p-0 text-center">
                        <button onClick={() => open(m.id, t.id)} title={mt ? `${fmtDate(mt.trainedAt)}${mt.expiresAt ? ` · s/d ${fmtDate(mt.expiresAt)}` : ""}` : "Belum"}
                          aria-label={`${m.name}, ${t.name}: level ${mt?.level ?? 0} dari 4`}
                          className={cn("mx-auto grid size-10 place-items-center rounded-md hover:ring-1 hover:ring-line",
                            d !== null && d < 0 && "bg-brand-soft text-brand-strong", d !== null && d >= 0 && d <= s.settings.reminderDays && "bg-warn-soft text-warn")}>
                          {mt ? <SkillDot level={mt.level} size={22} /> : <span className="text-line">·</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!sel} onClose={() => setSel(null)} title={`${sel ? name(sel.memberId) : ""} · ${selTraining?.name ?? ""}`}
        footer={<><Button onClick={() => setSel(null)}>Batal</Button><Button variant="primary" onClick={save}>Simpan</Button></>}>
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Level training <span className="font-normal text-muted">(0 = belum mengikuti)</span></legend>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <button key={i} type="button" onClick={() => setDraft((d) => ({ ...d, level: i }))} aria-pressed={draft.level === i}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-sm",
                    draft.level === i ? "border-brand-strong bg-brand-soft font-semibold" : "border-line hover:bg-soft")}>
                  <SkillDot level={i} size={24} />
                  <span className="tabular">{i ? `${i}/4` : "0"}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {draft.level > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal training"><input type="date" max={today} className={inputCls} value={draft.trainedAt} onChange={(e) => setDraft({ ...draft, trainedAt: e.target.value })} /></Field>
              {selTraining?.hasExpiry && (
                <Field label="Berlaku sampai *" error={err}><input type="date" className={inputCls} value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} /></Field>
              )}
              <Field label="Sertifikat" hint="Upload tersedia setelah backend terhubung." className="sm:col-span-2">
                <input type="file" disabled className={cn(inputCls, "py-2")} />
              </Field>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
