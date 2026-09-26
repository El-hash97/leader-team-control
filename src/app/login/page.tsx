"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-8 bg-brand-strong px-6 py-5 text-white lg:px-12 lg:py-10">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-md bg-white text-base font-black text-brand-strong">LTC</span>
          <span>
            <span className="block text-lg font-bold leading-tight">Leader Team Control</span>
            <span className="block text-xs text-[#ffe1e5]">Skill &amp; mapping peningkatan member</span>
          </span>
        </div>
        <div className="hidden lg:block">
          <p className="max-w-md text-3xl font-bold leading-tight">Tahu siapa bisa apa, di proses mana, dan siapa yang perlu dinaikkan berikutnya.</p>
          <p className="mt-3 max-w-md text-[#ffe1e5]">Pantau skill member per proses, susun rencana peningkatan, dan kontrol absensi harian grup dalam satu tempat.</p>
        </div>
        <p className="hidden text-xs text-[#ffe1e5] lg:block">Akses hanya untuk Leader (TL/GL). Akun dibuat oleh admin.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <form
          className="w-full max-w-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (!String(f.get("id")).trim() || !String(f.get("pw"))) return setError("Isi NoReg/email dan password.");
            setError("");
            setBusy(true);
            router.push("/dashboard");
          }}
        >
          <div>
            <h1 className="text-2xl font-bold">Masuk</h1>
            <p className="mt-1 text-sm text-muted">Mode pratinjau: isian apa saja akan membuka dashboard dengan data contoh.</p>
          </div>
          <Field label="NoReg atau email">
            <input name="id" autoComplete="username" className={inputCls} placeholder="NoReg / email@perusahaan.co.id" />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input name="pw" type={show ? "text" : "password"} autoComplete="current-password" className={`${inputCls} pr-12`} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute right-0 top-0 grid h-full w-11 place-items-center text-muted">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          {error && <p role="alert" className="text-sm font-medium text-brand-strong">{error}</p>}
          <Button variant="primary" type="submit" disabled={busy} className="w-full">{busy ? "Memuat..." : "Masuk"}</Button>
        </form>
      </div>
    </div>
  );
}
