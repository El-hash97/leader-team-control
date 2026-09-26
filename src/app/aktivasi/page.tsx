"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import { activate } from "@/app/actions";
import { LtcMark } from "@/components/ltc-mark";
import { jakarta, mButtonDark, mCard, mInput } from "@/components/member-style";

// F-1103: NoReg + 6-digit code from the leader + own password. Mobile-first, same look as /me.
export default function ActivationPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const noreg = String(f.get("noreg")).trim(), code = String(f.get("code")).trim(), pass = String(f.get("password"));
    if (!/^\d{7}$/.test(noreg)) return setError("NoReg harus 7 digit angka.");
    if (!/^\d{6}$/.test(code)) return setError("Kode aktivasi harus 6 digit angka.");
    if (pass.length < 6) return setError("Password minimal 6 karakter.");
    if (pass !== String(f.get("repeat"))) return setError("Ulangi password belum sama.");
    setBusy(true);
    setError("");
    const r = await activate(noreg, code, pass).catch(() => ({ ok: false as const, error: "Server tidak bisa dihubungi. Coba lagi." }));
    if (r.ok) return router.push("/me");
    setBusy(false);
    setError(r.error);
  }

  const digits = { inputMode: "numeric" as const, pattern: "[0-9]*", autoComplete: "off", spellCheck: false };

  return (
    <div className={`${jakarta.variable} min-h-dvh bg-m-canvas font-jakarta text-m-text`}>
      <main className="mx-auto w-full max-w-md px-5 pb-10 pt-[max(env(safe-area-inset-top),20px)]">
        <Link href="/login" className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-m-sub hover:text-m-text"><ArrowLeft size={16} />Kembali ke login</Link>

        <section className="relative mt-3 overflow-hidden rounded-[26px] bg-brand p-6 text-white shadow-[0_12px_28px_-8px_rgba(200,0,26,0.45)]">
          <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 size-36 rounded-full bg-white/15 blur-sm" />
          <span className="grid size-12 place-items-center rounded-2xl bg-white"><LtcMark size={34} /></span>
          <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight">Aktivasi akun member</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/90">Masukkan NoReg dan kode 6 digit dari leader, lalu buat password sendiri.</p>
        </section>

        <form onSubmit={submit} noValidate className={`${mCard} mt-4 space-y-4 p-5`}>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">NoReg</span>
            <input name="noreg" maxLength={7} placeholder="7 digit" disabled={busy} className={`${mInput} tabular-nums`} {...digits} />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">Kode aktivasi<span className="text-[11px] font-medium text-m-sub">Berlaku 24 jam</span></span>
            <input name="code" maxLength={6} placeholder="6 digit" disabled={busy} className={`${mInput} text-center text-xl font-bold tracking-[0.4em] tabular-nums`} {...digits} autoComplete="one-time-code" />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">Password baru<span className="text-[11px] font-medium text-m-sub">Min. 6 karakter</span></span>
            <input name="password" type="password" autoComplete="new-password" maxLength={128} disabled={busy} className={mInput} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Ulangi password</span>
            <input name="repeat" type="password" autoComplete="new-password" maxLength={128} disabled={busy} className={mInput} />
          </label>
          <p role="alert" className="min-h-5 text-[13px] font-medium text-brand-strong">{error}</p>
          <button type="submit" disabled={busy} className={mButtonDark}>
            {busy ? <><LoaderCircle size={18} className="animate-spin" />Memeriksa…</> : <><KeyRound size={18} />Aktifkan &amp; masuk</>}
          </button>
          <p className="text-[12px] leading-snug text-m-sub">Belum punya kode atau kode habis? Minta kode baru ke leader. Kode baru juga dipakai untuk reset password.</p>
        </form>
      </main>
    </div>
  );
}
