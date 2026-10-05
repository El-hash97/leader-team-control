// Shared by server and client member pages (a "use client" module cannot export plain values to server components).
import { Plus_Jakarta_Sans } from "next/font/google";

export const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plus-jakarta", display: "swap" });

export const mCard = "rounded-[26px] bg-m-surface shadow-[0_8px_24px_-4px_rgba(18,19,26,0.05)]";
export const mInput =
  "h-12 w-full rounded-2xl bg-m-low px-4 text-[15px] text-m-text placeholder:text-m-sub/70 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60";
export const mButtonDark =
  "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-m-dock text-[15px] font-semibold text-white shadow-[0_4px_16px_rgba(18,19,26,0.15)] transition active:scale-[0.98] disabled:opacity-60";
