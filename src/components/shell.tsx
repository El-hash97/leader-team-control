"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  LayoutDashboard, Users, Grid3x3, TrendingUp, GraduationCap, CalendarCheck, ChartColumn, Settings,
  Bell, Ellipsis, LogOut, RotateCcw, X, type LucideIcon,
} from "lucide-react";
import { AUTH_KEY, useStore } from "@/lib/store";
import { LtcMark } from "./ltc-mark";
import { dueLabel } from "@/lib/rules";
import { accentChip, cn, type Accent } from "./ui";

/** Every module keeps one accent across sidebar, page header and cards. */
export const NAV: { href: string; label: string; icon: LucideIcon; accent: Accent }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, accent: "red" },
  { href: "/members", label: "Data Member", icon: Users, accent: "blue" },
  { href: "/skill-map", label: "Skill Map", icon: Grid3x3, accent: "violet" },
  { href: "/plans", label: "Mapping Peningkatan", icon: TrendingUp, accent: "green" },
  { href: "/trainings", label: "Training", icon: GraduationCap, accent: "amber" },
  { href: "/attendance", label: "Absensi", icon: CalendarCheck, accent: "teal" },
  { href: "/reports", label: "Laporan", icon: ChartColumn, accent: "blue" },
  { href: "/settings", label: "Pengaturan", icon: Settings, accent: "gray" },
];
const BOTTOM = ["/dashboard", "/attendance", "/skill-map"];

