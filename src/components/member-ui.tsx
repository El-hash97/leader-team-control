"use client";
/* Member portal UI (PRD v3 M12) · claymorphic bento, refs: web/stitch_field_skill_monitoring_dashboard/*.html
 * Lavender primary from the refs is swapped for Toyota red (brand tokens); amber/sky/pink accents kept.
 * Rules from the refs: 26px cards, no dark borders, floating dark pill dock, near-black text on pastel. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, CalendarDays, CircleUser, GraduationCap, House, MessageCircle, X, type LucideIcon } from "lucide-react";
import { cn } from "@/components/ui";
import { LtcMark } from "@/components/ltc-mark";
import { beginVisit } from "@/app/actions";

/** Page title for screen readers only: the top bar carries the brand, the dock shows where you are. */
export function MemberHeader({ title }: { title: string }) {
  return <h1 className="sr-only">{title}</h1>;
}

export type MemberNotice = { href: string; text: string };

/** Black top bar: LTC mark + "Mapping Skills", bell with unread dot, account shortcut. */
export function MemberTopBar({ notices }: { notices: MemberNotice[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  const icon = "relative grid size-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white";
  return (
    <header className="sticky top-0 z-40 bg-m-dock pt-[env(safe-area-inset-top)] text-white shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
      <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between gap-3 px-4">
        <Link href="/me" className="flex min-w-0 items-center gap-2.5" aria-label="Mapping Skills, ke Beranda">
          <LtcMark tone="dark" size={36} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[16px] font-bold tracking-tight">Mapping Skills</span>
            <span className="block truncate text-[11px] font-medium text-white/55">Finishing Line</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1" ref={box}>
          <div className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true"
              aria-label={notices.length ? `Notifikasi, ${notices.length} baru` : "Notifikasi"} className={icon}>
              <Bell size={22} aria-hidden />
              {notices.length > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-brand ring-2 ring-m-dock" />}
            </button>
            {open && (
              <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-[22px] bg-white text-m-text shadow-[0_16px_40px_rgba(18,19,26,0.28)]">
                <p className="border-b border-m-low px-4 py-3 text-[13px] font-bold">Notifikasi</p>
                {notices.length ? (
                  <ul className="divide-y divide-m-low">
                    {notices.map((n) => (
                      <li key={n.href + n.text}>
                        <Link href={n.href} onClick={() => setOpen(false)} className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-snug hover:bg-m-low">
                          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />{n.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-4 py-5 text-center text-[13px] text-m-sub">Tidak ada notifikasi baru.</p>}
              </div>
            )}
          </div>
          <Link href="/me/akun" aria-label="Akun" className={icon}><CircleUser size={24} aria-hidden /></Link>
        </div>
      </div>
    </header>
  );
}

type Tab = { href: "/me" | "/me/skill" | "/me/voice" | "/me/cuti" | "/me/akun"; label: string; icon: LucideIcon };
const TABS: Tab[] = [
  { href: "/me", label: "Beranda", icon: House },
  { href: "/me/skill", label: "Skill", icon: GraduationCap },
  { href: "/me/voice", label: "Voice", icon: MessageCircle },
  { href: "/me/cuti", label: "Cuti", icon: CalendarDays },
  { href: "/me/akun", label: "Akun", icon: CircleUser },
];

/** F-1503: records the visit once per tab session; the server keeps the previous visit as the "Baru" baseline. */
export function VisitTracker() {
  useEffect(() => { beginVisit().catch(() => {}); }, []);
  return null;
}

/** `voiceBadge`: leader replies the member has not opened yet (F-1305). */
export function Dock({ voiceBadge = 0 }: { voiceBadge?: number }) {
  const path = usePathname();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),16px)]">
      <nav aria-label="Menu member" className="pointer-events-auto flex h-16 w-full max-w-[360px] items-center rounded-full bg-m-dock px-1 shadow-[0_12px_32px_rgba(18,19,26,0.22)]">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          const badge = href === "/me/voice" && voiceBadge > 0 && !active ? voiceBadge : 0;
          return (
            <Link key={label} href={href} aria-current={active ? "page" : undefined}
              className={cn("relative flex h-12 flex-1 flex-col items-center justify-center rounded-full transition-colors", active ? "bg-white text-m-text" : "text-white/65 hover:text-white")}>
              <Icon size={20} aria-hidden /><span className="mt-0.5 text-[10px] leading-tight">{label}</span>
              {badge > 0 && (
                <span className="absolute right-2.5 top-1 grid min-w-4 place-items-center rounded-full bg-m-pink px-1 text-[9px] font-bold leading-4 text-m-text">
                  {badge}<span className="sr-only"> balasan baru</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Bottom sheet on a native <dialog> (focus trap + Esc for free). Ref: voice-me.html / pengajuan-cuti-me.html modals. */
export function Sheet({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-m-dock/55 sm:m-auto sm:max-w-md">
      {open && (
        <div className="mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 font-jakarta text-m-text sm:rounded-[32px]">
          <div aria-hidden className="mx-auto h-1.5 w-12 rounded-full bg-m-low" />
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">{title}</h2>
              {subtitle && <p className="text-[12px] text-m-sub">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-10 shrink-0 place-items-center rounded-full bg-m-low text-m-text"><X size={20} /></button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
