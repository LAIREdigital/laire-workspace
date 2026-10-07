import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  Attachment,
  Comment,
  Company,
  CustomField,
  Milestone,
  Notification,
  Profile,
  Project,
  Task,
  TimeEntry,
} from "@/lib/types";

// Every read goes through the user's own session, so RLS decides what comes back.

export const getPeople = cache(async (): Promise<Profile[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  return (data ?? []) as Profile[];
});

export const getCompanies = cache(async (): Promise<Company[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").order("name");
  return (data ?? []) as Company[];
});

export const getProjects = cache(async (): Promise<Project[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").order("name");
  return (data ?? []) as Project[];
});

export async function getCompany(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  return data as Company | null;
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  return data as Project | null;
}

export async function getMilestones(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  return (data ?? []) as Milestone[];
}

export async function getProjectTasks(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  return (data ?? []) as Task[];
}

export async function getProjectDependencies(taskIds: string[]) {
  if (taskIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_dependencies")
    .select("task_id, depends_on_id")
    .in("task_id", taskIds);
  return (data ?? []) as { task_id: string; depends_on_id: string }[];
}

export async function getCustomFields(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  return (data ?? []) as CustomField[];
}

export async function getFieldValues(taskIds: string[]) {
  if (taskIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_field_values")
    .select("task_id, field_id, value")
    .in("task_id", taskIds);
  return (data ?? []) as { task_id: string; field_id: string; value: string | null }[];
}

export async function getMyTasks(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("assignee_id", userId)
    .neq("status", "complete")
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as Task[];
}

// Guests: deliverables in their projects that still wait on their approval.
export async function getPendingApprovals() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("needs_approval", true)
    .is("approved_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as Task[];
}

export type TaskDetail = {
  task: Task;
  subtasks: Task[];
  comments: Comment[];
  attachments: Attachment[];
  time: TimeEntry[];
  fields: CustomField[];
  values: Record<string, string | null>;
  dependsOn: Task[];
  projectTasks: Task[];
};

export async function getTaskDetail(id: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) return null;
  const t = task as Task;
  const [subtasks, comments, attachments, time, fields, values, deps, projectTasks] =
    await Promise.all([
      supabase.from("tasks").select("*").eq("parent_id", id).order("position").order("created_at"),
      supabase.from("comments").select("*").eq("task_id", id).order("created_at"),
      supabase.from("attachments").select("*").eq("task_id", id).order("created_at"),
      supabase.from("time_entries").select("*").eq("task_id", id).order("work_date", { ascending: false }),
      supabase.from("custom_fields").select("*").eq("project_id", t.project_id).order("position"),
      supabase.from("custom_field_values").select("field_id, value").eq("task_id", id),
      supabase.from("task_dependencies").select("depends_on_id").eq("task_id", id),
      supabase.from("tasks").select("*").eq("project_id", t.project_id).is("parent_id", null).order("title"),
    ]);
  const depIds = new Set((deps.data ?? []).map((d) => d.depends_on_id as string));
  const all = (projectTasks.data ?? []) as Task[];
  return {
    task: t,
    subtasks: (subtasks.data ?? []) as Task[],
    comments: (comments.data ?? []) as Comment[],
    attachments: (attachments.data ?? []) as Attachment[],
    time: (time.data ?? []) as TimeEntry[],
    fields: (fields.data ?? []) as CustomField[],
    values: Object.fromEntries((values.data ?? []).map((v) => [v.field_id, v.value])),
    dependsOn: all.filter((x) => depIds.has(x.id)),
    projectTasks: all,
  };
}

export async function getNotifications() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as Notification[];
}

export async function getUnreadCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

export async function getInvites(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invites").select("email, created_at").eq("company_id", companyId);
  return (data ?? []) as { email: string; created_at: string }[];
}

export async function getMyTime(userId: string, from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select("*, tasks(title, project_id)")
    .eq("user_id", userId)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: false });
  return (data ?? []) as (TimeEntry & { tasks: { title: string; project_id: string } | null })[];
}
