"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Priority, ProjectStatus, TaskStatus } from "@/lib/types";

// Every action re-checks the caller. RLS is the real guard; these checks give
// clear errors and keep guests out of staff only paths.

type Result = { error?: string };

function done(error?: { message: string } | null): Result {
  revalidatePath("/", "layout");
  return error ? { error: error.message } : {};
}

const clean = (s: string | null | undefined) => {
  const v = (s ?? "").trim();
  return v === "" ? null : v;
};

// Companies and guests ---------------------------------------------------------

export async function createCompany(name: string, website: string): Promise<Result> {
  await requireStaff();
  if (!clean(name)) return { error: "Name is required" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({ name: name.trim(), website: clean(website) })
    .select("id")
    .single();
  if (error) return done(error);
  revalidatePath("/", "layout");
  redirect(`/companies/${data.id}`);
}

export async function inviteGuest(companyId: string, email: string): Promise<Result> {
  const me = await requireStaff();
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: "Enter a valid email" };
  if (e.endsWith("@lairedigital.com")) return { error: "LAIRE staff sign in with Google, no invite needed" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("invites")
    .upsert({ email: e, company_id: companyId, invited_by: me.id });
  return done(error);
}

export async function revokeInvite(email: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("invites").delete().eq("email", email);
  return done(error);
}

// Projects and milestones ------------------------------------------------------

export async function createProject(input: {
  companyId: string;
  name: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
}): Promise<Result> {
  const me = await requireStaff();
  if (!clean(input.name)) return { error: "Name is required" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      description: clean(input.description),
      start_date: clean(input.startDate),
      due_date: clean(input.dueDate),
      owner_id: me.id,
    })
    .select("id")
    .single();
  if (error) return done(error);
  revalidatePath("/", "layout");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    status: ProjectStatus;
    color: string;
    owner_id: string | null;
    start_date: string | null;
    due_date: string | null;
  }>,
): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  return done(error);
}

export async function deleteProject(id: string, companyId: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return done(error);
  revalidatePath("/", "layout");
  redirect(`/companies/${companyId}`);
}

export async function createMilestone(
  projectId: string,
  name: string,
  startDate?: string,
  dueDate?: string,
): Promise<Result> {
  await requireStaff();
  if (!clean(name)) return { error: "Name is required" };
  const supabase = await createClient();
  const { count } = await supabase
    .from("milestones")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const { error } = await supabase.from("milestones").insert({
    project_id: projectId,
    name: name.trim(),
    start_date: clean(startDate),
    due_date: clean(dueDate),
    position: count ?? 0,
  });
  return done(error);
}

export async function updateMilestone(
  id: string,
  patch: Partial<{ name: string; start_date: string | null; due_date: string | null }>,
): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").update(patch).eq("id", id);
  return done(error);
}

export async function deleteMilestone(id: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  return done(error);
}

// Tasks ------------------------------------------------------------------------

export async function createTask(input: {
  projectId: string;
  title: string;
  milestoneId?: string | null;
  parentId?: string | null;
  status?: TaskStatus;
  dueDate?: string | null;
}): Promise<Result & { id?: string }> {
  await requireStaff();
  if (!clean(input.title)) return { error: "Title is required" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: input.projectId,
      title: input.title.trim(),
      milestone_id: input.milestoneId ?? null,
      parent_id: input.parentId ?? null,
      status: input.status ?? "not_started",
      due_date: input.dueDate ?? null,
      position: Date.now(),
    })
    .select("id")
    .single();
  if (error) return done(error);
  revalidatePath("/", "layout");
  return { id: data.id };
}

export type TaskPatch = Partial<{
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee_id: string | null;
  milestone_id: string | null;
  start_date: string | null;
  due_date: string | null;
  is_internal: boolean;
  needs_approval: boolean;
  position: number;
}>;

const TASK_KEYS = new Set([
  "title",
  "description",
  "status",
  "priority",
  "assignee_id",
  "milestone_id",
  "start_date",
  "due_date",
  "is_internal",
  "needs_approval",
  "position",
]);

