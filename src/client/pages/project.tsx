import { PageHeader } from "../components/page-header";
import { TaskPanel } from "../components/task-panel";
import { EmptyState } from "../components/ui";
import { shortDate } from "../format";
import { Link, withQuery, type Route } from "../router";
import { useApp } from "../state";
import { PROJECT_STATUS_LABEL } from "../../shared/types";
import { ListView } from "../views/list-view";
import { BoardView } from "../views/board-view";
import { CalendarView } from "../views/calendar-view";
import { TimelineView } from "../views/timeline-view";
import { ProjectSettings } from "../views/project-settings";

const VIEWS = [
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
  { key: "timeline", label: "Timeline" },
] as const;

export function ProjectPage({ id, route }: { id: string; route: Route }) {
  const { snap, staff } = useApp();
  const project = snap.projects.find((p) => p.id === id);
  if (!project) {
    return (
      <div className="p-8 pt-16 md:pt-8">
        <EmptyState title="Project not found">It may have been deleted, or it is not shared with you.</EmptyState>
      </div>
    );
  }
  const asked = route.query.get("view");
  const view = asked === "settings" && staff ? "settings" : (VIEWS.find((v) => v.key === asked)?.key ?? "list");
  const company = snap.companies.find((c) => c.id === project.company_id);
  const milestones = snap.milestones.filter((m) => m.project_id === id);
  const allTasks = snap.tasks.filter((t) => t.project_id === id);
  const tasks = allTasks.filter((t) => !t.parent_id);
  const ids = new Set(tasks.map((t) => t.id));
  const subtaskCounts: Record<string, { done: number; total: number }> = {};
  for (const t of allTasks) {
    if (!t.parent_id) continue;
    const c = (subtaskCounts[t.parent_id] ??= { done: 0, total: 0 });
    c.total++;
    if (t.status === "complete") c.done++;
  }
  const fields = snap.fields.filter((f) => f.project_id === id);
  const base = `/projects/${id}`;
  const taskBase = (() => {
    const h = withQuery(route, { task: null });
    return `${h}${h.includes("?") ? "&" : "?"}task=`;
  })();
  const done = tasks.filter((t) => t.status === "complete").length;

  return (
    <>
      <PageHeader
        eyebrow={
          company ? (
            <Link href={`/companies/${company.id}`} className="hover:text-coral">
              {company.name}
            </Link>
          ) : null
        }
        title={
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: project.color }} />
            {project.name}
          </span>
        }
        actions={
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="rounded-full bg-mist-2 px-2.5 py-1 font-semibold text-plum">
              {PROJECT_STATUS_LABEL[project.status]}
            </span>
            {project.due_date && <span>Due {shortDate(project.due_date)}</span>}
            <span>
              {done}/{tasks.length} done
            </span>
          </div>
        }
      >
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={v.key === "list" ? base : `${base}?view=${v.key}`}
              className={`border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                view === v.key ? "border-coral text-plum" : "border-transparent text-muted hover:text-plum"
              }`}
            >
              {v.label}
            </Link>
          ))}
          {staff && (
            <Link
              href={`${base}?view=settings`}
              className={`ml-auto border-b-2 px-3 py-2 text-sm font-semibold ${
                view === "settings" ? "border-coral text-plum" : "border-transparent text-muted hover:text-plum"
              }`}
            >
              Settings
            </Link>
          )}
        </nav>
      </PageHeader>

      <main className="flex-1 overflow-auto px-4 py-5 md:px-8">
        {view === "list" && (
          <ListView
            staff={staff}
            projectId={id}
            tasks={tasks}
            milestones={milestones}
            people={snap.people}
            fields={fields}
            values={snap.values.filter((v) => ids.has(v.task_id))}
            subtaskCounts={subtaskCounts}
            taskBase={taskBase}
          />
        )}
        {view === "board" && (
          <BoardView staff={staff} projectId={id} tasks={tasks} people={snap.people} taskBase={taskBase} />
        )}
        {view === "calendar" && (
          <CalendarView
            tasks={tasks}
            month={route.query.get("month") ?? undefined}
            monthHref={(m) => `${base}?view=calendar&month=${m}`}
            taskBase={taskBase}
          />
        )}
        {view === "timeline" && (
          <TimelineView
            tasks={tasks}
            milestones={milestones}
            deps={snap.dependencies.filter((d) => ids.has(d.task_id))}
            people={snap.people}
            taskBase={taskBase}
          />
        )}
        {view === "settings" && (
          <ProjectSettings project={project} milestones={milestones} fields={fields} people={snap.people} />
        )}
      </main>

      {route.query.get("task") && <TaskPanel route={route} />}
    </>
  );
}
