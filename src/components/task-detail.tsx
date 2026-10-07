"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addComment,
  addDependency,
  approveTask,
  createTask,
  deleteAttachment,
  deleteComment,
  deleteTask,
  deleteTime,
  logTime,
  removeDependency,
  setFieldValue,
  updateTask,
  uploadAttachment,
  type TaskPatch,
} from "@/app/actions";
import { CommentBody, MentionInput } from "@/components/mentions";
import { ApprovalBadge, Avatar, InternalBadge, StatusPill } from "@/components/ui";
import { displayName, shortDate, timeAgo, todayISO } from "@/lib/format";
import type { TaskDetail } from "@/lib/data";
import type { Milestone, Priority, Profile, TaskStatus } from "@/lib/types";
import { PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/types";

export function TaskDetailView({
  me,
  detail,
  people,
  milestones,
  closeHref,
}: {
  me: Profile;
  detail: TaskDetail;
  people: Profile[];
  milestones: Milestone[];
  closeHref: string;
}) {
  const { task } = detail;
  const staff = me.role === "staff";
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const byId = new Map(people.map((p) => [p.id, p]));
  const assignable = people.filter((p) => p.role === "staff" || p.company_id !== null);

  const taskHref = (id: string) => {
    const q = new URLSearchParams(search.toString());
    q.set("task", id);
    return `${pathname}?${q.toString()}`;
  };

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r?.error) setError(r.error);
    });

  const save = (patch: TaskPatch) => run(() => updateTask(task.id, patch));
  const totalHours = detail.time.reduce((s, t) => s + Number(t.hours), 0);
  const billableHours = detail.time.filter((t) => t.billable).reduce((s, t) => s + Number(t.hours), 0);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        {staff ? (
          <button
            onClick={() => save({ status: task.status === "complete" ? "not_started" : "complete" })}
            className={task.status === "complete" ? "btn bg-teal/40 text-plum" : "btn border border-line hover:border-teal hover:bg-teal/15"}
          >
            {task.status === "complete" ? "Completed" : "Mark complete"}
          </button>
        ) : (
          <StatusPill status={task.status} />
        )}
        {task.is_internal && <InternalBadge />}
        {task.needs_approval && <ApprovalBadge approved={!!task.approved_at} />}
        <div className="flex-1" />
        {pending && <span className="text-xs text-muted">Saving...</span>}
        {staff && (
          <button
            className="btn-ghost text-coral-dark"
            onClick={() => {
              if (!confirm("Delete this task and its subtasks?")) return;
              run(async () => {
                const r = await deleteTask(task.id);
                if (!r.error) router.push(closeHref, { scroll: false });
                return r;
              });
            }}
          >
            Delete
          </button>
        )}
        <Link href={closeHref} scroll={false} className="btn-ghost" aria-label="Close">
          Close
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {error && <p className="mb-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-dark">{error}</p>}

        {task.parent_id && (
          <Link href={taskHref(task.parent_id)} scroll={false} className="mb-2 inline-block text-xs text-muted hover:text-coral">
            Back to parent task
          </Link>
        )}

        {staff ? (
          <input
            defaultValue={task.title}
            onBlur={(e) => e.target.value.trim() !== task.title && save({ title: e.target.value })}
            className="w-full rounded-md border border-transparent px-1 py-1 font-display text-xl font-bold outline-none hover:border-line focus:border-coral"
          />
        ) : (
          <h2 className="px-1 text-xl font-bold">{task.title}</h2>
        )}

        {/* Approval call to action for clients */}
        {task.needs_approval && !task.approved_at && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-coral/40 bg-coral/8 px-4 py-3">
            <p className="text-sm">
              {staff ? "Waiting on client approval." : "LAIRE needs your approval on this."}
            </p>
            {!staff && (
              <button className="btn-primary" disabled={pending} onClick={() => run(() => approveTask(task.id))}>
                Approve
              </button>
            )}
          </div>
        )}
        {task.approved_at && (
          <p className="mt-2 px-1 text-xs text-muted">
            Approved by {displayName(byId.get(task.approved_by ?? ""))} on {shortDate(task.approved_at.slice(0, 10))}
          </p>
        )}

        {/* Fields */}
        <dl className="mt-5 grid grid-cols-[120px_1fr] items-center gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted">Assignee</dt>
          <dd>
            {staff ? (
              <select
                value={task.assignee_id ?? ""}
                onChange={(e) => save({ assignee_id: e.target.value || null })}
                className="input max-w-xs"
              >
                <option value="">Unassigned</option>
                {assignable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)}
                    {p.role === "guest" ? " (client)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="flex items-center gap-2">
                <Avatar person={byId.get(task.assignee_id ?? "")} /> {displayName(byId.get(task.assignee_id ?? ""))}
              </span>
            )}
          </dd>

          <dt className="text-muted">Dates</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {staff ? (
              <>
                <input
                  type="date"
                  defaultValue={task.start_date ?? ""}
                  onChange={(e) => save({ start_date: e.target.value || null })}
                  className="input w-auto"
                  aria-label="Start date"
                />
                <span className="text-muted">to</span>
                <input
                  type="date"
                  defaultValue={task.due_date ?? ""}
                  onChange={(e) => save({ due_date: e.target.value || null })}
                  className="input w-auto"
                  aria-label="Due date"
                />
              </>
            ) : (
              <span>
                {task.start_date ? `${shortDate(task.start_date)} to ` : ""}
                {task.due_date ? shortDate(task.due_date) : "No due date"}
              </span>
            )}
          </dd>

          <dt className="text-muted">Status</dt>
          <dd>
            {staff ? (
              <select
                value={task.status}
                onChange={(e) => save({ status: e.target.value as TaskStatus })}
                className="input max-w-xs"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : (
              <StatusPill status={task.status} />
            )}
          </dd>

          {staff && (
            <>
              <dt className="text-muted">Priority</dt>
              <dd>
                <select
                  value={task.priority}
                  onChange={(e) => save({ priority: e.target.value as Priority })}
                  className="input max-w-xs"
                >
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </dd>

              <dt className="text-muted">Milestone</dt>
              <dd>
                <select
                  value={task.milestone_id ?? ""}
                  onChange={(e) => save({ milestone_id: e.target.value || null })}
                  className="input max-w-xs"
                >
                  <option value="">No milestone</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </dd>

              <dt className="text-muted">Visibility</dt>
              <dd className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.is_internal}
                    onChange={(e) => save({ is_internal: e.target.checked })}
                    className="accent-coral"
                  />
                  Internal only (hidden from client)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.needs_approval}
                    onChange={(e) => save({ needs_approval: e.target.checked })}
                    className="accent-coral"
                  />
                  Needs client approval
                </label>
              </dd>
            </>
          )}

          {detail.fields.map((f) => (
            <FieldRow
              key={f.id}
              name={f.name}
              type={f.type}
              options={f.options}
              value={detail.values[f.id] ?? ""}
              editable={staff}
              onSave={(v) => run(() => setFieldValue(task.id, f.id, v))}
            />
          ))}
        </dl>

        {/* Description */}
        <section className="mt-6">
          <h3 className="label mb-2">Description</h3>
          {staff ? (
            <textarea
              defaultValue={task.description ?? ""}
              onBlur={(e) => e.target.value !== (task.description ?? "") && save({ description: e.target.value || null })}
              rows={4}
              placeholder="Add details, links, the brief..."
              className="input"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{task.description || <span className="text-muted">No description.</span>}</p>
          )}
        </section>

        {/* Subtasks */}
        <section className="mt-6">
          <h3 className="label mb-2">Subtasks</h3>
          <ul className="divide-y divide-line rounded-md border border-line">
            {detail.subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {staff && (
                  <input
                    type="checkbox"
                    checked={s.status === "complete"}
                    onChange={(e) => run(() => updateTask(s.id, { status: e.target.checked ? "complete" : "not_started" }))}
                    className="accent-teal"
                  />
                )}
                <Link
                  href={taskHref(s.id)}
                  scroll={false}
                  className={`flex-1 truncate hover:text-coral ${s.status === "complete" ? "text-muted line-through" : ""}`}
                >
                  {s.title}
                </Link>
                {s.is_internal && <InternalBadge />}
                <Avatar person={byId.get(s.assignee_id ?? "")} size={20} />
              </li>
            ))}
            {staff && (
              <li className="px-3 py-1.5">
                <QuickAdd
                  placeholder="Add a subtask"
                  onAdd={(title) =>
                    createTask({ projectId: task.project_id, parentId: task.id, milestoneId: task.milestone_id, title })
                  }
                />
              </li>
            )}
            {!staff && detail.subtasks.length === 0 && <li className="px-3 py-2 text-sm text-muted">None</li>}
          </ul>
        </section>

        {/* Dependencies */}
        <section className="mt-6">
          <h3 className="label mb-2">Waiting on</h3>
          <div className="flex flex-wrap gap-2">
            {detail.dependsOn.map((d) => (
              <span key={d.id} className="flex items-center gap-1.5 rounded-full bg-mist-2 px-3 py-1 text-xs">
                <Link href={taskHref(d.id)} scroll={false} className="hover:text-coral">
                  {d.title}
                </Link>
                {staff && (
                  <button
                    aria-label="Remove dependency"
                    className="text-muted hover:text-coral-dark"
                    onClick={() => run(() => removeDependency(task.id, d.id))}
                  >
                    x
                  </button>
                )}
              </span>
            ))}
            {detail.dependsOn.length === 0 && !staff && <span className="text-sm text-muted">Nothing</span>}
            {staff && (
              <select
                value=""
                onChange={(e) => e.target.value && run(() => addDependency(task.id, e.target.value))}
                className="input w-auto text-xs"
              >
                <option value="">+ Add a task this waits on</option>
                {detail.projectTasks
                  .filter((t) => t.id !== task.id && !detail.dependsOn.some((d) => d.id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </section>

        {/* Attachments */}
        <section className="mt-6">
          <h3 className="label mb-2">Files</h3>
          <ul className="space-y-1">
            {detail.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <a href={`/attachments/${a.id}`} target="_blank" rel="noreferrer" className="truncate text-plum underline decoration-coral/50 hover:text-coral">
                  {a.file_name}
                </a>
                <span className="text-xs text-muted">{a.size_bytes ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : ""}</span>
                {staff && (
                  <button className="text-xs text-muted hover:text-coral-dark" onClick={() => run(() => deleteAttachment(a.id))}>
                    Remove
                  </button>
                )}
              </li>
            ))}
            {detail.attachments.length === 0 && <li className="text-sm text-muted">No files.</li>}
          </ul>
          {staff && (
            <form
              className="mt-2"
              action={(fd) => run(() => uploadAttachment(fd))}
            >
              <input type="hidden" name="taskId" value={task.id} />
              <label className="btn-ghost -ml-3 cursor-pointer text-coral-dark">
                + Upload a file
                <input
                  type="file"
                  name="file"
                  className="hidden"
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                />
              </label>
            </form>
          )}
        </section>

        {/* Time, staff only */}
        {staff && (
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="label">Time</h3>
              <span className="text-xs text-muted">
                {totalHours.toFixed(2)}h logged, {billableHours.toFixed(2)}h billable
              </span>
            </div>
            <TimeForm onLog={(input) => logTime(task.id, input)} />
            <ul className="mt-2 divide-y divide-line text-sm">
              {detail.time.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-16 text-xs text-muted">{shortDate(t.work_date)}</span>
                  <span className="w-12 font-semibold">{Number(t.hours).toFixed(2)}h</span>
                  <span className="flex-1 truncate text-muted">
                    {displayName(byId.get(t.user_id))}
                    {t.note ? `: ${t.note}` : ""}
                  </span>
                  {!t.billable && <span className="text-[10px] font-bold text-muted uppercase">Non billable</span>}
                  {t.user_id === me.id && (
                    <button className="text-xs text-muted hover:text-coral-dark" onClick={() => run(() => deleteTime(t.id))}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Comments */}
        <section className="mt-6 pb-6">
          <h3 className="label mb-3">Comments</h3>
          <ul className="space-y-4">
            {detail.comments.map((c) => {
              const author = byId.get(c.author_id);
              return (
                <li key={c.id} className={`flex gap-3 ${c.is_internal ? "rounded-md bg-plum/5 p-2" : ""}`}>
                  <Avatar person={author} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{displayName(author)}</span>{" "}
                      {author?.role === "guest" && <span className="text-xs text-muted">(client)</span>}{" "}
                      <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>{" "}
                      {c.is_internal && <InternalBadge />}
                    </p>
                    <CommentBody body={c.body} people={byId} />
                  </div>
                  {staff && c.author_id === me.id && (
                    <button className="self-start text-xs text-muted hover:text-coral-dark" onClick={() => run(() => deleteComment(c.id))}>
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <CommentForm
            staff={staff}
            mentionable={people.filter((p) => p.id !== me.id)}
            onSubmit={(body, internal) => addComment(task.id, body, internal)}
          />
        </section>
      </div>
    </div>
  );
}

function FieldRow({
  name,
  type,
  options,
  value,
  editable,
  onSave,
}: {
  name: string;
  type: string;
  options: string[];
  value: string;
  editable: boolean;
  onSave: (v: string) => void;
}) {
  return (
    <>
      <dt className="truncate text-muted">{name}</dt>
      <dd>
        {!editable ? (
          <span>{value || <span className="text-muted">Empty</span>}</span>
        ) : type === "select" ? (
          <select value={value} onChange={(e) => onSave(e.target.value)} className="input max-w-xs">
            <option value="">Empty</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type === "number" ? "number" : type === "date" ? "date" : "text"}
            defaultValue={value}
            onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
            className="input max-w-xs"
          />
        )}
      </dd>
    </>
  );
}

export function QuickAdd({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (title: string) => Promise<{ error?: string }>;
}) {
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          const r = await onAdd(title);
          if (!r.error) setTitle("");
        });
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={pending ? "Adding..." : `+ ${placeholder}`}
        disabled={pending}
        className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted"
      />
    </form>
  );
}

function TimeForm({
  onLog,
}: {
  onLog: (input: { date: string; hours: number; note: string; billable: boolean }) => Promise<{ error?: string }>;
}) {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await onLog({ date, hours: Number(hours), note, billable });
          if (r.error) setError(r.error);
          else {
            setHours("");
            setNote("");
            setError("");
          }
        });
      }}
    >
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto" aria-label="Work date" />
      <input
        type="number"
        step="0.25"
        min="0.25"
        max="24"
        required
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        placeholder="Hours"
        className="input w-20"
      />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="input min-w-32 flex-1" />
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="accent-coral" />
        Billable
      </label>
      <button className="btn-dark" disabled={pending}>
        Log
      </button>
      {error && <p className="w-full text-xs text-coral-dark">{error}</p>}
    </form>
  );
}

function CommentForm({
  staff,
  mentionable,
  onSubmit,
}: {
  staff: boolean;
  mentionable: Profile[];
  onSubmit: (body: string, internal: boolean) => Promise<{ error?: string }>;
}) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await onSubmit(body, internal);
          if (r.error) setError(r.error);
          else {
            setBody("");
            setError("");
          }
        });
      }}
    >
      <MentionInput value={body} onChange={setBody} people={mentionable} placeholder="Write a comment. Type @ to mention someone." />
      <div className="flex items-center justify-between">
        {staff ? (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-coral" />
            Internal note (client cannot see)
          </label>
        ) : (
          <span />
        )}
        <button className="btn-primary" disabled={pending || !body.trim()}>
          Comment
        </button>
      </div>
      {error && <p className="text-xs text-coral-dark">{error}</p>}
    </form>
  );
}
