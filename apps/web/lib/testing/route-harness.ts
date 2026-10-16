import { startFakeSpotify, type FakeSpotify } from "@rulemix/spotify/testing";
import { NextRequest } from "next/server";
import type postgres from "postgres";
import { createSession, SESSION_COOKIE } from "../auth/session";
import { encrypt } from "../crypto";
import { insertTestUser } from "../db/test-utils";
// Aliased: useTestEnv is not a React hook, but its name trips react-hooks/rules-of-hooks.
import { useTestEnv as applyTestEnv } from "../test-env";
import { FAKE_ME, installFakeLibrary } from "./fake-library";

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test";
const APP = "http://127.0.0.1:3000";

export async function startRouteHarness(
  env: Record<string, string> = {},
): Promise<{ fake: FakeSpotify; restore: () => void }> {
  const fake = await startFakeSpotify();
  const restore = applyTestEnv({
    SPOTIFY_ACCOUNTS_BASE_URL: fake.url,
    SPOTIFY_API_BASE_URL: `${fake.url}/v1`,
    DATABASE_URL: TEST_DB_URL,
    ...env,
  });
  installFakeLibrary(fake);
  return { fake, restore };
}

/** Inserts the fake Spotify user and returns its session cookie value. */
export async function signInFakeUser(sql: postgres.Sql): Promise<string> {
  await insertTestUser(sql, { id: FAKE_ME, refresh_token_encrypted: encrypt("fake-refresh") });
  return createSession(sql, FAKE_ME);
}

export function req(path: string, cookie: string | null, init: { method?: string; body?: unknown } = {}): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = `${SESSION_COOKIE}=${cookie}`;
  return new NextRequest(`${APP}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}
