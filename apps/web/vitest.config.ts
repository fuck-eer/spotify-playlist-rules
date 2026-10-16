import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    // DB-backed test files share TEST_DATABASE_URL and truncate it; run files one at a time.
    fileParallelism: false,
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
  },
});
