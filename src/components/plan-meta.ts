import type { PlanStatus } from "@/lib/rules";
import type { PlanMethod } from "@/lib/mock";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export const PLAN_STATUS: Record<PlanStatus | "OVERDUE", { label: string; tone: Tone; bar: string }> = {
  PLANNED: { label: "Direncanakan", tone: "neutral", bar: "bg-[#d9dadd] text-ink" },
  IN_PROGRESS: { label: "Berjalan", tone: "info", bar: "bg-info text-white" },
  EVALUATION: { label: "Evaluasi", tone: "warn", bar: "bg-[#b07a00] text-white" },
  ACHIEVED: { label: "Tercapai", tone: "good", bar: "bg-good text-white" },
  CANCELLED: { label: "Dibatalkan", tone: "neutral", bar: "bg-soft text-muted" },
  OVERDUE: { label: "Terlambat", tone: "bad", bar: "bg-brand-strong text-white" },
};

export const PLAN_METHOD: Record<PlanMethod, string> = {
  OJT: "OJT",
  TJI: "TJI",
  CLASS: "Training kelas",
  MENTORING: "Pendampingan senior",
  OTHER: "Lainnya",
};
