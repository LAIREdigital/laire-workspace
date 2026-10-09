# LAIRE Workspace

Project and task management for LAIRE and its clients. Asana style views,
LAIRE branding, Accelo shaped data. Runs as a Google Apps Script web app with
the data in a Google Sheet. No servers, no other accounts.

- **Structure:** Company > Project > Milestone > Task > Subtask, same as Accelo.
- **Views:** List, Board (drag between statuses), Calendar, Timeline (Gantt with dependencies).
- **Sign in:** staff use the team password (default `LAIRE2026!`) and pick their name.
  Each client company gets its own password; clients enter their name and see only their own projects.
- **Clients** can comment and approve. They never see internal tasks (or their subtasks), internal comments, or time.
- **Also:** My Tasks, Inbox (assignments, comments, @mentions, approvals), custom fields, file uploads (saved to a Drive folder), time tracking.

## Set it up (5 minutes, once)

The data sheet already exists: [LAIRE Workspace](https://docs.google.com/spreadsheets/d/1pmKijX-sFLNqjs_JHaJI4e-OLbYv9eJmNtPmTnzfIvg/edit).

1. Open the sheet, then **Extensions > Apps Script**.
2. Delete what is in `Code.gs` and paste all of [`dist/Code.gs`](dist/Code.gs). Click **Save**.
3. **Deploy > New deployment**. Click the gear next to "Select type", pick **Web app**.
   Execute as **Me**, Who has access **Anyone**. Click **Deploy** and approve the Google permission prompts.
4. Open the **Web app URL** it shows. That is the app. Sign in with `LAIRE2026!` and type your name.

The sheet sets itself up on first open (tabs, file folder). "Anyone" only reaches the sign in
screen; the passwords guard the data. Optional: run **loadDemoData** from the editor to see sample projects (empty sheet only).

**Updating later:** paste the new `dist/Code.gs`, then **Deploy > Manage deployments > pencil > Version: New version > Deploy**.
The URL stays the same.

## Running it

- **Team password:** Project Settings > Script Properties > `STAFF_PASSWORD`. Change it there any time.
- **Client access:** open the company in the app, set a password under Client access, send the client the app URL and the password.
  Turning it off signs that client out.
- **The sheet is the database.** Read it freely. Avoid editing or sorting tabs by hand while people use the app;
  never rename tabs or header cells. The `Sessions` tab is hidden on purpose.
- **Files** land in a Drive folder called *LAIRE Workspace Files*, owned by whoever deployed. Uploads max out at 10 MB.

## Accelo import

1. In Accelo create a Service application to get a client id and secret.
2. Script Properties: add `ACCELO_DEPLOYMENT` (the part before `.accelo.com`), `ACCELO_CLIENT_ID`, `ACCELO_CLIENT_SECRET`.
3. Run **acceloDryRun**, check the counts in the log, then run **acceloImport**.

Companies, LAIRE staff, jobs (as projects), milestones, tasks and time come over. Safe to re-run.
Imported tasks start internal; staff untick "Internal only" on what clients should see. Tickets and retainer work are skipped.

## Development

```bash
npm install
npm run build      # writes dist/Code.gs, the only file Apps Script needs
npm run dev        # preview at http://localhost:8787 with demo data, password LAIRE2026!
npm test           # server logic, Accelo mapping, and the built Code.gs against fake Google services
npm run e2e        # browser walkthrough against npm run dev
npm run lint && npm run typecheck
```

```
src/server/   API, permissions, Sheet storage, Accelo import, Apps Script entry points
src/client/   React app, bundled into one HTML file
src/shared/   types used by both
dev/          preview server and fake Google services
tests/        unit, Code.gs and browser tests
dist/         Code.gs, committed so it can be pasted into Apps Script
```

Commit `dist/` after `npm run build` so the file to paste is always current.
