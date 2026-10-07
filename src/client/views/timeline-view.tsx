import { addDays, differenceInCalendarDays, format, isWeekend, max as maxDate, min as minDate, parseISO, startOfWeek } from "date-fns";
import { Avatar, EmptyState } from "../components/ui";
import type { Dependency, Milestone, Person, Task } from "../../shared/types";
import { Link } from "../router";

const DAY = 28;
const ROW = 36;
const LABEL = 260;

const BAR: Record<Task["status"], string> = {
  not_started: "bg-muted/45",
  in_progress: "bg-sky",
  in_review: "bg-coral",
  complete: "bg-teal",
};

// Gantt style timeline. A task spans start_date to due_date; a task with only
// one date is drawn as a single day. Arrows show "waits on" dependencies.
export function TimelineView({
  tasks,
  milestones,
  deps,
  people,
  taskBase,
}: {
  tasks: Task[];
  milestones: Milestone[];
  deps: Dependency[];
  people: Person[];
  taskBase: string;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const dated = tasks.filter((t) => t.start_date || t.due_date);
  const unscheduled = tasks.filter((t) => !t.start_date && !t.due_date);

  if (dated.length === 0) {
    return (
      <EmptyState title="Nothing on the timeline yet">
        Give tasks a start or due date to see them here. {unscheduled.length} tasks are unscheduled.
      </EmptyState>
    );
  }

  const span = (t: Task) => {
    const s = parseISO((t.start_date ?? t.due_date)!);
    const e = parseISO((t.due_date ?? t.start_date)!);
    return e < s ? { s: e, e: s } : { s, e };
  };

  const allDates = dated.flatMap((t) => [span(t).s, span(t).e]).concat(new Date());
  const start = startOfWeek(addDays(minDate(allDates), -3));
  const end = addDays(maxDate(allDates), 10);
  const totalDays = Math.max(42, differenceInCalendarDays(end, start) + 1);
  const days = Array.from({ length: totalDays }, (_, i) => addDays(start, i));
  const x = (d: Date) => differenceInCalendarDays(d, start) * DAY;

  // Rows: grouped by milestone, in milestone order.
  type RowItem = { kind: "group"; name: string } | { kind: "task"; task: Task };
  const rows: RowItem[] = [];
  const groups = [...milestones.map((m) => ({ id: m.id as string | null, name: m.name })), { id: null, name: "No milestone" }];
  for (const g of groups) {
    const list = dated
      .filter((t) => t.milestone_id === g.id)
      .sort((a, b) => span(a).s.getTime() - span(b).s.getTime());
    if (list.length === 0) continue;
    if (milestones.length > 0) rows.push({ kind: "group", name: g.name });
    list.forEach((task) => rows.push({ kind: "task", task }));
  }
  const rowOf = new Map<string, number>();
  rows.forEach((r, i) => r.kind === "task" && rowOf.set(r.task.id, i));

  const width = totalDays * DAY;
  const height = rows.length * ROW;
  const todayX = x(new Date());

  const arrows = deps
    .filter((d) => rowOf.has(d.task_id) && rowOf.has(d.depends_on_id))
    .map((d) => {
      const from = dated.find((t) => t.id === d.depends_on_id)!;
      const to = dated.find((t) => t.id === d.task_id)!;
      const x1 = x(span(from).e) + DAY - 2;
      const y1 = rowOf.get(from.id)! * ROW + ROW / 2;
      const x2 = x(span(to).s) + 2;
      const y2 = rowOf.get(to.id)! * ROW + ROW / 2;
      const mid = x1 + 8;
      const late = span(to).s <= span(from).e;
      return { key: `${d.depends_on_id}-${d.task_id}`, path: `M${x1},${y1} H${mid} V${y2} H${x2}`, late };
    });

  return (
    <div className="space-y-4">
      <div className="card overflow-auto">
        <div className="flex" style={{ width: LABEL + width }}>
          {/* Labels */}
          <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-white" style={{ width: LABEL }}>
            <div className="h-12 border-b border-line" />
            {rows.map((r, i) =>
              r.kind === "group" ? (
                <div key={`g${i}`} className="flex items-end px-3 pb-1.5 font-display text-xs font-bold" style={{ height: ROW }}>
                  {r.name}
                </div>
              ) : (
                <div key={r.task.id} className="flex items-center gap-2 border-b border-line/60 px-3" style={{ height: ROW }}>
                  <Avatar person={byId.get(r.task.assignee_id ?? "")} size={18} />
                  <Link href={taskBase + r.task.id} className="truncate text-sm hover:text-coral">
                    {r.task.title}
                  </Link>
                </div>
              ),
            )}
          </div>

          {/* Grid */}
          <div className="relative shrink-0" style={{ width }}>
            <div className="flex h-12 border-b border-line">
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={`flex shrink-0 flex-col items-center justify-end pb-1 text-[10px] ${isWeekend(d) ? "bg-mist/70" : ""}`}
                  style={{ width: DAY }}
                >
                  {d.getDate() === 1 || d.getTime() === start.getTime() ? (
                    <span className="font-bold text-plum">{format(d, "MMM")}</span>
                  ) : null}
                  <span className="text-muted">{format(d, "d")}</span>
                </div>
              ))}
            </div>
            <div className="relative" style={{ height }}>
              {days.map((d, i) =>
                isWeekend(d) ? (
                  <div key={i} className="absolute top-0 bottom-0 bg-mist/70" style={{ left: i * DAY, width: DAY }} />
                ) : null,
              )}
              <div className="absolute top-0 bottom-0 z-10 w-0.5 bg-coral" style={{ left: todayX + DAY / 2 }} title="Today" />
              {rows.map((r, i) => {
                if (r.kind !== "task") return null;
                const { s, e } = span(r.task);
                const left = x(s);
                const w = (differenceInCalendarDays(e, s) + 1) * DAY;
                const inside = w > 110;
                return [
                  <Link
                    key={r.task.id}
                    href={taskBase + r.task.id}
                   
                    title={`${r.task.title}: ${format(s, "MMM d")} to ${format(e, "MMM d")}`}
                    className={`absolute z-10 flex items-center overflow-hidden rounded-md px-2 text-xs font-semibold text-white shadow-sm hover:brightness-105 ${BAR[r.task.status]} ${
                      r.task.is_internal ? "ring-2 ring-plum ring-offset-1" : ""
                    }`}
                    style={{ left: left + 2, width: w - 4, top: i * ROW + 7, height: ROW - 14 }}
                  >
                    <span className="truncate pl-1.5 text-plum">{inside ? r.task.title : ""}</span>
                  </Link>,
                  inside ? null : (
                    <span
                      key={`${r.task.id}-label`}
                      className="absolute z-10 truncate text-xs whitespace-nowrap text-plum"
                      style={{ left: left + w + 6, top: i * ROW + 10, maxWidth: 220 }}
                    >
                      {r.task.title}
                    </span>
                  ),
                ];
              })}
              <svg className="pointer-events-none absolute inset-0 z-10" width={width} height={height}>
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill="#3d3642" />
                  </marker>
                  <marker id="arrow-late" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill="#e8705a" />
                  </marker>
                </defs>
                {arrows.map((a) => (
                  <path
                    key={a.key}
                    d={a.path}
                    fill="none"
                    stroke={a.late ? "#e8705a" : "#3d3642"}
                    strokeWidth={1.5}
                    strokeDasharray={a.late ? "4 3" : undefined}
                    markerEnd={`url(#${a.late ? "arrow-late" : "arrow"})`}
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-muted/45" /> Not started</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-sky" /> In progress</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-coral" /> In review</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-teal" /> Complete</span>
        <span>Dashed red arrow: a task starts before the task it waits on ends.</span>
        {unscheduled.length > 0 && <span className="ml-auto">{unscheduled.length} unscheduled</span>}
      </div>
    </div>
  );
}
