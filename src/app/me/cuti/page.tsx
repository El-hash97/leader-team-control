import { redirect } from "next/navigation";
import { requireMember } from "@/lib/server/member";
import { leaveForm, myLeaves } from "@/app/inbox-actions";
import { MemberHeader } from "@/components/member-ui";
import { CutiView } from "./cuti-view";

// M14 member side (F-1401, F-1402). Ref: pengajuan-cuti-me.html. No quota shown (PRD v3 D7).
export default async function MemberLeavePage() {
  if (!(await requireMember())) redirect("/login");
  const [form, leaves] = await Promise.all([leaveForm(), myLeaves()]);
  return (
    <>
      <MemberHeader title="Cuti" />
      <CutiView form={form} leaves={leaves} />
    </>
  );
}
