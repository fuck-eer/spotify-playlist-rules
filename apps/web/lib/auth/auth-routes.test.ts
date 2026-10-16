import { SCOPES } from "@rulemix/spotify";
import { startFakeSpotify, type FakeSpotify } from "@rulemix/spotify/testing";
import { NextRequest } from "next/server";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as callback } from "../../app/api/auth/callback/route";
import { GET as login } from "../../app/api/auth/login/route";
import { POST as logout } from "../../app/api/auth/logout/route";
import { GET as me } from "../../app/api/me/route";
import { sign } from "../crypto";
import { getSql } from "../db/client";
import { canReachTestDb, resetTestDb } from "../db/test-utils";
import { useTestEnv } from "../test-env";
import { createSession, getSessionUser, SESSION_COOKIE } from "./session";

const reachable = await canReachTestDb();
if (!reachable) console.warn("[auth-routes.test] TEST_DATABASE_URL unreachable: skipping");

const APP = "http://127.0.0.1:3000";
const REFRESH = "fake-refresh-token-raw";

function setCookies(res: Response): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair!.indexOf("=");
    m.set(pair!.slice(0, i), c);
  }
  return m;
}
function cookieValue(header: string | undefined): string {
  const pair = header!.split(";")[0]!;
  return decodeURIComponent(pair.slice(pair.indexOf("=") + 1));
}

describe.skipIf(!reachable)("auth routes", () => {
  let fake: FakeSpotify;
  let sql: postgres.Sql;
  let restore: () => void;

  beforeAll(async () => {
    fake = await startFakeSpotify();
    restore = useTestEnv({
      SPOTIFY_ACCOUNTS_BASE_URL: fake.url,
      SPOTIFY_API_BASE_URL: fake.url,
      APP_URL: APP,
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://postgres:postgres@127.0.0.1:54322/rulemix_test",
    });
    fake.on("POST", /^\/api\/token$/, () => ({
      body: {
        access_token: "fake-access",
        refresh_token: REFRESH,
        expires_in: 3600,
        scope: SCOPES.join(" "),
      },
    }));
    fake.on("GET", /^\/me$/, () => ({
      body: { id: "spotify-user-1", display_name: "Nishchay" },
    }));
  });
  beforeEach(async () => {
    sql = await resetTestDb();
  });
  afterAll(async () => {
    await getSql().end();
    await sql.end();
    await fake.close();
    restore();
  });

  it("login sets a signed oauth cookie and redirects to authorize with the 4 scopes", () => {
    const res = login();
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(`${loc.origin}${loc.pathname}`).toBe(`${fake.url}/authorize`);
    expect(loc.searchParams.get("scope")!.split(" ").sort()).toEqual([...SCOPES].sort());
    const oauth = setCookies(res).get("rulemix_oauth")!;
    expect(oauth).toMatch(/HttpOnly/i);
    expect(oauth).toMatch(/SameSite=lax/i);
    expect(oauth).toMatch(/Path=\/api\/auth/);
    expect(cookieValue(oauth)).toContain(loc.searchParams.get("state")!);
  });

  it("callback with a bad state redirects to /?error=state", async () => {
    const oauth = sign(JSON.stringify({ state: "good", verifier: "v" }));
    const req = new NextRequest(`${APP}/api/auth/callback?code=c&state=bad`, {
      headers: { cookie: `rulemix_oauth=${encodeURIComponent(oauth)}` },
    });
    const res = await callback(req);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).search).toBe("?error=state");
    const missing = await callback(new NextRequest(`${APP}/api/auth/callback?code=c&state=good`));
    expect(new URL(missing.headers.get("location")!).search).toBe("?error=state");
  });

  it("callback with a Spotify error redirects to /?error=denied", async () => {
    const res = await callback(new NextRequest(`${APP}/api/auth/callback?error=access_denied`));
    expect(new URL(res.headers.get("location")!).search).toBe("?error=denied");
  });

  it("happy callback stores an encrypted refresh token, sets the session and goes to /mixes", async () => {
    const oauth = sign(JSON.stringify({ state: "st", verifier: "ver" }));
    const res = await callback(
      new NextRequest(`${APP}/api/auth/callback?code=the-code&state=st`, {
        headers: { cookie: `rulemix_oauth=${encodeURIComponent(oauth)}` },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${APP}/mixes`);
    const [user] = await sql<{ id: string; refresh_token_encrypted: string; scopes: string }[]>`
      select id, refresh_token_encrypted, scopes from users`;
    expect(user!.id).toBe("spotify-user-1");
    expect(user!.refresh_token_encrypted).not.toContain(REFRESH);
    expect(user!.refresh_token_encrypted.startsWith("v1.")).toBe(true);
    const cookies = setCookies(res);
    const session = cookies.get(SESSION_COOKIE)!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).not.toMatch(/Secure/i);
    expect(await getSessionUser(sql, cookieValue(session))).toEqual({
      id: "spotify-user-1",
      displayName: "Nishchay",
    });
    expect(cookies.get("rulemix_oauth")).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    const tokenCall = fake.calls.find((c) => c.path === "/api/token")!;
    expect(new URLSearchParams(tokenCall.rawBody).get("code_verifier")).toBe("ver");
    for (const v of res.headers.values()) expect(v).not.toContain(REFRESH);
  });

  it("logout clears the cookie and redirects to /", async () => {
    await sql`insert into users (id, refresh_token_encrypted, scopes, authorized_at) values ('u', 'x', 's', now())`;
    const raw = await createSession(sql, "u");
    const res = await logout(
      new NextRequest(`${APP}/api/auth/logout`, {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${raw}` },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${APP}/`);
    expect(setCookies(res).get(SESSION_COOKIE)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(await getSessionUser(sql, raw)).toBeNull();
  });

  it("/api/me returns 401 without a cookie and the user with one", async () => {
    const res = await me(new NextRequest(`${APP}/api/me`));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unauthorized");
    await sql`insert into users (id, display_name, refresh_token_encrypted, scopes, authorized_at) values ('u', 'N', 'x', 's', now())`;
    const raw = await createSession(sql, "u");
    const ok = await me(
      new NextRequest(`${APP}/api/me`, { headers: { cookie: `${SESSION_COOKIE}=${raw}` } }),
    );
    expect(await ok.json()).toEqual({ id: "u", displayName: "N" });
  });
});
