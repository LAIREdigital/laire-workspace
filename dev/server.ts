// Local preview: serves dist/Index.html and runs dist/Code.gs against fake
// Google services loaded with demo data. Run npm run build first.
//   npm run dev            http://localhost:8787
import http from "node:http";
import fs from "node:fs";
import { loadCodeGs } from "./gas-fake";

const port = Number(process.env.PORT ?? 8787);
const gs = loadCodeGs();
gs.g.setup();
gs.g.loadDemoData();

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
      res.end(fs.readFileSync("dist/Index.html"));
      return;
    }
    res.writeHead(url.pathname === "/favicon.ico" ? 204 : 404);
    res.end();
  })
  .listen(port, () => console.log(`LAIRE Workspace preview on http://localhost:${port} (password LAIRE2026!)`));
