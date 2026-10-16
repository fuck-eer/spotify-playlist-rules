import { expect, test } from "@playwright/test";
import { encrypt } from "../lib/crypto";
import { createSql } from "../lib/db/client";
import { useTestEnv as applyTestEnv } from "../lib/test-env";
import { FAKE_ME } from "../lib/testing/fake-library";
import { seedSession } from "./helpers/session";

const DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

test("the new-mix form keeps the name and source when the page reloads right after creating the mix", async ({
  page,
}) => {
  const { userId } = await seedSession(page);
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

  // Stand-in for a cold dev compile of /mixes/[id]: hold the client navigation to the new mix.
  await page.route(/\/mixes\/[0-9a-f-]{36}(\?.*)?$/, async (route) => {
    if (route.request().resourceType() === "document") return route.continue();
    await new Promise((r) => setTimeout(r, 6000));
    await route.continue().catch(() => undefined);
  });

  await page.goto("/mixes/new");
  const name = page.getByPlaceholder("Name this mix");
  await name.fill("QA test");
  await page.getByRole("button", { name: "Pick a source" }).click();
  await page.getByRole("button", { name: /Gym bangers/ }).click();
  await expect(page.getByRole("button", { name: /Source: Gym bangers/ })).toBeVisible();

  // Once the mix exists the URL must already point at it, so a reload during the
  // slow navigation (what Next dev's full reload did) lands on the saved mix.
  await expect(page).toHaveURL(/\/mixes\/[0-9a-f-]{36}$/, { timeout: 3000 });
  await page.reload();
  await expect(name).toHaveValue("QA test");
  await expect(page.getByRole("button", { name: /Source: Gym bangers/ })).toBeVisible();
});
