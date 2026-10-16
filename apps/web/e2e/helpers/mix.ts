import type { Page } from "@playwright/test";
import { encrypt } from "../../lib/crypto";
import { createSql } from "../../lib/db/client";
import { useTestEnv as applyTestEnv } from "../../lib/test-env";
import { FAKE_ME } from "../../lib/testing/fake-library";
import { seedSession } from "./session";

export const E2E_DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";

/** Signs in as the fake Spotify user and creates a "Gym bangers" Mix (Echo, local, Drift, Sunrise). */
export async function seedGymMix(
  page: Page,
  opts: { keepSourceOrder?: boolean; scopes?: string } = {},
): Promise<string> {
  const { userId } = await seedSession(page);
  const restore = applyTestEnv();
  const sql = createSql(E2E_DB);
  try {
    await sql`delete from users where id = ${FAKE_ME}`;
    await sql`insert into users (id, display_name, refresh_token_encrypted, scopes, authorized_at)
      values (${FAKE_ME}, 'Nishchay', ${encrypt("e2e-refresh")}, ${opts.scopes ?? "playlist-read-private"}, now())`;
    await sql`update sessions set user_id = ${FAKE_ME} where user_id = ${userId}`;
    const [m] = await sql<{ id: string }[]>`
      insert into mixes (user_id, name, source_type, source_playlist_id, source_name, shuffle_seed, keep_source_order)
      values (${FAKE_ME}, 'Gym', 'playlist', 'pl-own', 'Gym bangers', 1, ${opts.keepSourceOrder ?? true})
      returning id`;
    return m!.id;
  } finally {
    await sql.end({ timeout: 1 });
    restore();
  }
}

export async function coverLabels(page: Page): Promise<(string | null)[]> {
  return page
    .getByTestId("cover")
    .locator("button")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
}
