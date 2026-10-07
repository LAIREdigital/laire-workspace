import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { PageHeader } from "../components/page-header";
import { TaskPanel } from "../components/task-panel";
import { EmptyState } from "../components/ui";
import { Link, type Route } from "../router";
import { useApp } from "../state";

// Weekly timesheet for the signed in staff member.
export function TimePage({ route }: { route: Route }) {
  const { snap, staff } = useApp();
  if (!staff) return null;
  const week = route.query.get("week");
  const start = startOfWeek(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? parseISO(week) : new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const taskById = new Map(snap.tasks.map((t) => [t.id, t]));
  const entries = snap.time
    .filter((e) => e.user_id === snap.me.id && e.work_date >= iso(days[0]) && e.work_date <= iso(days[6]))
    .map((e) => ({ ...e, tasks: taskById.get(e.task_id) ?? null }));
  const projects = snap.projects;
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const total = entries.reduce((s, e) => s + Number(e.hours), 0);
  const billable = entries.filter((e) => e.billable).reduce((s, e) => s + Number(e.hours), 0);

  return (
    <>
      <PageHeader
        title="My Time"
        eyebrow={`Week of ${format(start, "MMM d, yyyy")}`}
        actions={
          <div className="flex gap-2">
            <Link href={`/time?week=${iso(addDays(start, -7))}`} className="btn-ghost border border-line">
              Prev
            </Link>
            <Link href="/time" className="btn-ghost border border-line">
              This week
            </Link>
            <Link href={`/time?week=${iso(addDays(start, 7))}`} className="btn-ghost border border-line">
              Next
            </Link>
          </div>
        }
      />
      <main className="flex-1 space-y-4 overflow-auto px-4 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={`${total.toFixed(2)}h`} />
          <Stat label="Billable" value={`${billable.toFixed(2)}h`} />
          <Stat label="Non billable" value={`${(total - billable).toFixed(2)}h`} />
          <Stat label="Billable share" value={total ? `${Math.round((billable / total) * 100)}%` : "0%"} />
        </div>
        {entries.length === 0 ? (
          <EmptyState title="No time this week">Log time from any task&apos;s detail panel.</EmptyState>
        ) : (
          days.map((d) => {
            const list = entries.filter((e) => e.work_date === iso(d));
            if (list.length === 0) return null;
            const dayTotal = list.reduce((s, e) => s + Number(e.hours), 0);
            return (
              <section key={iso(d)} className="card">
                <div className="flex justify-between border-b border-line px-4 py-2">
                  <h3 className="font-display text-sm font-bold">{format(d, "EEEE, MMM d")}</h3>
                  <span className="text-sm font-semibold">{dayTotal.toFixed(2)}h</span>
                </div>
                <ul className="divide-y divide-line">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="w-14 font-semibold">{Number(e.hours).toFixed(2)}h</span>
                      <Link
                        href={`/time?${week ? `week=${week}&` : ""}task=${e.task_id}`}
                        className="min-w-0 flex-1 truncate hover:text-coral"
                      >
                        {e.tasks?.title ?? "Task"}
                        <span className="text-muted"> · {projectName.get(e.tasks?.project_id ?? "") ?? ""}</span>
                        {e.note && <span className="text-muted"> · {e.note}</span>}
                      </Link>
                      {!e.billable && <span className="text-[10px] font-bold text-muted uppercase">Non billable</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
      {route.query.get("task") && <TaskPanel route={route} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
