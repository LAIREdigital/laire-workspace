"use client";

import { useState, useTransition } from "react";
import { createProject, inviteGuest, revokeInvite } from "@/app/actions";

export function NewProjectForm({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
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
      action={(fd) =>
        start(async () => {
          const r = await createProject({
            companyId,
            name: String(fd.get("name") ?? ""),
            description: String(fd.get("description") ?? ""),
            startDate: String(fd.get("start") ?? ""),
            dueDate: String(fd.get("due") ?? ""),
          });
          if (r?.error) setError(r.error);
        })
      }
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
      {error && <p className="text-sm text-coral-dark">{error}</p>}
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

export function GuestInvites({ companyId, invites }: { companyId: string; invites: { email: string }[] }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="card space-y-3 p-4">
      <h3 className="font-bold">Invite a client user</h3>
      <p className="text-xs text-muted">
        They sign in at this site with a magic link sent to this address. They see this company&apos;s projects, minus
        anything marked internal.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await inviteGuest(companyId, email);
            if (r.error) setMsg(r.error);
            else {
              setMsg(`Invited ${email}. Send them the site link.`);
              setEmail("");
            }
          });
        }}
      >
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@client.com" className="input" />
        <button className="btn-dark" disabled={pending}>
          Invite
        </button>
      </form>
      {msg && <p className="text-xs">{msg}</p>}
      {invites.length > 0 && (
        <ul className="space-y-1 text-sm">
          <li className="label">Pending</li>
          {invites.map((i) => (
            <li key={i.email} className="flex items-center justify-between">
              <span className="truncate">{i.email}</span>
              <button className="text-xs text-muted hover:text-coral-dark" onClick={() => start(async () => void (await revokeInvite(i.email)))}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
