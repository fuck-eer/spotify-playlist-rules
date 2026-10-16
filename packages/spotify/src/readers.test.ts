import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startFakeSpotify, type FakeSpotify } from "../test/fake-spotify.js";
import { createClient, type SpotifyClient } from "./client.js";
import {
  getMe,
  getSourceTrackCount,
  listSources,
  readLikedSongs,
  readPlaylistItems,
} from "./readers.js";

let fake: FakeSpotify;
let c: SpotifyClient;

beforeEach(async () => {
  fake = await startFakeSpotify();
  c = createClient(
    {
      clientId: "c",
      clientSecret: "s",
      redirectUri: "r",
      accountsBaseUrl: fake.url,
      apiBaseUrl: `${fake.url}/v1`,
    },
    {
      get: () =>
        Promise.resolve({
          accessToken: "AT",
          refreshToken: "RT",
          expiresAt: Date.now() + 3_600_000,
          scope: "",
        }),
      set: () => Promise.resolve(),
    },
  );
});
afterEach(() => fake.close());

const track = (i: number) => ({
  uri: `spotify:track:t${i}`,
  name: `Song ${i}`,
  type: "track",
  artists: [{ name: "A" }, { name: "B" }],
});

function servePages(path: RegExp, all: unknown[]): void {
  fake.on("GET", path, (req) => {
    const offset = Number(req.query.get("offset") ?? 0);
    const limit = Number(req.query.get("limit") ?? 20);
    const items = all.slice(offset, offset + limit);
    return {
      body: { total: all.length, next: offset + limit < all.length ? "more" : null, items },
    };
  });
}

describe("getMe", () => {
  it("maps id, account_id and display_name", async () => {
    fake.on("GET", /^\/v1\/me$/, () => ({
      body: { id: "u1", account_id: "acc", display_name: "Nish" },
    }));
    expect(await getMe(c)).toEqual({ id: "u1", accountId: "acc", displayName: "Nish" });
  });
  it("uses null when account_id and display_name are missing", async () => {
    fake.on("GET", /^\/v1\/me$/, () => ({ body: { id: "u1", display_name: null } }));
    expect(await getMe(c)).toEqual({ id: "u1", accountId: null, displayName: null });
  });
});

describe("readPlaylistItems", () => {
  it("pages 120 items in 3 calls of 50 and reports progress", async () => {
    servePages(
      /^\/v1\/playlists\/pl1\/items$/,
      Array.from({ length: 120 }, (_, i) => ({ is_local: false, item: track(i) })),
    );
    const progress: [number, number][] = [];
    const out = await readPlaylistItems(c, "pl1", (d, t) => progress.push([d, t]));
    expect(out).toHaveLength(120);
    expect(out[119]).toEqual({ uri: "spotify:track:t119", name: "Song 119", artists: ["A", "B"] });
    const calls = fake.calls.filter((x) => x.path === "/v1/playlists/pl1/items");
    expect(calls.map((x) => [x.query.get("limit"), x.query.get("offset")])).toEqual([
      ["50", "0"],
      ["50", "50"],
      ["50", "100"],
    ]);
    expect(calls[0]!.query.get("fields")).toBe(
      "total,next,items(is_local,item(uri,name,type,artists(name)),track(uri,name,type,artists(name)))",
    );
    expect(progress).toEqual([
      [50, 120],
      [100, 120],
      [120, 120],
    ]);
  });

  it("maps missing, local, episode and null-uri entries to null and falls back to track", async () => {
    servePages(/^\/v1\/playlists\/pl2\/items$/, [
      { is_local: false, item: null },
      { is_local: true, item: { ...track(1), uri: "spotify:local:x" } },
      {
        is_local: false,
        item: { uri: "spotify:episode:e", name: "Ep", type: "episode", artists: [] },
      },
      { is_local: false, item: { ...track(2), uri: null } },
      { is_local: false, track: track(3) },
      { is_local: false, item: track(4) },
    ]);
    expect(await readPlaylistItems(c, "pl2")).toEqual([
      null,
      null,
      null,
      null,
      { uri: "spotify:track:t3", name: "Song 3", artists: ["A", "B"] },
      { uri: "spotify:track:t4", name: "Song 4", artists: ["A", "B"] },
    ]);
  });

  it("handles an empty playlist", async () => {
    servePages(/^\/v1\/playlists\/pl3\/items$/, []);
    expect(await readPlaylistItems(c, "pl3")).toEqual([]);
  });
});

