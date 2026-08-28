import { loadEnvConfig } from "@next/env";
import { defineConfig } from "@playwright/test";

// The spec talks to the database directly (it seeds and cleans its own rows), and the test
// runner is not Next, so .env.local has to be loaded explicitly — same as drizzle.config.ts.
// @next/env leaves variables that are already set alone, so CI's DATABASE_URL still wins.
loadEnvConfig(process.cwd());

/**
 * The browser-level smoke test (tests/e2e/). Runs against the dev server with an invalid
 * model key on purpose: the deterministic core — sign-in, first path, feedback, diff,
 * graph, dashboard — must work with the LLM unreachable (§8.4), and that is exactly what
 * CI can exercise without a real key. Needs DATABASE_URL (any Postgres) and AUTH_SECRET.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  // The first run on a cold checkout also compiles the app's data-heavy routes; 30s was too tight.
  expect: { timeout: 60_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      // The model must be unreachable: the smoke test is the degraded-mode test.
      ANTHROPIC_API_KEY: "invalid-on-purpose",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-not-for-production",
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? "e2e-google-id",
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? "e2e-google-secret",
    },
  },
});
