import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { loadPortal, requireMember } from "@/lib/server/member";
import { one, q } from "@/lib/server/db";
import { Dock, MemberTopBar, VisitTracker, type MemberNotice } from "@/components/member-ui";
import { jakarta } from "@/components/member-style";

export const metadata: Metadata = { title: "Portal Member · Leader Team Control" };
export const viewport: Viewport = { themeColor: "#12131A" }; // matches the black top bar
// Cookie + live account check on every request (PRD v3 F-1105, F-1108).
export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: LayoutProps<"/me">) {
  const me = await requireMember();
  if (!me) redirect("/login");
  const portal = await loadPortal(me.id); // cached: pages reuse it
  const [replies, decided] = await Promise.all([
    one<{ n: number }>("select count(*)::int as n from voices where member_id = $1 and replied_at is not null and member_seen_at is null", [me.id]),
    portal.base
      ? q<{ status: string }>("select status from leave_requests where member_id = $1 and status in ('APPROVED', 'REJECTED') and decided_at > $2",
        [me.id, portal.base])
      : Promise.resolve([]),
  ]);

  // Bell: everything the leader did for this member that the member has not looked at yet.
  const voiceNew = replies?.n ?? 0;
  const approved = decided.filter((d) => d.status === "APPROVED").length;
  const rejected = decided.length - approved;
  const notices: MemberNotice[] = [
    voiceNew && { href: "/me/voice", text: `${voiceNew} balasan baru dari leader untuk voice kamu` },
    approved && { href: "/me/cuti", text: `${approved} pengajuan cuti disetujui` },
    rejected && { href: "/me/cuti", text: `${rejected} pengajuan cuti ditolak, lihat alasannya` },
    portal.newCount && { href: "/me/skill", text: `${portal.newCount} pembaruan skill, rencana, atau training` },
  ].filter((n): n is MemberNotice => !!n);

  return (
    <div className={`${jakarta.variable} m-root min-h-dvh bg-m-canvas font-jakarta text-m-text`}>
      <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.mTheme=localStorage.getItem("m-theme")==="dark"?"dark":"light"}catch{}` }} />
      <MemberTopBar notices={notices} />
      <main className="mx-auto w-full max-w-md px-5 pb-32 pt-5">{children}</main>
      <Dock voiceBadge={voiceNew} />
      <VisitTracker />
    </div>
  );
}
