// Demo build: runs the real server code in the page against sample data, so
// the app can be tried without Google. Nothing is saved; a reload resets it.
import { Api, dispatch, type Env } from "../server/api";
import { MemoryStore } from "../server/store";
import { demoData } from "../server/demo";

// Demo only: a plain string hash stands in for SHA-256.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
}

const blobs = new Map<string, string>();
const env: Env = {
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
  sha256: hash,
  staffPassword: () => "LAIRE2026!",
  sleep: () => {},
  files: {
    save: (_n, _t, b64) => {
      const id = crypto.randomUUID();
      blobs.set(id, b64);
      return id;
    },
    read: (id) => blobs.get(id) ?? "",
    remove: (id) => void blobs.delete(id),
  },
};
const api = new Api(new MemoryStore(demoData(new Date())), env);
// Sample client login: Northwind Dental.
const staff = api.login("LAIRE2026!", { name: "Sam Barth" }).token;
api.setClientPassword(staff, "10000000-0000-4000-8000-000000000001", "northwind-demo");
api.logout(staff);

window.google = {
  script: {
    run: {
      withSuccessHandler: (ok) => ({
        withFailureHandler: () => ({
          api: (method: string, args: string) =>
            setTimeout(() => ok(JSON.stringify(dispatch(api, method, JSON.parse(args)))), 120),
        }),
      }),
    },
  },
};

const banner = document.createElement("div");
banner.textContent =
  "Demo with sample data. Staff password LAIRE2026!   Client password northwind-demo.   Changes reset on reload.";
banner.style.cssText =
  "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:60;max-width:calc(100% - 32px);" +
  "background:#2f2934;color:#8bd8d5;font:700 12px Lato,system-ui,sans-serif;padding:8px 14px;border-radius:999px;" +
  "box-shadow:0 4px 16px rgba(0,0,0,.25);text-align:center;white-space:pre-wrap";
document.body.appendChild(banner);

await import("./main");
