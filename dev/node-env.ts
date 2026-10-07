import crypto from "node:crypto";
import type { Env } from "../src/server/api";

// Node stand-in for the Apps Script services, for tests and local dev.
export function nodeEnv(opts: { staffPassword?: string; now?: () => Date } = {}): Env & { files: Env["files"] & { blobs: Map<string, string> } } {
  const blobs = new Map<string, string>();
  return {
    now: opts.now ?? (() => new Date()),
    uuid: () => crypto.randomUUID(),
    sha256: (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex"),
    staffPassword: () => opts.staffPassword ?? "LAIRE2026!",
    sleep: () => {},
    files: {
      blobs,
      save: (_name, _type, base64) => {
        const id = crypto.randomUUID();
        blobs.set(id, base64);
        return id;
      },
      read: (id) => {
        const b = blobs.get(id);
        if (b === undefined) throw new Error("missing file");
        return b;
      },
      remove: (id) => void blobs.delete(id),
    },
  };
}
