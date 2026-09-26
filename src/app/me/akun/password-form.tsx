"use client";
import { useState, type FormEvent } from "react";
import { CircleCheck, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { changePassword } from "@/app/actions";
import { mButtonDark, mInput } from "@/components/member-style";

function PasswordInput({ name, label, hint, autoComplete }: { name: string; label: string; hint?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">{label}{hint && <span className="text-[11px] font-medium text-m-sub">{hint}</span>}</span>
      <span className="relative block">
        <input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={6} maxLength={128} className={`${mInput} pr-12`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={show}
          className="absolute right-1 top-1 grid size-10 place-items-center rounded-full text-m-sub hover:text-m-text">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

// F-1104: current + new + repeat. Server bumps session_version, so other devices are signed out.
export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const next = String(f.get("next"));
    if (next !== String(f.get("repeat"))) return setMsg({ ok: false, text: "Ulangi password baru belum sama." });
    setBusy(true);
    setMsg(null);
    const r = await changePassword(String(f.get("current")), next).catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi. Coba lagi." }));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    form.reset();
    setMsg({ ok: true, text: "Password diganti. Perangkat lain otomatis keluar." });
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <PasswordInput name="current" label="Password saat ini" autoComplete="current-password" />
      <PasswordInput name="next" label="Password baru" hint="Min. 6 karakter" autoComplete="new-password" />
      <PasswordInput name="repeat" label="Ulangi password baru" autoComplete="new-password" />
      <p role="status" className={`min-h-5 text-[13px] font-medium ${msg?.ok ? "text-m-ok" : "text-brand-strong"}`}>
        {msg?.ok && <CircleCheck size={15} className="mr-1 inline align-[-2px]" />}{msg?.text}
      </p>
      <button type="submit" disabled={busy} className={mButtonDark}>
        {busy ? <><LoaderCircle size={18} className="animate-spin" />Menyimpan…</> : "Simpan password baru"}
      </button>
    </form>
  );
}
