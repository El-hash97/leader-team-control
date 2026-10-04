"use client";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { LEVEL_TEXT } from "./plan-meta";

export const cn = (...c: (string | number | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const inputCls =
  "w-full min-h-11 sm:min-h-10 rounded-md border border-line bg-white px-3 text-[15px] sm:text-sm text-ink placeholder:text-muted/70 focus:border-brand-strong focus:outline-none disabled:bg-soft disabled:text-muted";

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ variant = "secondary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const v: Record<Variant, string> = {
    primary: "bg-brand-strong text-white hover:bg-[#a80016]",
    secondary: "bg-white text-ink border border-line hover:bg-soft",
    ghost: "text-ink hover:bg-soft",
    danger: "bg-white text-brand-strong border border-brand-strong/40 hover:bg-brand-soft",
  };
  return (
    <button
      {...p}
      className={cn(
        "inline-flex min-h-11 sm:min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed",
        v[variant],
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-lg border border-line bg-white", className)}>{children}</section>;
}

/** Module accents: wayfinding colour per area, always paired with an icon and label. */
export type Accent = "red" | "blue" | "green" | "amber" | "teal" | "violet" | "gray";
export const accentChip: Record<Accent, string> = {
  red: "bg-brand-soft text-brand-strong",
  blue: "bg-info-soft text-info",
  green: "bg-good-soft text-good",
  amber: "bg-warn-soft text-warn",
  teal: "bg-teal-soft text-teal",
  violet: "bg-violet-soft text-violet",
  gray: "bg-soft text-muted",
};

export function IconChip({ icon: Icon, accent = "gray", size = 32 }: { icon: LucideIcon; accent?: Accent; size?: number }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-md", accentChip[accent])} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.55)} strokeWidth={2} />
    </span>
  );
}

export function CardHeader({ title, desc, action, icon, accent }: { title: ReactNode; desc?: ReactNode; action?: ReactNode; icon?: LucideIcon; accent?: Accent }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <IconChip icon={icon} accent={accent} size={30} />}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {desc && <p className="mt-0.5 text-[13px] text-muted">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, desc, actions, icon, accent }: { title: string; desc?: ReactNode; actions?: ReactNode; icon?: LucideIcon; accent?: Accent }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <IconChip icon={icon} accent={accent} size={44} />}
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "brand";
const toneCls: Record<Tone, string> = {
  neutral: "bg-soft text-ink",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-brand-soft text-brand-strong",
  info: "bg-info-soft text-info",
  brand: "bg-brand-strong text-white",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold", toneCls[tone], className)}>{children}</span>;
}

export function Stat({ label, value, hint, tone, icon, accent = "gray" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "bad" | "warn" | "good"; icon?: LucideIcon; accent?: Accent }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2">
        {icon && <IconChip icon={icon} accent={accent} size={26} />}
        <div className="text-[13px] leading-tight text-muted">{label}</div>
      </div>
      <div className={cn("tabular mt-2 text-2xl font-bold leading-none", tone === "bad" && "text-brand-strong", tone === "warn" && "text-warn", tone === "good" && "text-good")}>{value}</div>
      {hint && <div className="mt-1.5 truncate text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** Toyota skill symbol: quarter-filled circle, 0..4 (PRD §8.2). */
export function SkillDot({ level, target, size = 22 }: { level: number; target?: number | null; size?: number }) {
  const c = size / 2, r = size / 2 - 3;
  const gap = target != null && target > level;
  const d =
    level === 1 ? `M${c} ${c}V${c - r}A${r} ${r} 0 0 1 ${c + r} ${c}Z`
    : level === 2 ? `M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}Z`
    : level === 3 ? `M${c} ${c}V${c - r}A${r} ${r} 0 1 1 ${c - r} ${c}Z`
    : "";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Level ${level} dari 4${gap ? `, target ${target}` : ""}`} className="shrink-0 overflow-visible">
      {gap && <circle cx={c} cy={c} r={r + 3.5} fill="none" stroke="var(--color-brand-strong)" strokeWidth="1.3" strokeDasharray="3 2" />}
      <circle cx={c} cy={c} r={r} fill={level === 4 ? "var(--color-brand)" : "#fff"} stroke="var(--color-ink)" strokeWidth="1.3" />
      {d && <path d={d} fill="var(--color-brand)" />}
      {level > 0 && level < 4 && <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-ink)" strokeWidth="1.3" />}
    </svg>
  );
}

export { LEVEL_TEXT };

export function SkillLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
      {LEVEL_TEXT.map((t, i) => (
        <span key={t} className="inline-flex items-center gap-1.5"><SkillDot level={i} size={16} />{i ? `${i}/4` : "0"} {t}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><SkillDot level={1} target={3} size={16} />Belum capai target</span>
    </div>
  );
}

export function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string | null; size?: number }) {
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  const initials = /^\d+$/.test(last) ? last.slice(-2) : words.map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-soft text-xs font-bold text-muted" style={{ width: size, height: size }}>{initials}</span>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
      {error ? <span role="alert" className="mt-1 block text-xs font-medium text-brand-strong">{error}</span>
        : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-xl bg-white p-0 text-ink sm:m-auto sm:rounded-xl",
        wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        "max-h-[92dvh]",
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Tutup" className="-mr-2 grid size-11 place-items-center rounded-md text-muted hover:bg-soft"><X size={20} /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Styled replacement for window.confirm(), on the shared Dialog. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}
      footer={<><Button onClick={onClose}>Kembali</Button><Button variant="danger" onClick={() => { onClose(); onConfirm(); }}>{confirmLabel}</Button></>}>
      <p className="text-sm">{message}</p>
    </Dialog>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-md border border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-10 whitespace-nowrap rounded px-3 text-sm font-medium", value === o.value ? "bg-ink text-white" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PerfValue({ p }: { p: number | null }) {
  if (p === null) return <span className="text-muted">-</span>;
  const tone = p >= 95 ? "text-good" : p >= 80 ? "text-warn" : "text-brand-strong";
  return <span className={cn("tabular font-semibold", tone)}>{p}%</span>;
}

/** % multi-skill per month with dashed target line. Last point may be the live month. */
export function TrendChart({ points, target, label }: { points: { label: string; value: number; live?: boolean }[]; target: number; label: string }) {
  const W = 420, H = 210, L = 38, R = 34, T = 18, B = 30;
  const x = (i: number) => L + (points.length === 1 ? 0 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v ? "#eee" : "#cfcfcf"} />
            <text x={L - 6} y={y(v)} fontSize="13" textAnchor="end" dominantBaseline="central" fill="var(--color-muted)">{v}%</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="var(--color-brand-strong)" strokeDasharray="5 4" />
        <text x={W - R} y={y(target) - 7} fontSize="13" textAnchor="end" fill="var(--color-brand-strong)" fontWeight="600">Target {target}%</text>
        <polyline fill="none" stroke="var(--color-ink)" strokeWidth="2" points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r="5" fill={p.live ? "var(--color-brand)" : "var(--color-ink)"} stroke="#fff" strokeWidth="2" />
            <text x={x(i)} y={y(p.value) - 11} fontSize="14" textAnchor="middle" fontWeight="600" fill="var(--color-ink)">{p.value}%</text>
            <text x={x(i)} y={H - 8} fontSize="13" textAnchor="middle" fill="var(--color-muted)">{p.label}{p.live ? "*" : ""}</text>
          </g>
        ))}
      </svg>
      {points.some((p) => p.live) && <p className="mt-1 text-xs text-muted">* bulan berjalan, dihitung dari skill map saat ini.</p>}
      <figcaption className="sr-only">{points.map((p) => `${p.label}: ${p.value}%`).join(", ")}. Target {target}%.</figcaption>
    </figure>
  );
}

/** Horizontal bar used in lists; value 0..100. */
export function Bar({ value, tone = "ink", fill }: { value: number; tone?: "ink" | "brand" | "good"; fill?: string }) {
  const bg = fill ?? (tone === "brand" ? "bg-brand" : tone === "good" ? "bg-good" : "bg-ink");
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
      <div className={cn("h-full rounded-full", bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
