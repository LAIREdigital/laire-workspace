// Runs the built dist/Code.gs against fake Google services, so the bundle,
// the entry point stubs and the Sheet storage are all exercised.
// Run npm run build first (npm test does not build).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCodeGs } from "../dev/gas-fake";

type Snap = { me: { name: string; role: string }; tasks: { id: string; title: string; due_date: string | null; is_internal: boolean }[]; attachments: { id: string }[] };

test("Code.gs: setup, demo data, sign in, edit, files", () => {
  const gs = loadCodeGs();
  gs.g.setup();
  const names = gs.book.sheets.map((s) => s.name);
  assert.ok(names.includes("Tasks") && names.includes("Sessions") && !names.includes("Sheet1"));
  assert.deepEqual(gs.book.getSheetByName("Tasks")!.data[0].slice(0, 3), ["id", "project_id", "milestone_id"]);
  assert.ok(gs.book.getSheetByName("Sessions")!.hidden);
  assert.equal(gs.props.get("STAFF_PASSWORD"), "LAIRE2026!");

  gs.g.loadDemoData();
  assert.throws(() => gs.g.loadDemoData(), /already has data/);

  const page = gs.g.doGet() as { file: string; title: string };
  assert.deepEqual([page.file, page.title], ["Index", "LAIRE Workspace"]);

  assert.equal(gs.call("checkPassword", "wrong").error, "That password did not work.");
  const check = gs.call("checkPassword", "LAIRE2026!").data as { staff: { id: string; name: string }[] };
  const sam = check.staff.find((s) => s.name === "Sam Barth")!;
  const { token } = gs.call("login", "LAIRE2026!", { personId: sam.id }).data as { token: string };

  let snap = gs.call("snapshot", token).data as Snap;
  assert.equal(snap.me.name, "Sam Barth");
  assert.equal(snap.tasks.length, 17);
  // Dates survive the round trip through the sheet as plain text.
  assert.match(snap.tasks[0].due_date ?? "", /^\d{4}-\d{2}-\d{2}$/);

  const target = snap.tasks.find((t) => t.title === "Homepage design comp")!;
  snap = gs.call("updateTask", token, target.id, { title: "Homepage comp v2", due_date: "2026-12-01" }).data as Snap;
  const edited = snap.tasks.find((t) => t.id === target.id)!;
  assert.equal(edited.title, "Homepage comp v2");
  assert.equal(edited.due_date, "2026-12-01");
  // The row really changed in the sheet.
  const row = gs.book.getSheetByName("Tasks")!.data.find((r) => r[0] === target.id)!;
  assert.equal(row[4], "Homepage comp v2");

  const b64 = Buffer.from("hello file").toString("base64");
  snap = gs.call("uploadAttachment", token, target.id, { name: "brief.txt", type: "text/plain", base64: b64 }).data as Snap;
  const file = gs.call("getAttachment", token, snap.attachments[0].id).data as { base64: string; name: string };
  assert.equal(Buffer.from(file.base64, "base64").toString(), "hello file");

  // Client password, client sign in, internal work hidden.
  const company = (gs.call("snapshot", token).data as { companies: { id: string; name: string }[] }).companies.find(
    (c) => c.name === "Northwind Dental",
  )!;
  assert.ok(!gs.call("setClientPassword", token, company.id, "northwind-2026").error);
  const guest = (gs.call("login", "northwind-2026", { name: "Dana Whitfield" }).data as { token: string }).token;
  const gsnap = gs.call("snapshot", guest).data as Snap;
  assert.equal(gsnap.me.role, "guest");
  assert.ok(gsnap.tasks.length > 0 && gsnap.tasks.every((t) => !t.is_internal));
  assert.equal(gs.call("updateTask", guest, target.id, { title: "x" }).error, "Only LAIRE staff can do that.");

  // Deleting removes the sheet rows and trashes the Drive file.
  gs.call("deleteTask", token, target.id);
  assert.ok(!gs.book.getSheetByName("Tasks")!.data.some((r) => r[0] === target.id));
  assert.ok([...gs.files.values()].every((f) => f.trashed));

  assert.equal(gs.call("nope", token).error, "Unknown action");
});
