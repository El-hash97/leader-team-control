-- Member "kelas" (employee class) is no longer part of the app (commit 4b73117).
-- Values were backed up to backup-members-kelas-2026-10-02.json before this ran.
-- members_kelas_check is dropped together with the column.
alter table public.members drop column if exists kelas;
