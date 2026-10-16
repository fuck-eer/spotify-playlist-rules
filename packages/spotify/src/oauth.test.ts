import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startFakeSpotify, type FakeSpotify } from "../test/fake-spotify.js";
import type { SpotifyConfig } from "./config.js";
import { SpotifyAuthError } from "./errors.js";
import { buildAuthorizeUrl, exchangeCode, refreshAccessToken } from "./oauth.js";

let fake: FakeSpotify;
let cfg: SpotifyConfig;

beforeEach(async () => {
  fake = await startFakeSpotify();
  cfg = {
    clientId: "cid",
    clientSecret: "csecret",
    redirectUri: "http://127.0.0.1:3000/api/auth/callback",
    accountsBaseUrl: fake.url,
    apiBaseUrl: `${fake.url}/v1`,
  };
});
afterEach(async () => {
  vi.useRealTimers();
  await fake.close();
});

describe("buildAuthorizeUrl", () => {
  it("has exactly the PKCE authorize params", () => {
    const u = new URL(buildAuthorizeUrl(cfg, { state: "st", challenge: "ch" }));
    expect(`${u.origin}${u.pathname}`).toBe(`${fake.url}/authorize`);
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: "cid",
      response_type: "code",
      redirect_uri: "http://127.0.0.1:3000/api/auth/callback",
      state: "st",
      code_challenge_method: "S256",
      code_challenge: "ch",
      scope: "playlist-read-private playlist-read-collaborative playlist-modify-private user-library-read",
    });
  });
});

describe("exchangeCode", () => {
  it("posts the code with Basic auth and maps expires_in to expiresAt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
    fake.on("POST", /^\/api\/token$/, () => ({
      body: { access_token: "AT", refresh_token: "RT", expires_in: 3600, scope: "s1 s2" },
    }));
    const t = await exchangeCode(cfg, { code: "the-code", verifier: "ver" });
    expect(t).toEqual({ accessToken: "AT", refreshToken: "RT", expiresAt: 1_000_000 + 3_600_000, scope: "s1 s2" });
    const call = fake.calls[0]!;
    expect(call.headers.authorization).toBe(`Basic ${Buffer.from("cid:csecret").toString("base64")}`);
    expect(call.headers["content-type"]).toContain("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(call.rawBody))).toEqual({
      grant_type: "authorization_code",
      code: "the-code",
      redirect_uri: "http://127.0.0.1:3000/api/auth/callback",
      code_verifier: "ver",
    });
  });
});

describe("refreshAccessToken", () => {
  it("keeps the old refresh token when the response omits it", async () => {
    fake.on("POST", /^\/api\/token$/, () => ({ body: { access_token: "AT2", expires_in: 3600, scope: "s" } }));
    const t = await refreshAccessToken(cfg, "OLD_RT");
    expect(t.accessToken).toBe("AT2");
    expect(t.refreshToken).toBe("OLD_RT");
    expect(Object.fromEntries(new URLSearchParams(fake.calls[0]!.rawBody))).toEqual({
      grant_type: "refresh_token",
      refresh_token: "OLD_RT",
    });
  });

  it("uses a rotated refresh token when one is returned", async () => {
    fake.on("POST", /^\/api\/token$/, () => ({ body: { access_token: "AT2", refresh_token: "NEW", expires_in: 1, scope: "s" } }));
    expect((await refreshAccessToken(cfg, "OLD_RT")).refreshToken).toBe("NEW");
  });

  it("throws SpotifyAuthError on invalid_grant", async () => {
    fake.on("POST", /^\/api\/token$/, () => ({
      status: 400,
      body: { error: "invalid_grant", error_description: "Refresh token revoked" },
    }));
    await expect(refreshAccessToken(cfg, "RT")).rejects.toBeInstanceOf(SpotifyAuthError);
  });
});
