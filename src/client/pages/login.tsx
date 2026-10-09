import { useState } from "react";
import logo from "../assets/laire-logo-white.png";
import { call, CallError } from "../api";
import { ErrorNote } from "../components/ui";

type Step =
  | { kind: "password" }
  | { kind: "staff"; staff: { id: string; name: string }[] }
  | { kind: "client"; company: string };

export function Login({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [personId, setPersonId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function attempt<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof CallError ? e.message : "Something went wrong. Try again.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function checkPassword(e: React.FormEvent) {
    e.preventDefault();
    const r = await attempt(() =>
      call<{ kind: "staff"; staff: { id: string; name: string }[] } | { kind: "client"; company: string }>(
        "checkPassword",
        password,
      ),
    );
    if (r) {
      // First staff member on a fresh sheet: skip straight to entering a name.
      setPersonId(r.kind === "staff" && r.staff.length === 0 ? "new" : "");
      setStep(r);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const identity = personId && personId !== "new" ? { personId } : { name, email };
    const r = await attempt(() => call<{ token: string }>("login", password, identity));
    if (r) onSignedIn(r.token);
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-plum px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src={logo} alt="LAIRE" width={150} height={62} />
          <p className="font-display text-sm font-semibold tracking-[0.2em] text-teal uppercase">Workspace</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">
          {step.kind === "password" && (
            <form onSubmit={checkPassword} className="space-y-4">
              <h1 className="text-center text-lg font-bold">Sign in</h1>
              <ErrorNote error={error} />
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="input py-2"
              />
              <button className="btn-primary w-full py-2.5" disabled={busy}>
                {busy ? "Checking..." : "Continue"}
              </button>
            </form>
          )}

          {step.kind === "staff" && (
            <form onSubmit={signIn} className="space-y-4">
              <h1 className="text-center text-lg font-bold">Who are you?</h1>
              <ErrorNote error={error} />
              {step.staff.length > 0 && (
                <select required value={personId} onChange={(e) => setPersonId(e.target.value)} className="input py-2">
                  <option value="" disabled>
                    Pick your name
                  </option>
                  {step.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="new">I am not on the list</option>
                </select>
              )}
              {personId === "new" && (
                <>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="input py-2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@lairedigital.com (optional)"
                    className="input py-2"
                  />
                </>
              )}
              <button className="btn-primary w-full py-2.5" disabled={busy || !personId}>
                {busy ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}

          {step.kind === "client" && (
            <form onSubmit={signIn} className="space-y-4">
              <h1 className="text-center text-lg font-bold">Welcome, {step.company}</h1>
              <p className="text-center text-sm text-muted">Tell us who you are so LAIRE knows who commented or approved.</p>
              <ErrorNote error={error} />
              <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="input py-2" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="input py-2" />
              <button className="btn-primary w-full py-2.5" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}

          {step.kind !== "password" && (
            <button
              className="mt-3 w-full text-center text-xs text-muted hover:text-plum"
              onClick={() => {
                setStep({ kind: "password" });
                setError("");
              }}
            >
              Use a different password
            </button>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-white/60">
          LAIRE staff use the team password. Clients use the password LAIRE sent them.
        </p>
      </div>
    </main>
  );
}
