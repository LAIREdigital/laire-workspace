import { test } from "node:test";
import assert from "node:assert/strict";
import { importAccelo, acceloDate, type AcceloData } from "../src/server/accelo";
import { MemoryStore } from "../src/server/store";
import { nodeEnv } from "../dev/node-env";

const data: AcceloData = {
  companies: [
    { id: "101", name: "Pinecrest Veterinary", website: "pinecrestvet.example" },
    { id: "102", name: "Orbit Fitness", website: "" },
  ],
  staff: [
    { id: "7", firstname: "Sam", surname: "Barth", email: "SBarth@lairedigital.com" },
    { id: "8", firstname: "Free", surname: "Lancer", email: "free@gmail.example" },
  ],
  jobs: [
    { id: "501", title: "Pinecrest SEO Retainer", company: "101", manager: "7", standing: "active", date_started: "1788220800", date_due: "1796083200" },
    { id: "502", title: "Orphan", company: "999", standing: "active" },
  ],
  milestones: [{ id: "601", title: "Month 1", job: "501", ordering: "1", date_started: "1788220800", date_due: "1790812800" }],
  tasks: [
    { id: "701", title: "Keyword research", against_type: "milestone", against_id: "601", assignee: "7", standing: "complete" },
    { id: "702", title: "Technical audit", against_type: "job", against_id: "501", assignee: "7", standing: "started" },
    { id: "703", title: "Ticket", against_type: "issue", against_id: "1" },
  ],
  activities: [
    { id: "801", subject: "Research", against_type: "task", against_id: "701", staff: "7", billable: "5400", nonbillable: "1800", date_logged: "1788300000" },
  ],
};

test("dates convert from unix seconds", () => {
  assert.equal(acceloDate("1788220800"), "2026-09-01");
  assert.equal(acceloDate("0"), null);
  assert.equal(acceloDate(undefined), null);
});

test("dry run writes nothing", () => {
  const store = new MemoryStore();
  const report = importAccelo(store, nodeEnv(), data, true);
  assert.ok(report.includes("Dry run, nothing written."));
  assert.equal(store.all("Companies").length, 0);
  assert.equal(store.all("Tasks").length, 0);
});

test("import maps the Accelo tree and is safe to re-run", () => {
  const store = new MemoryStore({
    People: [{ id: "sam-existing", name: "Sam Barth", email: "sbarth@lairedigital.com", role: "staff", company_id: "" }],
  });
  const env = nodeEnv();
  importAccelo(store, env, data);

  const people = store.all<{ id: string; role: string; accelo_id: string }>("People");
  assert.equal(people.length, 1, "matched Sam by email, skipped the freelancer");
  assert.equal(people[0].accelo_id, "7");

  const projects = store.all<{ name: string; status: string; owner_id: string; start_date: string }>("Projects");
  assert.deepEqual(projects.map((p) => [p.name, p.status, p.owner_id, p.start_date]), [
    ["Pinecrest SEO Retainer", "active", "sam-existing", "2026-09-01"],
  ]);
  const tasks = store.all<{ id: string; title: string; status: string; is_internal: boolean; milestone_id: string | null; assignee_id: string }>("Tasks");
  assert.deepEqual(tasks.map((t) => [t.title, t.status, t.is_internal, !!t.milestone_id, t.assignee_id]), [
    ["Keyword research", "complete", true, true, "sam-existing"],
    ["Technical audit", "in_progress", true, false, "sam-existing"],
  ]);
  const time = store.all<{ hours: number; billable: boolean }>("Time");
  assert.deepEqual(time.map((t) => [t.hours, t.billable]), [[1.5, true], [0.5, false]]);

  // Staff share a task, then the import runs again.
  store.update("Tasks", tasks[0].id, { is_internal: false });
  importAccelo(store, env, data);
  assert.equal(store.all("Companies").length, 2);
  assert.equal(store.all("Tasks").length, 2);
  assert.equal(store.all("Time").length, 2);
  assert.equal(store.all<{ is_internal: boolean }>("Tasks")[0].is_internal, false, "sharing choice kept");
});
