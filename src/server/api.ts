import type {
  Attachment,
  Comment,
  Company,
  CustomField,
  Dependency,
  FieldValue,
  Milestone,
  Notification,
  Person,
  Priority,
  Project,
  ProjectStatus,
  Snapshot,
  Task,
  TaskStatus,
  TimeEntry,
} from "../shared/types";
import type { Store } from "./store";

// Platform services the API needs. Apps Script and the Node test harness each
// provide their own.
export interface Env {
  now(): Date;
  uuid(): string;
  sha256(s: string): string;
  staffPassword(): string;
  sleep(ms: number): void;
  files: {
    save(name: string, type: string, base64: string): string;
    read(fileId: string): string;
    remove(fileId: string): void;
  };
}

type CompanyRow = Omit<Company, "has_client_password"> & { password_hash: string; created_at: string };
type SessionRow = { id: string; person_id: string; role: string; company_id: string; expires_at: string };
type Ctx = { me: Person; staff: boolean };

const SESSION_DAYS = 30;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const STATUSES: TaskStatus[] = ["not_started", "in_progress", "in_review", "complete"];
const PRIORITIES: Priority[] = ["none", "low", "medium", "high"];
const PROJECT_STATUSES: ProjectStatus[] = ["planned", "active", "on_hold", "complete"];
const MENTION = /@\[[^\]]*\]\(([0-9a-f-]{36})\)/g;

export class ApiError extends Error {}

const fail = (msg: string): never => {
  throw new ApiError(msg);
};
const clean = (s: unknown) => {
  const v = typeof s === "string" ? s.trim() : "";
  return v === "" ? null : v;
};
const isDate = (s: unknown) => s === null || (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s));

export class Api {
  constructor(
    private db: Store,
    private env: Env,
  ) {}

  private iso() {
    return this.env.now().toISOString();
  }

  // -------------------------------------------------------------------------
  // Sign in
  // -------------------------------------------------------------------------

  private companyForPassword(password: string): CompanyRow | null {
    for (const c of this.db.all<CompanyRow>("Companies")) {
      if (c.password_hash && c.password_hash === this.env.sha256(`${c.id}:${password}`)) return c;
    }
    return null;
  }

  private passwordKind(password: string) {
    if (password && password === this.env.staffPassword()) return { kind: "staff" as const };
    const company = password ? this.companyForPassword(password) : null;
    if (company) return { kind: "client" as const, company };
    // Slow down guessing.
    this.env.sleep(1500);
    return fail("That password did not work.");
  }

  checkPassword(password: string) {
    const r = this.passwordKind(password);
    if (r.kind === "staff") {
      const staff = this.db
        .all<Person>("People")
        .filter((p) => p.role === "staff")
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { kind: "staff" as const, staff };
    }
    return { kind: "client" as const, company: r.company.name };
  }

  login(password: string, identity: { personId?: string; name?: string; email?: string }) {
    return this.db.locked(() => {
      const r = this.passwordKind(password);
      const name = clean(identity.name);
      const email = (clean(identity.email) ?? "").toLowerCase();
      const people = this.db.all<Person>("People");
      let person: Person | undefined;

      if (r.kind === "staff") {
        if (identity.personId) {
          person = people.find((p) => p.id === identity.personId && p.role === "staff");
          if (!person) fail("Pick your name from the list.");
        } else {
          if (!name) fail("Enter your name.");
          person = people.find((p) => p.role === "staff" && p.name.toLowerCase() === name!.toLowerCase());
          if (!person) {
            person = { id: this.env.uuid(), name: name!, email, role: "staff", company_id: "" };
            this.db.insert("People", { ...person, created_at: this.iso() });
          }
        }
      } else {
        if (!name) fail("Enter your name.");
        const companyId = r.company.id;
        person = people.find(
          (p) =>
            p.role === "guest" &&
            p.company_id === companyId &&
            ((email && p.email.toLowerCase() === email) || p.name.toLowerCase() === name!.toLowerCase()),
        );
        if (!person) {
          person = { id: this.env.uuid(), name: name!, email, role: "guest", company_id: companyId };
          this.db.insert("People", { ...person, created_at: this.iso() });
        }
      }

      const token = this.env.uuid() + this.env.uuid();
      const expires = new Date(this.env.now().getTime() + SESSION_DAYS * 86400000).toISOString();
      // Drop this person's expired sessions while we are here.
      const now = this.iso();
      this.db.remove(
        "Sessions",
        this.db
          .all<SessionRow>("Sessions")
          .filter((s) => s.expires_at < now)
          .map((s) => s.id),
      );
      this.db.insert("Sessions", {
        id: token,
        person_id: person!.id,
        role: person!.role,
        company_id: person!.company_id,
        expires_at: expires,
      });
      return { token };
    });
  }

