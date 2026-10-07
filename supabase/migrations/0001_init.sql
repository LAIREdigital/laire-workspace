-- LAIRE Workspace schema.
-- Structure mirrors Accelo: companies > projects > milestones > tasks > subtasks.
-- Staff (@lairedigital.com) see everything. Client guests see only their own
-- company's projects, never internal tasks or internal comments, and can only
-- comment and approve.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type user_role as enum ('staff', 'guest');
create type project_status as enum ('planned', 'active', 'on_hold', 'complete');
create type task_status as enum ('not_started', 'in_progress', 'in_review', 'complete');
create type task_priority as enum ('none', 'low', 'medium', 'high');
create type field_type as enum ('text', 'number', 'select', 'date');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  accelo_id bigint unique,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  role user_role not null default 'guest',
  company_id uuid references companies (id) on delete set null,
  accelo_staff_id bigint unique,
  created_at timestamptz not null default now(),
  constraint guest_has_company check (role = 'staff' or company_id is not null)
);

-- Client guests are invite only. A row here lets that email sign in once.
create table invites (
  email text primary key,
  company_id uuid not null references companies (id) on delete cascade,
  invited_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  description text,
  status project_status not null default 'active',
  color text not null default '#ff8b71',
  owner_id uuid references profiles (id) on delete set null,
  start_date date,
  due_date date,
  accelo_id bigint unique,
  created_at timestamptz not null default now()
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  start_date date,
  due_date date,
  position double precision not null default 0,
  accelo_id bigint unique,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  milestone_id uuid references milestones (id) on delete set null,
  parent_id uuid references tasks (id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'not_started',
  priority task_priority not null default 'none',
  assignee_id uuid references profiles (id) on delete set null,
  start_date date,
  due_date date,
  completed_at timestamptz,
  is_internal boolean not null default false,
  needs_approval boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references profiles (id) on delete set null,
  position double precision not null default 0,
  created_by uuid references profiles (id) on delete set null,
  accelo_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_idx on tasks (project_id);
create index tasks_assignee_idx on tasks (assignee_id);
create index tasks_parent_idx on tasks (parent_id);

create table task_dependencies (
  task_id uuid not null references tasks (id) on delete cascade,
  depends_on_id uuid not null references tasks (id) on delete cascade,
  primary key (task_id, depends_on_id),
  constraint no_self_dependency check (task_id <> depends_on_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index comments_task_idx on comments (task_id);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  content_type text,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table custom_fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  type field_type not null default 'text',
  options text[] not null default '{}',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table custom_field_values (
  task_id uuid not null references tasks (id) on delete cascade,
  field_id uuid not null references custom_fields (id) on delete cascade,
  value text,
  primary key (task_id, field_id)
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  work_date date not null default current_date,
  hours numeric(6, 2) not null check (hours > 0 and hours <= 24),
  note text,
  billable boolean not null default true,
  accelo_id bigint unique,
  created_at timestamptz not null default now()
);

create index time_entries_task_idx on time_entries (task_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  task_id uuid references tasks (id) on delete cascade,
  kind text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Access helpers. security definer so policies can call them without
-- recursing through profiles' own policies.
-- ---------------------------------------------------------------------------

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'staff' from profiles where id = auth.uid()), false)
$$;

create or replace function my_company() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function can_see_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff() or exists (
    select 1 from projects where id = p and company_id = my_company()
  )
$$;

-- A guest sees a task only if its project is theirs and neither the task nor
-- any of its parents is internal.
create or replace function can_see_task(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_id, project_id, is_internal from tasks where id = t
    union all
    select p.id, p.parent_id, p.project_id, p.is_internal
    from tasks p join chain c on p.id = c.parent_id
  )
  select is_staff() or (
    exists (select 1 from chain)
    and not exists (select 1 from chain where is_internal)
    and can_see_project((select project_id from tasks where id = t))
  )
$$;

-- ---------------------------------------------------------------------------
-- New users: staff by domain, guests only with an invite.
-- ---------------------------------------------------------------------------

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
  email_lower text := lower(new.email);
begin
  if email_lower like '%@lairedigital.com' then
    insert into profiles (id, email, full_name, avatar_url, role)
    values (
      new.id, email_lower,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      new.raw_user_meta_data ->> 'avatar_url',
      'staff'
    );
    return new;
  end if;

  select * into inv from invites where email = email_lower;
  if not found then
    raise exception 'LAIRE Workspace is invite only. Ask your LAIRE contact for an invite.';
  end if;

  insert into profiles (id, email, full_name, role, company_id)
  values (new.id, email_lower, new.raw_user_meta_data ->> 'full_name', 'guest', inv.company_id);
  delete from invites where email = email_lower;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Task bookkeeping and notifications
-- ---------------------------------------------------------------------------

create or replace function notify(
  recipient uuid, actor uuid, task uuid, kind text, body text
) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, actor_id, task_id, kind, body)
  select recipient, actor, task, kind, body
  where recipient is not null
    and actor is not null -- imports and service jobs stay silent
    and recipient is distinct from actor
    -- never leak internal work to a guest through the inbox
    and (
      (select role from profiles where id = recipient) = 'staff'
      or not (select is_internal from tasks where id = task)
    )
$$;

create or replace function tasks_before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'complete' and (tg_op = 'INSERT' or old.status <> 'complete') then
    new.completed_at := now();
  elsif new.status <> 'complete' then
    new.completed_at := null;
  end if;
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

create trigger tasks_before_write
  before insert or update on tasks
  for each row execute function tasks_before_write();

create or replace function tasks_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform notify(new.assignee_id, auth.uid(), new.id, 'assigned',
                   'assigned you "' || new.title || '"');
  end if;
  if tg_op = 'UPDATE' and new.status = 'complete' and old.status <> 'complete' then
    perform notify(new.created_by, auth.uid(), new.id, 'completed',
                   'completed "' || new.title || '"');
  end if;
  return null;
end $$;

create trigger tasks_after_write
  after insert or update on tasks
  for each row execute function tasks_after_write();

-- Comments notify the assignee, the creator, and anyone @mentioned with the
-- token format @[Name](uuid).
create or replace function comments_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t tasks%rowtype;
  mentioned uuid;
begin
  select * into t from tasks where id = new.task_id;
  for mentioned in
    select distinct m[1]::uuid
    from regexp_matches(new.body, '@\[[^\]]*\]\(([0-9a-f-]{36})\)', 'g') as m
  loop
    if not new.is_internal or (select role from profiles where id = mentioned) = 'staff' then
      perform notify(mentioned, new.author_id, t.id, 'mention',
                     'mentioned you on "' || t.title || '"');
    end if;
  end loop;

  if new.is_internal then
    if (select role from profiles where id = t.assignee_id) = 'staff' then
      perform notify(t.assignee_id, new.author_id, t.id, 'comment',
                     'left an internal note on "' || t.title || '"');
    end if;
  else
    perform notify(t.assignee_id, new.author_id, t.id, 'comment',
                   'commented on "' || t.title || '"');
    if t.created_by is distinct from t.assignee_id then
      perform notify(t.created_by, new.author_id, t.id, 'comment',
                     'commented on "' || t.title || '"');
    end if;
  end if;
  return null;
end $$;

create trigger comments_after_insert
  after insert on comments
  for each row execute function comments_after_insert();

-- Guests cannot update tasks directly. Approval goes through this function,
-- which checks visibility itself.
create or replace function approve_task(t uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  rec tasks%rowtype;
begin
  if auth.uid() is null or not can_see_task(t) then
    raise exception 'Not allowed';
  end if;
  select * into rec from tasks where id = t;
  if not rec.needs_approval then
    raise exception 'This task does not need approval';
  end if;
  update tasks set approved_at = now(), approved_by = auth.uid() where id = t;
  perform notify(rec.assignee_id, auth.uid(), t, 'approved',
                 'approved "' || rec.title || '"');
  if rec.created_by is distinct from rec.assignee_id then
    perform notify(rec.created_by, auth.uid(), t, 'approved',
                   'approved "' || rec.title || '"');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table companies enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table projects enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table task_dependencies enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table custom_fields enable row level security;
alter table custom_field_values enable row level security;
alter table time_entries enable row level security;
alter table notifications enable row level security;

-- Staff: full access to shared work data.
create policy staff_all on companies for all using (is_staff()) with check (is_staff());
create policy staff_all on invites for all using (is_staff()) with check (is_staff());
create policy staff_all on projects for all using (is_staff()) with check (is_staff());
create policy staff_all on milestones for all using (is_staff()) with check (is_staff());
create policy staff_all on tasks for all using (is_staff()) with check (is_staff());
create policy staff_all on task_dependencies for all using (is_staff()) with check (is_staff());
create policy staff_all on attachments for all using (is_staff()) with check (is_staff());
create policy staff_all on custom_fields for all using (is_staff()) with check (is_staff());
create policy staff_all on custom_field_values for all using (is_staff()) with check (is_staff());
create policy staff_all on time_entries for all using (is_staff()) with check (is_staff());
create policy staff_read on comments for select using (is_staff());
create policy staff_write on comments for insert
  with check (is_staff() and author_id = auth.uid());
create policy staff_delete on comments for delete using (is_staff() and author_id = auth.uid());

-- Guests: read their own company's work.
create policy guest_read on companies for select using (id = my_company());
create policy guest_read on projects for select using (company_id = my_company());
create policy guest_read on milestones for select using (can_see_project(project_id));
create policy guest_read on tasks for select using (can_see_task(id));
create policy guest_read on task_dependencies for select
  using (can_see_task(task_id) and can_see_task(depends_on_id));
create policy guest_read on attachments for select using (can_see_task(task_id));
create policy guest_read on custom_fields for select using (can_see_project(project_id));
create policy guest_read on custom_field_values for select using (can_see_task(task_id));
create policy guest_read on comments for select
  using (not is_internal and can_see_task(task_id));
create policy guest_write on comments for insert
  with check (not is_internal and author_id = auth.uid() and can_see_task(task_id));

-- Profiles: staff see everyone, guests see staff, their own company, and self.
create policy read_profiles on profiles for select using (
  is_staff() or id = auth.uid() or role = 'staff' or company_id = my_company()
);
create policy update_self on profiles for update using (id = auth.uid())
  with check (id = auth.uid());
create policy staff_manage_profiles on profiles for update using (is_staff()) with check (is_staff());

-- Only staff may change anyone's role or company, including their own.
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_staff()
     and (new.role <> old.role or new.company_id is distinct from old.company_id
          or new.email <> old.email) then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;

create trigger guard_profile_update
  before update on profiles
  for each row execute function guard_profile_update();

-- Notifications: your own only. Rows are created by triggers.
create policy own_read on notifications for select using (user_id = auth.uid());
create policy own_update on notifications for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- File storage. Objects live at <task_id>/<random>-<file name>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_staff on storage.objects for all
  using (bucket_id = 'attachments' and is_staff())
  with check (bucket_id = 'attachments' and is_staff());

create policy attachments_guest_read on storage.objects for select using (
  bucket_id = 'attachments'
  and can_see_task(((storage.foldername(name))[1])::uuid)
);

grant execute on function approve_task(uuid) to authenticated;
