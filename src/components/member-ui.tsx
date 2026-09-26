"use client";
/* Member portal UI (PRD v3 M12) · claymorphic bento, refs: web/stitch_field_skill_monitoring_dashboard/*.html
 * Lavender primary from the refs is swapped for Toyota red (brand tokens); amber/sky/pink accents kept.
 * Rules from the refs: 26px cards, no dark borders, floating dark pill dock, near-black text on pastel. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, CircleUser, GraduationCap, House, MessageCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/components/ui";

/** Page chrome: brand eyebrow + title. Sits under the safe area, not fixed, so nothing hides content. */
export function MemberHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between pb-4 pt-[max(env(safe-area-inset-top),16px)]">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-m-sub">
          <span className="size-2 rounded-full bg-brand" />TMMIN · Finishing Line
        </p>
        <h1 className="mt-0.5 text-base font-bold tracking-tight text-m-text">{title}</h1>
      </div>
      {right}
    </header>
  );
}

type Tab = { href: "/me" | "/me/skill" | "/me/akun" | null; label: string; icon: LucideIcon };
// Voice and Cuti arrive in PRD v3 phase 3; shown now so the dock does not reshuffle later.
const TABS: Tab[] = [
  { href: "/me", label: "Beranda", icon: House },
  { href: "/me/skill", label: "Skill", icon: GraduationCap },
  { href: null, label: "Voice", icon: MessageCircle },
  { href: null, label: "Cuti", icon: CalendarDays },
  { href: "/me/akun", label: "Akun", icon: CircleUser },
];

export function Dock() {
  const path = usePathname();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[max(env(safe-area-inset-bottom),16px)]">
      <nav aria-label="Menu member" className="pointer-events-auto flex h-16 w-full max-w-[360px] items-center rounded-full bg-m-dock px-1 shadow-[0_12px_32px_rgba(18,19,26,0.22)]">
        {TABS.map(({ href, label, icon: Icon }) => {
          const inner = (<><Icon size={20} aria-hidden /><span className="mt-0.5 text-[10px] leading-tight">{label}</span></>);
          const base = "flex h-12 flex-1 flex-col items-center justify-center rounded-full";
          if (!href) return <span key={label} aria-disabled title="Segera hadir" className={cn(base, "text-white/30")}>{inner}</span>;
          const active = path === href;
          return (
            <Link key={label} href={href} aria-current={active ? "page" : undefined}
              className={cn(base, "transition-colors", active ? "bg-white text-m-text" : "text-white/65 hover:text-white")}>{inner}</Link>
          );
        })}
      </nav>
    </div>
  );
}
