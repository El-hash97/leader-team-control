"use server";
// PRD v3 M13 Voice + M14 Cuti. Member functions take the member id from the session only (requireMember);
// leader functions require the leader cookie (isAuthed). Every input is re-validated here.
import { one, q } from "@/lib/server/db";
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
async function workCfg(from: ISODate, to: ISODate) {
  const [s, h] = await Promise.all([
    one<{ work_weekdays: number[]; default_min_backup: number }>("select work_weekdays, default_min_backup from settings limit 1"),
    q<{ date: ISODate }>("select date from holidays where date between $1 and $2", [from, to]),
  ]);
  return {
    workWeekdays: s?.work_weekdays ?? [1, 2, 3, 4, 5],
    defaultMinBackup: s?.default_min_backup ?? 2,
    holidays: h.map((r) => r.date),
  };
}

type VoiceDb = {
  id: string; member_id: string; category: VoiceCategory; process_id: string | null; process_name: string | null; body: string;
  photo_url: string | null; has_photo: boolean | null; created_at: string; read_at: string | null; reply: string | null;
  replied_at: string | null; member_seen_at: string | null; member_name: string | null; noreg: string | null; member_photo: string | null;
};

/* ======================= member: Voice ======================= */

export type MemberVoice = {
  id: string; category: VoiceCategory; processName: string | null; body: string; photo: string | null;
  createdAt: string; status: VoiceStatus; reply: string | null; repliedAt: string | null; unseen: boolean;
};

