// Sheet tabs and their columns. Row 1 of every tab holds these headers.
// Kinds: "s" text, "n" nullable text (blank cell = null), "num" number, "bool" TRUE/FALSE, "json" JSON text.
export type Kind = "s" | "n" | "num" | "bool" | "json";

export const SCHEMA = {
  Companies: { id: "s", name: "s", website: "s", password_hash: "s", accelo_id: "n", created_at: "s" },
  People: { id: "s", name: "s", email: "s", role: "s", company_id: "s", accelo_id: "n", created_at: "s" },
  Projects: {
    id: "s", company_id: "s", name: "s", description: "n", status: "s", color: "s", owner_id: "n",
    start_date: "n", due_date: "n", accelo_id: "n", created_at: "s",
  },
  Milestones: { id: "s", project_id: "s", name: "s", start_date: "n", due_date: "n", position: "num", accelo_id: "n" },
  Tasks: {
    id: "s", project_id: "s", milestone_id: "n", parent_id: "n", title: "s", description: "n", status: "s",
    priority: "s", assignee_id: "n", start_date: "n", due_date: "n", completed_at: "n", is_internal: "bool",
    needs_approval: "bool", approved_at: "n", approved_by: "n", position: "num", created_by: "n", accelo_id: "n",
    created_at: "s", updated_at: "s",
  },
  Dependencies: { id: "s", task_id: "s", depends_on_id: "s" },
  Comments: { id: "s", task_id: "s", author_id: "s", body: "s", is_internal: "bool", created_at: "s" },
  Attachments: {
    id: "s", task_id: "s", file_id: "s", file_name: "s", size_bytes: "num", content_type: "s", uploaded_by: "s",
    created_at: "s",
  },
  Fields: { id: "s", project_id: "s", name: "s", type: "s", options: "json", position: "num" },
  FieldValues: { id: "s", task_id: "s", field_id: "s", value: "s" },
  Time: {
    id: "s", task_id: "s", user_id: "s", work_date: "s", hours: "num", note: "n", billable: "bool", accelo_id: "n",
  },
  Notifications: {
    id: "s", user_id: "s", actor_id: "n", task_id: "n", kind: "s", body: "s", read_at: "n", created_at: "s",
  },
  Sessions: { id: "s", person_id: "s", role: "s", company_id: "s", expires_at: "s" },
} as const satisfies Record<string, Record<string, Kind>>;

export type Table = keyof typeof SCHEMA;
export type Row = Record<string, unknown> & { id: string };

export const TABLES = Object.keys(SCHEMA) as Table[];

// Converts a raw cell value into its typed form.
export function fromCell(kind: Kind, v: unknown): unknown {
  if (v instanceof Date) v = isoDateOrTime(v);
  switch (kind) {
    case "num":
      return v === "" || v === null || v === undefined ? 0 : Number(v);
    case "bool":
      return v === true || v === "TRUE" || v === "true";
    case "json":
      if (typeof v !== "string" || v === "") return [];
      try {
        return JSON.parse(v);
      } catch {
        return [];
      }
    case "n":
      return v === "" || v === null || v === undefined ? null : String(v);
    default:
      return v === null || v === undefined ? "" : String(v);
  }
}

export function toCell(kind: Kind, v: unknown): string | number | boolean {
  switch (kind) {
    case "num":
      return Number(v ?? 0);
    case "bool":
      return !!v;
    case "json":
      return JSON.stringify(v ?? []);
    default:
      return v === null || v === undefined ? "" : String(v);
  }
}

// Sheets turns date-like text into Date objects if a cell is not plain text.
// Tabs are formatted as plain text on setup; this is the safety net.
function isoDateOrTime(d: Date) {
  const iso = d.toISOString();
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 ? iso.slice(0, 10) : iso;
}
