// Leader Team Control mark: three nested arcs growing 1/4 → 2/4 → 3/4, the same
// quarter language as the Toyota skill symbol, closing on a solid centre (4/4 = mastery).
type Tone = "dark" | "light";

const C = 24;
function arc(r: number, sweep: number) {
  const a = ((-90 + sweep) * Math.PI) / 180;
  const x = +(C + r * Math.cos(a)).toFixed(2);
  const y = +(C + r * Math.sin(a)).toFixed(2);
  return `M ${C} ${C - r} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x} ${y}`;
}

export const MARK_ARCS = [
  { r: 8, sweep: 90 },
  { r: 14, sweep: 180 },
  { r: 20, sweep: 270 },
];

/** `tone` = the surface the mark sits on. */
export function LtcMark({ size = 40, tone = "light", className }: { size?: number; tone?: Tone; className?: string }) {
  const quiet = tone === "dark" ? "var(--color-mist)" : "var(--color-ink)";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} role="img" aria-label="Leader Team Control">
      {MARK_ARCS.map(({ r, sweep }, i) => (
        <path key={r} data-arc d={arc(r, sweep)} stroke={i === 2 ? "var(--color-brand)" : quiet} strokeWidth={i === 2 ? 3.4 : 2.4} strokeLinecap="round"
          opacity={i === 2 ? 1 : 0.55 + i * 0.2} />
      ))}
      <circle data-core cx={C} cy={C} r={2.6} fill="var(--color-brand)" />
    </svg>
  );
}
