-- First day attendance is recorded in the app. Working days before it are never "missed"
-- (quick attendance) and are not counted in monthly performance.
alter table public.settings add column if not exists attendance_start_date date not null default '2026-10-01';
