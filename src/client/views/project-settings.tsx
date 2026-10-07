import { useState } from "react";
import { ErrorNote } from "../components/ui";
import { displayName } from "../format";
import { navigate } from "../router";
import { useAction } from "../state";
import type { CustomField, FieldType, Milestone, Person, Project, ProjectStatus } from "../../shared/types";
import { PROJECT_STATUS_LABEL } from "../../shared/types";

const COLORS = ["#ff8b71", "#8bd8d5", "#b4bb65", "#81b5c6", "#3d3642", "#c792b8"];

export function ProjectSettings({
  project,
  milestones,
  fields,
  people,
}: {
  project: Project;
  milestones: Milestone[];
  fields: CustomField[];
  people: Person[];
}) {
  const { act, pending, error } = useAction();
  const save = (patch: Partial<Project>) => act("updateProject", project.id, patch);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ErrorNote error={error} />
      {pending && <p className="text-xs text-muted">Saving...</p>}

      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Project details</h2>
        <label className="block space-y-1">
          <span className="label">Name</span>
          <input defaultValue={project.name} onBlur={(e) => e.target.value !== project.name && save({ name: e.target.value })} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="label">Description</span>
          <textarea
            defaultValue={project.description ?? ""}
            rows={3}
            onBlur={(e) => e.target.value !== (project.description ?? "") && save({ description: e.target.value || null })}
            className="input"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="label">Status</span>
            <select value={project.status} onChange={(e) => save({ status: e.target.value as ProjectStatus })} className="input">
              {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label">Owner</span>
            <select value={project.owner_id ?? ""} onChange={(e) => save({ owner_id: e.target.value || null })} className="input">
              <option value="">None</option>
              {people
                .filter((p) => p.role === "staff")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)}
                  </option>
                ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label">Start</span>
            <input type="date" defaultValue={project.start_date ?? ""} onChange={(e) => save({ start_date: e.target.value || null })} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="label">Due</span>
            <input type="date" defaultValue={project.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null })} className="input" />
          </label>
        </div>
        <div className="space-y-1">
          <span className="label">Color</span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => save({ color: c })}
                className={`h-7 w-7 rounded-md ${project.color === c ? "ring-2 ring-plum ring-offset-2" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-bold">Milestones</h2>
        <p className="mt-1 text-sm text-muted">Phases of the project, same as Accelo milestones. Tasks group under them.</p>
        <ul className="mt-3 divide-y divide-line">
          {milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
              <input
                defaultValue={m.name}
                onBlur={(e) => e.target.value !== m.name && act("updateMilestone", m.id, { name: e.target.value })}
                className="input min-w-40 flex-1"
              />
              <input
                type="date"
                defaultValue={m.start_date ?? ""}
                onChange={(e) => act("updateMilestone", m.id, { start_date: e.target.value || null })}
                className="input w-auto"
                aria-label="Start"
              />
              <input
                type="date"
                defaultValue={m.due_date ?? ""}
                onChange={(e) => act("updateMilestone", m.id, { due_date: e.target.value || null })}
                className="input w-auto"
                aria-label="Due"
              />
              <button
                className="btn-ghost text-coral-dark"
                onClick={() => confirm(`Delete milestone "${m.name}"? Its tasks stay, without a milestone.`) && act("deleteMilestone", m.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <AddMilestone onAdd={(n, s, d) => act("createMilestone", project.id, { name: n, startDate: s, dueDate: d })} />
      </section>

      <section className="card p-5">
        <h2 className="font-bold">Custom fields</h2>
        <p className="mt-1 text-sm text-muted">Extra columns on every task in this project, like content type, keyword or word count.</p>
        <ul className="mt-3 divide-y divide-line">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1 font-semibold">{f.name}</span>
              <span className="text-xs text-muted">
                {f.type}
                {f.type === "select" ? `: ${f.options.join(", ")}` : ""}
              </span>
              <button
                className="btn-ghost text-coral-dark"
                onClick={() => confirm(`Delete field "${f.name}" and its values?`) && act("deleteField", f.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <AddField onAdd={(n, t, o) => act("createField", project.id, { name: n, type: t, options: o })} />
      </section>

      <section className="card border-coral/40 p-5">
        <h2 className="font-bold text-coral-dark">Delete project</h2>
        <p className="mt-1 text-sm text-muted">Removes the project with all its tasks, comments, files and time. This cannot be undone.</p>
        <button
          className="btn mt-3 border border-coral text-coral-dark hover:bg-coral/10"
          onClick={() =>
            prompt("Type the project name to delete it:") === project.name &&
            act("deleteProject", project.id).then((r) => !r.error && navigate(`/companies/${project.company_id}`))
          }
        >
          Delete project
        </button>
      </section>
    </div>
  );
}

function AddMilestone({ onAdd }: { onAdd: (n: string, s: string, d: string) => Promise<{ error?: string }> }) {
  const [name, setName] = useState("");
  const [s, setS] = useState("");
  const [d, setD] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const r = await onAdd(name, s, d);
        setPending(false);
        if (!r.error) {
          setName("");
          setS("");
          setD("");
        }
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New milestone" className="input min-w-40 flex-1" required />
      <input type="date" value={s} onChange={(e) => setS(e.target.value)} className="input w-auto" aria-label="Start" />
      <input type="date" value={d} onChange={(e) => setD(e.target.value)} className="input w-auto" aria-label="Due" />
      <button className="btn-dark" disabled={pending}>
        Add
      </button>
    </form>
  );
}

function AddField({ onAdd }: { onAdd: (n: string, t: FieldType, o: string) => Promise<{ error?: string }> }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const r = await onAdd(name, type, options);
        setPending(false);
        if (r.error) setError(r.error);
        else {
          setName("");
          setOptions("");
          setError("");
        }
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Field name" className="input min-w-36 flex-1" required />
      <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className="input w-auto">
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="select">Dropdown</option>
        <option value="date">Date</option>
      </select>
      {type === "select" && (
        <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options, comma separated" className="input min-w-48 flex-1" />
      )}
      <button className="btn-dark" disabled={pending}>
        Add field
      </button>
      {error && <p className="w-full text-xs text-coral-dark">{error}</p>}
    </form>
  );
}

