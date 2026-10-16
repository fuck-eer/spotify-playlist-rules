import { createHash, randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { createSql } from "../../lib/db/client";
import { migrate } from "../../lib/db/migrate";

const SESSION_COOKIE = "rulemix_session";

function testDbUrl(): string {
  return (
    process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test"
  );
}

/** Inserts a fresh test user + session into the test database and sets the session cookie. */
export async function seedSession(page: Page): Promise<{ userId: string }> {
  const sql = createSql(testDbUrl());
  try {
    await migrate(sql, { log: () => {} });
    const userId = `e2e-${randomBytes(6).toString("hex")}`;
    const raw = randomBytes(32).toString("base64url");
    await sql`
      insert into users (id, display_name, refresh_token_encrypted, scopes, authorized_at)
      values (${userId}, 'E2E User', 'enc:e2e', 'playlist-read-private', now())`;
    await sql`
      insert into sessions (id_hash, user_id, expires_at)
      values (${createHash("sha256").update(raw).digest("hex")}, ${userId}, now() + interval '1 day')`;
    await page.context().addCookies([
      {
        name: SESSION_COOKIE,
        value: raw,
        url: `http://127.0.0.1:${process.env.E2E_PORT ?? 3000}`,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    return { userId };
  } finally {
    await sql.end({ timeout: 1 });
  }
}
