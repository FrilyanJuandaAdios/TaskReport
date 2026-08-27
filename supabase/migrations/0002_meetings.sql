-- ---------------------------------------------------------------------------
-- Worklog — meeting schedules (v2).
--
-- Run after 0001_init.sql.
--
-- A meeting is stored once as a *rule* and expanded against a date on read, so
-- "every weekday at 09:15" is one row rather than 250 a year. What actually
-- happened on a given day lives in `meeting_logs`, created lazily.
-- ---------------------------------------------------------------------------

do $$ begin
  create type meeting_recurrence as enum ('daily', 'weekdays', 'weekly', 'once');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_status as enum ('scheduled', 'attended', 'skipped', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists meetings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null,
  time              text not null,
  duration_minutes  integer not null default 30,
  recurrence        meeting_recurrence not null default 'weekdays',
  -- ISO weekdays, 1 = Monday … 7 = Sunday. Only read when recurrence = 'weekly'.
  weekdays          smallint[] not null default '{}',
  date              date,
  start_date        date,
  end_date          date,
  project_id        uuid references projects (id) on delete set null,
  requester_id      uuid references requesters (id) on delete set null,
  link              text,
  notes             text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A one-off meeting needs its date; a weekly one needs at least one weekday.
  constraint meetings_once_needs_date
    check (recurrence <> 'once' or date is not null),
  constraint meetings_weekly_needs_days
    check (recurrence <> 'weekly' or array_length(weekdays, 1) >= 1)
);

create table if not exists meeting_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meeting_id  uuid not null references meetings (id) on delete cascade,
  date        date not null,
  status      meeting_status not null default 'scheduled',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One record per meeting per day.
  unique (meeting_id, date)
);

create index if not exists meetings_active_idx     on meetings (user_id, is_active);
create index if not exists meetings_date_idx       on meetings (user_id, date);
create index if not exists meeting_logs_date_idx   on meeting_logs (user_id, date desc);
create index if not exists meeting_logs_meeting_idx on meeting_logs (meeting_id);

-- updated_at triggers (touch_updated_at() is created in 0001_init.sql).
do $$
declare t text;
begin
  foreach t in array array['meetings', 'meeting_logs']
  loop
    execute format(
      'drop trigger if exists %1$s_touch on %1$s;
       create trigger %1$s_touch before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- Row level security, matching every other table.
alter table meetings     enable row level security;
alter table meeting_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['meetings', 'meeting_logs']
  loop
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format(
      'create policy %1$s_owner on %1$s
         for all using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;
