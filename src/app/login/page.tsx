"use client";
/* Hallmark · page: login · genre: atmospheric · tone: luxury dark
 * theme: custom (vibe: "showroom night, ember red, ivory paper")
 * paper oklch(0.975 0.008 80) · night oklch(0.17 0.012 25) · accent Toyota red
 * type: Instrument Serif (display, roman) + Manrope (UI)
 * motion: mark draw-on (DrawSVG) · headline line reveal (SplitText) · field stagger · error shake
 */
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Instrument_Serif, Manrope } from "next/font/google";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { LtcMark, MARK_ARCS } from "@/components/ltc-mark";
import { AUTH_KEY } from "@/lib/store";
import { cn } from "@/components/ui";

gsap.registerPlugin(useGSAP, SplitText, DrawSVGPlugin);

const display = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const ui = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

// ponytail: client-side demo gate for the mock preview. Real auth = Better Auth (PRD F-101).
const DEMO_USER = "finishing";
const DEMO_PASS = "toyota@1";

const LADDER = ["Belum", "Paham teori", "Dibantu", "Mandiri", "Mengajar"];

function LadderDot({ level }: { level: number }) {
  const c = 12, r = 9;
  const d =
    level === 1 ? `M${c} ${c}V${c - r}A${r} ${r} 0 0 1 ${c + r} ${c}Z`
    : level === 2 ? `M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}Z`
    : level === 3 ? `M${c} ${c}V${c - r}A${r} ${r} 0 1 1 ${c - r} ${c}Z` : "";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <circle cx={c} cy={c} r={r} fill={level === 4 ? "var(--color-brand)" : "none"} stroke="var(--color-mist)" strokeOpacity="0.7" strokeWidth="1.3" />
      {d && <path d={d} fill="var(--color-brand)" />}
    </svg>
  );
}

function bigArc(r: number, sweep: number) {
  const a = ((-90 + sweep) * Math.PI) / 180;
  return `M 300 ${300 - r} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${(300 + r * Math.cos(a)).toFixed(1)} ${(300 + r * Math.sin(a)).toFixed(1)}`;
}

type Status = "idle" | "loading" | "error" | "success";