describe("readLikedSongs", () => {
  it("pages /me/tracks with the same mapping", async () => {
    servePages(/^\/v1\/me\/tracks$/, [
      { track: track(1) },
      { track: null },
      ...Array.from({ length: 50 }, (_, i) => ({ track: track(i + 10) })),
    ]);
    const progress: [number, number][] = [];
    const out = await readLikedSongs(c, (d, t) => progress.push([d, t]));
    expect(out).toHaveLength(52);
    expect(out[0]).toEqual({ uri: "spotify:track:t1", name: "Song 1", artists: ["A", "B"] });
    expect(out[1]).toBeNull();
    expect(progress).toEqual([
      [50, 52],
      [52, 52],
    ]);
  });
});

describe("listSources", () => {
  it("puts Liked first, keeps owned and collaborative playlists, hides followed ones", async () => {
    fake.on("GET", /^\/v1\/me\/tracks$/, () => ({ body: { total: 321, items: [] } }));
    fake.on("GET", /^\/v1\/me$/, () => ({ body: { id: "me", display_name: "Nish" } }));
    const pl = (id: string, owner: string, collaborative: boolean, extra: object) => ({
      id,
      name: `P ${id}`,
      collaborative,
      owner: { id: owner, display_name: `${owner} name` },
      ...extra,
    });
    const all = [
      pl("own", "me", false, { items: { total: 10 }, images: [{ url: "img" }] }),
      pl("followed", "other", false, { items: { total: 5 }, images: [] }),
      pl("collab", "other", true, { tracks: { total: 7 }, images: null }),
      ...Array.from({ length: 50 }, (_, i) => pl(`x${i}`, "me", false, { items: { total: i } })),
    ];
    servePages(/^\/v1\/me\/playlists$/, all);
    const out = await listSources(c, "me");
    expect(out[0]).toEqual({
      type: "liked",
      id: null,
      name: "Liked Songs",
      trackCount: 321,
      imageUrl: null,
      ownerName: "Nish",
    });
    expect(out[1]).toEqual({
      type: "playlist",
      id: "own",
      name: "P own",
      trackCount: 10,
      imageUrl: "img",
      ownerName: "me name",
    });
    expect(out[2]).toEqual({
      type: "playlist",
      id: "collab",
      name: "P collab",
      trackCount: 7,
      imageUrl: null,
      ownerName: "other name",
    });
    expect(out.map((s) => s.id)).not.toContain("followed");
    expect(out).toHaveLength(1 + 2 + 50);
    expect(fake.calls.find((x) => x.path === "/v1/me/tracks")!.query.get("limit")).toBe("1");
    expect(
      fake.calls.filter((x) => x.path === "/v1/me/playlists").map((x) => x.query.get("offset")),
    ).toEqual(["0", "50"]);
  });
});

describe("getSourceTrackCount", () => {
  it("reads a playlist's items.total, falling back to tracks.total", async () => {
    fake.on("GET", /^\/v1\/playlists\/a$/, () => ({ body: { items: { total: 42 } } }));
    fake.on("GET", /^\/v1\/playlists\/b$/, () => ({ body: { tracks: { total: 9 } } }));
    expect(await getSourceTrackCount(c, { type: "playlist", id: "a" })).toBe(42);
    expect(await getSourceTrackCount(c, { type: "playlist", id: "b" })).toBe(9);
    expect(fake.calls[0]!.query.get("fields")).toBe("items(total),tracks(total)");
  });
  it("reads Liked Songs' total", async () => {
    fake.on("GET", /^\/v1\/me\/tracks$/, () => ({ body: { total: 600, items: [] } }));
    expect(await getSourceTrackCount(c, { type: "liked", id: null })).toBe(600);
  });
});
