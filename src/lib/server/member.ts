import "server-only";
import { cache } from "react";
import { db } from "./db";
import { readMemberSession } from "./session";

export type MemberProfile = {
  id: string; name: string; noreg: string; photoUrl: string | null;
  position: string; status: string; kelas: string | null; joinDate: string; contractEnd: string | null;
};

// PRD v3 §8: the single gate for every member page and action. memberId comes from the signed cookie only,
// and the account must still be active with the same session_version. Columns are explicit: never `notes`.
// cache(): layout + page share one lookup per request.
export const requireMember = cache(async (): Promise<MemberProfile | null> => {
  const s = await readMemberSession();
  if (!s) return null;
  const client = db();
  const { data: acc } = await client.from("member_accounts").select("session_version").eq("member_id", s.memberId).maybeSingle();
  if (!acc || acc.session_version !== s.sessionVersion) return null;
  const { data: m } = await client
    .from("members")
    .select("id, name, noreg, photo_url, kelas, join_date, contract_end, active, position_id, status_id")
    .eq("id", s.memberId)
    .maybeSingle();
  if (!m || !m.active) return null;
  const [pos, emp] = await Promise.all([
    client.from("positions").select("name").eq("id", m.position_id).maybeSingle(),
    client.from("emp_statuses").select("name").eq("id", m.status_id).maybeSingle(),
  ]);
  return {
    id: m.id, name: m.name, noreg: m.noreg, photoUrl: m.photo_url, kelas: m.kelas, joinDate: m.join_date, contractEnd: m.contract_end,
    position: pos.data?.name ?? "", status: emp.data?.name ?? "",
  };
});
