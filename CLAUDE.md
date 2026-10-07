# LAIRE Workspace

- Google Apps Script web app. Server in `src/server` bundles to `dist/Code.gs`; browser app in `src/client` bundles to one `dist/Index.html`. Data lives in a Google Sheet, one tab per table (`src/server/schema.ts`).
- All access rules live in `src/server/api.ts`. Every method takes the session token first and checks it. Guests must never see internal tasks (or children of internal tasks), internal comments, time, other companies, or other people's emails. Add a test in `tests/api.test.ts` for any new rule.
- New browser callable methods go in `PUBLIC_METHODS`. Anything not listed is refused.
- Adding a column: add it to `SCHEMA` at the end of the tab. `setup()` rewrites headers. Never reorder existing columns, live sheets depend on positions.
- After changing code: `npm run lint && npm run typecheck && npm run build && npm test`, then commit `dist/`.
- Brand tokens are in `src/client/styles.css`. Use them, not raw hex values.
- Writing style: no em dashes, no emojis, in code, comments, commits and docs.
