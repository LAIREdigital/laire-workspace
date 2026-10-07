-- Demo data for local development. Companies and people are fictional,
-- except Sam. Dates are relative to today so the views always look alive.
-- Do not run against production.

insert into companies (id, name, website) values
  ('10000000-0000-0000-0000-000000000001', 'Northwind Dental', 'https://northwind-dental.example'),
  ('10000000-0000-0000-0000-000000000002', 'Harbor Logistics', 'https://harbor-logistics.example'),
  ('10000000-0000-0000-0000-000000000003', 'Summit Credit Union', 'https://summit-cu.example');

insert into invites (email, company_id) values
  ('dana@northwind-dental.example', '10000000-0000-0000-0000-000000000001');

insert into auth.users (id, email, raw_user_meta_data) values
  ('20000000-0000-0000-0000-000000000001', 'sbarth@lairedigital.com', '{"full_name":"Sam Barth"}'),
  ('20000000-0000-0000-0000-000000000002', 'jreyes@lairedigital.com', '{"full_name":"Jordan Reyes"}'),
  ('20000000-0000-0000-0000-000000000003', 'pshah@lairedigital.com', '{"full_name":"Priya Shah"}'),
  ('20000000-0000-0000-0000-000000000004', 'dana@northwind-dental.example', '{"full_name":"Dana Whitfield"}');

insert into projects (id, company_id, name, description, status, color, owner_id, start_date, due_date) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Website Redesign', 'New site on HubSpot CMS, 14 pages plus blog migration.', 'active', '#ff8b71',
   '20000000-0000-0000-0000-000000000001', current_date - 21, current_date + 40),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Q4 Content Retainer', 'Four blogs and two ROPS a month.', 'active', '#8bd8d5',
   '20000000-0000-0000-0000-000000000002', current_date - 10, current_date + 80),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002',
   'SEO and AEO Program', 'Technical fixes, keyword focus, answer engine content.', 'active', '#b4bb65',
   '20000000-0000-0000-0000-000000000003', current_date - 30, current_date + 60),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003',
   'Paid Search Launch', 'Google Ads and LinkedIn for the HELOC campaign.', 'planned', '#81b5c6',
   '20000000-0000-0000-0000-000000000001', current_date + 5, current_date + 45);

insert into milestones (id, project_id, name, start_date, due_date, position) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Discovery', current_date - 21, current_date - 8, 0),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Design', current_date - 9, current_date + 10, 1),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Build and Launch', current_date + 8, current_date + 40, 2),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'October', current_date - 10, current_date + 20, 0);

