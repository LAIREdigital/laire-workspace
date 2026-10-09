import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The browser app ships as one self contained HTML file, because Apps Script
// serves a single file with HtmlService.
export default defineConfig({
  root: "src/client",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // Preact keeps the page small: Apps Script serves it on every load.
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom/client": "preact/compat/client",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
  build: {
    outDir: "../../build/client",
    emptyOutDir: true,
    assetsInlineLimit: 1024 * 1024,
  },
});
