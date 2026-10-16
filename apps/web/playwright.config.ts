import { defineConfig, devices } from "@playwright/test";
import { TEST_ENV } from "./lib/test-env";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE = `http://127.0.0.1:${PORT}`;
const FAKE_PORT = Number(process.env.E2E_FAKE_SPOTIFY_PORT ?? PORT + 1000);
const FAKE = `http://127.0.0.1:${FAKE_PORT}`;
const TEST_DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

export default defineConfig({
  testDir: "e2e",
  // e2e specs share one test database; run them serially.
  workers: 1,
  use: { baseURL: BASE },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `pnpm --dir ../.. exec tsx apps/web/e2e/fake-spotify-server.ts ${FAKE_PORT}`,
      url: `${FAKE}/v1/me`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `pnpm exec next dev -H 127.0.0.1 -p ${PORT}`,
      url: BASE,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...TEST_ENV,
        APP_URL: BASE,
        DATABASE_URL: TEST_DB,
        TEST_DATABASE_URL: TEST_DB,
        SPOTIFY_ACCOUNTS_BASE_URL: FAKE,
        SPOTIFY_API_BASE_URL: `${FAKE}/v1`,
      },
    },
  ],
});
