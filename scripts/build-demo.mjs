// Builds build/demo/demo.html: the app plus the server code running in the
// page on sample data. Used for the shareable demo page, not for Apps Script.
import { build } from "vite";
await build({
  configFile: "vite.config.ts",
  logLevel: "warn",
  build: {
    outDir: "../../build/demo",
    emptyOutDir: true,
    rollupOptions: { input: "src/client/demo.html" },
  },
});
