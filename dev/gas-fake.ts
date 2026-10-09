// In-memory stand-ins for the Apps Script services Code.gs uses, so the built
// server can run under Node for tests and local development. Only the calls
// this project makes are implemented.
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

type Cell = string | number | boolean | Date;

class FakeRange {
  constructor(
    private sheet: FakeSheet,
    private row: number,
    private col: number,
    private rows: number,
    private cols: number,
  ) {}
  getValues(): Cell[][] {
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => this.sheet.cell(this.row + r, this.col + c)),
    );
  }
  setValues(values: Cell[][]) {
    if (values.length !== this.rows || values.some((r) => r.length !== this.cols)) {
      throw new Error(`setValues: data is ${values.length}x${values[0]?.length}, range is ${this.rows}x${this.cols}`);
    }
    values.forEach((r, i) => r.forEach((v, j) => this.sheet.set(this.row + i, this.col + j, v)));
    return this;
  }
  setNumberFormat(fmt: string) {
    if (fmt === "@") this.sheet.plainText = true;
    return this;
  }
  setFontWeight() {
    return this;
  }
}

export class FakeSheet {
  data: Cell[][] = [];
  plainText = false;
  hidden = false;
  constructor(public name: string) {}
  cell(r: number, c: number): Cell {
    return this.data[r - 1]?.[c - 1] ?? "";
  }
  set(r: number, c: number, v: Cell) {
    while (this.data.length < r) this.data.push([]);
    const row = this.data[r - 1];
    while (row.length < c) row.push("");
    // Like Sheets: without plain text format, date-like text turns into a Date.
    row[c - 1] = !this.plainText && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : v;
  }
  getName() {
    return this.name;
  }
  getRange(row: number, col: number, rows = 1, cols = 1) {
    if (row < 1 || col < 1 || rows < 1 || cols < 1) throw new Error(`Bad range ${row},${col},${rows},${cols}`);
    return new FakeRange(this, row, col, rows, cols);
  }
  getLastRow() {
    for (let i = this.data.length; i > 0; i--) if (this.data[i - 1].some((v) => v !== "")) return i;
    return 0;
  }
  getMaxRows() {
    return Math.max(1000, this.data.length);
  }
  getMaxColumns() {
    return 26;
  }
  setFrozenRows() {}
  hideSheet() {
    this.hidden = true;
  }
  deleteRow(r: number) {
    this.data.splice(r - 1, 1);
  }
}

export class FakeBook {
  sheets: FakeSheet[] = [new FakeSheet("Sheet1")];
  constructor(public id = crypto.randomUUID()) {}
  getId() {
    return this.id;
  }
  getUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.id}`;
  }
  getSheetByName(n: string) {
    return this.sheets.find((s) => s.name === n) ?? null;
  }
  insertSheet(n: string) {
    const s = new FakeSheet(n);
    this.sheets.push(s);
    return s;
  }
  getSheets() {
    return this.sheets;
  }
  deleteSheet(s: FakeSheet) {
    this.sheets = this.sheets.filter((x) => x !== s);
  }
}

export function makeGas(book = new FakeBook()) {
  const props = new Map<string, string>();
  const files = new Map<string, { name: string; type: string; bytes: number[]; trashed: boolean }>();
  const toSigned = (buf: Buffer) => [...buf].map((b) => (b > 127 ? b - 256 : b));
  const blob = (bytes: number[], type: string, name: string) => ({
    bytes,
    type,
    name,
    getBytes: () => bytes,
  });
  const logs: string[] = [];

  const globals = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => book,
      openById: (id: string) => {
        if (id !== book.id) throw new Error("not found");
        return book;
      },
      create: () => book,
      flush: () => {},
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => props.set(k, v),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (_alg: string, s: string) => toSigned(crypto.createHash("sha256").update(s, "utf8").digest()),
      base64Encode: (v: string | number[]) =>
        Buffer.from(typeof v === "string" ? Buffer.from(v, "utf8") : Uint8Array.from(v.map((b) => (b + 256) % 256))).toString("base64"),
      base64Decode: (s: string) => toSigned(Buffer.from(s, "base64")),
      newBlob: blob,
      sleep: () => {},
    },
    DriveApp: {
      createFolder: () => ({
        getId: () => "folder-1",
      }),
      getFolderById: () => ({
        createFile: (b: ReturnType<typeof blob>) => {
          const id = crypto.randomUUID();
          files.set(id, { name: b.name, type: b.type, bytes: b.bytes, trashed: false });
          return { getId: () => id };
        },
      }),
      getFileById: (id: string) => {
        const f = files.get(id);
        if (!f || f.trashed) throw new Error("No file");
        return {
          getBlob: () => blob(f.bytes, f.type, f.name),
          setTrashed: (t: boolean) => {
            f.trashed = t;
          },
        };
      },
    },
    HtmlService: {
      createHtmlOutput: (html: string) => {
        const out = {
          html,
          title: "",
          getContent: () => html,
          setTitle: (t: string) => ((out.title = t), out),
          addMetaTag: () => out,
          setFaviconUrl: () => out,
        };
        return out;
      },
    },
    UrlFetchApp: {
      fetch: () => {
        throw new Error("No network in the fake");
      },
    },
    console: { log: (...a: unknown[]) => logs.push(a.join(" ")), error: (...a: unknown[]) => logs.push(a.join(" ")) },
  };
  return { globals, book, props, files, logs };
}

// Loads dist/Code.gs into a sandbox with the fakes and returns its globals.
export function loadCodeGs(path = "dist/Code.gs", book?: FakeBook) {
  const gas = makeGas(book);
  const ctx = vm.createContext({ ...gas.globals });
  vm.runInContext(fs.readFileSync(path, "utf8"), ctx, { filename: "Code.gs" });
  const g = ctx as unknown as Record<string, (...a: unknown[]) => unknown>;
  const call = (method: string, ...args: unknown[]) => {
    const env = JSON.parse(String(g.api(method, JSON.stringify(args)))) as { data?: unknown; error?: string };
    return env;
  };
  return { ...gas, g, call };
}
