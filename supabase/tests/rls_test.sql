-- RLS and trigger tests. Run with: npm run test:db
-- Every check raises on failure, so psql with ON_ERROR_STOP exits non-zero.
\set ON_ERROR_STOP 1

-- Seed as superuser ---------------------------------------------------------
insert into companies (id, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Co'),
  ('00000000-0000-0000-0000-0000000000c2', 'Other Co');
insert into invites (email, company_id) values
  ('client@acme.com', '00000000-0000-0000-0000-0000000000c1');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'Sam@LaireDigital.com', '{"full_name":"Sam Barth"}'),
  ('00000000-0000-0000-0000-00000000000b', 'client@acme.com', '{"full_name":"Casey Client"}');

do $$ begin
  begin
    insert into auth.users (email) values ('stranger@example.com');
    raise exception 'FAIL: uninvited signup was allowed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  assert (select role from profiles where email = 'sam@lairedigital.com') = 'staff', 'staff role';
  assert (select company_id from profiles where email = 'client@acme.com')
         = '00000000-0000-0000-0000-0000000000c1', 'guest company';
  assert not exists (select 1 from invites where email = 'client@acme.com'), 'invite consumed';
end $$;

insert into projects (id, company_id, name) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Acme Website'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'Other SEO');

insert into tasks (id, project_id, parent_id, title, is_internal, needs_approval, assignee_id, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', null,
   'Homepage copy', false, true, '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', null,
   'Internal margin review', true, false, null, '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d2',
   'Subtask of internal', false, false, null, null),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a2', null,
   'Other client task', false, false, null, null);

insert into comments (task_id, author_id, body, is_internal) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'Draft attached', false),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'Client is slow, chase', true);

insert into time_entries (task_id, user_id, hours) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 1.5);

-- Seeding as superuser has no auth.uid(), so no notifications yet.
do $$ begin
  assert (select count(*) from notifications) = 0, 'service writes stay silent';
end $$;

-- As the guest --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$ begin
  assert (select count(*) from companies) = 1, 'guest sees one company';
  assert (select count(*) from projects) = 1, 'guest sees own projects only';
  assert (select array_agg(title order by title) from tasks) = array['Homepage copy'],
         'guest sees no internal tasks, no children of internal tasks, no other clients';
  assert (select count(*) from comments) = 1, 'guest sees no internal comments';
  assert (select count(*) from time_entries) = 0, 'guest sees no time';
  assert (select count(*) from invites) = 0, 'guest sees no invites';
end $$;

-- Guest cannot edit tasks (RLS filters the update to zero rows).
update tasks set title = 'hacked' where id = '00000000-0000-0000-0000-0000000000d1';
do $$ begin
  assert (select title from tasks where id = '00000000-0000-0000-0000-0000000000d1') = 'Homepage copy',
         'guest update blocked';
end $$;

-- Guest cannot promote themselves.
do $$ begin
  begin
    update profiles set role = 'staff' where id = auth.uid();
    raise exception 'FAIL: guest changed own role';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- Guest cannot post an internal comment or comment on a hidden task.
do $$ begin
  begin
    insert into comments (task_id, author_id, body, is_internal)
    values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), 'x', true);
    raise exception 'FAIL: guest posted internal comment';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into comments (task_id, author_id, body)
    values ('00000000-0000-0000-0000-0000000000d2', auth.uid(), 'x');
    raise exception 'FAIL: guest commented on internal task';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Guest comments with a mention, then approves.
insert into comments (task_id, author_id, body) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000b',
   'Looks good @[Sam Barth](00000000-0000-0000-0000-00000000000a)');
select approve_task('00000000-0000-0000-0000-0000000000d1');

do $$ begin
  begin
    perform approve_task('00000000-0000-0000-0000-0000000000d4');
    raise exception 'FAIL: guest approved another client''s task';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- As staff ------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$ begin
  assert (select count(*) from tasks) = 4, 'staff sees all tasks';
  assert (select count(*) from comments) = 3, 'staff sees all comments';
  assert (select approved_by from tasks where id = '00000000-0000-0000-0000-0000000000d1')
         = '00000000-0000-0000-0000-00000000000b', 'approval recorded';
  -- mention + comment (assignee) + approval; creator = assignee so no duplicates
  assert (select array_agg(kind order by kind) from notifications)
         = array['approved', 'comment', 'mention'], 'staff inbox';
end $$;

-- Staff assigns the guest an internal task: the guest must not be notified.
update tasks set assignee_id = '00000000-0000-0000-0000-00000000000b'
  where id = '00000000-0000-0000-0000-0000000000d2';
-- Staff assigns the guest a visible task: the guest is notified.
update tasks set assignee_id = '00000000-0000-0000-0000-00000000000b', status = 'complete'
  where id = '00000000-0000-0000-0000-0000000000d1';

do $$ begin
  assert (select completed_at is not null from tasks where id = '00000000-0000-0000-0000-0000000000d1'),
         'completed_at stamped';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select array_agg(body) from notifications) = array['assigned you "Homepage copy"'],
         'guest inbox has no internal work';
end $$;

reset role;
select 'all RLS tests passed' as result;
