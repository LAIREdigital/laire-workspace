import { initials, relativeDue } from "../format";
import type { Person, Priority, TaskStatus } from "../../shared/types";
import { PRIORITY_LABEL, STATUS_LABEL } from "../../shared/types";

const AVATAR_COLORS = ["bg-coral", "bg-teal", "bg-olive", "bg-sky", "bg-plum-soft"];

export function Avatar({ person, size = 24 }: { person: Person | null | undefined; size?: number }) {
  if (!person) {
    return (
      <span
        title="Unassigned"
        style={{ width: size, height: size }}
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted/50 text-[10px] text-muted"
      >
        ?
      </span>
    );
  }
  const hash = [...person.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <span
      title={person.name}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${color}`}
    >
      {initials(person)}
    </span>
  );
}

export const STATUS_STYLE: Record<TaskStatus, string> = {
  not_started: "bg-mist-2 text-muted",
  in_progress: "bg-sky/25 text-plum",
  in_review: "bg-coral/20 text-coral-dark",
  complete: "bg-teal/35 text-plum",
};

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: Priority }) {
  if (priority === "none") return null;
  const style =
    priority === "high" ? "text-coral-dark" : priority === "medium" ? "text-olive" : "text-sky";
  return <span className={`shrink-0 text-xs font-semibold ${style}`}>{PRIORITY_LABEL[priority]}</span>;
}

export function DueDate({ date, done }: { date: string | null; done?: boolean }) {
  const { text, tone } = relativeDue(date);
  if (!text) return null;
  const color = done ? "text-muted" : tone === "overdue" ? "text-coral-dark font-semibold" : tone === "soon" ? "text-olive font-semibold" : "text-muted";
  return <span className={`text-xs whitespace-nowrap ${color}`}>{text}</span>;
}

export function InternalBadge() {
  return (
    <span className="shrink-0 rounded bg-plum px-1.5 py-0.5 text-[10px] whitespace-nowrap font-bold tracking-wide text-teal uppercase">
      Internal
    </span>
  );
}

export function ApprovalBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <span className="shrink-0 rounded bg-teal/35 px-1.5 py-0.5 text-[10px] whitespace-nowrap font-bold tracking-wide uppercase">Approved</span>
  ) : (
    <span className="shrink-0 rounded bg-coral/15 px-1.5 py-0.5 text-[10px] whitespace-nowrap font-bold tracking-wide text-coral-dark uppercase">
      Needs approval
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-display font-bold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-dark">{error}</p>;
}
