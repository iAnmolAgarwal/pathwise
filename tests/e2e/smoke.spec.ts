import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { chatMessages, db, feedbackEvents, learners, paths, profiles, sessions, tokenUsage, users } from "../../src/db";

/**
 * One journey through the deterministic core with the LLM unreachable (the config points
 * the server at an invalid key): sign-in redirect → new learner → a chat turn that
 * degrades and rests Nova → first path from the goal picker → too_hard feedback → the
 * diff banner → the skill graph → the dashboard. Sign-in itself is a database session row
 * (the Google round-trip is not ours to test); everything after the cookie is the app.
 */

const EMAIL = "e2e-smoke@example.test";
const TOKEN = `e2e-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

async function cleanup() {
  const conn = db();
  const [user] = await conn.select().from(users).where(eq(users.email, EMAIL));
  if (!user) return;
  for (const row of await conn.select().from(learners).where(eq(learners.userId, user.id))) {
    await conn.delete(tokenUsage).where(eq(tokenUsage.learnerId, row.id));
    await conn.delete(chatMessages).where(eq(chatMessages.learnerId, row.id));
    await conn.delete(feedbackEvents).where(eq(feedbackEvents.learnerId, row.id));
    await conn.delete(paths).where(eq(paths.learnerId, row.id));
    await conn.delete(profiles).where(eq(profiles.learnerId, row.id));
    await conn.delete(learners).where(eq(learners.id, row.id));
  }
  await conn.delete(sessions).where(eq(sessions.userId, user.id));
  await conn.delete(users).where(eq(users.id, user.id));
}

test.beforeAll(async () => {
  await cleanup();
  const conn = db();
  const [user] = await conn.insert(users).values({ name: "E2E Smoke", email: EMAIL }).returning();
  await conn.insert(sessions).values({ sessionToken: TOKEN, userId: user.id, expires: new Date(Date.now() + 3_600_000) });
});

test.afterAll(cleanup);

test("signed out, every /learn page redirects to sign-in with a way back", async ({ page }) => {
  await page.goto("/learn");
  await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Flearn/);
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
});

test("the deterministic core end to end with the model unreachable", async ({ page, context }) => {
  await context.addCookies([{ name: "authjs.session-token", value: TOKEN, url: "http://localhost:3000" }]);

  // No learners yet → straight to the new-learner form; creating one lands in the workspace.
  await page.goto("/learn");
  await page.getByPlaceholder("Your name").fill("Smoke Runner");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/learn\/[0-9a-f-]{36}/);

  // One chat turn: the invalid key degrades it and Nova rests, with the notice shown.
  await page.getByTestId("chat-input").fill("I want to become a data analyst.");
  await page.getByTestId("chat-send").click();
  await expect(page.getByText("answered without the model")).toBeVisible();
  await expect(page.getByText(/Nova is resting/).first()).toBeVisible();

  // The path tab offers the goal picker while Nova rests; the engine builds the first path.
  await page.getByRole("tab", { name: "Path" }).click();
  await page.getByTestId("empty-path-goal").selectOption({ label: "Data Analyst" });
  await page.getByTestId("empty-path-build").click();
  await expect(page.getByRole("heading", { name: "Your path" })).toBeVisible();
  await expect(page.getByTestId("path-version")).toContainText("v1");

  // too_hard on the first open item → the engine answers with a stated diff.
  await page.getByRole("button", { name: "Too hard" }).first().click();
  await expect(page.getByTestId("path-diff")).toBeVisible();
  await expect(page.getByTestId("path-diff")).toContainText(/too hard/i);

  // The graph and the dashboard render from the same stored state.
  await page.getByRole("tab", { name: "Skill Graph" }).click();
  await expect(page.getByRole("heading", { name: "Skill graph" })).toBeVisible();
  await page.getByRole("tab", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/Next/i).first()).toBeVisible();
});
