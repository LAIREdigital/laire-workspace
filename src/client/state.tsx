import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Method } from "../server/api";
import type { Snapshot } from "../shared/types";
import { call, CallError } from "./api";

const TOKEN_KEY = "laire-workspace-token";

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the session lasts until the tab closes.
  }
}

type Ctx = {
  snap: Snapshot;
  token: string;
  staff: boolean;
  // Runs a write, swaps in the fresh snapshot, returns an error message if any.
  run: (method: Method, ...args: unknown[]) => Promise<{ error?: string; createdId?: string }>;
  refresh: () => Promise<void>;
  signOut: () => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({
  initial,
  token,
  onSignOut,
  children,
}: {
  initial: Snapshot;
  token: string;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [snap, setSnap] = useState(initial);

  const handle = useCallback(
    (e: unknown) => {
      const msg = e instanceof CallError ? e.message : "Something went wrong. Try again.";
      if (msg === "Signed out") onSignOut();
      return { error: msg };
    },
    [onSignOut],
  );

  const run = useCallback(
    async (method: Method, ...args: unknown[]) => {
      try {
        const next = await call<Snapshot & { createdId?: string }>(method, token, ...args);
        setSnap(next);
        return { createdId: next.createdId };
      } catch (e) {
        return handle(e);
      }
    },
    [token, handle],
  );

  const refresh = useCallback(async () => {
    try {
      setSnap(await call<Snapshot>("snapshot", token));
    } catch (e) {
      handle(e);
    }
  }, [token, handle]);

  const signOut = useCallback(() => {
    call("logout", token).catch(() => {});
    onSignOut();
  }, [token, onSignOut]);

  const value = useMemo(
    () => ({ snap, token, staff: snap.me.role === "staff", run, refresh, signOut }),
    [snap, token, run, refresh, signOut],
  );
  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

// Tracks one in-flight write and its error for a component.
export function useAction() {
  const { run } = useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const act = useCallback(
    async (method: Method, ...args: unknown[]) => {
      setPending(true);
      setError("");
      const r = await run(method, ...args);
      setPending(false);
      if (r.error) setError(r.error);
      return r;
    },
    [run],
  );
  return { act, pending, error, setError };
}
