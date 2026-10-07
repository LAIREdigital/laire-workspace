import { differenceInCalendarDays, parseISO } from "date-fns";
import { PageHeader } from "../components/page-header";
import { TaskPanel } from "../components/task-panel";
import { ApprovalBadge, DueDate, EmptyState, InternalBadge, StatusPill } from "../components/ui";
import { displayName } from "../format";
import { Link, type Route } from "../router";
import { useApp } from "../state";
import type { Project, Task } from "../../shared/types";

function bucket(t: Task) {
  if (!t.due_date) return "Later";
  const d = differenceInCalendarDays(parseISO(t.due_date), new Date());
  if (d < 0) return "Overdue";
  if (d === 0) return "Today";
  if (d <= 7) return "Next 7 days";
  return "Later";
}

const ORDER = ["Overdue", "Today", "Next 7 days", "Later"];

export function MyTasksPage({ route }: { route: Route }) {
  const { snap, staff } = useApp();
  const me = snap.me;
  const task = route.query.get("task");
  const mine = snap.tasks
    .filter((t) => t.assignee_id === me.id && t.status !== "complete")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const approvals = staff
    ? []
    : snap.tasks
        .filter((t) => t.needs_approval && !t.approved_at)
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const projects = snap.projects;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader eyebrow={greeting} title={staff ? "My Tasks" : `Welcome, ${displayName(me).split(" ")[0]}`} />
      <main className="flex-1 space-y-8 overflow-auto px-4 py-6 md:px-8">
        {!staff && (
          <section>
            <h2 className="mb-3 text-lg font-bold">Waiting on your approval</h2>
            {approvals.length === 0 ? (
              <EmptyState title="All caught up">Nothing needs your approval right now.</EmptyState>
            ) : (
              <TaskList tasks={approvals} projectById={projectById} />
            )}
          </section>
        )}

        {(staff || mine.length > 0) && (
          <section className="space-y-6">
            {!staff && <h2 className="text-lg font-bold">Assigned to you</h2>}
            {mine.length === 0 ? (
              <EmptyState title="Inbox zero for tasks">Nothing open is assigned to you. Nice.</EmptyState>
            ) : (
              ORDER.map((b) => {
                const list = mine.filter((t) => bucket(t) === b);
                if (list.length === 0) return null;
                return (
                  <div key={b}>
                    <h3 className={`mb-2 font-display text-sm font-bold ${b === "Overdue" ? "text-coral-dark" : ""}`}>
                      {b} <span className="font-sans font-normal text-muted">{list.length}</span>
                    </h3>
                    <TaskList tasks={list} projectById={projectById} />
                  </div>
                );
              })
            )}
          </section>
        )}

        {!staff && (
          <section>
            <h2 className="mb-3 text-lg font-bold">Your projects</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="card flex items-center gap-3 p-4 hover:border-coral">
                  <span className="h-8 w-1.5 rounded" style={{ background: p.color }} />
                  <span className="font-semibold">{p.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      {task && <TaskPanel route={route} />}
    </>
  );
}

function TaskList({ tasks, projectById }: { tasks: Task[]; projectById: Map<string, Project> }) {
  return (
    <ul className="card divide-y divide-line">
      {tasks.map((t) => {
        const p = projectById.get(t.project_id);
        return (
          <li key={t.id}>
            <Link href={`/my-tasks?task=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-mist/50">
              <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
              {t.is_internal && <InternalBadge />}
              {t.needs_approval && <ApprovalBadge approved={!!t.approved_at} />}
              {p && (
                <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                  <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                  {p.name}
                </span>
              )}
              <StatusPill status={t.status} />
              <span className="w-16 text-right">
                <DueDate date={t.due_date} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
