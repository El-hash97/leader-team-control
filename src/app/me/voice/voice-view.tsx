"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, Camera, Eye, LoaderCircle, Megaphone, Plus, Send, Trash2 } from "lucide-react";
import { markRepliesSeen, sendVoice, type MemberVoice } from "@/app/inbox-actions";
import { Sheet } from "@/components/member-ui";
import { mButtonDark, mCard } from "@/components/member-style";
import { VOICE_CATEGORIES, VOICE_CATEGORY, VOICE_STATUS, type VoiceCategory } from "@/components/voice-meta";
import { cn } from "@/components/ui";

const dt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const STATUS_CHIP = { SENT: "bg-m-low text-m-sub", READ: "bg-m-sky-soft text-[#1d4a8c]", REPLIED: "bg-[#dcf5ea] text-[#0b6b47]" } as const;

/** Resize to ≤1280 px and re-encode as JPEG until it fits ~300 KB (F-1301). Re-encoding also strips anything that is not pixels. */
async function compressPhoto(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (let q = 0.82; q >= 0.4; q -= 0.14) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= 400_000) return url;
  }
  throw new Error("too big");
}

export function VoiceView({ voices, processes }: { voices: MemberVoice[]; processes: { id: string; name: string }[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<VoiceCategory | "ALL">("ALL");
  const [open, setOpen] = useState(false);

  // F-1305: seeing the list clears the dock badge; the "Baru" marks stay for this visit.
  const hasUnseen = voices.some((v) => v.unseen);
  useEffect(() => { if (hasUnseen) markRepliesSeen().then(() => router.refresh()); }, [hasUnseen, router]);

  const counts = Object.fromEntries(VOICE_CATEGORIES.map((c) => [c, voices.filter((v) => v.category === c).length]));
  const list = filter === "ALL" ? voices : voices.filter((v) => v.category === filter);

  return (
    <>
      <p className="-mt-2 mb-4 text-[13px] text-m-sub">Sampaikan saran, keluhan, temuan K3, atau minat belajar proses langsung ke leader.</p>

      <section className="relative overflow-hidden rounded-[26px] bg-brand p-5 text-white shadow-[0_12px_28px_-8px_rgba(200,0,26,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Kirim voice</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/90">Tercatat resmi dan dibalas leader. Target balasan ≤ 2 hari kerja.</p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/90 text-brand"><Megaphone size={24} aria-hidden /></span>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-m-dock px-5 text-[14px] font-semibold text-white shadow-md active:scale-95">
          <Plus size={18} />Tulis voice baru
        </button>
      </section>

      {voices.length > 0 && (
        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 py-1" role="group" aria-label="Saring kategori">
          {(["ALL", ...VOICE_CATEGORIES.filter((c) => counts[c])] as const).map((c) => (
            <button key={c} type="button" onClick={() => setFilter(c)} aria-pressed={filter === c}
              className={cn("h-9 shrink-0 rounded-full px-4 text-[12px] font-semibold shadow-sm", filter === c ? "bg-m-dock text-white" : "bg-white text-m-sub")}>
              {c === "ALL" ? `Semua (${voices.length})` : `${VOICE_CATEGORY[c].label} (${counts[c]})`}
            </button>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-5 px-1 text-base font-bold">Riwayat voice kamu</h2>
      {list.length === 0 ? (
        <p className={`${mCard} px-5 py-6 text-center text-[13px] text-m-sub`}>{voices.length ? "Tidak ada voice di kategori ini." : "Belum ada voice. Tulis yang pertama lewat tombol di atas."}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((v) => (
            <li key={v.id} className={`${mCard} p-5`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", VOICE_CATEGORY[v.category].chip)}>{VOICE_CATEGORY[v.category].label}</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", STATUS_CHIP[v.status])}>{VOICE_STATUS[v.status].label}</span>
                  {v.unseen && <span className="rounded-full bg-m-red-fixed px-2 py-1 text-[10px] font-bold text-brand-strong">Baru</span>}
                </div>
                <time className="shrink-0 text-[11px] text-m-sub" dateTime={v.createdAt}>{dt.format(new Date(v.createdAt))}</time>
              </div>
              {v.processName && <p className="mt-3 rounded-2xl bg-m-low px-3 py-2 text-[13px]"><span className="text-m-sub">Ingin belajar: </span><b>{v.processName}</b></p>}
              <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed">{v.body}</p>
              {v.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.photo} alt="Foto lampiran voice" className="mt-3 max-h-56 w-full rounded-2xl object-cover" />
              )}
              {v.reply ? (
                <div className="mt-4 rounded-[18px] bg-m-red-fixed/60 p-4">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                    <BadgeCheck size={16} className="text-brand" aria-hidden />Balasan leader<span className="font-normal text-m-sub">· {dt.format(new Date(v.repliedAt!))}</span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed">{v.reply}</p>
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-m-sub"><Eye size={14} aria-hidden />{v.status === "READ" ? "Sudah dibaca leader, menunggu balasan" : "Menunggu dibaca leader"}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Tulis voice" subtitle="Satu voice dibalas satu kali oleh leader">
        {open && <VoiceForm processes={processes} onDone={() => { setOpen(false); setFilter("ALL"); router.refresh(); }} />}
      </Sheet>
    </>
  );
}

function VoiceForm({ processes, onDone }: { processes: { id: string; name: string }[]; onDone: () => void }) {
  const [category, setCategory] = useState<VoiceCategory>("SARAN");
  const [processId, setProcessId] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("File harus berupa foto.");
    try { setPhoto(await compressPhoto(file)); setError(""); } catch { setError("Foto tidak bisa diproses. Coba foto lain."); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (body.trim().length < 10) return setError("Isi voice minimal 10 karakter.");
    if (category === "BELAJAR" && !processId) return setError("Pilih proses yang ingin dipelajari.");
    setBusy(true);
    const r = await sendVoice({ category, processId: category === "BELAJAR" ? processId : null, body, photo })
      .catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi. Coba lagi." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">Kategori</legend>
        <div className="grid grid-cols-2 gap-2">
          {VOICE_CATEGORIES.map((c) => (
            <label key={c} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-3 text-[13px] font-semibold", VOICE_CATEGORY[c].chip, category === c ? "ring-2 ring-m-dock" : "opacity-80")}>
              <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} className="accent-[var(--color-brand)]" />
              {VOICE_CATEGORY[c].label}
            </label>
          ))}
        </div>
      </fieldset>

      {category === "BELAJAR" && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Proses yang ingin dipelajari</span>
          <select value={processId} onChange={(e) => setProcessId(e.target.value)} className="h-12 w-full rounded-2xl bg-m-low px-4 text-[15px]">
            <option value="">Pilih proses…</option>
            {processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}

      <label className="block">
        <span className="mb-1.5 flex justify-between text-[13px] font-semibold">Isi voice<span className="font-medium text-m-sub">{body.trim().length}/1000</span></span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} required
          placeholder="Tulis dengan jelas: apa, di mana, kapan." className="w-full resize-none rounded-[18px] bg-m-low p-4 text-[15px] placeholder:text-m-sub/70 focus:outline-none focus:ring-2 focus:ring-brand/40" />
      </label>

      <div>
        {photo ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Pratinjau foto" className="max-h-48 w-full rounded-2xl object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="absolute right-2 top-2 inline-flex h-9 items-center gap-1 rounded-full bg-white/90 px-3 text-[12px] font-semibold"><Trash2 size={14} />Hapus</button>
          </div>
        ) : (
          <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-2xl bg-m-low px-4 text-[13px] font-semibold">
            <span className="flex items-center gap-2"><Camera size={18} className="text-m-sub" aria-hidden />Lampirkan foto (opsional)</span>
            <span className="rounded-full bg-white px-3 py-1 text-[12px] shadow-sm">Pilih</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
      </div>

      <p role="alert" className="min-h-5 text-[13px] font-medium text-brand-strong">{error}</p>
      <button type="submit" disabled={busy} className={mButtonDark}>
        {busy ? <><LoaderCircle size={18} className="animate-spin" />Mengirim…</> : <><Send size={18} />Kirim voice</>}
      </button>
    </form>
  );
}
