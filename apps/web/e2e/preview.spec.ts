import { expect, test } from "@playwright/test";
import { encrypt } from "../lib/crypto";
import { createSql } from "../lib/db/client";
import { useTestEnv as applyTestEnv } from "../lib/test-env";
import { FAKE_ME } from "../lib/testing/fake-library";
import { seedSession } from "./helpers/session";

const DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

test("preview shows the summary, regenerates, and the base-order switch hides Reshuffle", async ({
  page,
}) => {
  const { userId } = await seedSession(page);
  const restore = applyTestEnv();
  const sql = createSql(DB);
  let mixId = "";
  try {
    await sql`delete from users where id = ${FAKE_ME}`;
    await sql`insert into users (id, display_name, refresh_token_encrypted, scopes, authorized_at)
      values (${FAKE_ME}, 'Nishchay', ${encrypt("e2e-refresh")}, 'playlist-read-private', now())`;
    await sql`update sessions set user_id = ${FAKE_ME} where user_id = ${userId}`;
    const [m] = await sql<{ id: string }[]>`
      insert into mixes (user_id, name, source_type, source_playlist_id, source_name, shuffle_seed)
      values (${FAKE_ME}, 'Gym', 'playlist', 'pl-own', 'Gym bangers', 1) returning id`;
    mixId = m!.id;
  } finally {
    await sql.end({ timeout: 1 });
    restore();
  }

  await page.goto(`/mixes/${mixId}`);
  await expect(page.getByText("3 tracks · 0 rules applied")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("1 song skipped (unavailable)")).toBeVisible();

  const regen = page.waitForResponse((r) => r.url().endsWith("/preview"));
  await page.getByRole("button", { name: "Regenerate" }).click();
  expect((await regen).status()).toBe(200);

  await expect(page.getByRole("button", { name: "Reshuffle" })).toBeVisible();
  const saved = page.waitForResponse((r) => r.request().method() === "PATCH");
  await page.getByRole("switch", { name: "Keep base order" }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Reshuffle" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Keep base order" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
