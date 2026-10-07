import { test } from "node:test";
import assert from "node:assert/strict";
import { Api, ApiError, dispatch } from "../src/server/api";
import { MemoryStore } from "../src/server/store";
import { demoData } from "../src/server/demo";
import { nodeEnv } from "../dev/node-env";

const ACME = "10000000-0000-4000-8000-000000000001"; // Northwind Dental in demo data
const OTHER = "10000000-0000-4000-8000-000000000002";
const SAM = "20000000-0000-4000-8000-000000000001";
const JORDAN = "20000000-0000-4000-8000-000000000002";
const DANA = "20000000-0000-4000-8000-000000000004";
const T = (n: number) => `50000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const COMP = T(5); // Homepage design comp: needs approval, has an internal comment
const INTERNAL = T(3);

function setup() {
  const env = nodeEnv();
  const store = new MemoryStore(demoData(new Date()));
  const api = new Api(store, env);
  const staff = api.login("LAIRE2026!", { personId: SAM }).token;
  return { env, store, api, staff };
}

function guestLogin(api: Api, staffToken: string, password = "northwind-pass-1") {
  api.setClientPassword(staffToken, ACME, password);
  return api.login(password, { name: "Dana Whitfield", email: "dana@northwind-dental.example" }).token;
}

const throwsApi = (fn: () => unknown, msg?: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof ApiError && (!msg || msg.test((e as Error).message)));

test("staff password lists staff; wrong password fails", () => {
  const { api } = setup();
  const r = api.checkPassword("LAIRE2026!");
  assert.equal(r.kind, "staff");
  assert.deepEqual(
    r.kind === "staff" && r.staff.map((s) => s.name),
    ["Jordan Reyes", "Priya Shah", "Sam Barth"],
  );
  throwsApi(() => api.checkPassword("nope"), /did not work/);
  throwsApi(() => api.checkPassword(""));
});

test("staff can add themselves by name at login", () => {
  const { api } = setup();
  const { token } = api.login("LAIRE2026!", { name: "New Person" });
  const snap = api.snapshot(token);
  assert.equal(snap.me.name, "New Person");
  assert.equal(snap.me.role, "staff");
  // Logging in again with the same name reuses the person.
  const again = api.login("LAIRE2026!", { name: "new person" }).token;
  assert.equal(api.snapshot(again).me.id, snap.me.id);
});

test("client password logs into that company only", () => {
  const { api, staff } = setup();
  assert.equal(api.checkPassword("LAIRE2026!").kind, "staff");
  throwsApi(() => api.setClientPassword(staff, ACME, "short"), /8 characters/);
  throwsApi(() => api.setClientPassword(staff, ACME, "LAIRE2026!"), /staff password/);
  api.setClientPassword(staff, ACME, "northwind-pass-1");
  throwsApi(() => api.setClientPassword(staff, OTHER, "northwind-pass-1"), /already uses/);
  const check = api.checkPassword("northwind-pass-1");
  assert.deepEqual(check, { kind: "client", company: "Northwind Dental" });
  const guest = api.login("northwind-pass-1", { name: "Dana Whitfield" }).token;
  const snap = api.snapshot(guest);
  assert.equal(snap.me.id, DANA, "matched the existing guest by name");
  assert.equal(snap.me.company_name, "Northwind Dental");
});

test("guest sees only their company and nothing internal", () => {
  const { api, staff, store } = setup();
  const guest = guestLogin(api, staff);
  const s = api.snapshot(guest);
  assert.deepEqual(s.companies.map((c) => c.name), ["Northwind Dental"]);
  assert.ok(s.projects.every((p) => p.company_id === ACME));
  assert.ok(!s.tasks.some((t) => t.id === INTERNAL), "internal task hidden");
  assert.ok(!s.tasks.some((t) => t.is_internal));
  assert.equal(s.time.length, 0, "no time for guests");
  assert.ok(!s.comments.some((c) => c.is_internal), "no internal comments");
  assert.ok(s.people.every((p) => p.role === "staff" || p.company_id === ACME));
  assert.ok(s.people.filter((p) => p.id !== DANA).every((p) => p.email === ""), "no emails leak");
  assert.ok(!s.companies.some((c) => c.has_client_password), "guests never learn password state");

  // Children of an internal task are hidden too.
  store.insert("Tasks", { ...store.all("Tasks").find((t) => t.id === COMP)!, id: "child-x", parent_id: INTERNAL, is_internal: false });
  assert.ok(!api.snapshot(guest).tasks.some((t) => t.id === "child-x"));
  // Staff still see everything.
  assert.ok(api.snapshot(staff).tasks.some((t) => t.id === "child-x"));
});

test("guests cannot change work, only comment and approve", () => {
  const { api, staff } = setup();
  const guest = guestLogin(api, staff);
  throwsApi(() => api.updateTask(guest, COMP, { title: "hacked" }), /Only LAIRE staff/);
  throwsApi(() => api.createTask(guest, { projectId: "30000000-0000-4000-8000-000000000001", title: "x" }));
  throwsApi(() => api.deleteTask(guest, COMP));
  throwsApi(() => api.logTime(guest, COMP, { date: "2026-01-01", hours: 1, billable: true }));
  throwsApi(() => api.createCompany(guest, { name: "x" }));
  throwsApi(() => api.setClientPassword(guest, ACME, "something-long"));
  throwsApi(() => api.addComment(guest, INTERNAL, "hi", false), /not found/);
  throwsApi(() => api.approveTask(guest, T(16)), /not found/); // another client's task

  // Internal flag is ignored for guests.
  const s = api.addComment(guest, COMP, "Looks good", true);
  const mine = s.comments.find((c) => c.body === "Looks good")!;
  assert.equal(mine.is_internal, false);

  const after = api.approveTask(guest, COMP);
  const t = after.tasks.find((x) => x.id === COMP)!;
  assert.equal(t.approved_by, DANA);
  assert.ok(t.approved_at);
});

test("notifications: mentions, comments, approvals, and no leaks to guests", () => {
  const { api, staff } = setup();
  const guest = guestLogin(api, staff);
  const jordan = api.login("LAIRE2026!", { personId: JORDAN }).token;
  const before = api.snapshot(jordan).notifications.length;

  api.addComment(guest, COMP, `Hi @[Jordan Reyes](${JORDAN})`, false);
  const kinds = api.snapshot(jordan).notifications.slice(0, api.snapshot(jordan).notifications.length - before).map((n) => n.kind);
  assert.deepEqual(kinds, ["mention"], "mention replaces the plain comment notice for the assignee");

  api.approveTask(guest, COMP);
  assert.equal(api.snapshot(jordan).notifications[0].kind, "approved");
  assert.ok(api.snapshot(staff).notifications.some((n) => n.kind === "approved" && n.task_id === COMP), "creator told too");

  // Assigning an internal task to the guest must not notify them.
  const guestBefore = api.snapshot(guest).notifications.length;
  api.updateTask(staff, INTERNAL, { assignee_id: DANA });
  assert.equal(api.snapshot(guest).notifications.length, guestBefore);
  // An internal note mentioning the guest must not notify them either.
  api.addComment(staff, COMP, `note @[Dana Whitfield](${DANA})`, true);
  assert.equal(api.snapshot(guest).notifications.length, guestBefore);
  // A visible assignment does.
  api.updateTask(staff, T(4), { assignee_id: DANA });
  assert.equal(api.snapshot(guest).notifications.length, guestBefore + 1);
});

test("status changes stamp completion", () => {
  const { api, staff } = setup();
  let t = api.updateTask(staff, T(6), { status: "complete" }).tasks.find((x) => x.id === T(6))!;
  assert.ok(t.completed_at);
  t = api.updateTask(staff, T(6), { status: "in_progress" }).tasks.find((x) => x.id === T(6))!;
  assert.equal(t.completed_at, null);
  throwsApi(() => api.updateTask(staff, T(6), { status: "bogus" as never }));
  throwsApi(() => api.updateTask(staff, T(6), { due_date: "next week" }));
});

test("deleting a task removes subtasks and everything attached", () => {
  const { api, staff, store, env } = setup();
  api.uploadAttachment(staff, T(12), { name: "a.txt", type: "text/plain", base64: Buffer.from("hi").toString("base64") });
  assert.equal(env.files.blobs.size, 1);
  api.deleteTask(staff, COMP);
  const ids = new Set(store.all<{ id: string }>("Tasks").map((t) => t.id));
  assert.ok(!ids.has(COMP) && !ids.has(T(11)) && !ids.has(T(12)));
  assert.equal(store.all<{ task_id: string }>("Comments").filter((c) => c.task_id === COMP).length, 0);
  assert.equal(store.all<{ task_id: string }>("Time").filter((c) => c.task_id === COMP).length, 0);
  assert.equal(store.all("Attachments").length, 0);
  assert.equal(env.files.blobs.size, 0, "Drive file trashed");
  assert.ok(store.all<{ task_id: string; depends_on_id: string }>("Dependencies").every((d) => d.task_id !== COMP && d.depends_on_id !== COMP));
});

test("dependencies refuse loops", () => {
  const { api, staff } = setup();
  // Demo: 6 waits on 5, 5 waits on 4. Making 4 wait on 6 closes a loop.
  throwsApi(() => api.addDependency(staff, T(4), T(6)), /loop/);
  throwsApi(() => api.addDependency(staff, T(4), T(4)));
  api.addDependency(staff, T(9), T(4));
});

test("attachments: guests can download visible files only", () => {
  const { api, staff } = setup();
  const b64 = Buffer.from("draft").toString("base64");
  let s = api.uploadAttachment(staff, COMP, { name: "draft.txt", type: "text/plain", base64: b64 });
  const visible = s.attachments.find((a) => a.task_id === COMP)!.id;
  s = api.uploadAttachment(staff, INTERNAL, { name: "margin.xlsx", type: "x", base64: b64 });
  const hidden = s.attachments.find((a) => a.task_id === INTERNAL)!.id;
  const guest = guestLogin(api, staff);
  assert.equal(api.getAttachment(guest, visible).base64, b64);
  throwsApi(() => api.getAttachment(guest, hidden), /not found/);
});

test("sessions expire and die with the client password", () => {
  let now = new Date("2026-10-01T00:00:00Z");
  const env = nodeEnv({ now: () => now });
  const api = new Api(new MemoryStore(demoData(now)), env);
  const staff = api.login("LAIRE2026!", { personId: SAM }).token;
  api.setClientPassword(staff, ACME, "northwind-pass-1");
  const guest = api.login("northwind-pass-1", { name: "Dana Whitfield" }).token;
  api.setClientPassword(staff, ACME, "");
  throwsApi(() => api.snapshot(guest), /Signed out/);
  now = new Date("2026-11-15T00:00:00Z");
  throwsApi(() => api.snapshot(staff), /Signed out/);
  throwsApi(() => api.snapshot("made-up"), /Signed out/);
});

test("dispatch only exposes public methods and hides internals", () => {
  const { api } = setup();
  assert.deepEqual(dispatch(api, "removeTasks", [["x"]]), { error: "Unknown action" });
  assert.deepEqual(dispatch(api, "context", ["x"]), { error: "Unknown action" });
  assert.deepEqual(dispatch(api, "snapshot", ["bad"]), { error: "Signed out" });
});
