import { useState } from "react";
import { QuickAdd } from "../components/task-panel";
import { ApprovalBadge, Avatar, DueDate, EmptyState, InternalBadge, PriorityTag, StatusPill } from "../components/ui";
import type { CustomField, FieldValue, Milestone, Person, Task } from "../../shared/types";
import { shortDate } from "../format";
import { Link } from "../router";
import { useAction } from "../state";

export function ListView({
  staff,
  projectId,
  tasks,
  milestones,
  people,
  fields,
  values,
  subtaskCounts,
  taskBase,
}: {
  staff: boolean;
  projectId: string;
  tasks: Task[];
  milestones: Milestone[];
  people: Person[];
  fields: CustomField[];
  values: FieldValue[];
  subtaskCounts: Record<string, { done: number; total: number }>;
  taskBase: string;
}) {
  const [showDone, setShowDone] = useState(true);
  const { act } = useAction();
  const byId = new Map(people.map((p) => [p.id, p]));
  const shownFields = fields.slice(0, 3);
  const valueOf = new Map(values.map((v) => [`${v.task_id}:${v.field_id}`, v.value]));
  const groups: { id: string | null; name: string; due: string | null }[] = [
    ...milestones.map((m) => ({ id: m.id, name: m.name, due: m.due_date })),
    { id: null, name: milestones.length ? "No milestone" : "Tasks", due: null },
  ];

  if (!staff && tasks.length === 0) {
    return <EmptyState title="Nothing shared yet">LAIRE has not shared any tasks in this project yet.</EmptyState>;
  }

  const gridCols = `minmax(240px,1fr) 120px 90px 110px ${shownFields.map(() => "120px").join(" ")}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-coral" />
          Show completed
        </label>
      </div>
      <div className="card overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className="grid border-b border-line bg-mist/60 px-4 py-2 text-xs font-semibold text-muted"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span>Task</span>
            <span>Assignee</span>
            <span>Due</span>
            <span>Status</span>
            {shownFields.map((f) => (
              <span key={f.id} className="truncate">
                {f.name}
              </span>
            ))}
          </div>
          {groups.map((g) => {
            const list = tasks
              .filter((t) => t.milestone_id === g.id)
              .filter((t) => showDone || t.status !== "complete")
              .sort((a, b) => Number(a.status === "complete") - Number(b.status === "complete"));
            if (g.id === null && list.length === 0 && milestones.length > 0 && !staff) return null;
            return (
              <section key={g.id ?? "none"}>
                <div className="flex items-baseline gap-3 border-b border-line px-4 pt-4 pb-2">
                  <h3 className="font-display text-sm font-bold">{g.name}</h3>
                  {g.due && <span className="text-xs text-muted">Due {shortDate(g.due)}</span>}
                  <span className="text-xs text-muted">{list.length}</span>
                </div>
                {list.map((t) => (
                  <Row
                    key={t.id}
                    task={t}
                    staff={staff}
                    href={taskBase + t.id}
                    assignee={byId.get(t.assignee_id ?? "")}
                    subtasks={subtaskCounts[t.id]}
                    gridCols={gridCols}
                    fieldValues={shownFields.map((f) => valueOf.get(`${t.id}:${f.id}`) ?? "")}
                  />
                ))}
                {staff && (
                  <div className="border-b border-line px-4 py-1.5 pl-11">
                    <QuickAdd
                      placeholder="Add task"
                      onAdd={(title) => act("createTask", { projectId, milestoneId: g.id, title })}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  task,
  staff,
  href,
  assignee,
  subtasks,
  gridCols,
  fieldValues,
}: {
  task: Task;
  staff: boolean;
  href: string;
  assignee: Person | undefined;
  subtasks?: { done: number; total: number };
  gridCols: string;
  fieldValues: string[];
}) {
  const { act, pending } = useAction();
  const done = task.status === "complete";
  return (
    <div
      className={`grid items-center border-b border-line px-4 py-2 text-sm hover:bg-mist/50 ${pending ? "opacity-60" : ""}`}
      style={{ gridTemplateColumns: gridCols }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {staff ? (
          <button
            aria-label={done ? "Mark incomplete" : "Mark complete"}
            onClick={() => act("updateTask", task.id, { status: done ? "not_started" : "complete" })}
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 text-[10px] ${
              done ? "border-teal bg-teal text-white" : "border-muted/40 hover:border-teal"
            }`}
          >
            {done ? "✓" : ""}
          </button>
        ) : (
          <span className={`h-2 w-2 shrink-0 rounded-full ${done ? "bg-teal" : "bg-muted/30"}`} />
        )}
        <Link href={href} className={`truncate hover:text-coral ${done ? "text-muted line-through" : ""}`}>
          {task.title}
        </Link>
        {subtasks && (
          <span className="shrink-0 text-xs text-muted">
            {subtasks.done}/{subtasks.total}
          </span>
        )}
        {task.is_internal && <InternalBadge />}
        {task.needs_approval && <ApprovalBadge approved={!!task.approved_at} />}
        <PriorityTag priority={task.priority} />
      </div>
      <span className="flex min-w-0 items-center gap-1.5 truncate text-xs">
        <Avatar person={assignee} size={20} />
        <span className="truncate">{assignee ? assignee.name.split(" ")[0] : ""}</span>
      </span>
      <DueDate date={task.due_date} done={done} />
      <span>
        <StatusPill status={task.status} />
      </span>
      {fieldValues.map((v, i) => (
        <span key={i} className="truncate text-xs text-muted">
          {v}
        </span>
      ))}
    </div>
  );
}
