/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
    restoreMocks: true,
    // API tests replace global fetch and reset the singleton client; process
    // isolation keeps those mocked HTTP lifecycles independent across files.
    pool: "forks",
    maxWorkers: 4,
  },
});
