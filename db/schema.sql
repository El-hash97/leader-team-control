-- Leader Team Control: full schema of the Neon database (PostgreSQL 17).
-- Run once on an empty database. Changes after 2026-10-27 go here and are applied with the Neon SQL editor.

create type leave_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
create type voice_category as enum ('SARAN', 'KELUHAN', 'PERTANYAAN', 'K3', 'BELAJAR', 'LAINNYA');

create table settings (
  id smallint primary key default 1 check (id = 1),
  reminder_days integer not null default 90,
  multi_skill_min_processes integer not null default 3,
  multi_skill_min_level integer not null default 3,
  default_min_backup integer not null default 2,
  work_weekdays integer[] not null default '{1,2,3,4,5}',
  qcc_target_pct integer not null default 70,
  qcc_baseline_date date,
  contract_vokasi integer not null default 6,
  contract_pkwt1 integer not null default 24,
  contract_pkwt2_extra integer not null default 12,
  attendance_start_date date not null default '2026-10-01',
  -- Monday of a morning-shift week; the team alternates weekly
  shift_anchor_date date not null default '2026-10-05'
);

create table positions (id text primary key, name text not null unique, sort integer not null);
create table emp_statuses (id text primary key, name text not null unique, has_contract boolean not null);
create table att_statuses (
  id text primary key, name text not null unique,
  category text not null check (category in ('FULFILLED', 'SICK', 'LEAVE', 'PERMIT', 'ABSENT', 'OTHER')),
  sort integer not null
);
create table trainings (id text primary key, name text not null unique, has_expiry boolean not null default false, sort integer not null);
create table processes (
  id text primary key, name text not null unique, sort integer not null,
  min_backup integer check (min_backup > 0), active boolean not null default true
);

create table members (
  id text primary key,
  name text not null,
  noreg text not null unique,
  position_id text not null references positions(id),
  status_id text not null references emp_statuses(id),
  join_date date not null,
  contract_end date,
  photo_url text check (photo_url is null or (photo_url like 'data:image/jpeg;base64,%' and char_length(photo_url) <= 100000)),
  notes text not null default '',
  active boolean not null default true,
  deactivated_at date,
  created_at timestamptz not null default now()
);

create table skill_levels (
  member_id text not null references members(id) on delete cascade,
  process_id text not null references processes(id) on delete cascade,
  level smallint not null default 0 check (level between 0 and 4),
  target smallint check (target between 0 and 4),
  primary key (member_id, process_id)
);

create table plans (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  process_id text not null references processes(id) on delete cascade,
  from_level smallint not null check (from_level between 0 and 4),
  target_level smallint not null check (target_level between 1 and 4),
  start_date date not null,
  due_date date not null,
  method text not null check (method in ('OJT', 'TJI', 'CLASS', 'MENTORING', 'OTHER')),
  mentor_id text references members(id) on delete set null,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'IN_PROGRESS', 'EVALUATION', 'ACHIEVED', 'CANCELLED')),
  achieved_at date,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (due_date >= start_date)
);

create table skill_logs (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  process_id text not null references processes(id) on delete cascade,
  from_level smallint not null,
  to_level smallint not null,
  date date not null,
  note text not null default '',
  plan_id text references plans(id) on delete set null,
  created_at timestamptz not null default now()
);

create table member_trainings (
  member_id text not null references members(id) on delete cascade,
  training_id text not null references trainings(id) on delete cascade,
  trained_at date,
  expires_at date,
  level smallint not null default 4 check (level between 1 and 4),
  primary key (member_id, training_id)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  att_status_id text not null references att_statuses(id),
  start_date date not null,
  end_date date not null,
  workdays integer not null check (workdays > 0),
  reason text not null check (char_length(reason) between 5 and 500),
  status leave_status not null default 'PENDING',
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (status <> 'REJECTED' or char_length(coalesce(decision_note, '')) > 0)
);

create table attendance (
  member_id text not null references members(id) on delete cascade,
  date date not null,
  status_id text not null references att_statuses(id),
  note text not null default '',
  leave_request_id uuid references leave_requests(id) on delete set null,
  primary key (member_id, date)
);

create table holidays (date date primary key);

create table snapshots (
  id text primary key,
  month text not null,
  kind text not null check (kind in ('BASELINE', 'MONTHLY')),
  multi_skill_rate integer not null,
  safe_processes integer not null
);

create table member_accounts (
  member_id text primary key references members(id) on delete cascade,
  password_hash text,
  activation_hash text,
  activation_expires timestamptz,
  session_version integer not null default 0,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  activated_at timestamptz,
  last_login_at timestamptz,
  last_seen_at timestamptz
);

create table voices (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  category voice_category not null,
  process_id text references processes(id),
  body text not null check (char_length(body) between 10 and 1000),
  photo_url text check (photo_url is null or char_length(photo_url) <= 420000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  reply text check (reply is null or char_length(reply) between 1 and 1000),
  replied_at timestamptz,
  member_seen_at timestamptz,
  has_photo boolean generated always as (photo_url is not null) stored,
  check (category <> 'BELAJAR' or process_id is not null),
  check ((reply is null) = (replied_at is null))
);

create index attendance_date_idx on attendance (date);
create index attendance_status_idx on attendance (status_id);
create index leave_requests_member_start on leave_requests (member_id, start_date);
create index leave_requests_status on leave_requests (status, start_date);
create index member_trainings_training_idx on member_trainings (training_id);
create index members_position_idx on members (position_id);
create index members_status_idx on members (status_id);
create index plans_mentor_idx on plans (mentor_id);
create unique index plans_one_active on plans (member_id, process_id) where status not in ('ACHIEVED', 'CANCELLED');
create index plans_process_idx on plans (process_id);
create index skill_levels_process_idx on skill_levels (process_id);
create index skill_logs_member_idx on skill_logs (member_id);
create index skill_logs_plan_idx on skill_logs (plan_id);
create index skill_logs_process_idx on skill_logs (process_id);
create index voices_member_created on voices (member_id, created_at desc);

-- Auto "Hadir" for every active member on a workday, called by Vercel Cron (/api/cron/auto-hadir/[shift]).
-- Only the shift whose week it is fills; existing rows (leave, manual input) are never overwritten.
create or replace function auto_fill_hadir(p_shift text) returns integer
language plpgsql set search_path to 'public' as $$
declare
  d date := (now() at time zone 'Asia/Jakarta')::date;
  cfg record;
  hadir text;
  morning boolean;
  n integer;
begin
  select work_weekdays, shift_anchor_date into cfg from settings where id = 1;
  if not (extract(dow from d)::int = any (cfg.work_weekdays)) then return 0; end if;
  if exists (select 1 from holidays where date = d) then return 0; end if;

  morning := (((date_trunc('week', d)::date - date_trunc('week', cfg.shift_anchor_date)::date) / 7) % 2 + 2) % 2 = 0;
  if (p_shift = 'pagi') <> morning then return 0; end if;

  select id into hadir from att_statuses where name = 'Hadir';
  insert into attendance (member_id, date, status_id, note)
    select m.id, d, hadir, case when morning then 'Otomatis 07:00' else 'Otomatis 21:00' end
    from members m where m.active and m.join_date <= d
    on conflict (member_id, date) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