insert into tasks (id, project_id, milestone_id, parent_id, title, description, status, priority, assignee_id,
                   start_date, due_date, is_internal, needs_approval, approved_at, approved_by, position, created_by) values
  -- Website Redesign: Discovery
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', null,
   'Kickoff call and stakeholder interviews', null, 'complete', 'medium', '20000000-0000-0000-0000-000000000001',
   current_date - 21, current_date - 18, false, false, null, null, 1, '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', null,
   'Sitemap and page inventory', 'Map every current URL to the new structure. Flag redirects.', 'complete', 'high', '20000000-0000-0000-0000-000000000003',
   current_date - 17, current_date - 10, false, true, now() - interval '9 days', '20000000-0000-0000-0000-000000000004', 2, '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', null,
   'Scope and margin check', 'Internal: hours vs. SOW after discovery.', 'complete', 'medium', '20000000-0000-0000-0000-000000000001',
   current_date - 10, current_date - 8, true, false, null, null, 3, '20000000-0000-0000-0000-000000000001'),
  -- Design
  ('50000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', null,
   'Homepage wireframe', null, 'complete', 'high', '20000000-0000-0000-0000-000000000002',
   current_date - 9, current_date - 4, false, false, null, null, 4, '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', null,
   'Homepage design comp', 'Two directions, LAIRE recommends option B.', 'in_review', 'high', '20000000-0000-0000-0000-000000000002',
   current_date - 3, current_date + 2, false, true, null, null, 5, '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', null,
   'Interior page templates', null, 'in_progress', 'medium', '20000000-0000-0000-0000-000000000002',
   current_date, current_date + 9, false, false, null, null, 6, '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', null,
   'Service page copy', null, 'in_progress', 'medium', '20000000-0000-0000-0000-000000000003',
   current_date - 2, current_date - 1, false, true, null, null, 7, '20000000-0000-0000-0000-000000000001'),
  -- Build and Launch
  ('50000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', null,
   'Build HubSpot theme modules', null, 'not_started', 'medium', '20000000-0000-0000-0000-000000000002',
   current_date + 10, current_date + 25, false, false, null, null, 8, '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', null,
   '301 redirect map', null, 'not_started', 'high', '20000000-0000-0000-0000-000000000003',
   current_date + 20, current_date + 30, false, false, null, null, 9, '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', null,
   'Launch and QA', null, 'not_started', 'high', '20000000-0000-0000-0000-000000000001',
   current_date + 31, current_date + 40, false, true, null, null, 10, '20000000-0000-0000-0000-000000000001'),
  -- Subtasks
  ('50000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005',
   'Hero image options', null, 'complete', 'none', '20000000-0000-0000-0000-000000000002',
   null, current_date - 1, false, false, null, null, 1, '20000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005',
   'Mobile version', null, 'in_progress', 'none', '20000000-0000-0000-0000-000000000002',
   null, current_date + 1, false, false, null, null, 2, '20000000-0000-0000-0000-000000000002'),
  -- Content retainer
  ('50000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', null,
   'Blog: How often should you replace a toothbrush', null, 'in_review', 'medium', '20000000-0000-0000-0000-000000000002',
   current_date - 6, current_date + 1, false, true, null, null, 1, '20000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', null,
   'Blog: Invisalign vs braces cost guide', null, 'in_progress', 'medium', '20000000-0000-0000-0000-000000000001',
   current_date - 2, current_date + 6, false, false, null, null, 2, '20000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', null,
   'ROPS: Emergency dentist page', null, 'not_started', 'low', '20000000-0000-0000-0000-000000000003',
   current_date + 7, current_date + 14, false, false, null, null, 3, '20000000-0000-0000-0000-000000000002'),
  -- SEO program
  ('50000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000003', null, null,
   'Fix crawl errors from site audit', null, 'in_progress', 'high', '20000000-0000-0000-0000-000000000003',
   current_date - 5, current_date, false, false, null, null, 1, '20000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000003', null, null,
   'Monthly SEO and AEO report', null, 'not_started', 'medium', '20000000-0000-0000-0000-000000000001',
   current_date + 3, current_date + 4, false, false, null, null, 2, '20000000-0000-0000-0000-000000000003');

insert into task_dependencies (task_id, depends_on_id) values
  ('50000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000004'),
  ('50000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000005'),
  ('50000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000006'),
  ('50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000008'),
  ('50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000009');

insert into custom_fields (id, project_id, name, type, options, position) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Content type', 'select', '{Blog,ROPS,Webpage,Email}', 1),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Target keyword', 'text', '{}', 2),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Word count', 'number', '{}', 3);

insert into custom_field_values (task_id, field_id, value) values
  ('50000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000001', 'Blog'),
  ('50000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000002', 'replace toothbrush'),
  ('50000000-0000-0000-0000-000000000013', '60000000-0000-0000-0000-000000000003', '1200'),
  ('50000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000001', 'Blog'),
  ('50000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000002', 'invisalign cost'),
  ('50000000-0000-0000-0000-000000000015', '60000000-0000-0000-0000-000000000001', 'ROPS'),
  ('50000000-0000-0000-0000-000000000015', '60000000-0000-0000-0000-000000000002', 'emergency dentist');

insert into comments (task_id, author_id, body, is_internal, created_at) values
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'Both directions are in the Figma link. Option B tests better on mobile.', false, now() - interval '20 hours'),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001',
   'Push for B. If they want A we should flag the extra round of revisions.', true, now() - interval '18 hours'),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004',
   'Leaning B too. Can the hero be a little warmer? @[Jordan Reyes](20000000-0000-0000-0000-000000000002)', false, now() - interval '3 hours');

insert into time_entries (task_id, user_id, work_date, hours, note, billable) values
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', current_date - 2, 3.5, 'Comp option A', true),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', current_date - 1, 4, 'Comp option B', true),
  ('50000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000001', current_date, 2, 'Outline and research', true),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', current_date - 8, 1, 'Margin review', false);

insert into notifications (user_id, actor_id, task_id, kind, body, created_at) values
  ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002',
   'approved', 'approved "Sitemap and page inventory"', now() - interval '9 days'),
  ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000014',
   'assigned', 'assigned you "Blog: Invisalign vs braces cost guide"', now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000005',
   'comment', 'commented on "Homepage design comp"', now() - interval '3 hours'),
  ('20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005',
   'comment', 'commented on "Homepage design comp"', now() - interval '20 hours');
