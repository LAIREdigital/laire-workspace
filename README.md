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

## Set it up (about 10 minutes, once)

1. Create a new Google Sheet in Drive, name it **LAIRE Workspace Data**.
2. In the sheet: **Extensions > Apps Script**.
3. In the editor, replace the contents of `Code.gs` with [`dist/Code.gs`](dist/Code.gs).
4. Click **+ > HTML**, name it `Index` (no extension), and paste [`dist/Index.html`](dist/Index.html) into it.
5. **Project Settings** (gear icon): tick **Show "appsscript.json"**, then back in the editor replace
   `appsscript.json` with [`dist/appsscript.json`](dist/appsscript.json). Save.
6. Pick **setup** in the function menu at the top and click **Run**. Approve the Google permission
   prompts (it needs the sheet and a Drive folder for uploads). This creates the tabs.
7. Optional: run **loadDemoData** to see the app with sample projects. Only works on an empty sheet.
8. **Deploy > New deployment > Web app**. Execute as **Me**, Who has access **Anyone**. Deploy and copy the URL.
   That URL is the app. "Anyone" only reaches the sign in screen; the passwords guard the data.

**Updating later:** paste the new `dist` files, then **Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy**.
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
npm run build      # writes dist/Code.gs, dist/Index.html, dist/appsscript.json
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
dist/         build output, committed so it can be pasted into Apps Script
```

Commit `dist/` after `npm run build` so the files to paste are always current.
