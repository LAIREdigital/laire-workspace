// Apps Script entry points. The build turns this into Code.gs and adds
// top level functions that call into it (Apps Script needs real globals).
import { Api, dispatch, type Env } from "./api";
import { ACCELO_FIELDS, importAccelo, type AcceloData } from "./accelo";
import { demoData } from "./demo";
import { SheetStore } from "./sheet-store";
import { TABLES } from "./schema";

const DEFAULT_STAFF_PASSWORD = "LAIRE2026!";
// Bump when tabs or columns change, so live sheets set themselves up again.
const SETUP_VERSION = "1";

// The whole browser app, inlined by the build so only one file is pasted.
declare const INDEX_HTML: string;

function props() {
  return PropertiesService.getScriptProperties();
}

function filesFolder() {
  const p = props();
  const id = p.getProperty("FILES_FOLDER_ID");
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder("LAIRE Workspace Files");
  p.setProperty("FILES_FOLDER_ID", folder.getId());
  return folder;
}

const env: Env = {
  now: () => new Date(),
  uuid: () => Utilities.getUuid(),
  sha256: (s) =>
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
      .map((b) => ((b + 256) % 256).toString(16).padStart(2, "0"))
      .join(""),
  staffPassword: () => props().getProperty("STAFF_PASSWORD") || DEFAULT_STAFF_PASSWORD,
  sleep: (ms) => Utilities.sleep(ms),
  files: {
    save: (name, type, base64) =>
      filesFolder().createFile(Utilities.newBlob(Utilities.base64Decode(base64), type, name)).getId(),
    read: (fileId) => Utilities.base64Encode(DriveApp.getFileById(fileId).getBlob().getBytes()),
    remove: (fileId) => DriveApp.getFileById(fileId).setTrashed(true),
  },
};

export function doGet() {
  ready();
  return HtmlService.createHtmlOutput(INDEX_HTML)
    .setTitle("LAIRE Workspace")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setFaviconUrl("https://www.lairedigital.com/hubfs/Logos/LaireA_Blue.png");
}

// Called from the browser with google.script.run.api(method, argsJson).
export function api(method: string, argsJson: string) {
  ready();
  const store = SheetStore.open();
  return JSON.stringify(dispatch(new Api(store, env), method, JSON.parse(argsJson || "[]")));
}

// Sets the sheet up the first time the app is opened. Nothing to run by hand.
function ready() {
  if (props().getProperty("SETUP_VERSION") === SETUP_VERSION) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (props().getProperty("SETUP_VERSION") !== SETUP_VERSION) {
      setup();
      props().setProperty("SETUP_VERSION", SETUP_VERSION);
    }
  } finally {
    lock.releaseLock();
  }
}

// Creates the tabs and the files folder. Runs on its own via ready().
// The staff password lives in Project Settings > Script Properties > STAFF_PASSWORD.
export function setup() {
  const p = props();
  if (!p.getProperty("SHEET_ID")) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    const book = active ?? SpreadsheetApp.create("LAIRE Workspace Data");
    p.setProperty("SHEET_ID", book.getId());
  }
  if (!p.getProperty("STAFF_PASSWORD")) p.setProperty("STAFF_PASSWORD", DEFAULT_STAFF_PASSWORD);
  SheetStore.open().ensureTabs();
  filesFolder();
  console.log(`Ready. Sheet: ${SpreadsheetApp.openById(p.getProperty("SHEET_ID")!).getUrl()}`);
}

// Optional: fills an empty sheet with demo companies, projects and tasks.
export function loadDemoData() {
  const store = SheetStore.open();
  store.locked(() => {
    if (store.all("Companies").length > 0) throw new Error("The sheet already has data. Demo data only goes into an empty sheet.");
    const data = demoData(new Date());
    for (const t of TABLES) for (const row of data[t] ?? []) store.insert(t, row);
  });
  console.log("Demo data loaded.");
}

function acceloFetch(): AcceloData {
  const p = props();
  const deployment = p.getProperty("ACCELO_DEPLOYMENT");
  const id = p.getProperty("ACCELO_CLIENT_ID");
  const secret = p.getProperty("ACCELO_CLIENT_SECRET");
  if (!deployment || !id || !secret) {
    throw new Error("Add ACCELO_DEPLOYMENT, ACCELO_CLIENT_ID and ACCELO_CLIENT_SECRET under Project Settings > Script Properties.");
  }
  const base = `https://${deployment}.api.accelo.com`;
  const tokenRes = UrlFetchApp.fetch(`${base}/oauth2/v0/token`, {
    method: "post",
    headers: { Authorization: `Basic ${Utilities.base64Encode(`${id}:${secret}`)}` },
    payload: { grant_type: "client_credentials", scope: "read(all)" },
    muteHttpExceptions: true,
  });
  if (tokenRes.getResponseCode() !== 200) throw new Error(`Accelo login failed: ${tokenRes.getContentText()}`);
  const bearer = JSON.parse(tokenRes.getContentText()).access_token as string;
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [kind, fields] of Object.entries(ACCELO_FIELDS)) {
    out[kind] = [];
    for (let page = 0; ; page++) {
      const res = UrlFetchApp.fetch(`${base}/api/v0/${kind}?_fields=${fields}&_limit=100&_page=${page}`, {
        headers: { Authorization: `Bearer ${bearer}` },
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() !== 200) throw new Error(`Accelo ${kind}: ${res.getContentText()}`);
      const rows = (JSON.parse(res.getContentText()).response ?? []) as Record<string, unknown>[];
      out[kind].push(...rows);
      if (rows.length < 100) break;
    }
  }
  return out as AcceloData;
}

// Run from the editor. Dry run first: it reports counts and writes nothing.
export function acceloDryRun() {
  importAccelo(SheetStore.open(), env, acceloFetch(), true).forEach((l) => console.log(l));
}

export function acceloImport() {
  importAccelo(SheetStore.open(), env, acceloFetch(), false).forEach((l) => console.log(l));
}
