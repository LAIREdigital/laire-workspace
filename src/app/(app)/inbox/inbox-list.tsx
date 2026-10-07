"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllRead, markRead } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { displayName, timeAgo } from "@/lib/format";
import type { Notification, Profile } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  assigned: "Assigned",
  comment: "Comment",
  mention: "Mention",
  approved: "Approved",
  completed: "Completed",
};

export function InboxList({ items, people }: { items: Notification[]; people: Profile[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const byId = new Map(people.map((p) => [p.id, p]));
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{unread} unread</p>
        {unread > 0 && (
          <button className="btn-ghost" disabled={pending} onClick={() => start(async () => void (await markAllRead()))}>
            Mark all read
          </button>
        )}
      </div>
      <ul className="card divide-y divide-line">
        {items.map((n) => {
          const actor = byId.get(n.actor_id ?? "");
          return (
            <li key={n.id}>
              <button
                onClick={() =>
                  start(async () => {
                    if (!n.read_at) await markRead(n.id);
                    if (n.task_id) router.push(`/my-tasks?task=${n.task_id}`);
                  })
                }
                className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-mist/50 ${n.read_at ? "" : "bg-teal/10"}`}
              >
                <Avatar person={actor} size={30} />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-semibold">{actor ? displayName(actor) : "Someone"}</span> {n.body}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {KIND_LABEL[n.kind] ?? n.kind} · {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" aria-label="Unread" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
