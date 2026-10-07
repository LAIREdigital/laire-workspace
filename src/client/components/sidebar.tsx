import { useState } from "react";
import logo from "../assets/laire-logo-white.png";
import { Avatar } from "./ui";
import { displayName } from "../format";
import { Link, type Route } from "../router";
import { useApp } from "../state";

export function Sidebar({ route }: { route: Route }) {
  const { snap, staff, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const path = `/${route.path.join("/")}`;
  const unread = snap.notifications.filter((n) => !n.read_at).length;

  const nav = (href: string, label: string, badge?: number) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm ${
        path.startsWith(href) ? "bg-white/12 font-semibold text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
      }`}
    >
      {label}
      {!!badge && <span className="rounded-full bg-coral px-1.5 text-xs font-bold text-white">{badge}</span>}
    </Link>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-30 rounded-md bg-plum px-2.5 py-1.5 text-sm font-semibold text-white md:hidden"
        aria-label="Open menu"
      >
        Menu
      </button>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-plum text-white transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <img src={logo} alt="LAIRE" width={78} height={32} />
          <span className="font-display text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">Workspace</span>
        </div>

        <nav className="space-y-0.5 px-2">
          {nav("/my-tasks", staff ? "My Tasks" : "Home")}
          {nav("/inbox", "Inbox", unread)}
          {staff && nav("/time", "My Time")}
          {staff && nav("/team", "Team")}
        </nav>

        <div className="mt-5 flex items-center justify-between px-5">
          <span className="text-[11px] font-bold tracking-widest text-white/45 uppercase">
            {staff ? "Companies" : "Projects"}
          </span>
          {staff && (
            <Link href="/companies/new" className="text-xs text-teal hover:underline" onClick={() => setOpen(false)}>
              + New
            </Link>
          )}
        </div>
        <div className="mt-1 flex-1 space-y-2 overflow-y-auto px-2 pb-4">
          {snap.companies.map((c) => {
            const list = snap.projects.filter((p) => p.company_id === c.id && p.status !== "complete");
            return (
              <div key={c.id}>
                <Link
                  href={`/companies/${c.id}`}
                  onClick={() => setOpen(false)}
                  className={`block truncate rounded-md px-3 py-1 text-sm font-semibold ${
                    path === `/companies/${c.id}` ? "bg-white/12 text-white" : "text-white/85 hover:bg-white/8"
                  }`}
                >
                  {c.name}
                </Link>
                {list.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    onClick={() => setOpen(false)}
                    className={`ml-2 flex items-center gap-2 truncate rounded-md px-3 py-1 text-sm ${
                      path.startsWith(`/projects/${p.id}`)
                        ? "bg-white/12 text-white"
                        : "text-white/65 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
              </div>
            );
          })}
          {snap.companies.length === 0 && (
            <p className="px-3 text-xs text-white/50">{staff ? "No companies yet." : "No projects shared yet."}</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
          <Avatar person={snap.me} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName(snap.me)}</p>
            <p className="truncate text-[11px] text-white/50">{staff ? "LAIRE staff" : snap.me.company_name}</p>
          </div>
          <button className="text-xs text-white/60 hover:text-white" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