export default function LoginPage() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-arc]", { drawSVG: 0, duration: 1.1, stagger: 0.16, ease: "power2.inOut" })
        .from("[data-core]", { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2)" }, "-=0.5")
        .from("[data-fade]", { y: 18, autoAlpha: 0, duration: 0.8, stagger: 0.09 }, 0.35)
        .from("[data-step]", { y: 10, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, 0.9)
        .from("[data-field]", { y: 22, autoAlpha: 0, duration: 0.7, stagger: 0.07 }, 0.45);

      SplitText.create(title.current, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, stagger: 0.1, ease: "power4.out", delay: 0.2 }),
      });
    });
  }, { scope: root });

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // event-time handlers: elements come from the submitted form, not from refs read during render
  function fail(form: HTMLFormElement, msg: string) {
    setStatus("error");
    setError(msg);
    if (!reduced()) gsap.to(form, { keyframes: { x: [-10, 9, -6, 4, 0] }, duration: 0.45, ease: "power2.out" });
  }

  function succeed(form: HTMLFormElement) {
    setStatus("success");
    try { sessionStorage.setItem(AUTH_KEY, "1"); } catch {}
    const go = () => router.push("/dashboard");
    if (reduced()) return go();
    const parts = form.closest("[data-login]")?.querySelectorAll("[data-exit]") ?? [];
    gsap.to(parts, { autoAlpha: 0, y: -14, duration: 0.45, stagger: 0.05, ease: "power2.in", delay: 0.35 });
    // navigation must not depend on rAF (paused in background tabs); the exit tween is cosmetic
    setTimeout(go, 900);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const user = String(f.get("username") ?? "").trim();
    const pass = String(f.get("password") ?? "");
    if (!user || !pass) return fail(form, "Isi username dan password.");
    setStatus("loading");
    setError("");
    // short, honest pause so the state change is perceivable; no network call in preview mode
    setTimeout(() => (user.toLowerCase() === DEMO_USER && pass === DEMO_PASS ? succeed(form) : fail(form, "Username atau password salah.")), 450);
  }

  const busy = status === "loading" || status === "success";

  return (
    <div ref={root} data-login className={cn(display.variable, ui.variable, "min-h-dvh bg-ivory font-ui text-ink lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]")}>
      {/* ——— Night panel ——— */}
      <section className="relative isolate flex min-h-[52svh] flex-col justify-between gap-10 overflow-hidden bg-night px-6 py-7 text-ivory sm:px-10 lg:min-h-dvh lg:px-14 lg:py-12">
        <svg aria-hidden viewBox="0 0 600 600" className="pointer-events-none absolute -bottom-40 -right-40 -z-10 w-[640px] max-w-none sm:-bottom-52 sm:-right-44 lg:w-[760px]">
          {[140, 210, 280].map((r, i) => (
            <path key={r} data-arc d={bigArc(r, MARK_ARCS[i].sweep)} fill="none" stroke={i === 2 ? "var(--color-brand)" : "var(--color-night-line)"}
              strokeOpacity={i === 2 ? 0.55 : 1} strokeWidth={i === 2 ? 3 : 2} strokeLinecap="round" />
          ))}
        </svg>

        <div data-exit className="flex items-center gap-3">
          <LtcMark tone="dark" size={46} />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Leader Team Control</div>
            <div className="text-xs text-mist">Skill &amp; mapping peningkatan member</div>
          </div>
        </div>

        <div data-exit className="max-w-xl">
          <h1 ref={title} className="font-display text-[clamp(3.1rem,8.5vw,6.75rem)] font-normal leading-[0.94] tracking-[-0.02em] [overflow-wrap:anywhere]">
            Dari bisa, menjadi <span className="text-brand">mahir</span>.
          </h1>
          <p data-fade className="mt-5 max-w-md text-[15px] leading-relaxed text-mist">
            Skill map per proses, rencana peningkatan member, dan absensi harian grup Finishing Line dalam satu tempat.
          </p>

          <ol aria-label="Tingkat skill" className="mt-8 hidden grid-cols-5 gap-2 sm:grid lg:mt-10">
            {LADDER.map((t, i) => (
              <li key={t} data-step className="flex flex-col items-start gap-2 border-t border-night-line pt-3">
                <LadderDot level={i} />
                <span className="text-[12px] leading-tight text-mist"><b className="tabular font-semibold text-ivory">{i ? `${i}/4` : "0"}</b> {t}</span>
              </li>
            ))}
          </ol>
        </div>

        <p data-fade className="hidden text-xs text-mist lg:block">Akses khusus Leader (TL/GL). Akun dibuat oleh admin.</p>
      </section>

      {/* ——— Ivory panel ——— */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:py-16">
        <form onSubmit={submit} noValidate data-exit className="w-full max-w-[380px]">
          <div data-field>
            <h2 className="font-display text-[2.6rem] font-normal leading-none tracking-[-0.01em]">Masuk</h2>
            <p className="mt-3 text-sm text-muted">Gunakan akun leader grup Anda.</p>
          </div>

          <div className="mt-9 space-y-5">
            <label data-field className="block">
              <span className="mb-2 block text-[13px] font-semibold">Username</span>
              <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy}
                aria-invalid={status === "error"} onInput={() => status === "error" && setStatus("idle")}
                className="h-12 w-full rounded-md border border-ivory-line bg-white px-4 text-[15px] text-ink transition-colors duration-150 placeholder:text-muted/70 hover:border-muted/60 focus:border-night focus:outline-none disabled:opacity-60 aria-invalid:border-brand-strong" />
            </label>

            <label data-field className="block">
              <span className="mb-2 flex items-baseline justify-between text-[13px] font-semibold">
                Password
                {caps && <span className="text-xs font-medium text-warn" role="status">Caps Lock aktif</span>}
              </span>
              <span className="relative block">
                <input name="password" type={show ? "text" : "password"} autoComplete="current-password" disabled={busy}
                  aria-invalid={status === "error"} onInput={() => status === "error" && setStatus("idle")}
                  onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                  className="h-12 w-full rounded-md border border-ivory-line bg-white pl-4 pr-12 text-[15px] text-ink transition-colors duration-150 hover:border-muted/60 focus:border-night focus:outline-none disabled:opacity-60 aria-invalid:border-brand-strong" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={show}
                  className="absolute right-1 top-1 grid size-10 place-items-center rounded text-muted hover:text-ink">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
          </div>

          <p role="alert" className="mt-4 min-h-5 text-sm font-medium text-brand-strong">{status === "error" ? error : ""}</p>

          <div data-field>
            <button type="submit" disabled={busy}
              className={cn("group mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-ivory transition-colors duration-150 active:translate-y-px",
                status === "success" ? "bg-good" : "bg-night hover:bg-night-2", busy && "cursor-wait")}>
              {status === "loading" && <><LoaderCircle size={18} className="animate-spin" />Memeriksa…</>}
              {status === "success" && <><Check size={18} />Berhasil masuk</>}
              {(status === "idle" || status === "error") && <>Masuk<ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" /></>}
            </button>
            <p className="mt-8 text-xs text-muted">Lupa password? Hubungi admin sistem grup Anda.</p>
          </div>
        </form>
      </section>
    </div>
  );
}
