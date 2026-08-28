-- ---------------------------------------------------------------------------
-- Worklog — Postgres schema for the Supabase driver.
--
-- Run once in the Supabase SQL editor (or `supabase db push`), then set
--   VITE_DB_DRIVER=supabase
--   VITE_SUPABASE_URL=…
--   VITE_SUPABASE_ANON_KEY=…
--
-- Design notes
--  * `user_id` defaults to auth.uid() so the browser never sends it, and RLS
--    scopes every row to its owner. The anon key is therefore safe to ship.
--  * `date` columns are real DATE values — they are calendar days, not instants,
--    which is what makes "what did I do on 14 August" timezone-proof.
--  * Tags are a proper many-to-many via task_tags / delivery_tags.
--  * ON DELETE SET NULL on project/requester/delivery keeps historical tasks
--    intact when a lookup value is removed.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ------------------------------- enums -------------------------------------

do $$ begin
  create type task_status as enum ('planned', 'in_progress', 'completed', 'blocked', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum (
    'not_started', 'in_progress', 'waiting_feedback', 'revision',
    'ready_to_deliver', 'delivered', 'on_hold'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('active', 'archived');
exception when duplicate_object then null; end $$;

-- ------------------------------ lookups ------------------------------------

create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  code         text not null default '',
  description  text,
  color        text not null default 'slate',
  status       project_status not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists requesters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  team        text,
  email       text,
  notes       text,
  is_self     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ----------------------------- deliveries ----------------------------------

create table if not exists deliveries (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title                 text not null,
  description           text,
  project_id            uuid references projects (id) on delete set null,
  requester_id          uuid references requesters (id) on delete set null,
  requested_date        date not null,
  target_delivery_date  date,
  actual_delivery_date  date,
  status                delivery_status not null default 'not_started',
  figma_url             text,
  ticket_url            text,
  reference_url         text,
  notes                 text,
  delivered_at          timestamptz,
  revision_count        integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- -------------------------------- tasks ------------------------------------

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  description   text,
  date          date not null,
  planned_time  text,
  reminder_time text,
  start_time    text,
  end_time      text,
  status        task_status not null default 'planned',
  target_date   date,
  is_planned    boolean not null default true,
  priority      task_priority not null default 'normal',
  project_id    uuid references projects (id) on delete set null,
  requester_id  uuid references requesters (id) on delete set null,
  delivery_id   uuid references deliveries (id) on delete set null,
  notes         text,
  started_at    timestamptz,
  completed_at  timestamptz,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists task_tags (
  task_id  uuid not null references tasks (id) on delete cascade,
  tag_id   uuid not null references tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

create table if not exists delivery_tags (
  delivery_id  uuid not null references deliveries (id) on delete cascade,
  tag_id       uuid not null references tags (id) on delete cascade,
  primary key (delivery_id, tag_id)
);

-- ----------------------------- daily reports -------------------------------

create table if not exists daily_reports (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date                date not null,
  issues              text not null default '',
  next_steps          text not null default '',
  notes               text not null default '',
  summary             jsonb not null default '{}'::jsonb,
  body_override       text,
  synced_to_notion_at timestamptz,
  notion_page_url     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, date)
);

-- ------------------------------ activity log -------------------------------

create table if not exists activity_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity     text not null,
  entity_id  uuid not null,
  action     text not null,
  message    text not null,
  at         timestamptz not null default now(),
  meta       jsonb
);

-- -------------------------------- settings ---------------------------------

-- One row, id = 'settings'. This app is single-user per Supabase project; if you
-- ever share a project between people, change the primary key to user_id and
-- switch the driver's upsert to `onConflict: 'user_id'`.
create table if not exists settings (
  id                        text primary key default 'settings',
  user_id                   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  user_name                 text not null default 'Designer',
  workday_start             text not null default '09:00',
  workday_end               text not null default '18:00',
  theme                     text not null default 'system',
  morning_reminder_enabled  boolean not null default false,
  morning_reminder_time     text not null default '09:00',
  evening_reminder_enabled  boolean not null default false,
  evening_reminder_time     text not null default '17:30',
  updated_at                timestamptz not null default now()
);

-- -------------------------------- indexes ----------------------------------

create index if not exists tasks_date_idx          on tasks (user_id, date desc);
create index if not exists tasks_status_idx        on tasks (user_id, status);
create index if not exists tasks_project_idx       on tasks (project_id);
create index if not exists tasks_requester_idx     on tasks (requester_id);
create index if not exists tasks_delivery_idx      on tasks (delivery_id);
create index if not exists deliveries_status_idx   on deliveries (user_id, status);
create index if not exists deliveries_target_idx   on deliveries (user_id, target_delivery_date);
create index if not exists reports_date_idx        on daily_reports (user_id, date desc);
create index if not exists activity_at_idx         on activity_log (user_id, at desc);
create index if not exists activity_entity_idx     on activity_log (entity, entity_id);

-- Free-text search over the archive.
create index if not exists tasks_title_trgm_idx on tasks using gin (to_tsvector('simple', title));

-- ------------------------------ updated_at ---------------------------------

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['projects','requesters','tags','deliveries','tasks','daily_reports','settings']
  loop
    execute format(
      'drop trigger if exists %1$s_touch on %1$s;
       create trigger %1$s_touch before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- ------------------------- row level security ------------------------------
-- Every table is private to its owner. The join tables inherit ownership from
-- their parent row, which is why their policies use an EXISTS check.

alter table projects       enable row level security;
alter table requesters     enable row level security;
alter table tags           enable row level security;
alter table deliveries     enable row level security;
alter table tasks          enable row level security;
alter table daily_reports  enable row level security;
alter table activity_log   enable row level security;
alter table settings       enable row level security;
alter table task_tags      enable row level security;
alter table delivery_tags  enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'projects','requesters','tags','deliveries','tasks','daily_reports','activity_log','settings'
  ]
  loop
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format(
      'create policy %1$s_owner on %1$s
         for all using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

drop policy if exists task_tags_owner on task_tags;
create policy task_tags_owner on task_tags for all
  using (exists (select 1 from tasks t where t.id = task_tags.task_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tasks t where t.id = task_tags.task_id and t.user_id = auth.uid()));

drop policy if exists delivery_tags_owner on delivery_tags;
create policy delivery_tags_owner on delivery_tags for all
  using (exists (select 1 from deliveries d where d.id = delivery_tags.delivery_id and d.user_id = auth.uid()))
  with check (exists (select 1 from deliveries d where d.id = delivery_tags.delivery_id and d.user_id = auth.uid()));
