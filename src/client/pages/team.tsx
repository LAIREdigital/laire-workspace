import { useState } from "react";
import { PageHeader } from "../components/page-header";
import { Avatar, ErrorNote } from "../components/ui";
import { useAction, useApp } from "../state";

export function TeamPage() {
  const { snap, staff } = useApp();
  const { act, pending, error } = useAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  if (!staff) return null;
  const team = snap.people.filter((p) => p.role === "staff");
  return (
    <>
      <PageHeader title="Team" eyebrow="LAIRE staff" />
      <main className="flex-1 space-y-6 overflow-auto px-4 py-6 md:px-8">
        <ul className="card max-w-2xl divide-y divide-line">
          {team.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Avatar person={p} size={28} />
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-xs text-muted">{p.email}</span>
            </li>
          ))}
        </ul>
        <form
          className="card max-w-2xl space-y-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await act("addStaff", { name, email });
            if (!r.error) {
              setName("");
              setEmail("");
            }
          }}
        >
          <h2 className="font-bold">Add a teammate</h2>
          <p className="text-xs text-muted">
            They sign in with the team password and pick their name. Staff can also add themselves at sign in.
          </p>
          <div className="flex flex-wrap gap-2">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="input min-w-48 flex-1" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="input min-w-48 flex-1" />
            <button className="btn-dark" disabled={pending}>
              Add
            </button>
          </div>
          <ErrorNote error={error} />
        </form>
        <p className="max-w-2xl text-xs text-muted">
          The team password lives in the Apps Script project under Project Settings, Script Properties, STAFF_PASSWORD.
        </p>
      </main>
    </>
  );
}
