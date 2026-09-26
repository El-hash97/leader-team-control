"use server";
// PRD v3 M13 Voice + M14 Cuti. Member functions take the member id from the session only (requireMember);
// leader functions require the leader cookie (isAuthed). Every input is re-validated here.
import { db } from "@/lib/server/db";
import { isAuthed } from "@/lib/server/session";
import { requireMember } from "@/lib/server/member";
import {
  addDays, backupShortfall, leaveOverlaps, todayJakarta, voiceStatus, workdayList,
  type ISODate, type LevelMap, type VoiceStatus,
} from "@/lib/rules";
import { VOICE_CATEGORIES, type LeaveStatus, type VoiceCategory } from "@/components/voice-meta";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const EXPIRED = { ok: false as const, error: "Sesi habis. Silakan masuk lagi." };
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const one = <T,>(x: unknown) => (Array.isArray(x) ? x[0] : x) as T | null;

async function workCfg(from: ISODate, to: ISODate) {
  const c = db();
  const [s, h] = await Promise.all([
    c.from("settings").select("work_weekdays, default_min_backup").limit(1).maybeSingle(),
    c.from("holidays").select("date").gte("date", from).lte("date", to),
  ]);
  return {
    workWeekdays: (s.data?.work_weekdays as number[] | undefined) ?? [1, 2, 3, 4, 5],
    defaultMinBackup: (s.data?.default_min_backup as number | undefined) ?? 2,
    holidays: (h.data ?? []).map((r) => r.date as ISODate),
  };
}

/* ======================= member: Voice ======================= */

export type MemberVoice = {
  id: string; category: VoiceCategory; processName: string | null; body: string; photo: string | null;
  createdAt: string; status: VoiceStatus; reply: string | null; repliedAt: string | null; unseen: boolean;
};

export async function myVoices(): Promise<MemberVoice[]> {
  const me = await requireMember();
  if (!me) return [];
  const { data } = await db().from("voices")
    .select("id, category, body, photo_url, created_at, read_at, reply, replied_at, member_seen_at, processes(name)")
    .eq("member_id", me.id).order("created_at", { ascending: false }).limit(100);
  return (data ?? []).map((v) => ({
    id: v.id, category: v.category, body: v.body, photo: v.photo_url, createdAt: v.created_at,
    processName: one<{ name: string }>(v.processes)?.name ?? null,
    status: voiceStatus(v), reply: v.reply, repliedAt: v.replied_at, unseen: !!v.replied_at && !v.member_seen_at,
  }));
}

/** F-1301 */
export async function sendVoice(input: { category: string; processId: string | null; body: string; photo: string | null }): Promise<Result> {
  const me = await requireMember();
  if (!me) return EXPIRED;
  const category = input.category as VoiceCategory;
  if (!VOICE_CATEGORIES.includes(category)) return { ok: false, error: "Pilih kategori." };
  const body = input.body.trim();
  if (body.length < 10) return { ok: false, error: "Isi voice minimal 10 karakter." };
  if (body.length > 1000) return { ok: false, error: "Isi voice maksimal 1000 karakter." };
  let processId: string | null = null;
  if (category === "BELAJAR") {
    const { data } = await db().from("processes").select("id").eq("id", input.processId ?? "").eq("active", true).maybeSingle();
    if (!data) return { ok: false, error: "Pilih proses yang ingin dipelajari." };
    processId = data.id;
  }
  const photo = input.photo;
  if (photo && (!photo.startsWith("data:image/jpeg;base64,") || photo.length > 420_000)) return { ok: false, error: "Foto tidak valid atau terlalu besar." };
  const { error } = await db().from("voices").insert({ member_id: me.id, category, process_id: processId, body, photo_url: photo || null });
  return error ? { ok: false, error: "Gagal mengirim. Coba lagi." } : { ok: true };
}

/** F-1305: opening the Voice tab clears the unread-reply badge. */
export async function markRepliesSeen(): Promise<void> {
  const me = await requireMember();
  if (!me) return;
  await db().from("voices").update({ member_seen_at: new Date().toISOString() })
    .eq("member_id", me.id).not("replied_at", "is", null).is("member_seen_at", null);
}

/* ======================= member: Cuti ======================= */

