import type { Row, Table } from "./schema";

// Demo data, fictional except Sam. Dates are relative to today so the views
// always look alive. Loaded only into an empty sheet.
export function demoData(today: Date): Partial<Record<Table, Row[]>> {
  const day = (n: number) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);
  const ago = (hours: number) => new Date(today.getTime() - hours * 3600000).toISOString();
  const now = today.toISOString();
  const C = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
  const P = (n: number) => `20000000-0000-4000-8000-00000000000${n}`;
  const J = (n: number) => `30000000-0000-4000-8000-00000000000${n}`;
  const M = (n: number) => `40000000-0000-4000-8000-00000000000${n}`;
  const T = (n: number) => `50000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
  const F = (n: number) => `60000000-0000-4000-8000-00000000000${n}`;
  const [sam, jordan, priya, dana] = [P(1), P(2), P(3), P(4)];

  const task = (
    n: number,
    project: number,
    milestone: number | null,
    title: string,
    status: string,
    priority: string,
    assignee: string,
    start: number | null,
    due: number | null,
    extra: Record<string, unknown> = {},
  ): Row => ({
    id: T(n),
    project_id: J(project),
    milestone_id: milestone ? M(milestone) : null,
    parent_id: null,
    title,
    description: null,
    status,
    priority,
    assignee_id: assignee,
    start_date: start === null ? null : day(start),
    due_date: due === null ? null : day(due),
    completed_at: status === "complete" ? now : null,
    is_internal: false,
    needs_approval: false,
    approved_at: null,
    approved_by: null,
    position: n,
    created_by: sam,
    accelo_id: null,
    created_at: now,
    updated_at: now,
    ...extra,
  });

  return {
    Companies: [
      { id: C(1), name: "Northwind Dental", website: "https://northwind-dental.example", password_hash: "", created_at: now },
      { id: C(2), name: "Harbor Logistics", website: "https://harbor-logistics.example", password_hash: "", created_at: now },
      { id: C(3), name: "Summit Credit Union", website: "https://summit-cu.example", password_hash: "", created_at: now },
    ],
    People: [
      { id: sam, name: "Sam Barth", email: "sbarth@lairedigital.com", role: "staff", company_id: "", created_at: now },
      { id: jordan, name: "Jordan Reyes", email: "", role: "staff", company_id: "", created_at: now },
      { id: priya, name: "Priya Shah", email: "", role: "staff", company_id: "", created_at: now },
      { id: dana, name: "Dana Whitfield", email: "dana@northwind-dental.example", role: "guest", company_id: C(1), created_at: now },
    ],
    Projects: [
      { id: J(1), company_id: C(1), name: "Website Redesign", description: "New site on HubSpot CMS, 14 pages plus blog migration.", status: "active", color: "#ff8b71", owner_id: sam, start_date: day(-21), due_date: day(40), created_at: now },
      { id: J(2), company_id: C(1), name: "Q4 Content Retainer", description: "Four blogs and two ROPS a month.", status: "active", color: "#8bd8d5", owner_id: jordan, start_date: day(-10), due_date: day(80), created_at: now },
      { id: J(3), company_id: C(2), name: "SEO and AEO Program", description: "Technical fixes, keyword focus, answer engine content.", status: "active", color: "#b4bb65", owner_id: priya, start_date: day(-30), due_date: day(60), created_at: now },
      { id: J(4), company_id: C(3), name: "Paid Search Launch", description: "Google Ads and LinkedIn for the HELOC campaign.", status: "planned", color: "#81b5c6", owner_id: sam, start_date: day(5), due_date: day(45), created_at: now },
    ],
    Milestones: [
      { id: M(1), project_id: J(1), name: "Discovery", start_date: day(-21), due_date: day(-8), position: 0 },
      { id: M(2), project_id: J(1), name: "Design", start_date: day(-9), due_date: day(10), position: 1 },
      { id: M(3), project_id: J(1), name: "Build and Launch", start_date: day(8), due_date: day(40), position: 2 },
      { id: M(4), project_id: J(2), name: "October", start_date: day(-10), due_date: day(20), position: 0 },
    ],
    Tasks: [
      task(1, 1, 1, "Kickoff call and stakeholder interviews", "complete", "medium", sam, -21, -18),
      task(2, 1, 1, "Sitemap and page inventory", "complete", "high", priya, -17, -10, {
        description: "Map every current URL to the new structure. Flag redirects.",
        needs_approval: true, approved_at: ago(24 * 9), approved_by: dana,
      }),
      task(3, 1, 1, "Scope and margin check", "complete", "medium", sam, -10, -8, { is_internal: true, description: "Hours vs. SOW after discovery." }),
      task(4, 1, 2, "Homepage wireframe", "complete", "high", jordan, -9, -4),
      task(5, 1, 2, "Homepage design comp", "in_review", "high", jordan, -3, 2, { needs_approval: true, description: "Two directions, LAIRE recommends option B." }),
      task(6, 1, 2, "Interior page templates", "in_progress", "medium", jordan, 0, 9),
      task(7, 1, 2, "Service page copy", "in_progress", "medium", priya, -2, -1, { needs_approval: true }),
      task(8, 1, 3, "Build HubSpot theme modules", "not_started", "medium", jordan, 10, 25),
      task(9, 1, 3, "301 redirect map", "not_started", "high", priya, 20, 30),
      task(10, 1, 3, "Launch and QA", "not_started", "high", sam, 31, 40, { needs_approval: true }),
      task(11, 1, 2, "Hero image options", "complete", "none", jordan, null, -1, { parent_id: T(5), created_by: jordan }),
      task(12, 1, 2, "Mobile version", "in_progress", "none", jordan, null, 1, { parent_id: T(5), created_by: jordan }),
      task(13, 2, 4, "Blog: How often should you replace a toothbrush", "in_review", "medium", jordan, -6, 1, { needs_approval: true, created_by: jordan }),
      task(14, 2, 4, "Blog: Invisalign vs braces cost guide", "in_progress", "medium", sam, -2, 6, { created_by: jordan }),
      task(15, 2, 4, "ROPS: Emergency dentist page", "not_started", "low", priya, 7, 14, { created_by: jordan }),
      task(16, 3, null, "Fix crawl errors from site audit", "in_progress", "high", priya, -5, 0, { created_by: priya }),
      task(17, 3, null, "Monthly SEO and AEO report", "not_started", "medium", sam, 3, 4, { created_by: priya }),
    ],
    Dependencies: [
      [5, 4], [6, 5], [8, 6], [10, 8], [10, 9],
    ].map(([a, b], i) => ({ id: `70000000-0000-4000-8000-00000000000${i}`, task_id: T(a), depends_on_id: T(b) })),
    Fields: [
      { id: F(1), project_id: J(2), name: "Content type", type: "select", options: ["Blog", "ROPS", "Webpage", "Email"], position: 1 },
      { id: F(2), project_id: J(2), name: "Target keyword", type: "text", options: [], position: 2 },
      { id: F(3), project_id: J(2), name: "Word count", type: "number", options: [], position: 3 },
    ],
    FieldValues: [
      [13, 1, "Blog"], [13, 2, "replace toothbrush"], [13, 3, "1200"],
      [14, 1, "Blog"], [14, 2, "invisalign cost"], [15, 1, "ROPS"], [15, 2, "emergency dentist"],
    ].map(([t, f, v]) => ({ id: `${T(t as number)}:${F(f as number)}`, task_id: T(t as number), field_id: F(f as number), value: v })),
    Comments: [
      { id: "80000000-0000-4000-8000-000000000001", task_id: T(5), author_id: jordan, body: "Both directions are in the Figma link. Option B tests better on mobile.", is_internal: false, created_at: ago(20) },
      { id: "80000000-0000-4000-8000-000000000002", task_id: T(5), author_id: sam, body: "Push for B. If they want A we should flag the extra round of revisions.", is_internal: true, created_at: ago(18) },
      { id: "80000000-0000-4000-8000-000000000003", task_id: T(5), author_id: dana, body: `Leaning B too. Can the hero be a little warmer? @[Jordan Reyes](${jordan})`, is_internal: false, created_at: ago(3) },
    ],
    Time: [
      { id: "90000000-0000-4000-8000-000000000001", task_id: T(5), user_id: jordan, work_date: day(-2), hours: 3.5, note: "Comp option A", billable: true },
      { id: "90000000-0000-4000-8000-000000000002", task_id: T(5), user_id: jordan, work_date: day(-1), hours: 4, note: "Comp option B", billable: true },
      { id: "90000000-0000-4000-8000-000000000003", task_id: T(14), user_id: sam, work_date: day(0), hours: 2, note: "Outline and research", billable: true },
      { id: "90000000-0000-4000-8000-000000000004", task_id: T(3), user_id: sam, work_date: day(-8), hours: 1, note: "Margin review", billable: false },
    ],
    Notifications: [
      { id: "a0000000-0000-4000-8000-000000000001", user_id: sam, actor_id: dana, task_id: T(2), kind: "approved", body: 'approved "Sitemap and page inventory"', read_at: null, created_at: ago(24 * 9) },
      { id: "a0000000-0000-4000-8000-000000000002", user_id: sam, actor_id: jordan, task_id: T(14), kind: "assigned", body: 'assigned you "Blog: Invisalign vs braces cost guide"', read_at: null, created_at: ago(48) },
      { id: "a0000000-0000-4000-8000-000000000003", user_id: sam, actor_id: dana, task_id: T(5), kind: "comment", body: 'commented on "Homepage design comp"', read_at: null, created_at: ago(3) },
      { id: "a0000000-0000-4000-8000-000000000004", user_id: dana, actor_id: jordan, task_id: T(5), kind: "comment", body: 'commented on "Homepage design comp"', read_at: null, created_at: ago(20) },
    ],
  };
}
