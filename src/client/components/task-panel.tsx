import { useState } from "react";
import { call } from "../api";
import { CommentBody, MentionInput } from "./mentions";
import { ApprovalBadge, Avatar, ErrorNote, InternalBadge, StatusPill } from "./ui";
import { displayName, shortDate, timeAgo, todayISO } from "../format";
import { Link, navigate, withQuery, type Route } from "../router";
import { useAction, useApp } from "../state";
import type { Priority, Task, TaskStatus } from "../../shared/types";
import { PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "../../shared/types";

// Right hand task panel, opened with ?task=<id> on any page.
export function TaskPanel({ route }: { route: Route }) {
  const taskId = route.query.get("task")!;
  const closeHref = withQuery(route, { task: null });
  const { snap } = useApp();
  const task = snap.tasks.find((t) => t.id === taskId);
  return (
    <>
      <Link href={closeHref} aria-label="Close task" className="fixed inset-0 z-40 bg-plum/30" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {task ? (
          <TaskDetail key={task.id} task={task} route={route} closeHref={closeHref} />
        ) : (
          <div className="p-8">
            <p className="font-display font-bold">Task not found</p>
            <p className="mt-1 text-sm text-muted">It may have been deleted, or you do not have access.</p>
            <Link href={closeHref} className="btn-ghost mt-4 -ml-3">
              Close
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

function TaskDetail({ task, route, closeHref }: { task: Task; route: Route; closeHref: string }) {
  const { snap, staff } = useApp();
  const { act, pending, error } = useAction();
  const me = snap.me;
  const byId = new Map(snap.people.map((p) => [p.id, p]));
  const project = snap.projects.find((p) => p.id === task.project_id);
  const milestones = snap.milestones.filter((m) => m.project_id === task.project_id);
  const subtasks = snap.tasks.filter((t) => t.parent_id === task.id);
  const comments = snap.comments.filter((c) => c.task_id === task.id);
  const attachments = snap.attachments.filter((a) => a.task_id === task.id);
  const time = snap.time.filter((t) => t.task_id === task.id).sort((a, b) => b.work_date.localeCompare(a.work_date));
  const fields = snap.fields.filter((f) => f.project_id === task.project_id);
  const values = new Map(snap.values.filter((v) => v.task_id === task.id).map((v) => [v.field_id, v.value]));
  const depIds = new Set(snap.dependencies.filter((d) => d.task_id === task.id).map((d) => d.depends_on_id));
  const projectTasks = snap.tasks.filter((t) => t.project_id === task.project_id && !t.parent_id);
  const dependsOn = projectTasks.filter((t) => depIds.has(t.id));
  const assignable = snap.people.filter((p) => p.role === "staff" || p.company_id === project?.company_id);
  const taskHref = (id: string) => withQuery(route, { task: id });

  const save = (patch: Partial<Task>) => act("updateTask", task.id, patch);
  const totalHours = time.reduce((s, t) => s + Number(t.hours), 0);
  const billableHours = time.filter((t) => t.billable).reduce((s, t) => s + Number(t.hours), 0);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        {staff ? (
          <button
            onClick={() => save({ status: task.status === "complete" ? "not_started" : "complete" })}
            className={
              task.status === "complete"
                ? "btn bg-teal/40 text-plum"
                : "btn border border-line hover:border-teal hover:bg-teal/15"
            }
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
            onClick={async () => {
              if (!confirm("Delete this task and its subtasks?")) return;
              const r = await act("deleteTask", task.id);
              if (!r.error) navigate(closeHref);
            }}
          >
            Delete
          </button>
        )}
        <Link href={closeHref} className="btn-ghost" aria-label="Close">
          Close
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mb-3">
          <ErrorNote error={error} />
        </div>

        {task.parent_id && (
          <Link href={taskHref(task.parent_id)} className="mb-2 inline-block text-xs text-muted hover:text-coral">
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

        {task.needs_approval && !task.approved_at && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-coral/40 bg-coral/8 px-4 py-3">
            <p className="text-sm">{staff ? "Waiting on client approval." : "LAIRE needs your approval on this."}</p>
            {!staff && (
              <button className="btn-primary" disabled={pending} onClick={() => act("approveTask", task.id)}>
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

          {fields.map((f) => {
            const value = values.get(f.id) ?? "";
            return (
              <FieldRow
                key={f.id}
                name={f.name}
                type={f.type}
                options={f.options}
                value={value}
                editable={staff}
                onSave={(v) => act("setFieldValue", task.id, f.id, v)}
              />
            );
          })}
        </dl>

        <section className="mt-6">
          <h3 className="label mb-2">Description</h3>
          {staff ? (
            <textarea
              defaultValue={task.description ?? ""}
              onBlur={(e) =>
                e.target.value !== (task.description ?? "") && save({ description: e.target.value || null })
              }
              rows={4}
              placeholder="Add details, links, the brief..."
              className="input"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {task.description || <span className="text-muted">No description.</span>}
            </p>
          )}
        </section>

        <section className="mt-6">
          <h3 className="label mb-2">Subtasks</h3>
          <ul className="divide-y divide-line rounded-md border border-line">
            {subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {staff && (
                  <input
                    type="checkbox"
                    checked={s.status === "complete"}
                    onChange={(e) => act("updateTask", s.id, { status: e.target.checked ? "complete" : "not_started" })}
                    className="accent-teal"
                    aria-label={`Complete ${s.title}`}
                  />
                )}
                <Link
                  href={taskHref(s.id)}
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
                    act("createTask", {
                      projectId: task.project_id,
                      parentId: task.id,
                      milestoneId: task.milestone_id,
                      title,
                    })
                  }
                />
              </li>
            )}
            {!staff && subtasks.length === 0 && <li className="px-3 py-2 text-sm text-muted">None</li>}
          </ul>
        </section>

        <section className="mt-6">
          <h3 className="label mb-2">Waiting on</h3>
          <div className="flex flex-wrap gap-2">
            {dependsOn.map((d) => (
              <span key={d.id} className="flex items-center gap-1.5 rounded-full bg-mist-2 px-3 py-1 text-xs">
                <Link href={taskHref(d.id)} className="hover:text-coral">
                  {d.title}
                </Link>
                {staff && (
                  <button
                    aria-label="Remove dependency"
                    className="text-muted hover:text-coral-dark"
                    onClick={() => act("removeDependency", task.id, d.id)}
                  >
                    x
                  </button>
                )}
              </span>
            ))}
            {dependsOn.length === 0 && !staff && <span className="text-sm text-muted">Nothing</span>}
            {staff && (
              <select
                value=""
                onChange={(e) => e.target.value && act("addDependency", task.id, e.target.value)}
                className="input w-auto text-xs"
              >
                <option value="">+ Add a task this waits on</option>
                {projectTasks
                  .filter((t) => t.id !== task.id && !depIds.has(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="label mb-2">Files</h3>
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <DownloadLink id={a.id} name={a.file_name} />
                <span className="text-xs text-muted">{Math.max(1, Math.round(a.size_bytes / 1024))} KB</span>
                {staff && (
                  <button className="text-xs text-muted hover:text-coral-dark" onClick={() => act("deleteAttachment", a.id)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
            {attachments.length === 0 && <li className="text-sm text-muted">No files.</li>}
          </ul>
          {staff && (
            <label className="btn-ghost mt-2 -ml-3 cursor-pointer text-coral-dark">
              + Upload a file
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const base64 = await toBase64(file);
                  await act("uploadAttachment", task.id, { name: file.name, type: file.type, base64 });
                }}
              />
            </label>
          )}
        </section>

        {staff && (
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="label">Time</h3>
              <span className="text-xs text-muted">
                {totalHours.toFixed(2)}h logged, {billableHours.toFixed(2)}h billable
              </span>
            </div>
            <TimeForm taskId={task.id} />
            <ul className="mt-2 divide-y divide-line text-sm">
              {time.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-16 text-xs text-muted">{shortDate(t.work_date)}</span>
                  <span className="w-12 font-semibold">{Number(t.hours).toFixed(2)}h</span>
                  <span className="flex-1 truncate text-muted">
                    {displayName(byId.get(t.user_id))}
                    {t.note ? `: ${t.note}` : ""}
                  </span>
                  {!t.billable && <span className="text-[10px] font-bold text-muted uppercase">Non billable</span>}
                  {t.user_id === me.id && (
                    <button className="text-xs text-muted hover:text-coral-dark" onClick={() => act("deleteTime", t.id)}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 pb-6">
          <h3 className="label mb-3">Comments</h3>
          <ul className="space-y-4">
            {comments.map((c) => {
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
                  {c.author_id === me.id && (
                    <button
                      className="self-start text-xs text-muted hover:text-coral-dark"
                      onClick={() => act("deleteComment", c.id)}
                    >
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <CommentForm taskId={task.id} />
        </section>
      </div>
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function DownloadLink({ id, name }: { id: string; name: string }) {
  const { token } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="truncate text-left text-plum underline decoration-coral/50 hover:text-coral"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const f = await call<{ name: string; type: string; base64: string }>("getAttachment", token, id);
          const bytes = Uint8Array.from(atob(f.base64), (ch) => ch.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: f.type }));
          const a = document.createElement("a");
          a.href = url;
          a.download = f.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch {
          alert("Could not download that file.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Downloading..." : name}
    </button>
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
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setPending(true);
        const r = await onAdd(title);
        setPending(false);
        if (!r.error) setTitle("");
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

function TimeForm({ taskId }: { taskId: string }) {
  const { act, pending, error } = useAction();
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [billable, setBillable] = useState(true);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await act("logTime", taskId, { date, hours: Number(hours), note, billable });
        if (!r.error) {
          setHours("");
          setNote("");
        }
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

function CommentForm({ taskId }: { taskId: string }) {
  const { snap, staff } = useApp();
  const { act, pending, error } = useAction();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await act("addComment", taskId, body, internal);
        if (!r.error) setBody("");
      }}
    >
      <MentionInput
        value={body}
        onChange={setBody}
        people={snap.people.filter((p) => p.id !== snap.me.id)}
        placeholder="Write a comment. Type @ to mention someone."
      />
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
