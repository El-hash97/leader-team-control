import { redirect } from "next/navigation";
import { loadPortal, requireMember } from "@/lib/server/member";
import { myVoices } from "@/app/inbox-actions";
import { MemberHeader } from "@/components/member-ui";
import { VoiceView } from "./voice-view";

// M13 member side (F-1301, F-1302, F-1305). Ref: voice-me.html.
export default async function MemberVoicePage() {
  const me = await requireMember();
  if (!me) redirect("/login");
  const [voices, portal] = await Promise.all([myVoices(), loadPortal(me.id)]);
  return (
    <>
      <MemberHeader title="Voice" />
      <VoiceView voices={voices} processes={portal.processes.map(({ id, name }) => ({ id, name }))} />
    </>
  );
}
