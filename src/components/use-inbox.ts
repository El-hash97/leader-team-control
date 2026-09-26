"use client";
// PRD v3 §5.6: counts behind the Voice/Cuti sidebar badges and dashboard cards. Re-fetched on every navigation
// and when a leader page announces a change, so the badge follows replies and decisions without a reload.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { inboxCounts } from "@/app/inbox-actions";

type Counts = Awaited<ReturnType<typeof inboxCounts>>;
const EVENT = "ltc:inbox";
export const announceInboxChange = () => window.dispatchEvent(new Event(EVENT));

export function useInbox(): Counts | null {
  const path = usePathname();
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => inboxCounts().then((c) => live && setCounts(c), () => {});
    load();
    window.addEventListener(EVENT, load);
    return () => { live = false; window.removeEventListener(EVENT, load); };
  }, [path]);
  return counts;
}
