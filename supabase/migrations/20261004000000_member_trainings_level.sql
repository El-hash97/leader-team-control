-- Training is scored like a soft skill: level 1..4 (level 0 = no row). Existing rows count as completed (4).
alter table public.member_trainings add column if not exists level smallint not null default 4 check (level between 1 and 4);