  logout(token: string) {
    this.db.locked(() => this.db.remove("Sessions", [token]));
    return { ok: true };
  }

  // Resolves a token into the caller. Every API call goes through this.
  context(token: string): Ctx {
    if (!token) fail("Signed out");
    const s = this.db.all<SessionRow>("Sessions").find((x) => x.id === token);
    if (!s || s.expires_at < this.iso()) fail("Signed out");
    const me = this.db.all<Person>("People").find((p) => p.id === s!.person_id);
    if (!me) fail("Signed out");
    // A guest whose company was deleted, or whose role changed, is signed out.
    if (me!.role !== s!.role || me!.company_id !== s!.company_id) fail("Signed out");
    return { me: me!, staff: me!.role === "staff" };
  }

  private staffOnly(ctx: Ctx) {
    if (!ctx.staff) fail("Only LAIRE staff can do that.");
  }

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  private visibleTaskIds(ctx: Ctx, tasks: Task[], projects: Project[]) {
    if (ctx.staff) return new Set(tasks.map((t) => t.id));
    const myProjects = new Set(projects.filter((p) => p.company_id === ctx.me.company_id).map((p) => p.id));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    // A task is visible if its project is theirs and no task in its parent
    // chain (itself included) is internal.
    const ok = (t: Task): boolean => {
      if (!myProjects.has(t.project_id)) return false;
      const seen = new Set<string>();
      let cur: Task | undefined = t;
      while (cur) {
        if (cur.is_internal || seen.has(cur.id)) return false;
        seen.add(cur.id);
        if (!cur.parent_id) return true;
        cur = byId.get(cur.parent_id);
      }
      return false;
    };
    return new Set(tasks.filter(ok).map((t) => t.id));
  }

  private canSeeTask(ctx: Ctx, taskId: string) {
    const tasks = this.db.all<Task>("Tasks");
    const projects = this.db.all<Project>("Projects");
    return this.visibleTaskIds(ctx, tasks, projects).has(taskId);
  }

