import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Task } from "../../shared/types";
import { Link } from "../router";

// Month grid. Tasks sit on their due date.
export function CalendarView({
  tasks,
  month,
  monthHref,
  taskBase,
}: {
  tasks: Task[];
  month?: string;
  monthHref: (m: string) => string;
  taskBase: string;
}) {
  const parsed = month && /^\d{4}-\d{2}$/.test(month) ? parse(month, "yyyy-MM", new Date()) : new Date();
  const first = startOfMonth(parsed);
  const days = eachDayOfInterval({
    start: startOfWeek(first),
    end: endOfWeek(endOfMonth(first)),
  });
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const list = byDay.get(t.due_date) ?? [];
    list.push(t);
    byDay.set(t.due_date, list);
  }
  const undated = tasks.filter((t) => !t.due_date && t.status !== "complete").length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Link href={monthHref(format(addMonths(first, -1), "yyyy-MM"))} className="btn-ghost border border-line bg-white">
          Prev
        </Link>
        <Link href={monthHref(format(new Date(), "yyyy-MM"))} className="btn-ghost border border-line bg-white">
          Today
        </Link>
        <Link href={monthHref(format(addMonths(first, 1), "yyyy-MM"))} className="btn-ghost border border-line bg-white">
          Next
        </Link>
        <h2 className="ml-2 text-lg font-bold">{format(first, "MMMM yyyy")}</h2>
        {undated > 0 && <span className="ml-auto text-xs text-muted">{undated} open tasks have no due date</span>}
      </div>
      <div className="card overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="border-b border-line bg-mist/60 px-2 py-1.5 text-xs font-semibold text-muted">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const list = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`min-h-28 border-r border-b border-line p-1.5 ${isSameMonth(d, first) ? "" : "bg-mist/40"}`}
              >
                <div
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday(d) ? "bg-coral font-bold text-white" : isSameMonth(d, first) ? "" : "text-muted/60"
                  }`}
                >
                  {format(d, "d")}
                </div>
                <div className="space-y-1">
                  {list.map((t) => (
                    <Link
                      key={t.id}
                      href={taskBase + t.id}
                      className={`block truncate rounded px-1.5 py-0.5 text-xs ${
                        t.status === "complete"
                          ? "bg-teal/25 text-muted line-through"
                          : t.is_internal
                            ? "bg-plum text-white"
                            : "bg-coral/15 hover:bg-coral/25"
                      }`}
                    >
                      {t.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
