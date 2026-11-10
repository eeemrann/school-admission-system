/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        rewrite: (path) => path.replace(/^\/api/, ""),
        target: `http://127.0.0.1:${process.env.E2E_API_PORT ?? "5085"}`,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
    restoreMocks: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "e2e/process-group-cleanup.test.ts"],
    // API tests replace global fetch and reset the singleton client; process
    // isolation keeps those mocked HTTP lifecycles independent across files.
    pool: "forks",
    maxWorkers: 4,
  },
});
