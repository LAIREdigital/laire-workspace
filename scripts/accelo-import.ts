/**
 * One time import from Accelo into LAIRE Workspace.
 *
 *   Companies  -> companies
 *   Staff      -> LAIRE staff users (only @lairedigital.com addresses)
 *   Jobs       -> projects
 *   Milestones -> milestones
 *   Tasks      -> tasks
 *   Activities -> time entries (only ones logged against a task)
 *
 * Safe to re-run: every row is upserted on its accelo_id.
 *
 * Usage:
 *   npm run import:accelo -- --dry-run          fetch and report, write nothing
 *   npm run import:accelo                       fetch and write
 *   npm run import:accelo -- --from-dir ./dump  read <kind>.json files instead of the API
 *   npm run import:accelo -- --save-dir ./dump  also save what the API returned
 *
 * Env: ACCELO_DEPLOYMENT (the subdomain in <deployment>.accelo.com),
 *      ACCELO_CLIENT_ID, ACCELO_CLIENT_SECRET (a Service application in Accelo),
 *      NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Field names follow the Accelo v0 API docs. Run --dry-run first and check
 * the counts against Accelo before writing.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = flag("--dry-run");
const FROM_DIR = opt("--from-dir");
const SAVE_DIR = opt("--save-dir");

const FIELDS: Record<string, string> = {
  companies: "id,name,website",
  staff: "id,firstname,surname,email",
  jobs: "id,title,description,company,manager,standing,date_started,date_due",
  milestones: "id,title,job,parent,ordering,standing,date_started,date_due",
  tasks: "id,title,description,against_type,against_id,assignee,standing,date_started,date_due",
  activities: "id,subject,against_type,against_id,staff,billable,nonbillable,date_logged",
};

// ---------------------------------------------------------------------------
// Accelo
// ---------------------------------------------------------------------------

async function token(base: string) {
  const id = process.env.ACCELO_CLIENT_ID;
  const secret = process.env.ACCELO_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Set ACCELO_CLIENT_ID and ACCELO_CLIENT_SECRET");
  const res = await fetch(`${base}/oauth2/v0/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "read(all)" }),
  });
  if (!res.ok) throw new Error(`Accelo token request failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function fetchAll(kind: string, base: string, bearer: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let page = 0; ; page++) {
    const url = `${base}/api/v0/${kind}?_fields=${FIELDS[kind]}&_limit=100&_page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
    if (!res.ok) throw new Error(`Accelo ${kind} page ${page}: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { response?: Row[] };
    const rows = body.response ?? [];
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

async function load(): Promise<Record<string, Row[]>> {
  const data: Record<string, Row[]> = {};
  if (FROM_DIR) {
    for (const kind of Object.keys(FIELDS)) {
      const file = path.join(FROM_DIR, `${kind}.json`);
      data[kind] = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Row[]) : [];
    }
    return data;
  }
  const deployment = process.env.ACCELO_DEPLOYMENT;
  if (!deployment) throw new Error("Set ACCELO_DEPLOYMENT, or pass --from-dir");
  const base = `https://${deployment}.api.accelo.com`;
  const bearer = await token(base);
  for (const kind of Object.keys(FIELDS)) {
    data[kind] = await fetchAll(kind, base, bearer);
    console.log(`fetched ${data[kind].length} ${kind}`);
    if (SAVE_DIR) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
      fs.writeFileSync(path.join(SAVE_DIR, `${kind}.json`), JSON.stringify(data[kind], null, 2));
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

// Accelo dates are unix seconds; 0 means unset.
export function date(v: unknown): string | null {
  const n = num(v);
  if (!n) return null;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

export function projectStatus(standing: unknown) {
  switch (standing) {
    case "active":
      return "active";
    case "paused":
      return "on_hold";
    case "closed":
    case "inactive":
      return "complete";
    default:
      return "planned";
  }
}

export function taskStatus(standing: unknown) {
  switch (standing) {
    case "started":
      return "in_progress";
    case "complete":
    case "inactive":
      return "complete";
    default:
      return "not_started";
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function main() {
  const data = await load();
  console.log(
    Object.entries(data)
      .map(([k, v]) => `${k}: ${v.length}`)
      .join(", "),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!DRY && (!url || !key)) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const db = DRY ? null : createClient(url!, key!, { auth: { persistSession: false } });

  async function upsert(table: string, rows: Row[], conflict = "accelo_id") {
    if (!db || rows.length === 0) return new Map<number, string>();
    const ids = new Map<number, string>();
    for (let i = 0; i < rows.length; i += 500) {
      const { data: out, error } = await db
        .from(table)
        .upsert(rows.slice(i, i + 500), { onConflict: conflict })
        .select("id, accelo_id");
      if (error) throw new Error(`${table}: ${error.message}`);
      for (const r of out ?? []) ids.set(Number(r.accelo_id), r.id as string);
    }
    return ids;
  }

  // Staff. Only LAIRE addresses become users; Google SSO links on first login.
  const staffIds = new Map<number, string>();
  const laireStaff = data.staff.filter((s) => String(s.email ?? "").toLowerCase().endsWith("@lairedigital.com"));
  console.log(`staff: ${laireStaff.length} LAIRE accounts, ${data.staff.length - laireStaff.length} skipped`);
  for (const s of laireStaff) {
    if (!db) continue;
    const email = String(s.email).toLowerCase();
    const fullName = [str(s.firstname), str(s.surname)].filter(Boolean).join(" ") || null;
    let { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) {
      const { data: created, error } = await db.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw new Error(`staff ${email}: ${error.message}`);
      profile = { id: created.user.id };
    }
    await db.from("profiles").update({ accelo_staff_id: num(s.id), full_name: fullName }).eq("id", profile.id);
    staffIds.set(Number(s.id), profile.id);
  }
  const staff = (v: unknown) => staffIds.get(Number(v)) ?? null;

  // Companies
  const companyIds = await upsert(
    "companies",
    data.companies.map((c) => ({ accelo_id: num(c.id), name: str(c.name) ?? `Accelo company ${c.id}`, website: str(c.website) })),
  );

  // Projects (Accelo jobs). Jobs without a known company are reported, not imported.
  const jobs = data.jobs.filter((j) => DRY || companyIds.has(Number(j.company)));
  if (jobs.length < data.jobs.length) console.log(`jobs: ${data.jobs.length - jobs.length} skipped, no matching company`);
  const projectIds = await upsert(
    "projects",
    jobs.map((j) => ({
      accelo_id: num(j.id),
      company_id: companyIds.get(Number(j.company)),
      name: str(j.title) ?? `Accelo job ${j.id}`,
      description: str(j.description),
      status: projectStatus(j.standing),
      owner_id: staff(j.manager),
      start_date: date(j.date_started),
      due_date: date(j.date_due),
    })),
  );

  // Milestones. Nested Accelo milestones are flattened under their job.
  const milestones = data.milestones.filter((m) => DRY || projectIds.has(Number(m.job)));
  const milestoneIds = await upsert(
    "milestones",
    milestones.map((m) => ({
      accelo_id: num(m.id),
      project_id: projectIds.get(Number(m.job)),
      name: str(m.title) ?? `Milestone ${m.id}`,
      position: num(m.ordering) ?? 0,
      start_date: date(m.date_started),
      due_date: date(m.date_due),
    })),
  );
  const milestoneProject = new Map(milestones.map((m) => [Number(m.id), projectIds.get(Number(m.job))]));

  // Tasks against a job or a milestone. Everything else (tickets, retainers) is out of scope.
  const tasks = data.tasks
    .map((t) => {
      const against = Number(t.against_id);
      const onJob = t.against_type === "job";
      const onMilestone = t.against_type === "milestone";
      return {
        t,
        projectId: onJob ? projectIds.get(against) : onMilestone ? milestoneProject.get(against) : undefined,
        milestoneId: onMilestone ? milestoneIds.get(against) : null,
        inScope: onJob || onMilestone,
      };
    })
    .filter((x) => x.inScope && (DRY || x.projectId));
  console.log(`tasks: ${tasks.length} in scope, ${data.tasks.length - tasks.length} skipped`);
  // Imported work starts internal so nothing leaks to clients; staff choose
  // what to share. Re-runs leave that choice alone on tasks already imported.
  const existing = new Set<number>();
  if (db) {
    const acceloIds = tasks.map(({ t }) => Number(t.id));
    for (let i = 0; i < acceloIds.length; i += 500) {
      const { data: rows } = await db.from("tasks").select("accelo_id").in("accelo_id", acceloIds.slice(i, i + 500));
      (rows ?? []).forEach((r) => existing.add(Number(r.accelo_id)));
    }
  }
  const taskRows = tasks.map(({ t, projectId, milestoneId }) => ({
    accelo_id: num(t.id),
    project_id: projectId,
    milestone_id: milestoneId ?? null,
    title: str(t.title) ?? `Task ${t.id}`,
    description: str(t.description),
    status: taskStatus(t.standing),
    assignee_id: staff(t.assignee),
    start_date: date(t.date_started),
    due_date: date(t.date_due),
  }));
  const taskIds = new Map([
    ...(await upsert(
      "tasks",
      taskRows.filter((r) => !existing.has(Number(r.accelo_id))).map((r) => ({ ...r, is_internal: true })),
    )),
    ...(await upsert(
      "tasks",
      taskRows.filter((r) => existing.has(Number(r.accelo_id))),
    )),
  ]);

  // Time: activities logged against tasks, seconds to hours.
  const time = data.activities
    .filter((a) => a.against_type === "task" && (DRY || (taskIds.has(Number(a.against_id)) && staff(a.staff))))
    .flatMap((a) => {
      const billable = Number(a.billable ?? 0) / 3600;
      const non = Number(a.nonbillable ?? 0) / 3600;
      const base = {
        task_id: taskIds.get(Number(a.against_id)),
        user_id: staff(a.staff),
        work_date: date(a.date_logged) ?? new Date().toISOString().slice(0, 10),
        note: str(a.subject),
      };
      // accelo_id must be unique, so split entries get a negative id for the non billable half.
      return [
        billable > 0 ? { ...base, accelo_id: num(a.id), hours: Math.min(24, +billable.toFixed(2)), billable: true } : null,
        non > 0 ? { ...base, accelo_id: -Number(a.id), hours: Math.min(24, +non.toFixed(2)), billable: false } : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null && x.hours > 0);
    });
  console.log(`time entries: ${time.length}`);
  await upsert("time_entries", time);

  console.log(DRY ? "Dry run, nothing written." : "Import complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
