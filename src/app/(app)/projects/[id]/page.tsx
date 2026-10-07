import Link from "next/link";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/auth";
import {
  getCompany,
  getCustomFields,
  getFieldValues,
  getMilestones,
  getPeople,
  getProject,
  getProjectDependencies,
  getProjectTasks,
} from "@/lib/data";
import { shortDate } from "@/lib/format";
import { PROJECT_STATUS_LABEL } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { TaskPanel } from "@/components/task-panel";
import { ListView } from "@/components/views/list-view";
import { BoardView } from "@/components/views/board-view";
import { CalendarView } from "@/components/views/calendar-view";
import { TimelineView } from "@/components/views/timeline-view";
import { ProjectSettings } from "@/components/views/project-settings";

const VIEWS = [
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
  { key: "timeline", label: "Timeline" },
] as const;

type Search = { view?: string; task?: string; month?: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const [me, project] = await Promise.all([getMe(), getProject(id)]);
  if (!project) notFound();
  const staff = me.role === "staff";
  const view = search.view === "settings" && staff ? "settings" : (VIEWS.find((v) => v.key === search.view)?.key ?? "list");

  const [company, milestones, allTasks, people, fields] = await Promise.all([
    getCompany(project.company_id),
    getMilestones(id),
    getProjectTasks(id),
    getPeople(),
    getCustomFields(id),
  ]);
  const tasks = allTasks.filter((t) => !t.parent_id);
  const subtaskCounts: Record<string, { done: number; total: number }> = {};
  for (const t of allTasks) {
    if (!t.parent_id) continue;
    const c = (subtaskCounts[t.parent_id] ??= { done: 0, total: 0 });
    c.total++;
    if (t.status === "complete") c.done++;
  }
  const [deps, values] = await Promise.all([
    view === "timeline" ? getProjectDependencies(tasks.map((t) => t.id)) : Promise.resolve([]),
    view === "list" ? getFieldValues(tasks.map((t) => t.id)) : Promise.resolve([]),
  ]);

  const base = `/projects/${id}`;
  const qs = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { view: view === "list" ? undefined : view, month: search.month, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const closeHref = qs({});
  const taskBase = `${closeHref}${closeHref.includes("?") ? "&" : "?"}task=`;

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
            people={people}
            fields={fields}
            values={values}
            subtaskCounts={subtaskCounts}
            taskBase={taskBase}
          />
        )}
        {view === "board" && (
          <BoardView staff={staff} projectId={id} tasks={tasks} people={people} taskBase={taskBase} />
        )}
        {view === "calendar" && (
          <CalendarView
            tasks={tasks}
            month={search.month}
            monthHref={(m) => `${base}?view=calendar&month=${m}`}
            taskBase={taskBase}
          />
        )}
        {view === "timeline" && (
          <TimelineView tasks={tasks} milestones={milestones} deps={deps} people={people} taskBase={taskBase} />
        )}
        {view === "settings" && (
          <ProjectSettings project={project} milestones={milestones} fields={fields} people={people} />
        )}
      </main>

      {search.task && <TaskPanel taskId={search.task} closeHref={closeHref} />}
    </>
  );
}
