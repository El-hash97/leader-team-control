"use client";
// Leader side of PRD v3 M11: account status per member + activation code (F-1102, §5.6).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, MessagesSquare, Smartphone } from "lucide-react";
import { createActivationCode, listAccounts, type AccountSummary } from "@/app/actions";
import { listLeaves, listVoices, type LeaderVoice, type LeaveRow } from "@/app/inbox-actions";
import { fmtDate } from "@/lib/format";
import { LEAVE_STATUS, VOICE_CATEGORY, VOICE_STATUS } from "@/components/voice-meta";
import { Badge, Button, Card, CardHeader, Dialog } from "@/components/ui";

/** PRD v3 §5.6: this member's voices and leave requests on the member detail page. */
export function MemberInboxCard({ memberId }: { memberId: string }) {
  const [data, setData] = useState<{ voices: LeaderVoice[]; leaves: LeaveRow[] } | null>(null);
  useEffect(() => {
    Promise.all([listVoices(), listLeaves()])
      .then(([v, l]) => setData({ voices: v.filter((x) => x.memberId === memberId).slice(0, 5), leaves: l.filter((x) => x.memberId === memberId).slice(0, 5) }))
      .catch(() => setData({ voices: [], leaves: [] }));
  }, [memberId]);
  return (
    <Card>
      <CardHeader icon={MessagesSquare} accent="red" title="Voice & cuti" desc="5 terakhir dari portal member" />
      {!data ? <p className="px-5 py-3 text-sm text-muted">Memuat…</p> : (
        <div className="divide-y divide-line text-sm">
          {/* F-1504: learning wishes, one click to a prefilled plan */}
          {[...new Map(data.voices.filter((v) => v.category === "BELAJAR" && v.processId).map((v) => [v.processId, v])).values()].map((v) => (
            <div key={`want-${v.processId}`} className="flex items-center gap-2 bg-info-soft/60 px-4 py-2.5 sm:px-5">
              <span className="min-w-0 flex-1">Minat belajar: <b>{v.processName}</b></span>
              <Link href={`/plans?member=${memberId}&process=${v.processId}`} className="font-semibold text-info hover:underline">Jadikan rencana</Link>
            </div>
          ))}
          {data.voices.map((v) => (
            <Link key={v.id} href="/voice" className="flex items-start gap-2 px-4 py-2.5 hover:bg-rowhover sm:px-5">
              <span className="min-w-0 flex-1"><b className="block">{VOICE_CATEGORY[v.category].label}{v.processName ? ` · ${v.processName}` : ""}</b><span className="line-clamp-1 text-muted">{v.body}</span></span>
              <Badge tone={VOICE_STATUS[v.status].tone}>{VOICE_STATUS[v.status].label}</Badge>
            </Link>
          ))}
          {data.leaves.map((l) => (
            <Link key={l.id} href="/cuti" className="flex items-center gap-2 px-4 py-2.5 hover:bg-rowhover sm:px-5">
              <span className="min-w-0 flex-1"><b className="block">{l.typeName} · {l.workdays} hari</b><span className="tabular text-muted">{fmtDate(l.start)}{l.end !== l.start ? ` – ${fmtDate(l.end)}` : ""}</span></span>
              <Badge tone={LEAVE_STATUS[l.status].tone}>{LEAVE_STATUS[l.status].label}</Badge>
            </Link>
          ))}
          {!data.voices.length && !data.leaves.length && <p className="px-5 py-3 text-muted">Belum ada voice atau pengajuan cuti.</p>}
        </div>
      )}
    </Card>
  );
}

const dt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const fmtTime = (iso: string | null) => (iso ? dt.format(new Date(iso)) : "-");

/** Account summaries for all members; `null` while loading. */
export function useAccounts() {
  const [list, setList] = useState<AccountSummary[] | null>(null);
  const reload = useCallback(() => { listAccounts().then(setList, () => setList([])); }, []);
  useEffect(reload, [reload]);
  return { list, reload };
}

