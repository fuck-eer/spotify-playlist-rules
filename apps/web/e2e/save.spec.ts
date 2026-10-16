import { expect, test } from "@playwright/test";
import { encrypt } from "../lib/crypto";
import { createSql } from "../lib/db/client";
import { useTestEnv as applyTestEnv } from "../lib/test-env";
import { FAKE_ME } from "../lib/testing/fake-library";
import { seedSession } from "./helpers/session";

const DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

test("save a Liked Songs mix with a Pin first rule to Spotify, then see the saved time on Home", async ({
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
      values (${FAKE_ME}, 'Gym', 'liked', null, 'Liked Songs', 1) returning id`;
    mixId = m!.id;
    const [r] = await sql<{ id: string }[]>`
      insert into rules (user_id, kind, n) values (${FAKE_ME}, 'pin_first', null) returning id`;
    await sql`insert into mix_rules (mix_id, rule_id, position, track_uri)
      values (${mixId}, ${r!.id}, 0, 'spotify:track:bassline')`;
  } finally {
    await sql.end({ timeout: 1 });
    restore();
  }

  await page.goto(`/mixes/${mixId}`);
  await expect(
    page.getByText("Play with shuffle off. Saving while it's playing may skip ahead."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save to Spotify" }).click();
  await expect(
    page.getByText('Saved "Rules: Gym" to Spotify. Play it with shuffle off.'),
  ).toBeVisible({ timeout: 30_000 });

  const dialog = page.getByRole("dialog", { name: "Saved to Spotify" });
  await expect(dialog).toBeVisible();
  const open = dialog.getByRole("link", { name: "Open in Spotify" });
  await expect(open).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\/playlist\/.+/);
  await expect(open).toHaveAttribute("target", "_blank");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: "Open in Spotify" })).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page.getByText("Liked Songs · 1 rule · just now")).toBeVisible();
});
