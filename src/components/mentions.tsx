"use client";

import { useRef, useState } from "react";
import { displayName } from "@/lib/format";
import type { Profile } from "@/lib/types";

// Mentions are stored in the comment body as @[Name](uuid). The database
// trigger reads the uuid to notify that person.
const TOKEN = /@\[([^\]]*)\]\(([0-9a-f-]{36})\)/g;

export function CommentBody({ body, people }: { body: string; people: Map<string, Profile> }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    parts.push(body.slice(last, m.index));
    const person = people.get(m[2]);
    parts.push(
      <span key={m.index} className="rounded bg-teal/30 px-1 font-semibold">
        @{person ? displayName(person) : m[1]}
      </span>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(body.slice(last));
  return <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{parts}</p>;
}

export function MentionInput({
  value,
  onChange,
  people,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Profile[];
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);

  function update(v: string, caret: number) {
    onChange(v);
    const before = v.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\w.\-]*)$/);
    setQuery(m ? m[1].toLowerCase() : null);
  }

  function pick(p: Profile) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([\w.\-]*)$/, "");
    const token = `@[${displayName(p)}](${p.id}) `;
    const next = before + token + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = (before + token).length;
      el.setSelectionRange(pos, pos);
    });
  }

  const matches =
    query === null
      ? []
      : people
          .filter((p) => displayName(p).toLowerCase().includes(query) || p.email.toLowerCase().includes(query))
          .slice(0, 6);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => update(e.target.value, e.target.selectionStart)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery(null);
          if (e.key === "Enter" && matches.length > 0) {
            e.preventDefault();
            pick(matches[0]);
          }
        }}
        className="input"
      />
      {matches.length > 0 && (
        <ul className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-md border border-line bg-white shadow-lg">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-mist"
              >
                {displayName(p)}
                <span className="text-xs text-muted">{p.role === "guest" ? "client" : "LAIRE"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