type Kind = "none" | "pending" | "active" | "locked";
export function accountKind(a: AccountSummary | undefined): Kind {
  if (a?.lockedUntil) return "locked";
  if (a?.activated) return "active";
  return a?.codeValidUntil ? "pending" : "none";
}
const KIND: Record<Kind, { label: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  none: { label: "Belum aktif", tone: "neutral" },
  pending: { label: "Menunggu aktivasi", tone: "warn" },
  active: { label: "Aktif", tone: "good" },
  locked: { label: "Terkunci sementara", tone: "bad" },
};

/** Small status mark next to a member name in lists. */
export function AccountMark({ a }: { a: AccountSummary | undefined }) {
  const k = accountKind(a);
  return (
    <span title={`Akun aplikasi: ${KIND[k].label}`} className={k === "active" ? "text-good" : k === "none" ? "text-line" : "text-warn"}>
      <Smartphone size={14} aria-hidden />
      <span className="sr-only">Akun aplikasi: {KIND[k].label}</span>
    </span>
  );
}

export function AccountCard({ memberId, memberName, active }: { memberId: string; memberName: string; active: boolean }) {
  const { list, reload } = useAccounts();
  const a = list?.find((x) => x.memberId === memberId);
  const k = accountKind(a);
  const [confirm, setConfirm] = useState(false);
  const [issued, setIssued] = useState<{ code: string; validUntil: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function issue() {
    setBusy(true);
    setError("");
    const r = await createActivationCode(memberId).catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi." }));
    setBusy(false);
    setConfirm(false);
    if (!r.ok) return setError(r.error);
    setIssued({ code: r.code, validUntil: r.validUntil });
    setCopied(false);
    reload();
  }

  return (
    <Card>
      <CardHeader icon={Smartphone} accent="red" title="Akun Aplikasi" desc="Login member ke portal dengan NoReg"
        action={list && <Badge tone={KIND[k].tone}>{KIND[k].label}</Badge>} />
      <div className="space-y-3 px-4 py-3 text-sm sm:px-5">
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-xs text-muted">Aktivasi</dt><dd className="tabular font-semibold">{fmtTime(a?.activatedAt ?? null)}</dd></div>
          <div><dt className="text-xs text-muted">Login terakhir</dt><dd className="tabular font-semibold">{fmtTime(a?.lastLoginAt ?? null)}</dd></div>
        </dl>
        {k === "pending" && !issued && <p className="text-xs text-muted">Kode aktif sampai {fmtTime(a!.codeValidUntil)}. Kode hanya tampil sekali saat dibuat.</p>}
        {k === "locked" && <p className="text-xs text-muted">Terlalu banyak salah password, terbuka lagi {fmtTime(a!.lockedUntil)}. Buat kode baru untuk membuka sekarang.</p>}

        {issued && (
          <div className="rounded-md border border-brand-strong/30 bg-brand-soft p-3">
            <p className="text-xs font-semibold text-brand-strong">Kode aktivasi untuk {memberName}</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="tabular text-2xl font-bold tracking-[0.25em] sm:text-3xl">{issued.code}</span>
              <Button onClick={() => navigator.clipboard?.writeText(issued.code).then(() => setCopied(true))} aria-label="Salin kode">
                {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Tersalin" : "Salin"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">Berlaku sampai {fmtTime(issued.validUntil)}. Berikan langsung ke member, lalu member buka halaman Aktivasi di layar login.</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-medium text-brand-strong">{error}</p>}

        <Button variant={k === "active" ? "secondary" : "primary"} disabled={!active || busy || !list} className="w-full"
          onClick={() => (k === "active" || k === "pending" ? setConfirm(true) : issue())}>
          <KeyRound size={16} />{k === "active" ? "Reset password (kode baru)" : k === "none" ? "Buat kode aktivasi" : "Buat kode baru"}
        </Button>
        {!active && <p className="text-xs text-muted">Member nonaktif tidak bisa login.</p>}
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Buat kode baru?"
        footer={<><Button onClick={() => setConfirm(false)}>Batal</Button><Button variant="primary" disabled={busy} onClick={issue}>Buat kode</Button></>}>
        <p className="text-sm">Kode lama dan password lama tidak berlaku lagi. {memberName} otomatis keluar dari semua perangkat sampai aktivasi ulang dengan kode baru.</p>
      </Dialog>
    </Card>
  );
}
