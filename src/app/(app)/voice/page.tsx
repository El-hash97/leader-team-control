"use client";
// PRD v3 M13 leader side: inbox (F-1303), open = read + reply once (F-1304).
import { useEffect, useMemo, useState } from "react";
import { ImageIcon, LoaderCircle, MessageSquareText, Search, Send, ShieldAlert } from "lucide-react";
import { listVoices, openVoice, replyVoice, type LeaderVoice } from "@/app/inbox-actions";
import { announceInboxChange } from "@/components/use-inbox";
import { VOICE_CATEGORIES, VOICE_CATEGORY, VOICE_STATUS, type VoiceCategory } from "@/components/voice-meta";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, Segmented, cn, inputCls } from "@/components/ui";

const dt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
type StatusFilter = "OPEN" | "REPLIED" | "ALL";

export default function VoicePage() {
  const [list, setList] = useState<LeaderVoice[] | null>(null);
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [category, setCategory] = useState<VoiceCategory | "">("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { listVoices().then(setList, () => setList([])); }, []);

  const shown = useMemo(() => (list ?? []).filter((v) =>
    (status === "ALL" || (status === "OPEN" ? v.status !== "REPLIED" : v.status === "REPLIED")) &&
    (!category || v.category === category) &&
    `${v.memberName} ${v.noreg} ${v.body}`.toLowerCase().includes(q.toLowerCase())), [list, status, category, q]);
  const open = list?.find((v) => v.id === openId) ?? null;
  const unread = list?.filter((v) => v.status === "SENT").length ?? 0;
  const pending = list?.filter((v) => v.status !== "REPLIED").length ?? 0;

  return (
    <>
      <PageHeader title="Voice Member" icon={MessageSquareText} accent="red"
        desc={list ? `${unread} belum dibaca · ${pending} belum dibalas. K3/Safety yang belum dibalas selalu di atas.` : "Memuat…"} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <Segmented label="Status" value={status} onChange={setStatus}
            options={[{ value: "OPEN", label: "Belum dibalas" }, { value: "REPLIED", label: "Dibalas" }, { value: "ALL", label: "Semua" }]} />
          <div className="flex gap-2">
            <select aria-label="Kategori" value={category} onChange={(e) => setCategory(e.target.value as VoiceCategory | "")} className={cn(inputCls, "sm:w-48")}>
              <option value="">Semua kategori</option>
              {VOICE_CATEGORIES.map((c) => <option key={c} value={c}>{VOICE_CATEGORY[c].label}</option>)}
            </select>
            <label className="relative block sm:w-56">
              <span className="sr-only">Cari</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau isi" className={cn(inputCls, "pl-9")} />
            </label>
          </div>
        </div>

        {!list ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" />Memuat voice…</p>
        ) : shown.length === 0 ? (
          <EmptyState title={list.length ? "Tidak ada voice yang cocok" : "Belum ada voice"} desc={list.length ? "Ubah filter atau kata kunci." : "Voice dari member akan muncul di sini."} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((v) => (
              <li key={v.id}>
                <button onClick={() => setOpenId(v.id)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-rowhover sm:px-5", v.status === "SENT" && "bg-brand-soft/40")}>
                  <Avatar name={v.memberName} photoUrl={v.photoUrl} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className={cn("text-sm", v.status === "SENT" && "font-bold")}>{v.memberName}</b>
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", VOICE_CATEGORY[v.category].chip)}>
                        {v.category === "K3" && <ShieldAlert size={11} className="-mt-px mr-0.5 inline" aria-hidden />}{VOICE_CATEGORY[v.category].label}
                      </span>
                      {v.hasPhoto && <ImageIcon size={14} className="text-muted" aria-label="ada foto" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{v.processName ? `[${v.processName}] ` : ""}{v.body}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={VOICE_STATUS[v.status].tone}>{VOICE_STATUS[v.status].label}</Badge>
                    <span className="tabular text-xs text-muted">{dt.format(new Date(v.createdAt))}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && (
        <VoiceDialog key={open.id} v={open} onClose={() => setOpenId(null)}
          onChanged={(patch) => { setList((l) => l?.map((x) => (x.id === open.id ? { ...x, ...patch } : x)) ?? null); announceInboxChange(); }} />
      )}
    </>
  );
}

function VoiceDialog({ v, onClose, onChanged }: { v: LeaderVoice; onClose: () => void; onChanged: (p: Partial<LeaderVoice>) => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // F-1304: opening marks the voice as read (server keeps the first read time). Runs once per opened voice.
  useEffect(() => {
    openVoice(v.id).then((r) => {
      if (!r.ok) return setError(r.error);
      setPhoto(r.photo);
      if (v.status === "SENT") onChanged({ status: "READ", readAt: new Date().toISOString() });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.id]);

  async function send() {
    if (!reply.trim()) return setError("Tulis balasan dulu.");
    setBusy(true);
    const r = await replyVoice(v.id, reply).catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onChanged({ status: "REPLIED", reply: reply.trim(), repliedAt: new Date().toISOString() });
  }

  return (
    <Dialog open onClose={onClose} title="Voice member" wide
      footer={v.status === "REPLIED" ? <Button onClick={onClose}>Tutup</Button> : (
        <><Button onClick={onClose}>Nanti</Button><Button variant="primary" disabled={busy} onClick={send}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}Kirim balasan</Button></>
      )}>
      <div className="flex items-center gap-3">
        <Avatar name={v.memberName} photoUrl={v.photoUrl} size={44} />
        <div className="min-w-0">
          <p className="font-semibold">{v.memberName} <span className="tabular text-sm font-normal text-muted">· {v.noreg}</span></p>
          <p className="text-xs text-muted">{dt.format(new Date(v.createdAt))}</p>
        </div>
        <span className={cn("ml-auto rounded px-2 py-0.5 text-xs font-semibold", VOICE_CATEGORY[v.category].chip)}>{VOICE_CATEGORY[v.category].label}</span>
      </div>
      {v.processName && <p className="mt-3 rounded-md bg-info-soft px-3 py-2 text-sm">Minat belajar proses: <b>{v.processName}</b></p>}
      <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{v.body}</p>
      {v.hasPhoto && (photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <a href={photo} target="_blank" rel="noreferrer"><img src={photo} alt="Foto dari member" className="mt-3 max-h-80 rounded-md border border-line object-contain" /></a>
        : <p className="mt-3 flex items-center gap-2 text-sm text-muted"><LoaderCircle size={14} className="animate-spin" />Memuat foto…</p>)}

      <div className="mt-5 border-t border-line pt-4">
        {v.status === "REPLIED" ? (
          <div className="rounded-md bg-good-soft p-3">
            <p className="text-xs font-semibold text-good">Dibalas oleh Leader{v.repliedAt ? ` · ${dt.format(new Date(v.repliedAt))}` : ""}</p>
            <p className="mt-1 whitespace-pre-line text-sm">{v.reply}</p>
          </div>
        ) : (
          <Field label="Balasan (satu kali, tidak bisa diubah)" error={error || undefined}>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={1000} className={cn(inputCls, "py-2")} placeholder="Tulis tanggapan untuk member…" />
          </Field>
        )}
        {v.status === "REPLIED" && error && <p className="mt-2 text-sm text-brand-strong">{error}</p>}
      </div>
    </Dialog>
  );
}
