import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Attachments are uploaded through a Server Action.
    serverActions: { bodySizeLimit: "25mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
