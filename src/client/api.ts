import type { Method } from "../server/api";

type Envelope = { data?: unknown; error?: string };

declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler(fn: (v: string) => void): {
            withFailureHandler(fn: (e: Error) => void): { api(method: string, args: string): void };
          };
        };
      };
    };
  }
}

export class CallError extends Error {}

// Calls the server. Inside Apps Script this goes through google.script.run;
// in local development it posts to the dev server.
export async function call<T>(method: Method, ...args: unknown[]): Promise<T> {
  const payload = JSON.stringify(args);
  const raw: string = await new Promise((resolve, reject) => {
    const g = window.google?.script?.run;
    if (g) {
      g.withSuccessHandler(resolve)
        .withFailureHandler((e) => reject(new CallError(e?.message || "Could not reach the server")))
        .api(method, payload);
    } else {
      fetch(`/api/${method}`, { method: "POST", body: payload, headers: { "content-type": "application/json" } })
        .then((r) => r.text())
        .then(resolve, () => reject(new CallError("Could not reach the server")));
    }
  });
  const env = JSON.parse(raw) as Envelope;
  if (env.error) throw new CallError(env.error);
  return env.data as T;
}
