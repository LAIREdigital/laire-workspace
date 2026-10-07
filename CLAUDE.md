# LAIRE Workspace

@AGENTS.md

- Next.js 16 with breaking changes. Read `node_modules/next/dist/docs/` before using an API you are unsure of. `middleware` is now `src/proxy.ts`. Cache Components is off on purpose: every page is per user and dynamic.
- Access control lives in `supabase/migrations` as RLS. Any new table needs policies for staff and guests, plus a case in `supabase/tests/rls_test.sql`. Run `npm run test:db`.
- Reads go through `src/lib/data.ts` with the user's session. Writes go through `src/app/actions.ts` and re-check the caller. Never use the service role client in request code.
- Guests must never see internal tasks (or children of internal tasks), internal comments, time entries or invites.
- Brand tokens are in `src/app/globals.css`. Use them, not raw hex values.
- Writing style: no em dashes, no emojis, in code, comments, commits and docs.
