"use client";
import { RotateCcw } from "lucide-react";

// Shown when the layout cannot read Supabase (missing env key, network, database down).
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-md rounded-lg border border-line bg-white p-6">
        <h1 className="text-lg font-bold">Data tidak bisa dimuat</h1>
        <p className="mt-2 text-sm text-muted">
          Aplikasi gagal terhubung ke database. Coba muat ulang. Kalau masih gagal, hubungi admin sistem.
        </p>
        {error.message && <p className="mt-3 rounded bg-soft px-3 py-2 font-mono text-xs text-muted">{error.message}</p>}
        <button onClick={reset} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-strong px-4 text-sm font-semibold text-white hover:bg-[#a80016]">
          <RotateCcw size={16} />Coba lagi
        </button>
      </div>
    </div>
  );
}
