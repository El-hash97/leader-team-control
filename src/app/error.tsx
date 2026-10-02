"use client";
import { useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";

// Shown when a server render fails (Supabase unreachable after its own retries, missing env, …).
// retry() re-fetches the server components; reset() alone would only re-render the stale error.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-md rounded-lg border border-line bg-white p-6">
        <h1 className="text-lg font-bold">Data tidak bisa dimuat</h1>
        <p className="mt-2 text-sm text-muted">
          Koneksi ke database sedang terganggu. Tekan Coba lagi. Kalau masih gagal, kirim kode di bawah ke admin sistem.
        </p>
        {/* production hides server messages; the digest matches the server log line */}
        {(error.digest || error.message) && (
          <p className="mt-3 rounded bg-soft px-3 py-2 font-mono text-xs text-muted">{error.digest ? `Kode: ${error.digest}` : error.message}</p>
        )}
        <button onClick={() => { setBusy(true); retry(); setTimeout(() => setBusy(false), 4000); }} disabled={busy}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-strong px-4 text-sm font-semibold text-white hover:bg-[#a80016] disabled:opacity-60">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />}Coba lagi
        </button>
      </div>
    </div>
  );
}