  snapshot(token: string): Snapshot {
    const ctx = this.context(token);
    const { me, staff } = ctx;
    const companiesAll = this.db.all<CompanyRow>("Companies");
    const projectsAll = this.db.all<Project>("Projects");
    const tasksAll = this.db.all<Task>("Tasks");
    const visible = this.visibleTaskIds(ctx, tasksAll, projectsAll);
    const companies = companiesAll
      .filter((c) => staff || c.id === me.company_id)
      .map((c) => ({ id: c.id, name: c.name, website: c.website, has_client_password: staff && !!c.password_hash }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const projects = projectsAll
      .filter((p) => staff || p.company_id === me.company_id)
      .sort((a, b) => a.name.localeCompare(b.name));
    const projectIds = new Set(projects.map((p) => p.id));
    const company = companiesAll.find((c) => c.id === me.company_id);
    const people = this.db
      .all<Person>("People")
      .filter((p) => staff || p.role === "staff" || p.company_id === me.company_id)
      .map((p) => (staff || p.id === me.id ? p : { ...p, email: "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

    return {
      me: { ...me, company_name: company?.name ?? "LAIRE" },
      companies,
      people,
      projects,
      milestones: this.db
        .all<Milestone>("Milestones")
        .filter((m) => projectIds.has(m.project_id))
        .sort(byPosition),
      tasks: tasksAll.filter((t) => visible.has(t.id)).sort(byPosition),
      dependencies: this.db
        .all<Dependency>("Dependencies")
        .filter((d) => visible.has(d.task_id) && visible.has(d.depends_on_id)),
      comments: this.db
        .all<Comment>("Comments")
        .filter((c) => visible.has(c.task_id) && (staff || !c.is_internal))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      attachments: this.db.all<Attachment>("Attachments").filter((a) => visible.has(a.task_id)),
      fields: this.db
        .all<CustomField>("Fields")
        .filter((f) => projectIds.has(f.project_id))
        .sort(byPosition),
      values: this.db.all<FieldValue>("FieldValues").filter((v) => visible.has(v.task_id)),
      time: staff ? this.db.all<TimeEntry>("Time") : [],
      notifications: this.db
        .all<Notification>("Notifications")
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.user_id === me.id && (!n.task_id || visible.has(n.task_id) || staff))
        // Newest first; rows written in the same millisecond keep write order.
        .sort((a, b) => b.n.created_at.localeCompare(a.n.created_at) || b.i - a.i)
        .slice(0, 100)
        .map(({ n }) => n),
    };
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  private notify(recipient: string | null, actor: string | null, task: Task, kind: string, body: string) {
    if (!recipient || !actor || recipient === actor) return;
    const person = this.db.all<Person>("People").find((p) => p.id === recipient);
    if (!person) return;
    // Never tell a guest about work they cannot see.
    if (person.role === "guest" && !this.canSeeTask({ me: person, staff: false }, task.id)) return;
    this.db.insert("Notifications", {
      id: this.env.uuid(),
      user_id: recipient,
      actor_id: actor,
      task_id: task.id,
      kind,
      body,
      read_at: null,
      created_at: this.iso(),
    });
  }

  // -------------------------------------------------------------------------
  // Mutations. Each runs under the write lock and returns a fresh snapshot.
  // -------------------------------------------------------------------------

  private write(token: string, fn: (ctx: Ctx) => void): Snapshot {
    this.db.locked(() => fn(this.context(token)));
    return this.snapshot(token);
  }

  private task(id: string) {
    return this.db.all<Task>("Tasks").find((t) => t.id === id) ?? fail("Task not found");
  }

  createCompany(token: string, input: { name: string; website?: string }) {
    let id = "";
    const snap = this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const name = clean(input.name) ?? fail("Name is required");
      id = this.env.uuid();
      this.db.insert("Companies", {
        id,
        name,
        website: clean(input.website) ?? "",
        password_hash: "",
        accelo_id: null,
        created_at: this.iso(),
      });
    });
    return { ...snap, createdId: id };
  }

  updateCompany(token: string, id: string, patch: { name?: string; website?: string }) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const p: Record<string, unknown> = {};
      if (patch.name !== undefined) p.name = clean(patch.name) ?? fail("Name is required");
      if (patch.website !== undefined) p.website = clean(patch.website) ?? "";
      this.db.update("Companies", id, p);
    });
  }

