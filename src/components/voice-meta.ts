// Labels shared by member and leader views (PRD v3 D5–D7). Plain module so server and client pages can both read it.
import type { VoiceStatus } from "@/lib/rules";

export type VoiceCategory = "SARAN" | "KELUHAN" | "PERTANYAAN" | "K3" | "BELAJAR" | "LAINNYA";
export const VOICE_CATEGORY: Record<VoiceCategory, { label: string; chip: string }> = {
  SARAN: { label: "Saran perbaikan", chip: "bg-m-amber text-m-text" },
  KELUHAN: { label: "Keluhan", chip: "bg-m-low text-m-text" },
  PERTANYAAN: { label: "Pertanyaan", chip: "bg-m-sky-soft text-[#1d4a8c]" },
  K3: { label: "K3 / Safety", chip: "bg-m-pink text-m-text" },
  BELAJAR: { label: "Ingin belajar proses", chip: "bg-m-sky text-m-text" },
  LAINNYA: { label: "Lainnya", chip: "bg-m-low text-m-sub" },
};
export const VOICE_CATEGORIES = Object.keys(VOICE_CATEGORY) as VoiceCategory[];

export const VOICE_STATUS: Record<VoiceStatus, { label: string; tone: "neutral" | "info" | "good" }> = {
  SENT: { label: "Terkirim", tone: "neutral" },
  READ: { label: "Dibaca", tone: "info" },
  REPLIED: { label: "Dibalas", tone: "good" },
};

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: "warn" | "good" | "bad" | "neutral"; chip: string }> = {
  PENDING: { label: "Menunggu", tone: "warn", chip: "bg-m-amber-soft text-[#7a4a00]" },
  APPROVED: { label: "Disetujui", tone: "good", chip: "bg-[#dcf5ea] text-[#0b6b47]" },
  REJECTED: { label: "Ditolak", tone: "bad", chip: "bg-m-red-fixed text-brand-strong" },
  CANCELLED: { label: "Dibatalkan", tone: "neutral", chip: "bg-m-low text-m-sub" },
};
