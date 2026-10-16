import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startFakeSpotify, type FakeSpotify } from "../test/fake-spotify.js";
import { createClient, type SpotifyClient } from "./client.js";
import { WRITE_CHUNK, targetName, writeTarget } from "./writer.js";

let fake: FakeSpotify;
let c: SpotifyClient;
let snap = 0;

beforeEach(async () => {
  snap = 0;
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
  fake.on("POST", /^\/v1\/me\/playlists$/, () => ({ status: 201, body: { id: "new1" } }));
  fake.on("PUT", /^\/v1\/playlists\/[^/]+\/items$/, () => ({
    body: { snapshot_id: `s${++snap}` },
  }));
  fake.on("POST", /^\/v1\/playlists\/[^/]+\/items$/, () => ({
    status: 201,
    body: { snapshot_id: `s${++snap}` },
  }));
});
afterEach(() => fake.close());

const uris = (n: number) => Array.from({ length: n }, (_, i) => `spotify:track:t${i}`);
const writes = () =>
  fake.calls
    .filter((x) => x.path.endsWith("/items"))
    .map((x) => [x.method, x.path, (x.json as { uris: string[] }).uris.length]);

describe("targetName", () => {
  it("prefixes Rules:", () => expect(targetName("Gym")).toBe("Rules: Gym"));
});

describe("writeTarget", () => {
  it("creates the playlist when there is no target id", async () => {
    const r = await writeTarget(c, {
      targetPlaylistId: null,
      defaultName: "Rules: Gym",
      uris: uris(3),
    });
    const create = fake.calls.find((x) => x.method === "POST" && x.path === "/v1/me/playlists");
    expect(create?.json).toEqual({
      name: "Rules: Gym",
      public: false,
      description: "Made by rulemix. Play with shuffle off.",
    });
    expect(writes()).toEqual([["PUT", "/v1/playlists/new1/items", 3]]);
    expect(r).toEqual({
      playlistId: "new1",
      snapshotId: "s1",
      created: true,
      recreated: false,
      tracksWritten: 3,
    });
    expect(fake.calls.some((x) => x.path === "/v1/me/library/contains")).toBe(false);
  });

  it("reuses a followed target and checks /me/library/contains", async () => {
    fake.on("GET", /^\/v1\/me\/library\/contains$/, () => ({ body: [true] }));
    const r = await writeTarget(c, {
      targetPlaylistId: "old",
      defaultName: "Rules: Gym",
      uris: uris(2),
    });
    const check = fake.calls.find((x) => x.path === "/v1/me/library/contains");
    expect(check?.query.get("uris")).toBe("spotify:playlist:old");
    expect(fake.calls.some((x) => x.path === "/v1/me/playlists")).toBe(false);
    expect(fake.calls.some((x) => x.path.includes("followers"))).toBe(false);
    expect(writes()).toEqual([["PUT", "/v1/playlists/old/items", 2]]);
    expect(r).toMatchObject({ playlistId: "old", created: false, recreated: false });
  });

  it.each([
    ["404", { status: 404, body: { error: {} } }],
    ["403", { status: 403, body: { error: {} } }],
    ["[false]", { body: [false] }],
  ])("recreates a missing target (%s)", async (_l, resp) => {
    fake.on("GET", /^\/v1\/me\/library\/contains$/, () => resp);
    const r = await writeTarget(c, {
      targetPlaylistId: "gone",
      defaultName: "Rules: Gym",
      uris: uris(1),
    });
    expect(r).toMatchObject({ playlistId: "new1", created: true, recreated: true });
    expect(writes()).toEqual([["PUT", "/v1/playlists/new1/items", 1]]);
  });

  it.each([
    [0, [["PUT", 0]]],
    [99, [["PUT", 99]]],
    [100, [["PUT", 100]]],
    [
      101,
      [
        ["PUT", 100],
        ["POST", 1],
      ],
    ],
    [
      250,
      [
        ["PUT", 100],
        ["POST", 100],
        ["POST", 50],
      ],
    ],
  ])("chunks %i uris", async (n, seq) => {
    const r = await writeTarget(c, { targetPlaylistId: null, defaultName: "x", uris: uris(n) });
    expect(writes().map(([m, , len]) => [m, len])).toEqual(seq);
    expect(r.snapshotId).toBe(`s${seq.length}`);
    expect(r.tracksWritten).toBe(n);
    expect(WRITE_CHUNK).toBe(100);
  });

  it("sends chunks in order and duplicates unchanged", async () => {
    const list = [...uris(150), "spotify:track:t0", "spotify:track:t0"];
    await writeTarget(c, { targetPlaylistId: null, defaultName: "x", uris: list });
    const sent = fake.calls
      .filter((x) => x.path.endsWith("/items"))
      .flatMap((x) => (x.json as { uris: string[] }).uris);
    expect(sent).toEqual(list);
  });

  it("reports progress after each chunk", async () => {
    const p: [number, number][] = [];
    await writeTarget(c, {
      targetPlaylistId: null,
      defaultName: "x",
      uris: uris(250),
      onProgress: (d, t) => p.push([d, t]),
    });
    expect(p).toEqual([
      [100, 250],
      [200, 250],
      [250, 250],
    ]);
  });
});
