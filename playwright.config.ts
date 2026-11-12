import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";
const directory = path.join(os.tmpdir(), `folio-e2e-${process.pid}`);
process.env.FOLIO_E2E_DATA_DIR = directory;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 20000 },
  reporter: "list",
  globalTeardown: "./tests/browser/teardown.mjs",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm start",
        url: "http://localhost:3100/healthz",
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          PORT: "3100",
          DATA_DIR: directory,
          MAX_UPLOAD_MB: "1",
          NODE_ENV: "production",
        },
      },
});
