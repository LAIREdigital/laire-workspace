import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { QuickAdd } from "../components/task-panel";
import { ApprovalBadge, Avatar, DueDate, InternalBadge, PriorityTag } from "../components/ui";
import type { Person, Task, TaskStatus } from "../../shared/types";
import { STATUSES, STATUS_LABEL } from "../../shared/types";
import { Link } from "../router";
import { useApp } from "../state";

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  not_started: "bg-muted/40",
  in_progress: "bg-sky",
  in_review: "bg-coral",
  complete: "bg-teal",
};

export function BoardView({
  staff,
  projectId,
  tasks,
  people,
  taskBase,
}: {
  staff: boolean;
  projectId: string;
  tasks: Task[];
  people: Person[];
  taskBase: string;
}) {
  // Cards move at once; the move is dropped when the server answers.
  const [moves, setMoves] = useState<Record<string, TaskStatus>>({});
  const [error, setError] = useState("");
  const { run } = useApp();
  const items = tasks.map((t) => (moves[t.id] ? { ...t, status: moves[t.id] } : t));
  const byId = new Map(people.map((p) => [p.id, p]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(e: DragEndEvent) {
    const status = e.over?.id as TaskStatus | undefined;
    const id = String(e.active.id);
    const task = items.find((t) => t.id === id);
    if (!status || !task || task.status === status) return;
    setMoves((m) => ({ ...m, [id]: status }));
    run("updateTask", id, { status }).then((r) => {
      if (r.error) setError(r.error);
      setMoves((m) => {
        const rest = { ...m };
        delete rest[id];
        return rest;
      });
    });
  }

  return (
    <>
      {error && <p className="mb-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-dark">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map((s) => {
            const list = items.filter((t) => t.status === s);
            return (
              <Column key={s} status={s} count={list.length}>
                {list.map((t) => (
                  <Card
                    key={t.id}
                    task={t}
                    draggable={staff}
                    href={taskBase + t.id}
                    assignee={byId.get(t.assignee_id ?? "")}
                  />
                ))}
                {staff && (
                  <div className="rounded-md px-2">
                    <QuickAdd placeholder="Add task" onAdd={(title) => run("createTask", { projectId, title, status: s })} />
                  </div>
                )}
              </Column>
            );
          })}
        </div>
      </DndContext>
    </>
  );
}

function Column({ status, count, children }: { status: TaskStatus; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-lg p-2 transition-colors ${isOver ? "bg-teal/20" : "bg-mist-2"}`}
    >
      <div className="flex items-center gap-2 px-1 pt-1 pb-1">
        <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_ACCENT[status]}`} />
        <h3 className="font-display text-sm font-bold">{STATUS_LABEL[status]}</h3>
        <span className="text-xs text-muted">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Card({
  task,
  draggable,
  href,
  assignee,
}: {
  task: Task;
  draggable: boolean;
  href: string;
  assignee: Person | undefined;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`card p-3 shadow-sm ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        isDragging ? "z-10 shadow-lg ring-2 ring-coral/40" : ""
      }`}
    >
      <Link href={href} className="block text-sm font-semibold hover:text-coral">
        {task.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.is_internal && <InternalBadge />}
        {task.needs_approval && <ApprovalBadge approved={!!task.approved_at} />}
        <PriorityTag priority={task.priority} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Avatar person={assignee} size={22} />
        <DueDate date={task.due_date} done={task.status === "complete"} />
      </div>
    </div>
  );
}