function Notifications() {
  const { alerts } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const kindLabel = { contract: "Kontrak", sio: "Sertifikat", plan: "Rencana", attendance: "Absensi" } as const;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifikasi, ${alerts.length} perlu tindakan`}
        className="relative grid size-11 place-items-center rounded-md text-white hover:bg-white/15">
        <Bell size={21} />
        {alerts.length > 0 && (
          <span className="tabular absolute right-0.5 top-0.5 min-w-5 rounded-full bg-white px-1 text-center text-[11px] font-bold leading-5 text-brand-strong">{alerts.length}</span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[70dvh] overflow-y-auto rounded-lg border border-line bg-white text-ink shadow-[0_12px_32px_-8px_rgb(0_0_0/0.25)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="sticky top-0 border-b border-line bg-white px-4 py-3 text-sm font-semibold">Perlu tindakan ({alerts.length})</div>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Tidak ada kontrak, sertifikat, atau rencana yang perlu follow up.</p>
          ) : (
            <ul className="zebra-list">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} onClick={() => setOpen(false)} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-rowhover">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-muted">{kindLabel[a.kind]}</span>
                      <span className="block truncate text-sm font-medium">{a.title}</span>
                      <span className="block text-xs text-muted">{a.detail}</span>
                    </span>
                    {a.days !== undefined && (
                      <span className={cn("tabular shrink-0 text-xs font-semibold", a.days < 0 ? "text-brand-strong" : "text-warn")}>{dueLabel(a.days)}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// sessionStorage never changes while a page is open, so there is nothing to subscribe to
const noSubscribe = () => () => {};
const readAuth = () => { try { return sessionStorage.getItem(AUTH_KEY) === "1"; } catch { return false; } };
const logout = () => { try { sessionStorage.removeItem(AUTH_KEY); } catch {} };

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  // null on the server, then the real value in the browser
  const authed = useSyncExternalStore(noSubscribe, readAuth, () => null);
  useEffect(() => { if (authed === false) router.replace("/login"); }, [authed, router]);
  const { toasts, resetDemo, toast } = useStore();
  const [more, setMore] = useState(false);
  const active = (href: string) => path === href || path.startsWith(`${href}/`);

  // not signed in (or not known yet): show nothing until the redirect to /login happens
  if (authed !== true) return <div className="min-h-dvh bg-canvas" aria-busy="true" />;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:px-3 focus:py-2">Lewati ke konten</a>

      {/* Desktop sidebar: own white top bar with the logo */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-white lg:flex">
        <Link href="/dashboard" className="flex h-[5.5rem] shrink-0 items-center border-b border-line px-6" aria-label="Leader Team Control, ke Dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/toyota-logo.png" alt="Toyota" width={640} height={120} className="h-[26px] w-auto" />
        </Link>
        <nav aria-label="Menu utama" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map(({ href, label, icon: Icon, accent }) => {
            const on = active(href);
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-md px-2 text-sm font-medium transition-colors",
                  on ? "bg-brand-soft font-semibold text-brand-strong" : "text-ink hover:bg-soft")}>
                <span className={cn("grid size-8 place-items-center rounded-md", on ? "bg-brand-strong text-white" : accentChip[accent])}>
                  <Icon size={17} strokeWidth={2} />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <button onClick={() => { resetDemo(); toast("Data contoh dikembalikan ke awal."); }} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-soft">
            <RotateCcw size={16} />Reset data contoh
          </button>
          <Link href="/login" onClick={logout} className="flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-soft"><LogOut size={16} />Keluar</Link>
        </div>
      </aside>

      <div className="min-w-0">
      <header className="sticky top-0 z-40 bg-brand-strong text-white shadow-[0_2px_10px_-2px_rgb(120_0_16/0.45)]">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-white lg:hidden"><LtcMark size={30} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-bold leading-tight sm:text-lg">Leader Team Control</span>
              <span className="block truncate text-xs text-[#ffe1e5]">Skill &amp; mapping peningkatan member</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Notifications />
            <div className="ml-1 hidden items-center gap-2 py-1 pl-1 pr-1 sm:flex">
              <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-bold text-brand-strong">L</span>
              <span className="text-sm leading-tight"><b className="block">Leader</b><span className="text-xs text-[#ffe1e5]">TL / GL</span></span>
            </div>
          </div>
        </div>
        <div className="bg-[#9e0015] px-4 py-1 text-center text-[11px] font-medium text-[#ffe1e5] sm:text-xs">
          Pratinjau UI: semua nama, angka, dan proses adalah data contoh.
        </div>
      </header>

      <main id="main" className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-4">
          {NAV.filter((n) => BOTTOM.includes(n.href)).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
              className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active(href) ? "text-brand-strong" : "text-muted")}>
              <span className={cn("grid h-7 w-12 place-items-center rounded-full", active(href) && "bg-brand-soft")}><Icon size={20} strokeWidth={active(href) ? 2.3 : 1.8} /></span>
              {label}
            </Link>
          ))}
          <button onClick={() => setMore(true)} aria-expanded={more}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              NAV.some((n) => !BOTTOM.includes(n.href) && active(n.href)) ? "text-brand-strong" : "text-muted")}>
            <span className="grid h-7 w-12 place-items-center"><Ellipsis size={20} /></span>Lainnya
          </button>
        </div>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu lainnya">
          <button aria-label="Tutup menu" className="absolute inset-0 bg-black/45" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/toyota-logo.png" alt="Toyota" width={640} height={120} className="h-5 w-auto" />
              <button onClick={() => setMore(false)} aria-label="Tutup" className="grid size-11 place-items-center text-muted"><X size={20} /></button>
            </div>
            <nav className="grid grid-cols-1 p-2">
              {NAV.filter((n) => !BOTTOM.includes(n.href)).map(({ href, label, icon: Icon, accent }) => (
                <Link key={href} href={href} onClick={() => setMore(false)} className={cn("flex min-h-12 items-center gap-3 rounded-md px-2 text-[15px] font-medium", active(href) ? "bg-brand-soft text-brand-strong" : "hover:bg-soft")}>
                  <span className={cn("grid size-9 place-items-center rounded-md", accentChip[accent])}><Icon size={19} /></span>{label}
                </Link>
              ))}
              <div className="my-2 border-t border-line" />
              <button onClick={() => { resetDemo(); toast("Data contoh dikembalikan ke awal."); setMore(false); }} className="flex min-h-12 items-center gap-3 rounded-md px-3 text-[15px] text-muted hover:bg-soft"><RotateCcw size={18} />Reset data contoh</button>
              <Link href="/login" onClick={() => { logout(); setMore(false); }} className="flex min-h-12 items-center gap-3 rounded-md px-3 text-[15px] text-muted hover:bg-soft"><LogOut size={18} />Keluar</Link>
            </nav>
          </div>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-md bg-ink px-4 py-2.5 text-sm text-white shadow-[0_8px_24px_-6px_rgb(0_0_0/0.35)]">{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
