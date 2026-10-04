-- Auto "Hadir" on workdays: morning-shift weeks at 07:00 WIB, night-shift weeks at 21:00 WIB.
-- The whole team rotates weekly; shift_anchor_date is a Monday of a morning week.
-- Only members with no attendance row yet are filled, so approved leave and manual entries are never overwritten.
alter table public.settings add column if not exists shift_anchor_date date not null default '2026-10-05';

create or replace function public.auto_fill_hadir(p_shift text) returns integer
language plpgsql security definer set search_path = public as $$
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

-- Only pg_cron (postgres) may run it; never expose it over the REST API.
revoke all on function public.auto_fill_hadir(text) from public, anon, authenticated;

create extension if not exists pg_cron;
-- 00:00 UTC = 07:00 WIB, 14:00 UTC = 21:00 WIB; the function itself picks morning vs night weeks.
select cron.schedule('auto-hadir-pagi', '0 0 * * 1-5', $$select public.auto_fill_hadir('pagi')$$);
select cron.schedule('auto-hadir-malam', '0 14 * * 1-5', $$select public.auto_fill_hadir('malam')$$);