export type LeaveRow = {
  id: string; memberId: string; memberName: string; noreg: string; photoUrl: string | null;
  attStatusId: string; typeName: string; start: ISODate; end: ISODate; workdays: number; reason: string;
  status: LeaveStatus; decisionNote: string | null; decidedAt: string | null; createdAt: string;
};

const LEAVE_COLS = "id, member_id, att_status_id, start_date, end_date, workdays, reason, status, decision_note, decided_at, created_at, members(name, noreg, photo_url), att_statuses(name)";
type LeaveDb = {
  id: string; member_id: string; att_status_id: string; start_date: ISODate; end_date: ISODate; workdays: number; reason: string;
  status: LeaveStatus; decision_note: string | null; decided_at: string | null; created_at: string; members: unknown; att_statuses: unknown;
};
const toLeave = (r: LeaveDb): LeaveRow => {
  const m = one<{ name: string; noreg: string; photo_url: string | null }>(r.members);
  return {
    id: r.id, memberId: r.member_id, memberName: m?.name ?? "-", noreg: m?.noreg ?? "", photoUrl: m?.photo_url ?? null,
    attStatusId: r.att_status_id, typeName: one<{ name: string }>(r.att_statuses)?.name ?? "Cuti", start: r.start_date, end: r.end_date,
    workdays: r.workdays, reason: r.reason, status: r.status, decisionNote: r.decision_note, decidedAt: r.decided_at, createdAt: r.created_at,
  };
};

/** Form data for the member: LEAVE-type statuses and the calendar needed to count working days in the browser. */
export async function leaveForm(): Promise<{ types: { id: string; name: string }[]; workWeekdays: number[]; holidays: ISODate[]; today: ISODate }> {
  const today = todayJakarta();
  const [types, cfg] = await Promise.all([
    db().from("att_statuses").select("id, name, sort").eq("category", "LEAVE").order("sort"),
    workCfg(today, addDays(today, 400)),
  ]);
  return { types: (types.data ?? []).map((t) => ({ id: t.id, name: t.name })), workWeekdays: cfg.workWeekdays, holidays: cfg.holidays, today };
}

export async function myLeaves(): Promise<LeaveRow[]> {
  const me = await requireMember();
  if (!me) return [];
  const { data } = await db().from("leave_requests").select(LEAVE_COLS).eq("member_id", me.id).order("start_date", { ascending: false }).limit(100);
  return ((data ?? []) as LeaveDb[]).map(toLeave);
}

