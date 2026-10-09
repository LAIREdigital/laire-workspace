// Local preview: runs dist/Code.gs against fake Google services, loaded with
// demo data. Run npm run build first.
//   npm run dev            http://localhost:8787
//   EMPTY=1 npm run dev    start from an empty sheet, like a fresh install
import http from "node:http";
import { loadCodeGs } from "./gas-fake";

const port = Number(process.env.PORT ?? 8787);
const gs = loadCodeGs();
const page = (gs.g.doGet() as { getContent(): string }).getContent();
if (!process.env.EMPTY) gs.g.loadDemoData();

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const out = String(gs.g.api(url.pathname.slice(5), Buffer.concat(chunks).toString() || "[]"));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(out);
      return;
    }
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    res.writeHead(url.pathname === "/favicon.ico" ? 204 : 404);
    res.end();
  })
  .listen(port, () => console.log(`LAIRE Workspace preview on http://localhost:${port} (password LAIRE2026!)`));
