import { useState } from "react";
import { PageHeader } from "../components/page-header";
import { Avatar, EmptyState, ErrorNote } from "../components/ui";
import { displayName, shortDate } from "../format";
import { Link, navigate } from "../router";
import { useAction, useApp } from "../state";
import { PROJECT_STATUS_LABEL, type Company } from "../../shared/types";

export function CompanyPage({ id }: { id: string }) {
  const { snap, staff } = useApp();
  const company = snap.companies.find((c) => c.id === id);
  if (!company) {
    return (
      <div className="p-8 pt-16 md:pt-8">
        <EmptyState title="Company not found" />
      </div>
    );
  }
  const list = snap.projects.filter((p) => p.company_id === id);
  const guests = snap.people.filter((p) => p.role === "guest" && p.company_id === id);
  const byId = new Map(snap.people.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader
        eyebrow="Company"
        title={company.name}
        actions={
          company.website ? (
            <a href={company.website} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-coral">
              {company.website.replace(/^https?:\/\//, "")}
            </a>
          ) : null
        }
      />
      <main className="flex-1 overflow-auto px-4 py-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Projects</h2>
            {list.length === 0 ? (
              <EmptyState title="No projects yet">{staff ? "Create the first one below." : "Nothing shared yet."}</EmptyState>
            ) : (
              <ul className="card divide-y divide-line">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-mist/50">
                      <span className="h-8 w-1.5 shrink-0 rounded" style={{ background: p.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        {p.description && <span className="block truncate text-xs text-muted">{p.description}</span>}
                      </span>
                      <span className="hidden text-xs text-muted sm:block">
                        {p.due_date ? `Due ${shortDate(p.due_date)}` : ""}
                      </span>
                      <Avatar person={byId.get(p.owner_id ?? "")} size={22} />
                      <span className="rounded-full bg-mist-2 px-2.5 py-0.5 text-xs font-semibold">
                        {PROJECT_STATUS_LABEL[p.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {staff && <NewProjectForm companyId={id} />}
          </section>

          <aside className="space-y-3">
            <h2 className="text-lg font-bold">Client team</h2>
            <ul className="card divide-y divide-line">
              {guests.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Avatar person={g} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{displayName(g)}</span>
                    {g.email && <span className="block truncate text-xs text-muted">{g.email}</span>}
                  </span>
                </li>
              ))}
              {guests.length === 0 && <li className="px-4 py-3 text-sm text-muted">No client users yet.</li>}
            </ul>
            {staff && <ClientAccess company={company} />}
            {staff && <CompanyDetails company={company} />}
          </aside>
        </div>
      </main>
    </>
  );
}

function ClientAccess({ company }: { company: Company }) {
  const { act, pending, error } = useAction();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Client access</h3>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
            company.has_client_password ? "bg-teal/35" : "bg-mist-2 text-muted"
          }`}
        >
          {company.has_client_password ? "On" : "Off"}
        </span>
      </div>
      <p className="text-xs text-muted">
        Give {company.name} a password. They sign in with it, enter their name, and see only their own projects, minus
        anything marked internal. Send them the app link and the password.
      </p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await act("setClientPassword", company.id, password);
          if (!r.error) {
            setMsg(`Saved. Send ${company.name} this password: ${password}`);
            setPassword("");
          } else setMsg("");
        }}
      >
        <input
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={company.has_client_password ? "New password" : "Set a password"}
          className="input"
        />
        <button className="btn-dark" disabled={pending}>
          Save
        </button>
      </form>
      <ErrorNote error={error} />
      {msg && <p className="text-xs">{msg}</p>}
      {company.has_client_password && (
        <button
          className="text-xs text-muted hover:text-coral-dark"
          onClick={() =>
            confirm(`Turn off client access for ${company.name}? Anyone signed in from there is signed out.`) &&
            act("setClientPassword", company.id, "").then(() => setMsg("Client access is off."))
          }
        >
          Turn off client access
        </button>
      )}
    </div>
  );
}

function CompanyDetails({ company }: { company: Company }) {
  const { act, error } = useAction();
  return (
    <div className="card space-y-2 p-4">
      <h3 className="font-bold">Details</h3>
      <input
        defaultValue={company.name}
        onBlur={(e) => e.target.value !== company.name && act("updateCompany", company.id, { name: e.target.value })}
        className="input"
        aria-label="Company name"
      />
      <input
        defaultValue={company.website}
        placeholder="Website"
        onBlur={(e) => e.target.value !== company.website && act("updateCompany", company.id, { website: e.target.value })}
        className="input"
        aria-label="Website"
      />
      <ErrorNote error={error} />
    </div>
  );
}

function NewProjectForm({ companyId }: { companyId: string }) {
  const { act, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + New project
      </button>
    );
  }
  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const r = await act("createProject", {
          companyId,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? ""),
          startDate: String(fd.get("start") ?? ""),
          dueDate: String(fd.get("due") ?? ""),
        });
        if (r.createdId) navigate(`/projects/${r.createdId}`);
      }}
    >
      <h3 className="font-bold">New project</h3>
      <input name="name" required placeholder="Project name, e.g. Q4 Content Retainer" className="input" />
      <textarea name="description" rows={2} placeholder="What is this project for?" className="input" />
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Start <input type="date" name="start" className="input w-auto" />
        </label>
        <label className="flex items-center gap-2">
          Due <input type="date" name="due" className="input w-auto" />
        </label>
      </div>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Creating..." : "Create project"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function NewCompanyPage() {
  const { staff } = useApp();
  const { act, pending, error } = useAction();
  if (!staff) return null;
  return (
    <>
      <PageHeader title="New company" eyebrow="Client account, same as an Accelo company" />
      <main className="flex-1 overflow-auto px-4 py-6 md:px-8">
        <form
          className="card max-w-lg space-y-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const r = await act("createCompany", {
              name: String(fd.get("name") ?? ""),
              website: String(fd.get("website") ?? ""),
            });
            if (r.createdId) navigate(`/companies/${r.createdId}`);
          }}
        >
          <label className="block space-y-1">
            <span className="label">Name</span>
            <input name="name" required className="input" placeholder="Acme Co" />
          </label>
          <label className="block space-y-1">
            <span className="label">Website</span>
            <input name="website" className="input" placeholder="https://acme.com" />
          </label>
          <ErrorNote error={error} />
          <button className="btn-primary" disabled={pending}>
            {pending ? "Creating..." : "Create company"}
          </button>
        </form>
      </main>
    </>
  );
}
