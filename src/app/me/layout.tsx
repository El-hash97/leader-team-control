import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/server/member";
import { db } from "@/lib/server/db";
import { Dock } from "@/components/member-ui";
import { jakarta } from "@/components/member-style";

export const metadata: Metadata = { title: "Portal Member · Leader Team Control" };
// Cookie + live account check on every request (PRD v3 F-1105, F-1108).
export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: LayoutProps<"/me">) {
  const me = await requireMember();
  if (!me) redirect("/login");
  const { count } = await db().from("voices").select("id", { count: "exact", head: true })
    .eq("member_id", me.id).not("replied_at", "is", null).is("member_seen_at", null);
  return (
    <div className={`${jakarta.variable} min-h-dvh bg-m-canvas font-jakarta text-m-text`}>
      <main className="mx-auto w-full max-w-md px-5 pb-32">{children}</main>
      <Dock voiceBadge={count ?? 0} />
    </div>
  );
}