export async function updateTask(id: string, patch: TaskPatch): Promise<Result> {
  await requireStaff();
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => TASK_KEYS.has(k)));
  if ("title" in safe && !clean(safe.title as string)) return { error: "Title is required" };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(safe).eq("id", id);
  return done(error);
}

export async function deleteTask(id: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  return done(error);
}

export async function approveTask(id: string): Promise<Result> {
  await getMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_task", { t: id });
  return done(error);
}

export async function addDependency(taskId: string, dependsOnId: string): Promise<Result> {
  await requireStaff();
  if (taskId === dependsOnId) return { error: "A task cannot depend on itself" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: taskId, depends_on_id: dependsOnId });
  return done(error);
}

export async function removeDependency(taskId: string, dependsOnId: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", taskId)
    .eq("depends_on_id", dependsOnId);
  return done(error);
}

// Custom fields ----------------------------------------------------------------

export async function createField(
  projectId: string,
  name: string,
  type: "text" | "number" | "select" | "date",
  options: string,
): Promise<Result> {
  await requireStaff();
  if (!clean(name)) return { error: "Name is required" };
  const opts =
    type === "select"
      ? options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : [];
  if (type === "select" && opts.length === 0) return { error: "Add at least one option" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("custom_fields")
    .insert({ project_id: projectId, name: name.trim(), type, options: opts, position: Date.now() });
  return done(error);
}

export async function deleteField(id: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("custom_fields").delete().eq("id", id);
  return done(error);
}

export async function setFieldValue(taskId: string, fieldId: string, value: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const v = clean(value);
  const { error } = v
    ? await supabase.from("custom_field_values").upsert({ task_id: taskId, field_id: fieldId, value: v })
    : await supabase.from("custom_field_values").delete().eq("task_id", taskId).eq("field_id", fieldId);
  return done(error);
}

// Comments ---------------------------------------------------------------------

export async function addComment(taskId: string, body: string, isInternal: boolean): Promise<Result> {
  const me = await getMe();
  if (!clean(body)) return { error: "Write something first" };
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    task_id: taskId,
    author_id: me.id,
    body: body.trim(),
    is_internal: me.role === "staff" ? isInternal : false,
  });
  return done(error);
}

export async function deleteComment(id: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  return done(error);
}

// Time -------------------------------------------------------------------------

export async function logTime(
  taskId: string,
  input: { date: string; hours: number; note: string; billable: boolean },
): Promise<Result> {
  const me = await requireStaff();
  if (!(input.hours > 0 && input.hours <= 24)) return { error: "Hours must be between 0 and 24" };
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    task_id: taskId,
    user_id: me.id,
    work_date: input.date,
    hours: input.hours,
    note: clean(input.note),
    billable: input.billable,
  });
  return done(error);
}

export async function deleteTime(id: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  return done(error);
}

// Attachments ------------------------------------------------------------------

export async function uploadAttachment(formData: FormData): Promise<Result> {
  const me = await requireStaff();
  const taskId = String(formData.get("taskId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  const supabase = await createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${taskId}/${crypto.randomUUID()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type || undefined });
  if (upErr) return { error: upErr.message };
  const { error } = await supabase.from("attachments").insert({
    task_id: taskId,
    storage_path: path,
    file_name: file.name,
    size_bytes: file.size,
    content_type: file.type || null,
    uploaded_by: me.id,
  });
  return done(error);
}

export async function deleteAttachment(id: string): Promise<Result> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("attachments").select("storage_path").eq("id", id).single();
  if (data) await supabase.storage.from("attachments").remove([data.storage_path]);
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  return done(error);
}

// Inbox ------------------------------------------------------------------------

export async function markRead(id: string): Promise<Result> {
  await getMe();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  return done(error);
}

export async function markAllRead(): Promise<Result> {
  const me = await getMe();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", me.id)
    .is("read_at", null);
  return done(error);
}
