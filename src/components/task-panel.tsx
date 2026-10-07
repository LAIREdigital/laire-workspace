import Link from "next/link";
import { getMe } from "@/lib/auth";
import { getMilestones, getPeople, getTaskDetail } from "@/lib/data";
import { TaskDetailView } from "@/components/task-detail";

// Right hand task panel, opened with ?task=<id> on any page that renders it.
export async function TaskPanel({ taskId, closeHref }: { taskId: string; closeHref: string }) {
  const [me, detail, people] = await Promise.all([getMe(), getTaskDetail(taskId), getPeople()]);
  const milestones = detail ? await getMilestones(detail.task.project_id) : [];

  return (
    <>
      <Link href={closeHref} scroll={false} aria-label="Close task" className="fixed inset-0 z-40 bg-plum/30" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {detail ? (
          <TaskDetailView
            key={detail.task.id}
            me={me}
            detail={detail}
            people={people}
            milestones={milestones}
            closeHref={closeHref}
          />
        ) : (
          <div className="p-8">
            <p className="font-display font-bold">Task not found</p>
            <p className="mt-1 text-sm text-muted">It may have been deleted, or you do not have access.</p>
            <Link href={closeHref} className="btn-ghost mt-4 -ml-3">
              Close
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
