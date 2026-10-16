import { expect, test } from "@playwright/test";
import { encrypt } from "../lib/crypto";
import { createSql } from "../lib/db/client";
import { useTestEnv as applyTestEnv } from "../lib/test-env";
import { FAKE_ME } from "../lib/testing/fake-library";
import { seedSession } from "./helpers/session";

const DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

test("Play writes the rulemix player playlist and opens it in Spotify", async ({ page }) => {
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
  } finally {
    await sql.end({ timeout: 1 });
    restore();
  }

  await page.route("https://open.spotify.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Spotify</title>" }),
  );
  await page.goto(`/mixes/${mixId}`);
  // Seeded without playback scopes, like a user from before phase 1.
  await expect(page.getByRole("link", { name: "Log in again to enable auto-play" })).toBeVisible();
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForURL(/^https:\/\/open\.spotify\.com\/playlist\/.+/, { timeout: 30_000 });

  const check = createSql(DB);
  try {
    const [u] = await check<{ p: string | null }[]>`
      select player_playlist_id p from users where id = ${FAKE_ME}`;
    expect(page.url()).toBe(`https://open.spotify.com/playlist/${u!.p}`);
  } finally {
    await check.end({ timeout: 1 });
  }
});
