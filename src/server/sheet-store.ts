import { SCHEMA, TABLES, fromCell, toCell, type Kind, type Row, type Table } from "./schema";
import type { Store } from "./store";

type Sheet = GoogleAppsScript.Spreadsheet.Sheet;

// Google Sheet storage. One tab per table, headers in row 1, id in column A.
// Reads are cached for the length of one request.
export class SheetStore implements Store {
  private cache = new Map<Table, Row[]>();

  constructor(private book: GoogleAppsScript.Spreadsheet.Spreadsheet) {}

  static open() {
    const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
    const book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("No spreadsheet. Run setup() from the Apps Script editor first.");
    return new SheetStore(book);
  }

  // Creates any missing tabs with headers, formatted as plain text.
  ensureTabs() {
    for (const t of TABLES) {
      const cols = Object.keys(SCHEMA[t]);
      let sheet = this.book.getSheetByName(t);
      if (!sheet) sheet = this.book.insertSheet(t);
      sheet.getRange(1, 1, sheet.getMaxRows(), Math.max(cols.length, sheet.getMaxColumns())).setNumberFormat("@");
      sheet.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    const sessions = this.book.getSheetByName("Sessions");
    if (sessions) sessions.hideSheet();
    const blank = this.book.getSheetByName("Sheet1");
    if (blank && blank.getLastRow() === 0 && this.book.getSheets().length > 1) this.book.deleteSheet(blank);
  }

  private sheet(t: Table): Sheet {
    const s = this.book.getSheetByName(t);
    if (!s) throw new Error(`Missing tab ${t}. Run setup().`);
    return s;
  }

  private cols(t: Table) {
    return Object.entries(SCHEMA[t]) as [string, Kind][];
  }

  all<T = Row>(table: Table): T[] {
    if (!this.cache.has(table)) {
      const s = this.sheet(table);
      const cols = this.cols(table);
      const last = s.getLastRow();
      const values = last < 2 ? [] : s.getRange(2, 1, last - 1, cols.length).getValues();
      this.cache.set(
        table,
        values
          .filter((r) => r[0] !== "")
          .map((r) => Object.fromEntries(cols.map(([c, k], i) => [c, fromCell(k, r[i])])) as Row),
      );
    }
    return this.cache.get(table)!.map((r) => ({ ...r })) as T[];
  }

  private toRow(table: Table, row: Record<string, unknown>) {
    return this.cols(table).map(([c, k]) => toCell(k, row[c]));
  }

  private rowNumber(table: Table, id: string) {
    const s = this.sheet(table);
    const last = s.getLastRow();
    if (last < 2) return -1;
    const ids = s.getRange(2, 1, last - 1, 1).getValues();
    const i = ids.findIndex((r) => r[0] === id);
    return i < 0 ? -1 : i + 2;
  }

  insert(table: Table, row: Row) {
    const s = this.sheet(table);
    s.getRange(s.getLastRow() + 1, 1, 1, this.cols(table).length).setValues([this.toRow(table, row)]);
    this.cache.delete(table);
  }

  update(table: Table, id: string, patch: Record<string, unknown>) {
    const n = this.rowNumber(table, id);
    if (n < 0) return;
    const current = this.all(table).find((r) => r.id === id) ?? { id };
    this.sheet(table)
      .getRange(n, 1, 1, this.cols(table).length)
      .setValues([this.toRow(table, { ...current, ...patch })]);
    this.cache.delete(table);
  }

  remove(table: Table, ids: string[]) {
    if (ids.length === 0) return;
    const s = this.sheet(table);
    const last = s.getLastRow();
    if (last < 2) return;
    const set = new Set(ids);
    const col = s.getRange(2, 1, last - 1, 1).getValues();
    // Bottom up so row numbers stay valid while deleting.
    for (let i = col.length - 1; i >= 0; i--) if (set.has(String(col[i][0]))) s.deleteRow(i + 2);
    this.cache.delete(table);
  }

  locked<T>(fn: () => T): T {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      this.cache.clear();
      return fn();
    } finally {
      SpreadsheetApp.flush();
      lock.releaseLock();
    }
  }
}