/** F-1401 */
export async function requestLeave(input: { attStatusId: string; start: string; end: string; reason: string }): Promise<Result> {
  const me = await requireMember();
  if (!me) return EXPIRED;
  const { start, end } = input;
  const reason = input.reason.trim();
  if (!isDate(start) || !isDate(end)) return { ok: false, error: "Tanggal tidak valid." };
  if (end < start) return { ok: false, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  if (start < todayJakarta()) return { ok: false, error: "Tanggal mulai tidak boleh sebelum hari ini." };
  if (end > addDays(start, 90)) return { ok: false, error: "Satu pengajuan maksimal 90 hari kalender." };
  if (reason.length < 5 || reason.length > 500) return { ok: false, error: "Alasan wajib diisi, 5–500 karakter." };
  const c = db();
  const { data: type } = await c.from("att_statuses").select("id").eq("id", input.attStatusId).eq("category", "LEAVE").maybeSingle();
  if (!type) return { ok: false, error: "Pilih jenis cuti." };
  const cfg = await workCfg(start, end);
  const workdays = workdayList(start, end, cfg.workWeekdays, cfg.holidays).length;
  if (!workdays) return { ok: false, error: "Rentang tanggal itu tidak berisi hari kerja." };
  const { data: mine } = await c.from("leave_requests").select("start_date, end_date").eq("member_id", me.id).in("status", ["PENDING", "APPROVED"]);
  if ((mine ?? []).some((r) => leaveOverlaps({ start, end }, { start: r.start_date, end: r.end_date })))
    return { ok: false, error: "Tanggal ini bertumpuk dengan pengajuan cuti kamu yang lain." };
  const { error } = await c.from("leave_requests").insert({ member_id: me.id, att_status_id: type.id, start_date: start, end_date: end, workdays, reason });
  return error ? { ok: false, error: "Gagal mengirim. Coba lagi." } : { ok: true };
}

/** F-1402: only while still pending. */
export async function cancelMyLeave(id: string): Promise<Result> {
  const me = await requireMember();
  if (!me) return EXPIRED;
  const { data } = await db().from("leave_requests").update({ status: "CANCELLED" })
    .eq("id", id).eq("member_id", me.id).eq("status", "PENDING").select("id");
  return data?.length ? { ok: true } : { ok: false, error: "Pengajuan sudah diputuskan, tidak bisa dibatalkan." };
}

/* ======================= leader ======================= */

export async function inboxCounts(): Promise<{ voiceNew: number; voiceOpen: number; leavePending: number }> {
  if (!(await isAuthed())) return { voiceNew: 0, voiceOpen: 0, leavePending: 0 };
  const c = db();
  const [a, b, l] = await Promise.all([
    c.from("voices").select("id", { count: "exact", head: true }).is("read_at", null),
    c.from("voices").select("id", { count: "exact", head: true }).is("replied_at", null),
    c.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);
  return { voiceNew: a.count ?? 0, voiceOpen: b.count ?? 0, leavePending: l.count ?? 0 };
}

export type LeaderVoice = {
  id: string; memberId: string; memberName: string; noreg: string; photoUrl: string | null;
  category: VoiceCategory; processName: string | null; body: string; hasPhoto: boolean;
  createdAt: string; readAt: string | null; reply: string | null; repliedAt: string | null; status: VoiceStatus;
};

/** F-1303: unanswered K3 first, then unanswered, then answered; newest first inside each group. Photos load on open. */
export async function listVoices(): Promise<LeaderVoice[]> {
  if (!(await isAuthed())) return [];
  const { data } = await db().from("voices")
    .select("id, member_id, category, body, has_photo, created_at, read_at, reply, replied_at, members(name, noreg, photo_url), processes(name)")
    .order("created_at", { ascending: false }).limit(500);
  const rank = (v: LeaderVoice) => (v.status === "REPLIED" ? 2 : v.category === "K3" ? 0 : 1);
  return (data ?? []).map((v): LeaderVoice => {
    const m = one<{ name: string; noreg: string; photo_url: string | null }>(v.members);
    return {
      id: v.id, memberId: v.member_id, memberName: m?.name ?? "-", noreg: m?.noreg ?? "", photoUrl: m?.photo_url ?? null,
      category: v.category, processName: one<{ name: string }>(v.processes)?.name ?? null, body: v.body,
      hasPhoto: !!v.has_photo, createdAt: v.created_at, readAt: v.read_at, reply: v.reply, repliedAt: v.replied_at, status: voiceStatus(v),
    };
  }).sort((a, b) => rank(a) - rank(b));
}

/** F-1304: opening marks it read once and returns the attached photo. */
export async function openVoice(id: string): Promise<Result<{ photo: string | null }>> {
  if (!(await isAuthed())) return EXPIRED;
  const c = db();
  await c.from("voices").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  const { data } = await c.from("voices").select("photo_url").eq("id", id).maybeSingle();
  return data ? { ok: true, photo: data.photo_url } : { ok: false, error: "Voice tidak ditemukan." };
}

/** F-1304: exactly one reply; a second attempt is refused by the `replied_at is null` guard. */
export async function replyVoice(id: string, reply: string): Promise<Result> {
  if (!(await isAuthed())) return EXPIRED;
  const text = reply.trim();
  if (!text || text.length > 1000) return { ok: false, error: "Balasan wajib diisi, maksimal 1000 karakter." };
  const now = new Date().toISOString();
  const { data } = await db().from("voices").update({ reply: text, replied_at: now })
    .eq("id", id).is("replied_at", null).select("read_at");
  if (!data?.length) return { ok: false, error: "Voice ini sudah dibalas." };
  if (!data[0].read_at) await db().from("voices").update({ read_at: now }).eq("id", id);
  return { ok: true };
}

export async function listLeaves(): Promise<LeaveRow[]> {
  if (!(await isAuthed())) return [];
  const { data } = await db().from("leave_requests").select(LEAVE_COLS).order("start_date", { ascending: false }).limit(1000);
  return ((data ?? []) as LeaveDb[]).map(toLeave);
}

export type LeaveDay = { date: ISODate; others: string[]; short: { name: string; count: number; min: number }[] };

/** F-1404: per working day, who else is off (approved or pending) and which processes lose their minimum backup. */
export async function leaveCheck(id: string): Promise<Result<{ days: LeaveDay[] }>> {
  if (!(await isAuthed())) return EXPIRED;
  const c = db();
  const { data: req } = await c.from("leave_requests").select("member_id, start_date, end_date").eq("id", id).maybeSingle();
  if (!req) return { ok: false, error: "Pengajuan tidak ditemukan." };
  const [cfg, others, procs, levels, active] = await Promise.all([
    workCfg(req.start_date, req.end_date),
    c.from("leave_requests").select("member_id, start_date, end_date, members(name)").neq("id", id).in("status", ["PENDING", "APPROVED"])
      .lte("start_date", req.end_date).gte("end_date", req.start_date),
    c.from("processes").select("id, name, min_backup").eq("active", true).order("sort"),
    c.from("skill_levels").select("member_id, process_id, level"),
    c.from("members").select("id").eq("active", true),
  ]);
  const activeIds = new Set((active.data ?? []).map((m) => m.id));
  const byMember: Record<string, LevelMap> = {};
  for (const l of levels.data ?? []) if (activeIds.has(l.member_id)) (byMember[l.member_id] ??= {})[l.process_id] = l.level;
  const processes = (procs.data ?? []).map((p) => ({ id: p.id, name: p.name, minBackup: p.min_backup ?? cfg.defaultMinBackup }));
  const days = workdayList(req.start_date, req.end_date, cfg.workWeekdays, cfg.holidays).map((date): LeaveDay => {
    const off = (others.data ?? []).filter((o) => o.start_date <= date && date <= o.end_date);
    return {
      date,
      others: off.map((o) => one<{ name: string }>(o.members)?.name ?? "-"),
      short: backupShortfall(req.member_id, byMember, new Set(off.map((o) => o.member_id)), processes).map(({ name, count, min }) => ({ name, count, min })),
    };
  });
  return { ok: true, days };
}

/** F-1405 + F-1406: approve fills attendance for every working day, tagged with the request id. Reject needs a reason. */
export async function decideLeave(id: string, approve: boolean, note: string): Promise<Result> {
  if (!(await isAuthed())) return EXPIRED;
  const text = note.trim();
  if (!approve && !text) return { ok: false, error: "Alasan penolakan wajib diisi." };
  if (text.length > 500) return { ok: false, error: "Catatan maksimal 500 karakter." };
  const c = db();
  // The status guard makes a double click or a second leader tab a no-op instead of a double decision.
  const { data } = await c.from("leave_requests")
    .update({ status: approve ? "APPROVED" : "REJECTED", decision_note: text || null, decided_at: new Date().toISOString() })
    .eq("id", id).eq("status", "PENDING").select("member_id, att_status_id, start_date, end_date");
  const req = data?.[0];
  if (!req) return { ok: false, error: "Pengajuan ini sudah diputuskan atau dibatalkan." };
  if (!approve) return { ok: true };
  const cfg = await workCfg(req.start_date, req.end_date);
  const rows = workdayList(req.start_date, req.end_date, cfg.workWeekdays, cfg.holidays)
    .map((date) => ({ member_id: req.member_id, date, status_id: req.att_status_id, note: "", leave_request_id: id }));
  const { error } = rows.length ? await c.from("attendance").upsert(rows) : { error: null };
  if (error) {
    await c.from("leave_requests").update({ status: "PENDING", decision_note: null, decided_at: null }).eq("id", id);
    return { ok: false, error: `Gagal mengisi absensi: ${error.message}` };
  }
  return { ok: true };
}

/** F-1407: cancel an approved leave; only attendance rows still tagged with it are removed. */
export async function cancelApprovedLeave(id: string, note: string): Promise<Result> {
  if (!(await isAuthed())) return EXPIRED;
  const c = db();
  const { data } = await c.from("leave_requests")
    .update({ status: "CANCELLED", decision_note: note.trim() || null, decided_at: new Date().toISOString() })
    .eq("id", id).eq("status", "APPROVED").select("id");
  if (!data?.length) return { ok: false, error: "Hanya cuti yang sudah disetujui yang bisa dibatalkan di sini." };
  const { error } = await c.from("attendance").delete().eq("leave_request_id", id);
  return error ? { ok: false, error: `Status dibatalkan, tapi absensi gagal dihapus: ${error.message}` } : { ok: true };
}
