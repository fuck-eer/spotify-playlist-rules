import { expect, test } from "@playwright/test";
import { encrypt } from "../lib/crypto";
import { createSql } from "../lib/db/client";
import { useTestEnv as applyTestEnv } from "../lib/test-env";
import { FAKE_ME } from "../lib/testing/fake-library";
import { seedSession } from "./helpers/session";

const DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

test("create a mix from Liked Songs, see it on Home, then delete it", async ({ page }) => {
  const { userId } = await seedSession(page);
  // The app talks to the fake Spotify server as FAKE_ME with a decryptable refresh token.
  const restore = applyTestEnv();
  const sql = createSql(DB);
  try {
    await sql`delete from users where id = ${FAKE_ME}`;
    await sql`insert into users (id, display_name, refresh_token_encrypted, scopes, authorized_at)
      values (${FAKE_ME}, 'Nishchay', ${encrypt("e2e-refresh")}, 'playlist-read-private', now())`;
    await sql`update sessions set user_id = ${FAKE_ME} where user_id = ${userId}`;
  } finally {
    await sql.end({ timeout: 1 });
    restore();
  }

  await page.goto("/mixes");
  await expect(page.getByText("No mixes yet")).toBeVisible();
  await page.getByRole("link", { name: "New mix" }).click();
  await expect(page).toHaveURL(/\/mixes\/new$/);

  await page.getByPlaceholder("Name this mix").fill("Late drive");
  await page.getByRole("button", { name: "Pick a source" }).click();
  await expect(page.getByText("9 songs")).toBeVisible();
  await page.getByRole("button", { name: /Liked Songs/ }).click();
  await expect(page).toHaveURL(/\/mixes\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page.getByText("Late drive")).toBeVisible();
  await expect(page.getByText("Liked Songs · 0 rules · not generated")).toBeVisible();

  await page.getByText("Late drive").click();
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Delete mix" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/mixes$/);
  await expect(page.getByText("No mixes yet")).toBeVisible();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).not.toHaveURL(/\/mixes/);
});
