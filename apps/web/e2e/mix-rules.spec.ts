import { expect, test } from "@playwright/test";
import { encrypt } from "../lib/crypto";
import { createSql } from "../lib/db/client";
import { useTestEnv as applyTestEnv } from "../lib/test-env";
import { FAKE_ME } from "../lib/testing/fake-library";
import { seedSession } from "./helpers/session";

const DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

test("add two rules to a mix, reorder with the keyboard, remove one", async ({ page }) => {
  const { userId } = await seedSession(page);
  const restore = applyTestEnv();
  const sql = createSql(DB);
  let mixId = "";
  try {
    await sql`delete from users where id = ${FAKE_ME}`;
    await sql`insert into users (id, display_name, refresh_token_encrypted, scopes, authorized_at)
      values (${FAKE_ME}, 'Nishchay', ${encrypt("e2e-refresh")}, 'playlist-read-private', now())`;
    await sql`update sessions set user_id = ${FAKE_ME} where user_id = ${userId}`;
    await sql`insert into rules (user_id, kind, n) values (${FAKE_ME}, 'repeat', 3), (${FAKE_ME}, 'pin_first', null)`;
    const [m] = await sql<{ id: string }[]>`
      insert into mixes (user_id, name, source_type, source_playlist_id, source_name, shuffle_seed)
      values (${FAKE_ME}, 'Gym', 'playlist', 'pl-own', 'Gym bangers', 1) returning id`;
    mixId = m!.id;
  } finally {
    await sql.end({ timeout: 1 });
    restore();
  }

  await page.goto(`/mixes/${mixId}`);
  await expect(page.getByText("No rules yet. Without one, you just get a copy.")).toBeVisible();

  await page.getByRole("button", { name: "+ Add rule" }).click();
  await page.getByRole("button", { name: /Play a song 3 times in a row/ }).click();
  await expect(page.getByText("Pick the rule's song")).toBeVisible();
  await page.getByRole("button", { name: /Drift · Oren/ }).click();
  await expect(page.getByText("Repeat · Drift · 3×")).toBeVisible();

  await page.getByRole("button", { name: "+ Add rule" }).click();
  await page.getByRole("button", { name: /Play a song first/ }).click();
  await page.getByRole("button", { name: /Echo · Kavi/ }).click();
  await expect(page.getByText("Pin first · Echo")).toBeVisible();

  await page.getByRole("button", { name: "Reorder #02" }).focus();
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/rules/order") && r.request().method() === "PUT",
  );
  await page.keyboard.press("ArrowUp");
  expect((await saved).status()).toBe(204);
  await expect(page.getByTestId("rule-card").first()).toContainText("Pin first · Echo");

  await page.reload();
  await expect(page.getByTestId("rule-card").first()).toContainText("#01");
  await expect(page.getByTestId("rule-card").first()).toContainText("Pin first · Echo");

  const removed = page.waitForResponse((r) => r.request().method() === "DELETE");
  await page.getByTestId("rule-card").first().getByRole("button", { name: "Remove rule" }).click();
  expect((await removed).status()).toBe(204);
  await expect(page.getByTestId("rule-card")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("rule-card")).toHaveCount(1);
  await expect(page.getByTestId("rule-card").first()).toContainText("Repeat · Drift · 3×");
});
