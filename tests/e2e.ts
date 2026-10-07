// Browser walkthrough against the local preview (npm run build && npm run dev).
//   npm run e2e                 checks only
//   SHOTS=dir npm run e2e       also saves screenshots
// Set PW_CHROMIUM to a Chromium binary if Playwright has no browser installed.
import { chromium, type Page } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8787";
const SHOTS = process.env.SHOTS;
const results: string[] = [];
const errors: string[] = [];
let failed = 0;

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (e) {
    failed++;
    results.push(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`);
  }
}
const shot = async (page: Page, name: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });

async function signIn(page: Page, password: string, who: { pick?: string; name?: string }) {
  await page.goto(BASE);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  if (who.pick) {
    await page.locator("select").selectOption({ label: who.pick });
  } else {
    await page.getByPlaceholder("Your name").fill(who.name!);
  }
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Sign out").waitFor();
}

const go = (page: Page, hash: string) => page.evaluate((h) => (window.location.hash = h), hash);
const WEB = "/projects/30000000-0000-4000-8000-000000000001";
const COMP = "50000000-0000-4000-8000-000000000005";

if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  return page;
};

const p = await newPage();
await step("login screen", async () => {
  await p.goto(BASE);
  await p.getByPlaceholder("Password").waitFor();
  await shot(p, "01-login");
});
await step("wrong password rejected", async () => {
  await p.getByPlaceholder("Password").fill("guess");
  await p.getByRole("button", { name: "Continue" }).click();
  await p.getByText("That password did not work.").waitFor();
});
await step("staff sign in", async () => {
  await signIn(p, "LAIRE2026!", { pick: "Sam Barth" });
  await p.getByRole("heading", { name: "My Tasks" }).waitFor();
  await shot(p, "02-my-tasks");
});
await step("list view", async () => {
  await go(p, WEB);
  await p.getByText("Homepage design comp").first().waitFor();
  await shot(p, "03-list");
});
await step("quick add task", async () => {
  await p.getByPlaceholder("+ Add task").first().fill("Brand photography shot list");
  await p.getByPlaceholder("+ Add task").first().press("Enter");
  await p.getByRole("link", { name: "Brand photography shot list" }).waitFor({ timeout: 10000 });
});
await step("complete toggle", async () => {
  const before = await p.getByRole("button", { name: "Mark complete" }).count();
  await p.getByRole("button", { name: "Mark complete" }).first().click();
  await p.waitForFunction((n) => document.querySelectorAll('button[aria-label="Mark complete"]').length === n - 1, before);
});
await step("board view and drag", async () => {
  await go(p, `${WEB}?view=board`);
  await p.getByRole("heading", { name: "In review" }).waitFor();
  await shot(p, "04-board");
  const card = p.getByRole("link", { name: "Interior page templates" });
  const target = p.getByRole("heading", { name: "In review" });
  const a = (await card.boundingBox())!;
  const b = (await target.boundingBox())!;
  await p.mouse.move(a.x + 20, a.y + 5);
  await p.mouse.down();
  await p.mouse.move(a.x + 60, a.y + 30, { steps: 5 });
  await p.mouse.move(b.x + 40, b.y + 120, { steps: 10 });
  await p.mouse.up();
  const column = p.locator("div.w-72", { has: p.getByRole("heading", { name: "In review" }) });
  await column.getByRole("link", { name: "Interior page templates" }).waitFor({ timeout: 10000 });
});
await step("calendar view", async () => {
  await go(p, `${WEB}?view=calendar`);
  await p.getByText("Homepage design comp").first().waitFor();
  await shot(p, "05-calendar");
});
await step("timeline view", async () => {
  await go(p, `${WEB}?view=timeline`);
  await p.getByText("Launch and QA").first().waitFor();
  await shot(p, "06-timeline");
});
await step("task panel", async () => {
  await go(p, `${WEB}?task=${COMP}`);
  await p.getByText("Waiting on client approval.").waitFor();
  await shot(p, "07-task-panel");
});
await step("comment with mention", async () => {
  const box = p.getByPlaceholder("Write a comment. Type @ to mention someone.");
  await box.fill("Updated hero, see v2 @Pri");
  await box.press("End");
  await box.pressSequentially("y");
  await p.getByRole("button", { name: /Priya Shah/ }).click();
  await p.getByRole("button", { name: "Comment", exact: true }).click();
  await p.locator("span", { hasText: "@Priya Shah" }).first().waitFor({ timeout: 10000 });
});
await step("log time", async () => {
  await p.getByPlaceholder("Hours").fill("1.25");
  await p.getByPlaceholder("Note").fill("Hero revisions");
  await p.getByRole("button", { name: "Log", exact: true }).click();
  await p.getByText("Sam Barth: Hero revisions").waitFor({ timeout: 10000 });
});
await step("upload and download file", async () => {
  const file = `${SHOTS ?? "/tmp"}/hero-v2.txt`;
  fs.writeFileSync(file, "hero v2 notes");
  await p.locator("input[type=file]").setInputFiles(file);
  await p.getByRole("button", { name: "hero-v2.txt" }).waitFor({ timeout: 10000 });
  const [download] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "hero-v2.txt" }).click()]);
  const path = await download.path();
  if (fs.readFileSync(path!, "utf8") !== "hero v2 notes") throw new Error("download content mismatch");
});
await step("add subtask", async () => {
  await p.getByPlaceholder("+ Add a subtask").fill("Export final assets");
  await p.getByPlaceholder("+ Add a subtask").press("Enter");
  await p.getByRole("link", { name: "Export final assets" }).waitFor({ timeout: 10000 });
});
await step("custom fields in list", async () => {
  await go(p, "/projects/30000000-0000-4000-8000-000000000002");
  await p.getByText("replace toothbrush").waitFor();
});
await step("settings: add milestone and field", async () => {
  await go(p, `${WEB}?view=settings`);
  await p.getByPlaceholder("New milestone").fill("Post launch");
  await p.getByRole("button", { name: "Add", exact: true }).click();
  await p.locator('input[value="Post launch"]').waitFor({ timeout: 10000 });
  await p.getByPlaceholder("Field name").fill("Page type");
  await p.getByRole("button", { name: "Add field" }).click();
  await p.getByText("Page type").waitFor({ timeout: 10000 });
  await shot(p, "08-settings");
});
await step("inbox", async () => {
  await go(p, "/inbox");
  await p.getByText("commented on").first().waitFor();
  await shot(p, "09-inbox");
});
await step("my time", async () => {
  await go(p, "/time");
  await p.getByText("Hero revisions").waitFor();
  await shot(p, "10-time");
});
await step("team page", async () => {
  await go(p, "/team");
  await p.getByPlaceholder("Full name").fill("Morgan Lee");
  await p.getByRole("button", { name: "Add", exact: true }).click();
  await p.getByText("Morgan Lee").waitFor({ timeout: 10000 });
});
await step("client password", async () => {
  await go(p, "/companies/10000000-0000-4000-8000-000000000001");
  await p.getByPlaceholder("Set a password").fill("northwind-2026");
  await p.getByRole("button", { name: "Save" }).click();
  await p.getByText("Send Northwind Dental this password: northwind-2026").waitFor({ timeout: 10000 });
  await shot(p, "11-company");
});
await step("new company and project", async () => {
  await go(p, "/companies/new");
  await p.locator("input[name=name]").fill("Bluebird Bakery");
  await p.getByRole("button", { name: "Create company" }).click();
  await p.getByRole("heading", { name: "Bluebird Bakery" }).waitFor({ timeout: 10000 });
  await p.getByRole("button", { name: "+ New project" }).click();
  await p.locator("input[name=name]").fill("Launch Campaign");
  await p.getByRole("button", { name: "Create project" }).click();
  await p.getByRole("heading", { name: "Launch Campaign" }).waitFor({ timeout: 10000 });
});
await step("mobile layout", async () => {
  await p.setViewportSize({ width: 390, height: 844 });
  await go(p, WEB);
  await p.getByText("Homepage design comp").first().waitFor();
  await shot(p, "12-mobile");
  await p.setViewportSize({ width: 1440, height: 900 });
});
await step("session survives reload", async () => {
  await p.reload();
  await p.getByText("Sign out").waitFor();
});

const g = await newPage();
await step("client sign in", async () => {
  await signIn(g, "northwind-2026", { name: "Dana Whitfield" });
  await g.getByText("Waiting on your approval").waitFor();
  await shot(g, "13-client-home");
});
await step("client sees no internal work or other clients", async () => {
  await go(g, WEB);
  await g.getByText("Homepage design comp").first().waitFor();
  if (await g.getByText("Scope and margin check").count()) throw new Error("internal task visible");
  if (await g.getByPlaceholder("+ Add task").count()) throw new Error("client can add tasks");
  if (await g.getByText("Harbor Logistics").count()) throw new Error("other company visible");
  await shot(g, "14-client-list");
  await go(g, "/projects/30000000-0000-4000-8000-000000000003");
  await g.getByText("Project not found").waitFor();
});
await step("client task panel and approve", async () => {
  await go(g, `${WEB}?task=${COMP}`);
  await g.getByText("LAIRE needs your approval on this.").waitFor();
  if (await g.getByText("Push for B").count()) throw new Error("internal comment visible");
  if (await g.getByText("Hero revisions").count()) throw new Error("time visible");
  await shot(g, "15-client-task");
  await g.getByRole("button", { name: "Approve" }).click();
  await g.getByText(/Approved by Dana/).waitFor({ timeout: 10000 });
});
await step("client comment", async () => {
  await g.getByPlaceholder("Write a comment. Type @ to mention someone.").fill("Approved, thanks team");
  await g.getByRole("button", { name: "Comment", exact: true }).click();
  await g.getByText("Approved, thanks team").waitFor({ timeout: 10000 });
});
await step("staff sees approval in inbox", async () => {
  await go(p, "/my-tasks");
  await p.reload();
  await go(p, "/inbox");
  await p.getByText('approved "Homepage design comp"').waitFor({ timeout: 10000 });
});
await step("sign out", async () => {
  await go(g, "/my-tasks");
  await g.getByRole("button", { name: "Sign out" }).click();
  await g.getByPlaceholder("Password").waitFor();
});

await browser.close();
console.log(results.join("\n"));
console.log(errors.length ? `\nbrowser errors:\n${errors.join("\n")}` : "\nno browser errors");
process.exit(failed || errors.length ? 1 : 0);
