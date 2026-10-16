import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startFakeSpotify, type FakeSpotify } from "../test/fake-spotify.js";
import { createClient, type TokenStore } from "./client.js";
import type { SpotifyConfig } from "./config.js";
import {
  SpotifyAuthError,
  SpotifyForbiddenError,
  SpotifyHttpError,
  SpotifyNotFoundError,
  SpotifyRateLimitError,
} from "./errors.js";
import type { TokenSet } from "./oauth.js";

let fake: FakeSpotify;
let cfg: SpotifyConfig;
let sleep: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>;

function memoryStore(t: TokenSet): TokenStore & { saved: TokenSet[] } {
  let cur = t;
  const saved: TokenSet[] = [];
  return {
    saved,
    get: () => Promise.resolve(cur),
    set: (n) => {
      cur = n;
      saved.push(n);
      return Promise.resolve();
    },
  };
}
const fresh = (): TokenSet => ({
  accessToken: "AT1",
  refreshToken: "RT",
  expiresAt: Date.now() + 3_600_000,
  scope: "",
});

beforeEach(async () => {
  fake = await startFakeSpotify();
  sleep = vi.fn((ms: number) => (void ms, Promise.resolve()));
  cfg = {
    clientId: "c",
    clientSecret: "s",
    redirectUri: "r",
    accountsBaseUrl: fake.url,
    apiBaseUrl: `${fake.url}/v1`,
    sleep,
  };
  fake.on("POST", /^\/api\/token$/, () => ({
    body: { access_token: "AT2", expires_in: 3600, scope: "" },
  }));
});
afterEach(() => fake.close());

const apiCalls = () => fake.calls.filter((c) => c.path.startsWith("/v1"));

describe("createClient", () => {
  it("sends the bearer token to a path relative to apiBaseUrl, query allowed", async () => {
    fake.on("GET", /^\/v1\/me$/, () => ({ body: { id: "u" } }));
    const c = createClient(cfg, memoryStore(fresh()));
    const r = await c.request<{ id: string }>("GET", "/me?x=1");
    expect(r).toEqual({ status: 200, data: { id: "u" } });
    expect(apiCalls()[0]!.headers.authorization).toBe("Bearer AT1");
    expect(apiCalls()[0]!.query.get("x")).toBe("1");
    expect(c.stats.requests).toBe(1);
  });

  it("sends a JSON body", async () => {
    fake.on("POST", /^\/v1\/x$/, (req) => ({ status: 201, body: req.json }));
    const r = await createClient(cfg, memoryStore(fresh())).request("POST", "/x", { a: 1 });
    expect(r).toEqual({ status: 201, data: { a: 1 } });
  });

  it("refreshes proactively when the token expires within 60 s, and saves it", async () => {
    fake.on("GET", /^\/v1\/me$/, () => ({ body: {} }));
    const store = memoryStore({ ...fresh(), expiresAt: Date.now() + 30_000 });
    await createClient(cfg, store).request("GET", "/me");
    expect(store.saved.map((t) => t.accessToken)).toEqual(["AT2"]);
    expect(apiCalls()[0]!.headers.authorization).toBe("Bearer AT2");
  });

  it("on 401 refreshes once and retries", async () => {
    fake.on("GET", /^\/v1\/me$/, (req) =>
      req.headers.authorization === "Bearer AT2"
        ? { body: { ok: true } }
        : { status: 401, body: {} },
    );
    const store = memoryStore(fresh());
    const r = await createClient(cfg, store).request("GET", "/me");
    expect(r.data).toEqual({ ok: true });
    expect(apiCalls()).toHaveLength(2);
    expect(store.saved).toHaveLength(1);
  });

  it("throws SpotifyAuthError on a second 401", async () => {
    fake.on("GET", /^\/v1\/me$/, () => ({ status: 401, body: {} }));
    await expect(
      createClient(cfg, memoryStore(fresh())).request("GET", "/me"),
    ).rejects.toBeInstanceOf(SpotifyAuthError);
    expect(apiCalls()).toHaveLength(2);
  });

  it("waits Retry-After on 429, then succeeds", async () => {
    let n = 0;
    fake.on("GET", /^\/v1\/me$/, () =>
      n++ === 0 ? { status: 429, headers: { "retry-after": "2" } } : { body: { ok: 1 } },
    );
    const c = createClient(cfg, memoryStore(fresh()));
    expect((await c.request("GET", "/me")).data).toEqual({ ok: 1 });
    expect(sleep.mock.calls).toEqual([[2000]]);
    expect(c.stats.retries429).toBe(1);
  });

  it("defaults to 1 s without Retry-After and gives up after 5 retries", async () => {
    fake.on("GET", /^\/v1\/me$/, () => ({ status: 429 }));
    const c = createClient(cfg, memoryStore(fresh()));
    await expect(c.request("GET", "/me")).rejects.toBeInstanceOf(SpotifyRateLimitError);
    expect(apiCalls()).toHaveLength(6);
    expect(c.stats.retries429).toBe(5);
    expect(sleep.mock.calls.map((a) => a[0])).toEqual([1000, 1000, 1000, 1000, 1000]);
  });

  it.each([
    [403, SpotifyForbiddenError],
    [404, SpotifyNotFoundError],
    [500, SpotifyHttpError],
  ])("maps %i to its error class with status and body", async (status, cls) => {
    fake.on("GET", /^\/v1\/p$/, () => ({ status, body: { error: { status } } }));
    const err: unknown = await createClient(cfg, memoryStore(fresh()))
      .request("GET", "/p")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(cls);
    expect(err).toMatchObject({ status, body: { error: { status } } });
  });

  it("returns null data for 204", async () => {
    fake.on("DELETE", /^\/v1\/p$/, () => ({ status: 204 }));
    expect(await createClient(cfg, memoryStore(fresh())).request("DELETE", "/p")).toEqual({
      status: 204,
      data: null,
    });
  });
});
