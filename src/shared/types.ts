export type Role = "staff" | "guest";
export type ProjectStatus = "planned" | "active" | "on_hold" | "complete";
export type TaskStatus = "not_started" | "in_progress" | "in_review" | "complete";
export type Priority = "none" | "low" | "medium" | "high";
export type FieldType = "text" | "number" | "select" | "date";

export type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
  company_id: string;
};

export type Company = { id: string; name: string; website: string; has_client_password: boolean };

export type Project = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
};

export type Milestone = {
  id: string;
  project_id: string;
  name: string;
  start_date: string | null;
  due_date: string | null;
  position: number;
};

export type Task = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_internal: boolean;
  needs_approval: boolean;
  approved_at: string | null;
  approved_by: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type Attachment = {
  id: string;
  task_id: string;
  file_name: string;
  size_bytes: number;
  content_type: string;
  uploaded_by: string;
  created_at: string;
};

export type Dependency = { id: string; task_id: string; depends_on_id: string };

export type FieldValue = { id: string; task_id: string; field_id: string; value: string };

export type CustomField = {
  id: string;
  project_id: string;
  name: string;
  type: FieldType;
  options: string[];
  position: number;
};

export type TimeEntry = {
  id: string;
  task_id: string;
  user_id: string;
  work_date: string;
  hours: number;
  note: string | null;
  billable: boolean;
};

export type Me = Person & { company_name: string };

// Everything the signed in person may see, already filtered on the server.
export type Snapshot = {
  me: Me;
  companies: Company[];
  people: Person[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  dependencies: Dependency[];
  comments: Comment[];
  attachments: Attachment[];
  fields: CustomField[];
  values: FieldValue[];
  time: TimeEntry[];
  notifications: Notification[];
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  task_id: string | null;
  kind: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  in_review: "In review",
  complete: "Complete",
};

export const STATUSES: TaskStatus[] = ["not_started", "in_progress", "in_review", "complete"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  complete: "Complete",
};
