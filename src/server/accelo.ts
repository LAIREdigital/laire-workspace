import type { Person, Task } from "../shared/types";
import type { Env } from "./api";
import type { Row, Table } from "./schema";
import type { Store } from "./store";

/**
 * One time import from Accelo.
 *
 *   Companies  -> Companies
 *   Staff      -> People (staff, only @lairedigital.com addresses)
 *   Jobs       -> Projects
 *   Milestones -> Milestones
 *   Tasks      -> Tasks (against a job or milestone only)
 *   Activities -> Time (logged against a task)
 *
 * Re-running is safe: rows match on accelo_id. Imported tasks start internal
 * so nothing reaches a client until staff choose to share it, and a re-run
 * never changes that choice.
 */

export const ACCELO_FIELDS: Record<string, string> = {
  companies: "id,name,website",
  staff: "id,firstname,surname,email",
  jobs: "id,title,description,company,manager,standing,date_started,date_due",
  milestones: "id,title,job,parent,ordering,standing,date_started,date_due",
  tasks: "id,title,description,against_type,against_id,assignee,standing,date_started,date_due",
  activities: "id,subject,against_type,against_id,staff,billable,nonbillable,date_logged",
};

export type AcceloData = Record<keyof typeof ACCELO_FIELDS, Record<string, unknown>[]>;

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

