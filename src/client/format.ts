import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Person } from "../shared/types";

export function displayName(p: Pick<Person, "name" | "email"> | null | undefined) {
  if (!p) return "Unassigned";
  return p.name || p.email.split("@")[0];
}

export function initials(p: Pick<Person, "name" | "email"> | null | undefined) {
  const n = displayName(p);
  const parts = n.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function shortDate(d: string | null | undefined) {
  if (!d) return "";
  const date = parseISO(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "MMM d" : "MMM d, yyyy");
}

export function relativeDue(d: string | null | undefined) {
  if (!d) return { text: "", tone: "none" as const };
  const days = differenceInCalendarDays(parseISO(d), new Date());
  if (days < 0) return { text: shortDate(d), tone: "overdue" as const };
  if (days === 0) return { text: "Today", tone: "soon" as const };
  if (days === 1) return { text: "Tomorrow", tone: "soon" as const };
  return { text: shortDate(d), tone: "later" as const };
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return format(new Date(iso), "MMM d");
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}
