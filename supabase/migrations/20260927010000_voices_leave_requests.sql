-- PRD v3 §7 (M13 Voice, M14 Cuti). Same access model as every other table: RLS on, no policies, server-only.
create type public.voice_category as enum ('SARAN', 'KELUHAN', 'PERTANYAAN', 'K3', 'BELAJAR', 'LAINNYA');

create table public.voices (
  id             uuid primary key default gen_random_uuid(),
  member_id      text not null references public.members(id) on delete cascade,
  category       public.voice_category not null,
  process_id     text references public.processes(id),           -- required when BELAJAR
  body           text not null check (char_length(body) between 10 and 1000),
  photo_url      text check (photo_url is null or char_length(photo_url) <= 420000), -- jpeg data URL, ~300 KB
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  reply          text check (reply is null or char_length(reply) between 1 and 1000),
  replied_at     timestamptz,
  member_seen_at timestamptz,
  check (category <> 'BELAJAR' or process_id is not null),
  check ((reply is null) = (replied_at is null))
);
create index voices_member_created on public.voices (member_id, created_at desc);
alter table public.voices enable row level security;

create type public.leave_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

create table public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  member_id     text not null references public.members(id) on delete cascade,
  att_status_id text not null references public.att_statuses(id),
  start_date    date not null,
  end_date      date not null check (end_date >= start_date),
  workdays      int  not null check (workdays > 0),
  reason        text not null check (char_length(reason) between 5 and 500),
  status        public.leave_status not null default 'PENDING',
  decision_note text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  check (status <> 'REJECTED' or char_length(coalesce(decision_note, '')) > 0)
);
create index leave_requests_member_start on public.leave_requests (member_id, start_date);
create index leave_requests_status on public.leave_requests (status, start_date);
alter table public.leave_requests enable row level security;

-- F-1406: rows filled by an approved leave carry its id; a manual edit clears it.
alter table public.attendance add column leave_request_id uuid references public.leave_requests(id) on delete set null;

-- Leader inbox lists voices without pulling every photo; this flag says whether to fetch one on open.
alter table public.voices add column has_photo boolean generated always as (photo_url is not null) stored;