// Accelo dates are unix seconds; 0 means unset.
export function acceloDate(v: unknown): string | null {
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

export function importAccelo(db: Store, env: Env, data: AcceloData, dryRun = false) {
  const report: string[] = [];
  const log = (s: string) => report.push(s);
  const now = env.now().toISOString();

  // Upsert on accelo_id. Returns accelo id -> our id.
  function upsert(table: Table, rows: Record<string, unknown>[], keepOnUpdate: string[] = []) {
    const existing = new Map(
      db
        .all<Row & { accelo_id: string | null }>(table)
        .filter((r) => r.accelo_id)
        .map((r) => [String(r.accelo_id), r]),
    );
    const ids = new Map<string, string>();
    let added = 0;
    let updated = 0;
    for (const row of rows) {
      const key = String(row.accelo_id);
      const cur = existing.get(key);
      if (cur) {
        const patch = { ...row };
        for (const k of keepOnUpdate) delete patch[k];
        if (!dryRun) db.update(table, cur.id, patch);
        ids.set(key, cur.id);
        updated++;
      } else {
        const id = env.uuid();
        if (!dryRun) db.insert(table, { ...row, id });
        ids.set(key, id);
        added++;
      }
    }
    log(`${table}: ${added} new, ${updated} updated`);
    return ids;
  }

  return db.locked(() => {
    // Staff: match existing people by email, else create.
    const people = db.all<Person & { accelo_id: string | null }>("People");
    const staffIds = new Map<string, string>();
    const laire = data.staff.filter((s) => String(s.email ?? "").toLowerCase().endsWith("@lairedigital.com"));
    log(`Staff: ${laire.length} LAIRE accounts, ${data.staff.length - laire.length} others skipped`);
    for (const s of laire) {
      const email = String(s.email).toLowerCase();
      const name = [str(s.firstname), str(s.surname)].filter(Boolean).join(" ") || email.split("@")[0];
      const match = people.find(
        (p) => p.role === "staff" && (p.email.toLowerCase() === email || p.accelo_id === String(s.id)),
      );
      if (match) {
        if (!dryRun) db.update("People", match.id, { accelo_id: String(s.id), email });
        staffIds.set(String(s.id), match.id);
      } else {
        const id = env.uuid();
        if (!dryRun) {
          db.insert("People", { id, name, email, role: "staff", company_id: "", accelo_id: String(s.id), created_at: now });
        }
        staffIds.set(String(s.id), id);
      }
    }
    const staff = (v: unknown) => staffIds.get(String(v)) ?? null;

    const companyIds = upsert(
      "Companies",
      data.companies.map((c) => ({
        accelo_id: String(c.id),
        name: str(c.name) ?? `Accelo company ${c.id}`,
        website: str(c.website) ?? "",
        created_at: now,
      })),
      ["created_at"],
    );

    const jobs = data.jobs.filter((j) => companyIds.has(String(j.company)));
    if (jobs.length < data.jobs.length) log(`Jobs: ${data.jobs.length - jobs.length} skipped, company not found`);
    const projectIds = upsert(
      "Projects",
      jobs.map((j) => ({
        accelo_id: String(j.id),
        company_id: companyIds.get(String(j.company)),
        name: str(j.title) ?? `Accelo job ${j.id}`,
        description: str(j.description),
        status: projectStatus(j.standing),
        color: "#8bd8d5",
        owner_id: staff(j.manager),
        start_date: acceloDate(j.date_started),
        due_date: acceloDate(j.date_due),
        created_at: now,
      })),
      ["color", "created_at"],
    );

    // Nested Accelo milestones are flattened under their job.
    const milestones = data.milestones.filter((m) => projectIds.has(String(m.job)));
    const milestoneIds = upsert(
      "Milestones",
      milestones.map((m) => ({
        accelo_id: String(m.id),
        project_id: projectIds.get(String(m.job)),
        name: str(m.title) ?? `Milestone ${m.id}`,
        position: num(m.ordering) ?? 0,
        start_date: acceloDate(m.date_started),
        due_date: acceloDate(m.date_due),
      })),
    );
    const milestoneProject = new Map(milestones.map((m) => [String(m.id), projectIds.get(String(m.job))]));

    const tasks = data.tasks
      .map((t) => {
        const against = String(t.against_id);
        const projectId =
          t.against_type === "job"
            ? projectIds.get(against)
            : t.against_type === "milestone"
              ? milestoneProject.get(against)
              : undefined;
        return { t, projectId, milestoneId: t.against_type === "milestone" ? milestoneIds.get(against) : null };
      })
      .filter((x) => x.projectId);
    log(`Tasks: ${tasks.length} in scope, ${data.tasks.length - tasks.length} skipped (tickets, retainers, unknown job)`);
    const taskIds = upsert(
      "Tasks",
      tasks.map(({ t, projectId, milestoneId }) => {
        const status = taskStatus(t.standing);
        return {
          accelo_id: String(t.id),
          project_id: projectId,
          milestone_id: milestoneId ?? null,
          parent_id: null,
          title: str(t.title) ?? `Task ${t.id}`,
          description: str(t.description),
          status,
          priority: "none",
          assignee_id: staff(t.assignee),
          start_date: acceloDate(t.date_started),
          due_date: acceloDate(t.date_due),
          completed_at: status === "complete" ? now : null,
          is_internal: true,
          needs_approval: false,
          position: num(t.id) ?? 0,
          created_at: now,
          updated_at: now,
        } satisfies Partial<Task> & Record<string, unknown>;
      }),
      ["is_internal", "needs_approval", "priority", "completed_at", "created_at", "position"],
    );

    // Activities: seconds to hours, split into billable and non billable rows.
    const time = data.activities
      .filter((a) => a.against_type === "task" && taskIds.has(String(a.against_id)) && staff(a.staff))
      .flatMap((a) => {
        const base = {
          task_id: taskIds.get(String(a.against_id)),
          user_id: staff(a.staff),
          work_date: acceloDate(a.date_logged) ?? now.slice(0, 10),
          note: str(a.subject),
        };
        const b = Number(a.billable ?? 0) / 3600;
        const n = Number(a.nonbillable ?? 0) / 3600;
        return [
          b > 0 ? { ...base, accelo_id: `${a.id}`, hours: Math.min(24, +b.toFixed(2)), billable: true } : null,
          n > 0 ? { ...base, accelo_id: `${a.id}-nb`, hours: Math.min(24, +n.toFixed(2)), billable: false } : null,
        ].filter((x) => x !== null && x.hours > 0) as Record<string, unknown>[];
      });
    upsert("Time", time);

    log(dryRun ? "Dry run, nothing written." : "Import complete.");
    return report;
  });
}
