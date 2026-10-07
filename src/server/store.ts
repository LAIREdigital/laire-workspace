import { SCHEMA, fromCell, toCell, type Row, type Table } from "./schema";

// Storage behind the API. Apps Script uses the Google Sheet; tests and local
// development use memory.
export interface Store {
  all<T = Row>(table: Table): T[];
  insert(table: Table, row: Row): void;
  update(table: Table, id: string, patch: Record<string, unknown>): void;
  remove(table: Table, ids: string[]): void;
  // Runs fn while holding a write lock.
  locked<T>(fn: () => T): T;
}

function normalize(table: Table, row: Record<string, unknown>): Row {
  const cols = SCHEMA[table] as Record<string, Parameters<typeof fromCell>[0]>;
  const out: Record<string, unknown> = {};
  for (const [c, kind] of Object.entries(cols)) out[c] = fromCell(kind, toCell(kind, row[c]));
  return out as Row;
}

export class MemoryStore implements Store {
  data: Record<string, Row[]> = {};

  constructor(seed?: Partial<Record<Table, Record<string, unknown>[]>>) {
    for (const t of Object.keys(SCHEMA) as Table[]) {
      this.data[t] = (seed?.[t] ?? []).map((r) => normalize(t, r));
    }
  }
  all<T = Row>(table: Table): T[] {
    return this.data[table].map((r) => ({ ...r })) as T[];
  }
  insert(table: Table, row: Row) {
    this.data[table].push(normalize(table, row));
  }
  update(table: Table, id: string, patch: Record<string, unknown>) {
    const rows = this.data[table];
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows[i] = normalize(table, { ...rows[i], ...patch });
  }
  remove(table: Table, ids: string[]) {
    const set = new Set(ids);
    this.data[table] = this.data[table].filter((r) => !set.has(r.id));
  }
  locked<T>(fn: () => T): T {
    return fn();
  }
}