  setClientPassword(token: string, companyId: string, password: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const pw = password ?? "";
      if (pw === "") {
        this.db.update("Companies", companyId, { password_hash: "" });
        // Turning the password off signs that company's guests out.
        this.db.remove(
          "Sessions",
          this.db
            .all<SessionRow>("Sessions")
            .filter((s) => s.company_id === companyId)
            .map((s) => s.id),
        );
        return;
      }
      if (pw.length < 8) fail("Use at least 8 characters.");
      if (pw === this.env.staffPassword()) fail("That is the staff password. Pick a different one.");
      const clash = this.companyForPassword(pw);
      if (clash && clash.id !== companyId) fail("Another company already uses that password.");
      this.db.update("Companies", companyId, { password_hash: this.env.sha256(`${companyId}:${pw}`) });
    });
  }

  addStaff(token: string, input: { name: string; email?: string }) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const name = clean(input.name) ?? fail("Name is required");
      if (this.db.all<Person>("People").some((p) => p.role === "staff" && p.name.toLowerCase() === name.toLowerCase())) {
        fail("Someone with that name already exists.");
      }
      this.db.insert("People", {
        id: this.env.uuid(),
        name,
        email: (clean(input.email) ?? "").toLowerCase(),
        role: "staff",
        company_id: "",
        accelo_id: null,
        created_at: this.iso(),
      });
    });
  }

  createProject(
    token: string,
    input: { companyId: string; name: string; description?: string; startDate?: string; dueDate?: string },
  ) {
    let id = "";
    const snap = this.write(token, (ctx) => {
      this.staffOnly(ctx);
      if (!this.db.all<CompanyRow>("Companies").some((c) => c.id === input.companyId)) fail("Company not found");
      const name = clean(input.name) ?? fail("Name is required");
      id = this.env.uuid();
      this.db.insert("Projects", {
        id,
        company_id: input.companyId,
        name,
        description: clean(input.description),
        status: "active",
        color: "#ff8b71",
        owner_id: ctx.me.id,
        start_date: clean(input.startDate),
        due_date: clean(input.dueDate),
        accelo_id: null,
        created_at: this.iso(),
      });
    });
    return { ...snap, createdId: id };
  }

  updateProject(token: string, id: string, patch: Partial<Project>) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const p: Record<string, unknown> = {};
      if ("name" in patch) p.name = clean(patch.name) ?? fail("Name is required");
      if ("description" in patch) p.description = clean(patch.description);
      if ("status" in patch) p.status = PROJECT_STATUSES.includes(patch.status!) ? patch.status : fail("Bad status");
      if ("color" in patch) p.color = /^#[0-9a-f]{6}$/i.test(String(patch.color)) ? patch.color : fail("Bad color");
      if ("owner_id" in patch) p.owner_id = patch.owner_id || null;
      for (const k of ["start_date", "due_date"] as const) {
        if (k in patch) p[k] = isDate(patch[k] || null) ? patch[k] || null : fail("Bad date");
      }
      this.db.update("Projects", id, p);
    });
  }

  deleteProject(token: string, id: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const taskIds = this.db
        .all<Task>("Tasks")
        .filter((t) => t.project_id === id)
        .map((t) => t.id);
      this.removeTasks(taskIds);
      this.db.remove(
        "Milestones",
        this.db
          .all<Milestone>("Milestones")
          .filter((m) => m.project_id === id)
          .map((m) => m.id),
      );
      const fieldIds = this.db
        .all<CustomField>("Fields")
        .filter((f) => f.project_id === id)
        .map((f) => f.id);
      this.db.remove("Fields", fieldIds);
      this.db.remove("Projects", [id]);
    });
  }

  createMilestone(token: string, projectId: string, input: { name: string; startDate?: string; dueDate?: string }) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const name = clean(input.name) ?? fail("Name is required");
      const count = this.db.all<Milestone>("Milestones").filter((m) => m.project_id === projectId).length;
      this.db.insert("Milestones", {
        id: this.env.uuid(),
        project_id: projectId,
        name,
        start_date: clean(input.startDate),
        due_date: clean(input.dueDate),
        position: count,
        accelo_id: null,
      });
    });
  }

  updateMilestone(token: string, id: string, patch: Partial<Milestone>) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const p: Record<string, unknown> = {};
      if ("name" in patch) p.name = clean(patch.name) ?? fail("Name is required");
      for (const k of ["start_date", "due_date"] as const) {
        if (k in patch) p[k] = isDate(patch[k] || null) ? patch[k] || null : fail("Bad date");
      }
      this.db.update("Milestones", id, p);
    });
  }

  deleteMilestone(token: string, id: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      for (const t of this.db.all<Task>("Tasks").filter((t) => t.milestone_id === id)) {
        this.db.update("Tasks", t.id, { milestone_id: null });
      }
      this.db.remove("Milestones", [id]);
    });
  }

  createTask(
    token: string,
    input: {
      projectId: string;
      title: string;
      milestoneId?: string | null;
      parentId?: string | null;
      status?: TaskStatus;
      dueDate?: string | null;
    },
  ) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const title = clean(input.title) ?? fail("Title is required");
      if (!this.db.all<Project>("Projects").some((p) => p.id === input.projectId)) fail("Project not found");
      const now = this.iso();
      this.db.insert("Tasks", {
        id: this.env.uuid(),
        project_id: input.projectId,
        milestone_id: input.milestoneId ?? null,
        parent_id: input.parentId ?? null,
        title,
        description: null,
        status: input.status && STATUSES.includes(input.status) ? input.status : "not_started",
        priority: "none",
        assignee_id: null,
        start_date: null,
        due_date: input.dueDate ?? null,
        completed_at: input.status === "complete" ? now : null,
        is_internal: false,
        needs_approval: false,
        approved_at: null,
        approved_by: null,
        position: this.env.now().getTime(),
        created_by: ctx.me.id,
        accelo_id: null,
        created_at: now,
        updated_at: now,
      });
    });
  }

  updateTask(token: string, id: string, patch: Partial<Task>) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const old = this.task(id);
      const p: Record<string, unknown> = { updated_at: this.iso() };
      if ("title" in patch) p.title = clean(patch.title) ?? fail("Title is required");
      if ("description" in patch) p.description = clean(patch.description);
      if ("status" in patch) {
        if (!STATUSES.includes(patch.status!)) fail("Bad status");
        p.status = patch.status;
        if (patch.status === "complete" && old.status !== "complete") p.completed_at = this.iso();
        if (patch.status !== "complete") p.completed_at = null;
      }
      if ("priority" in patch) p.priority = PRIORITIES.includes(patch.priority!) ? patch.priority : fail("Bad priority");
      if ("assignee_id" in patch) p.assignee_id = patch.assignee_id || null;
      if ("milestone_id" in patch) p.milestone_id = patch.milestone_id || null;
      for (const k of ["start_date", "due_date"] as const) {
        if (k in patch) p[k] = isDate(patch[k] || null) ? patch[k] || null : fail("Bad date");
      }
      if ("is_internal" in patch) p.is_internal = !!patch.is_internal;
      if ("needs_approval" in patch) {
        p.needs_approval = !!patch.needs_approval;
        if (!patch.needs_approval) {
          p.approved_at = null;
          p.approved_by = null;
        }
      }
      if ("position" in patch) p.position = Number(patch.position);
      this.db.update("Tasks", id, p);

      const updated = this.task(id);
      if (updated.assignee_id && updated.assignee_id !== old.assignee_id) {
        this.notify(updated.assignee_id, ctx.me.id, updated, "assigned", `assigned you "${updated.title}"`);
      }
      if (updated.status === "complete" && old.status !== "complete") {
        this.notify(updated.created_by, ctx.me.id, updated, "completed", `completed "${updated.title}"`);
      }
    });
  }

  // Removes tasks with their subtasks and everything hanging off them.
  private removeTasks(ids: string[]) {
    const all = this.db.all<Task>("Tasks");
    const doomed = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of all) {
        if (t.parent_id && doomed.has(t.parent_id) && !doomed.has(t.id)) {
          doomed.add(t.id);
          grew = true;
        }
      }
    }
    const hits = <T extends { id: string }>(table: Parameters<Store["all"]>[0], key: keyof T) =>
      this.db
        .all<T>(table)
        .filter((r) => doomed.has(String(r[key])))
        .map((r) => r.id);
    for (const a of this.db.all<Attachment & { file_id: string }>("Attachments").filter((a) => doomed.has(a.task_id))) {
      try {
        this.env.files.remove(a.file_id);
      } catch {
        // The file may already be gone from Drive.
      }
    }
    this.db.remove("Attachments", hits<Attachment>("Attachments", "task_id"));
    this.db.remove("Comments", hits<Comment>("Comments", "task_id"));
    this.db.remove("Time", hits<TimeEntry>("Time", "task_id"));
    this.db.remove("FieldValues", hits<FieldValue>("FieldValues", "task_id"));
    this.db.remove("Notifications", hits<Notification>("Notifications", "task_id"));
    this.db.remove(
      "Dependencies",
      this.db
        .all<Dependency>("Dependencies")
        .filter((d) => doomed.has(d.task_id) || doomed.has(d.depends_on_id))
        .map((d) => d.id),
    );
    this.db.remove("Tasks", [...doomed]);
  }

  deleteTask(token: string, id: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      this.removeTasks([id]);
    });
  }

  approveTask(token: string, id: string) {
    return this.write(token, (ctx) => {
      if (!this.canSeeTask(ctx, id)) fail("Task not found");
      const t = this.task(id);
      if (!t.needs_approval) fail("This task does not need approval");
      if (t.approved_at) return;
      this.db.update("Tasks", id, { approved_at: this.iso(), approved_by: ctx.me.id, updated_at: this.iso() });
      this.notify(t.assignee_id, ctx.me.id, t, "approved", `approved "${t.title}"`);
      if (t.created_by !== t.assignee_id) this.notify(t.created_by, ctx.me.id, t, "approved", `approved "${t.title}"`);
    });
  }

  addDependency(token: string, taskId: string, dependsOnId: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      if (taskId === dependsOnId) fail("A task cannot wait on itself");
      const deps = this.db.all<Dependency>("Dependencies");
      if (deps.some((d) => d.task_id === taskId && d.depends_on_id === dependsOnId)) return;
      // Refuse cycles: walk what dependsOnId already waits on, looking for taskId.
      const queue = [dependsOnId];
      const seen = new Set(queue);
      while (queue.length) {
        const cur = queue.shift()!;
        for (const d of deps.filter((x) => x.task_id === cur)) {
          if (d.depends_on_id === taskId) fail("That would create a loop of tasks waiting on each other");
          if (!seen.has(d.depends_on_id)) {
            seen.add(d.depends_on_id);
            queue.push(d.depends_on_id);
          }
        }
      }
      this.db.insert("Dependencies", { id: this.env.uuid(), task_id: taskId, depends_on_id: dependsOnId });
    });
  }

  removeDependency(token: string, taskId: string, dependsOnId: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      this.db.remove(
        "Dependencies",
        this.db
          .all<Dependency>("Dependencies")
          .filter((d) => d.task_id === taskId && d.depends_on_id === dependsOnId)
          .map((d) => d.id),
      );
    });
  }

  createField(token: string, projectId: string, input: { name: string; type: string; options?: string }) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const name = clean(input.name) ?? fail("Name is required");
      if (!["text", "number", "select", "date"].includes(input.type)) fail("Bad field type");
      const options =
        input.type === "select"
          ? (input.options ?? "")
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : [];
      if (input.type === "select" && options.length === 0) fail("Add at least one option");
      this.db.insert("Fields", {
        id: this.env.uuid(),
        project_id: projectId,
        name,
        type: input.type,
        options,
        position: this.env.now().getTime(),
      });
    });
  }

  deleteField(token: string, id: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      this.db.remove(
        "FieldValues",
        this.db
          .all<FieldValue>("FieldValues")
          .filter((v) => v.field_id === id)
          .map((v) => v.id),
      );
      this.db.remove("Fields", [id]);
    });
  }

  setFieldValue(token: string, taskId: string, fieldId: string, value: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const id = `${taskId}:${fieldId}`;
      const v = clean(value);
      const exists = this.db.all<FieldValue>("FieldValues").some((x) => x.id === id);
      if (!v) this.db.remove("FieldValues", [id]);
      else if (exists) this.db.update("FieldValues", id, { value: v });
      else this.db.insert("FieldValues", { id, task_id: taskId, field_id: fieldId, value: v });
    });
  }

  addComment(token: string, taskId: string, body: string, isInternal: boolean) {
    return this.write(token, (ctx) => {
      if (!this.canSeeTask(ctx, taskId)) fail("Task not found");
      const text = clean(body) ?? fail("Write something first");
      const internal = ctx.staff ? !!isInternal : false;
      const t = this.task(taskId);
      this.db.insert("Comments", {
        id: this.env.uuid(),
        task_id: taskId,
        author_id: ctx.me.id,
        body: text,
        is_internal: internal,
        created_at: this.iso(),
      });
      const people = this.db.all<Person>("People");
      const mentioned = new Set([...text.matchAll(MENTION)].map((m) => m[1]));
      for (const id of mentioned) {
        const who = people.find((p) => p.id === id);
        if (!who || (internal && who.role !== "staff")) continue;
        this.notify(id, ctx.me.id, t, "mention", `mentioned you on "${t.title}"`);
      }
      const isStaff = (id: string | null) => people.find((p) => p.id === id)?.role === "staff";
      const verb = internal ? `left an internal note on "${t.title}"` : `commented on "${t.title}"`;
      for (const r of new Set([t.assignee_id, t.created_by])) {
        if (!r || mentioned.has(r) || (internal && !isStaff(r))) continue;
        this.notify(r, ctx.me.id, t, "comment", verb);
      }
    });
  }

  deleteComment(token: string, id: string) {
    return this.write(token, (ctx) => {
      const c = this.db.all<Comment>("Comments").find((x) => x.id === id) ?? fail("Comment not found");
      if (c.author_id !== ctx.me.id) fail("You can only delete your own comments.");
      this.db.remove("Comments", [id]);
    });
  }

  logTime(token: string, taskId: string, input: { date: string; hours: number; note?: string; billable: boolean }) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const hours = Number(input.hours);
      if (!(hours > 0 && hours <= 24)) fail("Hours must be between 0 and 24");
      if (!isDate(input.date)) fail("Bad date");
      this.task(taskId);
      this.db.insert("Time", {
        id: this.env.uuid(),
        task_id: taskId,
        user_id: ctx.me.id,
        work_date: input.date,
        hours,
        note: clean(input.note),
        billable: !!input.billable,
        accelo_id: null,
      });
    });
  }

  deleteTime(token: string, id: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const e = this.db.all<TimeEntry>("Time").find((x) => x.id === id) ?? fail("Entry not found");
      if (e.user_id !== ctx.me.id) fail("You can only remove your own time.");
      this.db.remove("Time", [id]);
    });
  }

  uploadAttachment(token: string, taskId: string, file: { name: string; type: string; base64: string }) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      this.task(taskId);
      const size = Math.floor((file.base64.length * 3) / 4);
      if (size > MAX_UPLOAD_BYTES) fail("Files can be up to 10 MB. Share bigger files as a Drive link in a comment.");
      const name = clean(file.name) ?? "file";
      const fileId = this.env.files.save(name, file.type || "application/octet-stream", file.base64);
      this.db.insert("Attachments", {
        id: this.env.uuid(),
        task_id: taskId,
        file_id: fileId,
        file_name: name,
        size_bytes: size,
        content_type: file.type || "application/octet-stream",
        uploaded_by: ctx.me.id,
        created_at: this.iso(),
      });
    });
  }

  getAttachment(token: string, id: string) {
    const ctx = this.context(token);
    const a =
      this.db.all<Attachment & { file_id: string }>("Attachments").find((x) => x.id === id) ?? fail("File not found");
    if (!this.canSeeTask(ctx, a.task_id)) fail("File not found");
    return { name: a.file_name, type: a.content_type, base64: this.env.files.read(a.file_id) };
  }

  deleteAttachment(token: string, id: string) {
    return this.write(token, (ctx) => {
      this.staffOnly(ctx);
      const a = this.db.all<Attachment & { file_id: string }>("Attachments").find((x) => x.id === id);
      if (!a) return;
      try {
        this.env.files.remove(a.file_id);
      } catch {
        // Already gone from Drive.
      }
      this.db.remove("Attachments", [id]);
    });
  }

  markRead(token: string, id: string) {
    return this.write(token, (ctx) => {
      const n = this.db.all<Notification>("Notifications").find((x) => x.id === id);
      if (n && n.user_id === ctx.me.id && !n.read_at) this.db.update("Notifications", id, { read_at: this.iso() });
    });
  }

  markAllRead(token: string) {
    return this.write(token, (ctx) => {
      for (const n of this.db.all<Notification>("Notifications")) {
        if (n.user_id === ctx.me.id && !n.read_at) this.db.update("Notifications", n.id, { read_at: this.iso() });
      }
    });
  }
}

