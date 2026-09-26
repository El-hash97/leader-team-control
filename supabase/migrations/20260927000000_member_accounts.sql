-- PRD v3 §7 (F-1101..F-1108): member login accounts. One row per member, created on first activation code.
create table if not exists public.member_accounts (
  member_id          text primary key references public.members(id) on delete cascade,
  password_hash      text,                 -- null = not activated yet
  activation_hash    text,                 -- null = no pending code
  activation_expires timestamptz,
  session_version    int  not null default 0,
  failed_attempts    int  not null default 0,
  locked_until       timestamptz,
  activated_at       timestamptz,
  last_login_at      timestamptz,
  last_seen_at       timestamptz
);

-- Same model as every other table: RLS on, no policies. Only the server (secret key) can read or write.
alter table public.member_accounts enable row level security;
