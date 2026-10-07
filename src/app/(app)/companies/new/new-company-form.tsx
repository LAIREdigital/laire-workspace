"use client";

import { useState, useTransition } from "react";
import { createCompany } from "@/app/actions";

export function NewCompanyForm() {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="card max-w-lg space-y-3 p-5"
      action={(fd) =>
        start(async () => {
          const r = await createCompany(String(fd.get("name") ?? ""), String(fd.get("website") ?? ""));
          if (r?.error) setError(r.error);
        })
      }
    >
      <label className="block space-y-1">
        <span className="label">Name</span>
        <input name="name" required className="input" placeholder="Acme Co" />
      </label>
      <label className="block space-y-1">
        <span className="label">Website</span>
        <input name="website" className="input" placeholder="https://acme.com" />
      </label>
      {error && <p className="text-sm text-coral-dark">{error}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Creating..." : "Create company"}
      </button>
    </form>
  );
}