export async function myVoices(): Promise<MemberVoice[]> {
  const me = await requireMember();
  if (!me) return [];
  const data = await q<VoiceDb>(`select v.id, v.category, v.body, v.photo_url, v.created_at, v.read_at, v.reply, v.replied_at, v.member_seen_at,
      p.name as process_name from voices v left join processes p on p.id = v.process_id
    where v.member_id = $1 order by v.created_at desc limit 100`, [me.id]);
  return data.map((v) => ({
    id: v.id, category: v.category, body: v.body, photo: v.photo_url, createdAt: v.created_at,
    processName: v.process_name,
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
    const data = await one<{ id: string }>("select id from processes where id = $1 and active", [input.processId ?? ""]);
    if (!data) return { ok: false, error: "Pilih proses yang ingin dipelajari." };
    processId = data.id;
  }
  const photo = input.photo;
  if (photo && (!photo.startsWith("data:image/jpeg;base64,") || photo.length > 420_000)) return { ok: false, error: "Foto tidak valid atau terlalu besar." };
  try {
    await q("insert into voices (member_id, category, process_id, body, photo_url) values ($1, $2, $3, $4, $5)",
      [me.id, category, processId, body, photo || null]);
  } catch {
    return { ok: false, error: "Gagal mengirim. Coba lagi." };
  }
  return { ok: true };
}

/** F-1305: opening the Voice tab clears the unread-reply badge. */
export async function markRepliesSeen(): Promise<void> {
  const me = await requireMember();
  if (!me) return;
  await q("update voices set member_seen_at = now() where member_id = $1 and replied_at is not null and member_seen_at is null", [me.id]);
}

/* ======================= member: Cuti ======================= */

export type LeaveRow = {
  id: string; memberId: string; memberName: string; noreg: string; photoUrl: string | null;
  attStatusId: string; typeName: string; start: ISODate; end: ISODate; workdays: number; reason: string;
  status: LeaveStatus; decisionNote: string | null; decidedAt: string | null; createdAt: string;
};

const LEAVE_SELECT = `select l.id, l.member_id, l.att_status_id, l.start_date, l.end_date, l.workdays, l.reason, l.status, l.decision_note,
    l.decided_at, l.created_at, m.name as member_name, m.noreg, m.photo_url, a.name as type_name
  from leave_requests l join members m on m.id = l.member_id left join att_statuses a on a.id = l.att_status_id`;
type LeaveDb = {
  id: string; member_id: string; att_status_id: string; start_date: ISODate; end_date: ISODate; workdays: number; reason: string;
  status: LeaveStatus; decision_note: string | null; decided_at: string | null; created_at: string;
  member_name: string | null; noreg: string | null; photo_url: string | null; type_name: string | null;
};
const toLeave = (r: LeaveDb): LeaveRow => ({
  id: r.id, memberId: r.member_id, memberName: r.member_name ?? "-", noreg: r.noreg ?? "", photoUrl: r.photo_url,
  attStatusId: r.att_status_id, typeName: r.type_name ?? "Cuti", start: r.start_date, end: r.end_date,
  workdays: r.workdays, reason: r.reason, status: r.status, decisionNote: r.decision_note, decidedAt: r.decided_at, createdAt: r.created_at,
});

/** Form data for the member: LEAVE-type statuses and the calendar needed to count working days in the browser. */
export async function leaveForm(): Promise<{ types: { id: string; name: string }[]; workWeekdays: number[]; holidays: ISODate[]; today: ISODate }> {
  const today = todayJakarta();
  const [types, cfg] = await Promise.all([
    q<{ id: string; name: string }>("select id, name from att_statuses where category = 'LEAVE' order by sort"),
    workCfg(today, addDays(today, 400)),
  ]);
  return { types, workWeekdays: cfg.workWeekdays, holidays: cfg.holidays, today };
}

export async function myLeaves(): Promise<LeaveRow[]> {
  const me = await requireMember();
  if (!me) return [];
  return (await q<LeaveDb>(`${LEAVE_SELECT} where l.member_id = $1 order by l.start_date desc limit 100`, [me.id])).map(toLeave);
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
  const type = await one<{ id: string }>("select id from att_statuses where id = $1 and category = 'LEAVE'", [input.attStatusId]);
  if (!type) return { ok: false, error: "Pilih jenis cuti." };
  const cfg = await workCfg(start, end);
  const workdays = workdayList(start, end, cfg.workWeekdays, cfg.holidays).length;
  if (!workdays) return { ok: false, error: "Rentang tanggal itu tidak berisi hari kerja." };
  const mine = await q<{ start_date: ISODate; end_date: ISODate }>(
    "select start_date, end_date from leave_requests where member_id = $1 and status in ('PENDING', 'APPROVED')", [me.id]);
  if (mine.some((r) => leaveOverlaps({ start, end }, { start: r.start_date, end: r.end_date })))
    return { ok: false, error: "Tanggal ini bertumpuk dengan pengajuan cuti kamu yang lain." };
  try {
    await q("insert into leave_requests (member_id, att_status_id, start_date, end_date, workdays, reason) values ($1, $2, $3, $4, $5, $6)",
      [me.id, type.id, start, end, workdays, reason]);
  } catch {
    return { ok: false, error: "Gagal mengirim. Coba lagi." };
  }
  return { ok: true };
}

/** F-1402: only while still pending. */
export async function cancelMyLeave(id: string): Promise<Result> {
  const me = await requireMember();
  if (!me) return EXPIRED;
  const data = await q("update leave_requests set status = 'CANCELLED' where id = $1 and member_id = $2 and status = 'PENDING' returning id", [id, me.id]);
  return data.length ? { ok: true } : { ok: false, error: "Pengajuan sudah diputuskan, tidak bisa dibatalkan." };
}

/* ======================= leader ======================= */

export async function inboxCounts(): Promise<{ voiceNew: number; voiceOpen: number; leavePending: number }> {
  if (!(await isAuthed())) return { voiceNew: 0, voiceOpen: 0, leavePending: 0 };
  const r = await one<{ voice_new: number; voice_open: number; leave_pending: number }>(`select
    (select count(*)::int from voices where read_at is null) as voice_new,
    (select count(*)::int from voices where replied_at is null) as voice_open,
    (select count(*)::int from leave_requests where status = 'PENDING') as leave_pending`);
  return { voiceNew: r?.voice_new ?? 0, voiceOpen: r?.voice_open ?? 0, leavePending: r?.leave_pending ?? 0 };
}

export type LeaderVoice = {
  id: string; memberId: string; memberName: string; noreg: string; photoUrl: string | null;
  category: VoiceCategory; processId: string | null; processName: string | null; body: string; hasPhoto: boolean;
  createdAt: string; readAt: string | null; reply: string | null; repliedAt: string | null; status: VoiceStatus;
};

/** F-1303: unanswered K3 first, then unanswered, then answered; newest first inside each group. Photos load on open. */
export async function listVoices(): Promise<LeaderVoice[]> {
  if (!(await isAuthed())) return [];
  const data = await q<VoiceDb>(`select v.id, v.member_id, v.category, v.process_id, v.body, v.has_photo, v.created_at, v.read_at, v.reply,
      v.replied_at, m.name as member_name, m.noreg, m.photo_url as member_photo, p.name as process_name
    from voices v join members m on m.id = v.member_id left join processes p on p.id = v.process_id
    order by v.created_at desc limit 500`);
  const rank = (v: LeaderVoice) => (v.status === "REPLIED" ? 2 : v.category === "K3" ? 0 : 1);
  return data.map((v): LeaderVoice => ({
    id: v.id, memberId: v.member_id, memberName: v.member_name ?? "-", noreg: v.noreg ?? "", photoUrl: v.member_photo,
    category: v.category, processId: v.process_id, processName: v.process_name, body: v.body,
    hasPhoto: !!v.has_photo, createdAt: v.created_at, readAt: v.read_at, reply: v.reply, repliedAt: v.replied_at, status: voiceStatus(v),
  })).sort((a, b) => rank(a) - rank(b));
}

/** F-1304: opening marks it read once and returns the attached photo. */
export async function openVoice(id: string): Promise<Result<{ photo: string | null }>> {
  if (!(await isAuthed())) return EXPIRED;
  await q("update voices set read_at = now() where id = $1 and read_at is null", [id]);
  const data = await one<{ photo_url: string | null }>("select photo_url from voices where id = $1", [id]);
  return data ? { ok: true, photo: data.photo_url } : { ok: false, error: "Voice tidak ditemukan." };
}

/** F-1304: exactly one reply; a second attempt is refused by the `replied_at is null` guard. */
export async function replyVoice(id: string, reply: string): Promise<Result> {
  if (!(await isAuthed())) return EXPIRED;
  const text = reply.trim();
  if (!text || text.length > 1000) return { ok: false, error: "Balasan wajib diisi, maksimal 1000 karakter." };
  const now = new Date().toISOString();
  const data = await q("update voices set reply = $1, replied_at = $2, read_at = coalesce(read_at, $2) where id = $3 and replied_at is null returning id",
    [text, now, id]);
  if (!data.length) return { ok: false, error: "Voice ini sudah dibalas." };
  return { ok: true };
}

export async function listLeaves(): Promise<LeaveRow[]> {
  if (!(await isAuthed())) return [];
  return (await q<LeaveDb>(`${LEAVE_SELECT} order by l.start_date desc limit 1000`)).map(toLeave);
}

export type LeaveDay = { date: ISODate; others: string[]; short: { name: string; count: number; min: number }[] };

/** F-1404: per working day, who else is off (approved or pending) and which processes lose their minimum backup. */
export async function leaveCheck(id: string): Promise<Result<{ days: LeaveDay[] }>> {
  if (!(await isAuthed())) return EXPIRED;
  const req = await one<{ member_id: string; start_date: ISODate; end_date: ISODate }>(
    "select member_id, start_date, end_date from leave_requests where id = $1", [id]);
  if (!req) return { ok: false, error: "Pengajuan tidak ditemukan." };
  const [cfg, others, procs, levels] = await Promise.all([
    workCfg(req.start_date, req.end_date),
    q<{ member_id: string; start_date: ISODate; end_date: ISODate; name: string | null }>(`select l.member_id, l.start_date, l.end_date, m.name
      from leave_requests l join members m on m.id = l.member_id
      where l.id <> $1 and l.status in ('PENDING', 'APPROVED') and l.start_date <= $3 and l.end_date >= $2`, [id, req.start_date, req.end_date]),
    q<{ id: string; name: string; min_backup: number | null }>("select id, name, min_backup from processes where active order by sort"),
    q<{ member_id: string; process_id: string; level: number }>(
      "select s.member_id, s.process_id, s.level from skill_levels s join members m on m.id = s.member_id where m.active"),
  ]);
  const byMember: Record<string, LevelMap> = {};
  for (const l of levels) (byMember[l.member_id] ??= {})[l.process_id] = l.level;
  const processes = procs.map((p) => ({ id: p.id, name: p.name, minBackup: p.min_backup ?? cfg.defaultMinBackup }));
  const days = workdayList(req.start_date, req.end_date, cfg.workWeekdays, cfg.holidays).map((date): LeaveDay => {
    const off = others.filter((o) => o.start_date <= date && date <= o.end_date);
    return {
      date,
      others: off.map((o) => o.name ?? "-"),
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
  // The status guard makes a double click or a second leader tab a no-op instead of a double decision.
  const req = await one<{ member_id: string; att_status_id: string; start_date: ISODate; end_date: ISODate }>(
    `update leave_requests set status = $1, decision_note = $2, decided_at = now() where id = $3 and status = 'PENDING'
    returning member_id, att_status_id, start_date, end_date`, [approve ? "APPROVED" : "REJECTED", text || null, id]);
  if (!req) return { ok: false, error: "Pengajuan ini sudah diputuskan atau dibatalkan." };
  if (!approve) return { ok: true };
  const cfg = await workCfg(req.start_date, req.end_date);
  const dates = workdayList(req.start_date, req.end_date, cfg.workWeekdays, cfg.holidays);
  try {
    if (dates.length) await q(`insert into attendance (member_id, date, status_id, note, leave_request_id)
      select $1, d, $2, '', $3 from unnest($4::date[]) d
      on conflict (member_id, date) do update set status_id = excluded.status_id, note = excluded.note, leave_request_id = excluded.leave_request_id`,
      [req.member_id, req.att_status_id, id, dates]);
  } catch (e) {
    await q("update leave_requests set status = 'PENDING', decision_note = null, decided_at = null where id = $1", [id]);
    return { ok: false, error: `Gagal mengisi absensi: ${(e as Error).message}` };
  }
  return { ok: true };
}

/** F-1407: cancel an approved leave; only attendance rows still tagged with it are removed. */
export async function cancelApprovedLeave(id: string, note: string): Promise<Result> {
  if (!(await isAuthed())) return EXPIRED;
  const data = await q("update leave_requests set status = 'CANCELLED', decision_note = $1, decided_at = now() where id = $2 and status = 'APPROVED' returning id",
    [note.trim() || null, id]);
  if (!data.length) return { ok: false, error: "Hanya cuti yang sudah disetujui yang bisa dibatalkan di sini." };
  try {
    await q("delete from attendance where leave_request_id = $1", [id]);
  } catch (e) {
    return { ok: false, error: `Status dibatalkan, tapi absensi gagal dihapus: ${(e as Error).message}` };
  }
  return { ok: true };
}