// Methods the browser may call by name. Anything else is refused.
export const PUBLIC_METHODS = [
  "checkPassword",
  "login",
  "logout",
  "snapshot",
  "createCompany",
  "updateCompany",
  "setClientPassword",
  "addStaff",
  "createProject",
  "updateProject",
  "deleteProject",
  "createMilestone",
  "updateMilestone",
  "deleteMilestone",
  "createTask",
  "updateTask",
  "deleteTask",
  "approveTask",
  "addDependency",
  "removeDependency",
  "createField",
  "deleteField",
  "setFieldValue",
  "addComment",
  "deleteComment",
  "logTime",
  "deleteTime",
  "uploadAttachment",
  "getAttachment",
  "deleteAttachment",
  "markRead",
  "markAllRead",
] as const;

export type Method = (typeof PUBLIC_METHODS)[number];

// Single entry point used by both Apps Script and the dev server.
export function dispatch(api: Api, method: string, args: unknown[]) {
  if (!(PUBLIC_METHODS as readonly string[]).includes(method)) return { error: "Unknown action" };
  try {
    const fn = (api as unknown as Record<string, (...a: unknown[]) => unknown>)[method];
    return { data: fn.apply(api, args) };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    console.error(`${method} failed`, e);
    return { error: "Something went wrong. Try again." };
  }
}
