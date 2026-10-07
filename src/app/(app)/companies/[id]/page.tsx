import Link from "next/link";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/auth";
import { getCompany, getInvites, getPeople, getProjects } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Avatar, EmptyState } from "@/components/ui";
import { displayName, shortDate } from "@/lib/format";
import { PROJECT_STATUS_LABEL } from "@/lib/types";
import { GuestInvites, NewProjectForm } from "./company-forms";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, company] = await Promise.all([getMe(), getCompany(id)]);
  if (!company) notFound();
  const staff = me.role === "staff";
  const [projects, people, invites] = await Promise.all([
    getProjects(),
    getPeople(),
    staff ? getInvites(id) : Promise.resolve([]),
  ]);
  const list = projects.filter((p) => p.company_id === id);
  const guests = people.filter((p) => p.role === "guest" && p.company_id === id);
  const byId = new Map(people.map((p) => [p.id, p]));

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
                      <span className="hidden text-xs text-muted sm:block">{p.due_date ? `Due ${shortDate(p.due_date)}` : ""}</span>
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
                    <span className="block truncate text-xs text-muted">{g.email}</span>
                  </span>
                </li>
              ))}
              {guests.length === 0 && <li className="px-4 py-3 text-sm text-muted">No client users yet.</li>}
            </ul>
            {staff && <GuestInvites companyId={id} invites={invites} />}
          </aside>
        </div>
      </main>
    </>
  );
}
