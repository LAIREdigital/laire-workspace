# LAIRE Workspace

Project and task management for LAIRE and its clients. Asana style views,
LAIRE branding, Accelo shaped data.

- **Structure:** Company > Project > Milestone > Task > Subtask, same as Accelo.
- **Views:** List, Board (drag between statuses), Calendar, Timeline (Gantt with dependencies).
- **People:** LAIRE staff sign in with Google. Client guests are invite only and sign in with a magic link.
- **Guests** see their own company's projects, can comment and approve. They never see internal tasks, internal comments or time.
- **Also:** My Tasks, Inbox (assignments, comments, @mentions, approvals), custom fields per project, file attachments, time tracking (hours, note, billable).

Stack: Next.js 16 on Vercel, Supabase (Postgres, Auth, Storage). Access rules live in
the database as row level security, so the UI cannot leak what the database will not return.

## Setup

1. **Supabase project.** Create one, then run `supabase/migrations/0001_init.sql`
   in the SQL editor (or `supabase db push`). It creates the tables, security
   rules, triggers and the private `attachments` storage bucket.
2. **Google sign in.** Authentication > Providers > Google. Use a Google Cloud
   OAuth client on the lairedigital.com Workspace, set to Internal.
3. **Magic links.** Authentication > Providers > Email stays on. Under
   Authentication > URL Configuration set the Site URL to the Vercel URL and add
   `https://YOUR-DOMAIN/auth/callback` to the redirect URLs.
4. **Vercel.** Import this repo and set the variables from `.env.example`.
5. **First login.** Any `@lairedigital.com` Google account becomes staff on first
   sign in. Anyone else needs an invite (Company page > Invite a client user).

## Accelo import

One time copy of companies, LAIRE staff, jobs (projects), milestones, tasks and
time. Create a Service application in Accelo for the client id and secret.

```bash
npm run import:accelo -- --dry-run            # counts only, writes nothing
npm run import:accelo -- --save-dir ./accelo  # import and keep the raw JSON
```

- Safe to re-run: rows upsert on `accelo_id`.
- Imported tasks start **internal**. Staff untick "Internal only" on what clients should see.
- Only `@lairedigital.com` staff are imported. Tickets and retainer work are skipped.
- Field names follow the Accelo v0 API docs. Check the dry run counts against Accelo first.

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

Checks to run before pushing:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:db   # needs a local Postgres superuser (PGHOST, PGPORT, PGUSER)
```

`test:db` applies the migration to a throwaway database with stand-ins for
Supabase's `auth` and `storage` schemas, then checks the access rules: invite
only signup, guest isolation, hidden internal work, approvals and
notifications. `supabase/seed.sql` loads demo data for local work. Never run it
against production.

## Layout

```
src/app/(app)/          signed in pages: my-tasks, inbox, time, companies, projects
src/app/actions.ts      every write, as Server Actions
src/components/views/   list, board, calendar, timeline, project settings
src/components/task-*   task detail panel
src/lib/data.ts         reads (all through the user's session, so RLS applies)
src/proxy.ts            session refresh and sign in redirect
supabase/migrations/    schema, RLS, triggers
supabase/tests/         RLS tests
scripts/accelo-import.ts
```

Brand: plum `#3d3642`, coral `#ff8b71`, teal `#8bd8d5`, olive `#b4bb65`, sky
`#81b5c6`, Montserrat headings, Lato body, from lairedigital.com.
